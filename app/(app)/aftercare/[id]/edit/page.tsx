import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PhotoUpload from "@/components/PhotoUpload";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v || "[]"));
  } catch {
    return [];
  }
}

export default async function EditAftercare({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("aftercare")
    .select("*")
    .eq("id", id)
    .single();

  if (!r) {
    return (
      <div>
        <p className="text-ink-3">기록을 찾을 수 없습니다.</p>
        <Link href="/aftercare" className="text-accent font-semibold">
          ← 대리점 사후관리로
        </Link>
      </div>
    );
  }

  async function update(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("aftercare")
      .update({
        dealer: String(formData.get("dealer") || ""),
        hospital: String(formData.get("hospital") || ""),
        serial: String(formData.get("serial") || ""),
        type: String(formData.get("type") || "정기점검"),
        visit_date: formData.get("visit_date")
          ? String(formData.get("visit_date"))
          : null,
        checked: String(formData.get("checked") || ""),
        replaced: String(formData.get("replaced") || ""),
        photos: parseJson(formData.get("photos")),
        status: String(formData.get("status") || "완료"),
        part_sent: formData.get("part_sent") === "on",
        part_sent_note: String(formData.get("part_sent_note") || ""),
        note: String(formData.get("note") || ""),
      })
      .eq("id", id);
    revalidatePath("/aftercare");
    redirect("/aftercare");
  }

  async function del() {
    "use server";
    const supabase = await createClient();
    await supabase.from("aftercare").delete().eq("id", id);
    revalidatePath("/aftercare");
    redirect("/aftercare");
  }

  return (
    <div className="max-w-[600px]">
      <Link href="/aftercare" className="text-[13px] text-accent font-semibold">
        ← 대리점 사후관리로
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-4">사후관리 기록 수정</h1>

      <form
        action={update}
        className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-3.5"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>유형</label>
            <select name="type" defaultValue={r.type ?? "정기점검"} className={inputCls}>
              <option>정기점검</option>
              <option>A/S</option>
              <option>납품</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>상태</label>
            <select name="status" defaultValue={r.status ?? "완료"} className={inputCls}>
              <option>완료</option>
              <option>예정</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>대리점</label>
            <input name="dealer" defaultValue={r.dealer ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>방문일</label>
            <input name="visit_date" type="date" defaultValue={r.visit_date ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>병원</label>
            <input name="hospital" defaultValue={r.hospital ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>기기 고유번호</label>
            <input name="serial" defaultValue={r.serial ?? ""} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>점검 사항</label>
          <textarea name="checked" rows={2} defaultValue={r.checked ?? ""} className={inputCls + " h-auto py-2"} />
        </div>
        <div>
          <label className={labelCls}>교체 사항</label>
          <textarea name="replaced" rows={2} defaultValue={r.replaced ?? ""} className={inputCls + " h-auto py-2"} />
        </div>
        <div>
          <label className={labelCls}>사진 (점검·납품 환경)</label>
          <PhotoUpload name="photos" defaultValue={JSON.stringify(r.photos ?? [])} />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input
            name="part_sent"
            type="checkbox"
            defaultChecked={!!r.part_sent}
            className="w-4 h-4"
          />
          고장 부품 본사 발송
        </label>
        <div>
          <label className={labelCls}>발송 부품 / 방법 (해당 시)</label>
          <input
            name="part_sent_note"
            defaultValue={r.part_sent_note ?? ""}
            className={inputCls}
            placeholder="예: 급수 호스 · 택배 송장 0000"
          />
        </div>
        <div>
          <label className={labelCls}>메모</label>
          <input name="note" defaultValue={r.note ?? ""} className={inputCls} />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            type="submit"
            className="h-10 px-5 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
          >
            저장
          </button>
          <Link
            href="/aftercare"
            className="h-10 px-4 grid place-items-center rounded-lg border border-line text-[14px] text-ink-2 hover:bg-surface-2"
          >
            취소
          </Link>
          <button
            formAction={del}
            className="ml-auto h-10 px-4 rounded-lg border border-line text-[13px] text-[color:var(--crit-ink)] hover:bg-[color:var(--crit-bg)]"
          >
            삭제
          </button>
        </div>
      </form>
    </div>
  );
}
