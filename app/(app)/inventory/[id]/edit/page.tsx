import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import PhotoUpload from "@/components/PhotoUpload";

export const dynamic = "force-dynamic";

function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v || "[]"));
  } catch {
    return [];
  }
}

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

function n(v: FormDataEntryValue | null) {
  const x = parseInt(String(v ?? "0"), 10);
  return Number.isFinite(x) ? x : 0;
}

export default async function EditPartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("parts")
    .select("*")
    .eq("id", id)
    .single();
  const { data: quotesRaw } = await supabase
    .from("part_quotes")
    .select("*")
    .eq("part", p?.name ?? "")
    .order("price");
  const quotes = (quotesRaw ?? []) as any[];

  if (!p) {
    return (
      <div>
        <p className="text-ink-3">해당 부품을 찾을 수 없습니다.</p>
        <Link href="/inventory" className="text-accent font-semibold">
          ← 재고·생산으로
        </Link>
      </div>
    );
  }

  async function updatePart(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("parts")
      .update({
        name: String(formData.get("name") || "").trim(),
        model: String(formData.get("model") || "공용"),
        vendor: String(formData.get("vendor") || ""),
        buy_url: String(formData.get("buy_url") || ""),
        price: n(formData.get("price")),
        per_unit: n(formData.get("per_unit")),
        stock: n(formData.get("stock")),
        floor1: n(formData.get("floor1")),
        floor2: n(formData.get("floor2")),
        floor3: n(formData.get("floor3")),
        toolbox: n(formData.get("toolbox")),
        as_type: String(formData.get("as_type") || ""),
        category: String(formData.get("category") || ""),
        note: String(formData.get("note") || ""),
        unit: String(formData.get("unit") || "개"),
        favorite: formData.get("favorite") === "on",
        docs: parseJson(formData.get("docs")),
      })
      .eq("id", id);
    await logAudit("수정", "부품", p?.name ?? id);
    revalidatePath("/inventory");
    redirect("/inventory");
  }

  // 원가 비교 견적 추가
  async function addQuote(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const vendor = String(formData.get("q_vendor") || "").trim();
    if (!vendor) return;
    await supabase.from("part_quotes").insert({
      part: String(formData.get("q_part") || ""),
      vendor,
      price: parseInt(String(formData.get("q_price") || "0"), 10) || 0,
      link: String(formData.get("q_link") || ""),
      note: String(formData.get("q_note") || ""),
    });
    revalidatePath(`/inventory/${id}/edit`);
  }

  async function deletePart() {
    "use server";
    const supabase = await createClient();
    await supabase.from("parts").delete().eq("id", id);
    await logAudit("삭제", "부품", p?.name ?? id);
    revalidatePath("/inventory");
    redirect("/inventory");
  }

  return (
    <div className="max-w-[600px]">
      <Link href="/inventory" className="text-[13px] text-accent font-semibold">
        ← 재고·생산으로
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-4">부품 수정</h1>

      <form
        action={updatePart}
        className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-3.5"
      >
        <div>
          <label className={labelCls}>부품명</label>
          <input name="name" defaultValue={p.name} className={inputCls} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>모델</label>
            <select name="model" defaultValue={p.model ?? "공용"} className={inputCls}>
              <option>공용</option>
              <option>OS2</option>
              <option>OS1</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>A/S 구분</label>
            <select
              name="as_type"
              defaultValue={p.as_type ?? ""}
              className={inputCls}
            >
              <option value="">해당 없음</option>
              <option>교체 대상</option>
              <option>정기점검</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>분류</label>
            <input
              name="category"
              defaultValue={p.category ?? ""}
              className={inputCls}
              list="catList"
              placeholder="피팅류"
            />
          </div>
          <div>
            <label className={labelCls}>단위</label>
            <input
              name="unit"
              defaultValue={p.unit ?? "개"}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>비고 (자재 설명)</label>
          <input
            name="note"
            defaultValue={p.note ?? ""}
            className={inputCls}
            placeholder="예: 급수모터 T피팅"
          />
        </div>
        <datalist id="catList">
          {[
            "1단", "2단", "3단", "소독조", "소독조 피팅류", "뚜껑", "PCB판",
            "케이스", "피팅류", "PP부품류", "신주 니플류", "PVC 니플류",
            "호스류", "패널류", "기타",
          ].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>구매처</label>
            <input name="vendor" defaultValue={p.vendor ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>단가(원)</label>
            <input
              name="price"
              type="number"
              defaultValue={p.price ?? 0}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>구매 링크</label>
          <input name="buy_url" defaultValue={p.buy_url ?? ""} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>1기당 소요</label>
            <input
              name="per_unit"
              type="number"
              defaultValue={p.per_unit ?? 0}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>현재고</label>
            <input
              name="stock"
              type="number"
              defaultValue={p.stock ?? 0}
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className={labelCls}>1층</label>
            <input name="floor1" type="number" defaultValue={p.floor1 ?? 0} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>2층</label>
            <input name="floor2" type="number" defaultValue={p.floor2 ?? 0} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>3층</label>
            <input name="floor3" type="number" defaultValue={p.floor3 ?? 0} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>공구함</label>
            <input name="toolbox" type="number" defaultValue={p.toolbox ?? 0} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input
            name="favorite"
            type="checkbox"
            defaultChecked={!!p.favorite}
            className="w-4 h-4"
          />
          즐겨찾기 (A/S에서 위에 표시)
        </label>

        <div>
          <label className={labelCls}>인증 서류 첨부 (이미지·PDF)</label>
          <PhotoUpload
            name="docs"
            defaultValue={JSON.stringify(p.docs ?? [])}
            accept="image/*,application/pdf"
          />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            type="submit"
            className="h-10 px-5 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
          >
            저장
          </button>
          <Link
            href="/inventory"
            className="h-10 px-4 grid place-items-center rounded-lg border border-line text-[14px] text-ink-2 hover:bg-surface-2"
          >
            취소
          </Link>
          <button
            formAction={deletePart}
            className="ml-auto h-10 px-4 rounded-lg border border-line text-[13px] text-[color:var(--crit-ink)] hover:bg-[color:var(--crit-bg)]"
          >
            삭제
          </button>
        </div>
      </form>

      {/* 신규 부품 원가 비교 */}
      <div className="bg-surface border border-line rounded-xl p-5 mt-4">
        <h2 className="font-bold text-[14px] mb-1">원가 비교 (견적)</h2>
        <p className="text-[11.5px] text-ink-3 mb-3">
          새 업체 문의가 오면 견적을 등록해 현재 단가({p.price?.toLocaleString()}
          원)와 비교하세요.
        </p>

        <div className="flex flex-col divide-y divide-line-2 mb-3">
          {quotes.map((q) => {
            const diff = (q.price ?? 0) - (p.price ?? 0);
            return (
              <div key={q.id} className="py-2.5 flex items-center gap-2.5 flex-wrap">
                <span className="text-[13px] font-semibold">{q.vendor}</span>
                <span className="text-[13px] tabular-nums">
                  {q.price?.toLocaleString()}원
                </span>
                <span
                  className={
                    "text-[11.5px] font-semibold px-2 py-0.5 rounded-full " +
                    (diff < 0
                      ? "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]"
                      : diff > 0
                        ? "bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]"
                        : "bg-surface-2 text-ink-2")
                  }
                >
                  {diff < 0
                    ? `${Math.abs(diff).toLocaleString()}원 저렴`
                    : diff > 0
                      ? `${diff.toLocaleString()}원 비쌈`
                      : "동일"}
                </span>
                {q.note && (
                  <span className="text-[11.5px] text-ink-3">· {q.note}</span>
                )}
                {q.link && (
                  <a
                    href={q.link}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-[12px] font-semibold text-accent hover:underline"
                  >
                    링크 →
                  </a>
                )}
              </div>
            );
          })}
          {quotes.length === 0 && (
            <p className="text-[12.5px] text-ink-3 py-2">
              등록된 견적이 없습니다.
            </p>
          )}
        </div>

        <form action={addQuote} className="flex flex-wrap gap-2 items-end">
          <input type="hidden" name="q_part" value={p.name} />
          <div className="flex-1 min-w-[110px]">
            <label className={labelCls}>업체</label>
            <input name="q_vendor" className={inputCls} placeholder="업체명" required />
          </div>
          <div className="w-28">
            <label className={labelCls}>단가(원)</label>
            <input name="q_price" type="number" className={inputCls} defaultValue={0} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className={labelCls}>링크</label>
            <input name="q_link" className={inputCls} placeholder="https://..." />
          </div>
          <div className="flex-1 min-w-[100px]">
            <label className={labelCls}>메모</label>
            <input name="q_note" className={inputCls} placeholder="비고" />
          </div>
          <button className="h-9 px-4 rounded-lg bg-accent text-white font-semibold text-[13px] hover:bg-accent-2">
            견적 추가
          </button>
        </form>
      </div>
    </div>
  );
}
