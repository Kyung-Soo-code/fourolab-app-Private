import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { ALL_KEYS, filledCount } from "@/lib/checklistItems";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

async function createChecklist(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const serial = String(formData.get("serial") || "").trim();
  const { data } = await supabase
    .from("checklists")
    .insert({
      serial,
      model: String(formData.get("model") || "OS2"),
      purpose: String(formData.get("purpose") || "납품용"),
      hospital: String(formData.get("hospital") || ""),
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  await logAudit("등록", "체크리스트", `${serial} 생성`);
  revalidatePath("/checklist");
  if (data?.id) redirect(`/checklist/${data.id}`);
}

export default async function ChecklistPage() {
  const supabase = await createClient();
  const [{ data: listRaw }, { data: devRaw }] = await Promise.all([
    supabase
      .from("checklists")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("devices").select("serial, model").order("serial"),
  ]);
  const list = (listRaw ?? []) as any[];
  const devices = (devRaw ?? []) as any[];
  const total = ALL_KEYS.length;

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">납품 전 체크리스트</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        29개 항목 · <b>2명이 확인해야 확정</b> (더블 체크)
      </p>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-bold text-[14px]">체크리스트 목록</h2>
          </div>
          <div className="divide-y divide-line-2">
            {list.map((c) => {
              const done = filledCount(c.data ?? {});
              const pct = Math.round((done / total) * 100);
              const confirmed = c.status === "확정";
              return (
                <Link
                  key={c.id}
                  href={`/checklist/${c.id}`}
                  className="block px-4 py-3 hover:bg-surface-2"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-[12.5px] font-semibold">
                      {c.serial || "번호 미입력"}
                    </span>
                    <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 border border-line text-ink-2">
                      {c.model === "OS1" ? "OCTA-SELL 1" : "OCTA-SELL 2"}
                    </span>
                    <span
                      className={
                        "text-[11.5px] font-semibold px-2 py-0.5 rounded-full " +
                        (c.purpose === "데모용"
                          ? "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]"
                          : "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]")
                      }
                    >
                      {c.purpose}
                    </span>
                    {c.hospital && (
                      <span className="text-[12px] text-ink-2">{c.hospital}</span>
                    )}
                    <span
                      className={
                        "ml-auto text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full " +
                        (confirmed
                          ? "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]"
                          : "bg-surface-2 text-ink-2")
                      }
                    >
                      {confirmed ? "확정" : "작성중"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11.5px] text-ink-3 tabular-nums">
                      {done}/{total}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-ink-3 mt-1.5">
                    확인 1: {c.checker1_name || "—"} · 확인 2:{" "}
                    {c.checker2_name || "—"}
                  </div>
                </Link>
              );
            })}
            {list.length === 0 && (
              <div className="px-4 py-10 text-center text-ink-3 text-[13px]">
                작성된 체크리스트가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">새 체크리스트</h2>
          <form action={createChecklist} className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>장비번호</label>
              <input
                name="serial"
                className={inputCls}
                list="serialList"
                placeholder="OS2-2607-031"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>모델</label>
                <select name="model" className={inputCls} defaultValue="OS2">
                  <option value="OS2">OCTA-SELL 2</option>
                  <option value="OS1">OCTA-SELL 1</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>구분</label>
                <select name="purpose" className={inputCls} defaultValue="납품용">
                  <option>납품용</option>
                  <option>데모용</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>납품처 / 데모처 (선택)</label>
              <input name="hospital" className={inputCls} placeholder="서울굿모닝안과" />
            </div>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              체크리스트 시작
            </button>
          </form>
        </div>
      </div>

      <datalist id="serialList">
        {devices.map((d) => (
          <option key={d.serial} value={d.serial} />
        ))}
      </datalist>
    </div>
  );
}
