import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import PartPicker from "@/components/PartPicker";
import PeopleEditor from "@/components/PeopleEditor";
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

function toLocalInput(ts: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function EditAsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: t }, { data: parts }] = await Promise.all([
    supabase.from("as_tickets").select("*").eq("id", id).single(),
    supabase
      .from("parts")
      .select("id, name, model, favorite, as_type, stock, note, category")
      .order("name"),
  ]);

  if (!t) {
    return (
      <div>
        <p className="text-ink-3">해당 A/S 접수를 찾을 수 없습니다.</p>
        <Link href="/as" className="text-accent font-semibold">
          ← A/S 목록으로
        </Link>
      </div>
    );
  }

  async function updateTicket(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("as_tickets")
      .update({
        reporters: parseJson(formData.get("reporters")),
        photos_before: parseJson(formData.get("photos_before")),
        photos_after: parseJson(formData.get("photos_after")),
        photos_f1: parseJson(formData.get("photos_f1")),
        photos_f2: parseJson(formData.get("photos_f2")),
        photos_f3: parseJson(formData.get("photos_f3")),
        customer_comment: String(formData.get("customer_comment") || ""),
        symptom: String(formData.get("symptom") || ""),
        fix_comment: String(formData.get("fix_comment") || ""),
        parts: String(formData.get("parts") || ""),
        ship: String(formData.get("ship") || ""),
        manager: String(formData.get("manager") || ""),
        priority: String(formData.get("priority") || "진행중"),
        repair_by: String(formData.get("repair_by") || "본사"),
        repair_dealer: String(formData.get("repair_dealer") || ""),
        visited_at: formData.get("visited_at")
          ? new Date(String(formData.get("visited_at"))).toISOString()
          : null,
      })
      .eq("id", id);
    await logAudit("수정", "A/S", `${t?.serial ?? id} · ${t?.hospital_name ?? ""}`);
    revalidatePath("/as");
    revalidatePath("/");
    redirect("/as");
  }

  async function deleteTicket() {
    "use server";
    const supabase = await createClient();
    await supabase.from("as_tickets").delete().eq("id", id);
    await logAudit("삭제", "A/S", `${t?.serial ?? id} · ${t?.hospital_name ?? ""}`);
    revalidatePath("/as");
    revalidatePath("/");
    redirect("/as");
  }

  return (
    <div className="max-w-[640px]">
      <Link href="/as" className="text-[13px] text-accent font-semibold">
        ← A/S 목록으로
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-1">A/S 수정</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        <span className="font-mono font-semibold">{t.serial}</span> ·{" "}
        {t.hospital_name}
      </p>

      <form
        action={updateTicket}
        className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-3.5"
      >
        <div>
          <label className={labelCls}>
            접수자 (병원측 · 여러 명)
          </label>
          <PeopleEditor
            name="reporters"
            defaultValue={JSON.stringify(t.reporters ?? [])}
            addLabel="＋ 접수자 추가"
          />
        </div>
        <div>
          <label className={labelCls}>증상 / 원인</label>
          <textarea
            name="symptom"
            rows={2}
            defaultValue={t.symptom ?? ""}
            className={inputCls + " h-auto py-2"}
          />
        </div>
        <div>
          <label className={labelCls}>수리 내용 · 사유 (사내 코멘트)</label>
          <textarea
            name="fix_comment"
            rows={3}
            defaultValue={t.fix_comment ?? ""}
            className={inputCls + " h-auto py-2"}
            placeholder="어떻게 수리했고 왜 필요했는지 · 재발 방지 조치"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>담당자</label>
            <input
              name="manager"
              defaultValue={t.manager ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>수리 주체</label>
            <select name="repair_by" defaultValue={t.repair_by ?? "본사"} className={inputCls}>
              <option>본사</option>
              <option>대리점</option>
              <option>제3업체</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>대리점/업체명 (해당 시)</label>
            <input
              name="repair_dealer"
              defaultValue={t.repair_dealer ?? ""}
              className={inputCls}
              placeholder="영남지사 등"
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>
              교체 부품 (즐겨찾기 우선 · 여러 개 · 수량)
            </label>
            <PartPicker
              parts={(parts ?? []) as any}
              name="parts"
              defaultValue={t.parts ?? ""}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>방문일시</label>
            <input
              name="visited_at"
              type="datetime-local"
              defaultValue={toLocalInput(t.visited_at)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>상태</label>
            <select
              name="priority"
              defaultValue={t.priority ?? "진행중"}
              className={inputCls}
            >
              <option>긴급</option>
              <option>진행중</option>
              <option>원격</option>
              <option>완료</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>부품 택배 발송 (지방)</label>
          <input name="ship" defaultValue={t.ship ?? ""} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>소비자 코멘트 (고객 반응)</label>
          <textarea
            name="customer_comment"
            rows={2}
            defaultValue={t.customer_comment ?? ""}
            className={inputCls + " h-auto py-2"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>진행 전 사진</label>
            <PhotoUpload
              name="photos_before"
              defaultValue={JSON.stringify(t.photos_before ?? [])}
            />
          </div>
          <div>
            <label className={labelCls}>진행 후 사진</label>
            <PhotoUpload
              name="photos_after"
              defaultValue={JSON.stringify(t.photos_after ?? [])}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>층별 점검 사진 (1·2·3층)</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div>
              <div className="text-[11px] text-ink-3 mb-1">1층</div>
              <PhotoUpload
                name="photos_f1"
                defaultValue={JSON.stringify(t.photos_f1 ?? [])}
              />
            </div>
            <div>
              <div className="text-[11px] text-ink-3 mb-1">2층</div>
              <PhotoUpload
                name="photos_f2"
                defaultValue={JSON.stringify(t.photos_f2 ?? [])}
              />
            </div>
            <div>
              <div className="text-[11px] text-ink-3 mb-1">3층</div>
              <PhotoUpload
                name="photos_f3"
                defaultValue={JSON.stringify(t.photos_f3 ?? [])}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            type="submit"
            className="h-10 px-5 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
          >
            저장
          </button>
          <Link
            href="/as"
            className="h-10 px-4 grid place-items-center rounded-lg border border-line text-[14px] text-ink-2 hover:bg-surface-2"
          >
            취소
          </Link>
          <button
            formAction={deleteTicket}
            className="ml-auto h-10 px-4 rounded-lg border border-line text-[13px] text-[color:var(--crit-ink)] hover:bg-[color:var(--crit-bg)]"
          >
            삭제
          </button>
        </div>
      </form>
    </div>
  );
}
