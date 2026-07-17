import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

const CATS = ["완성품", "데모", "전시", "A/S", "납품"];

async function createDevice(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const serial = String(formData.get("serial") || "").trim();
  if (!serial) return;
  await supabase.from("devices").insert({
    serial,
    model: String(formData.get("model") || "OS2"),
    category: String(formData.get("category") || "완성품"),
    hospital_id: (formData.get("hospital_id") as string) || null,
    produced_at: formData.get("produced_at")
      ? String(formData.get("produced_at"))
      : null,
    delivered_at: formData.get("delivered_at")
      ? String(formData.get("delivered_at"))
      : null,
  });
  await logAudit("등록", "기기", serial);
  revalidatePath("/devices");
}

export default async function DevicesPage() {
  const supabase = await createClient();
  const [{ data: devices }, { data: hospitals }] = await Promise.all([
    supabase
      .from("devices")
      .select("*, hospitals(name)")
      .order("serial"),
    supabase.from("hospitals").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">기기 관리</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        고유번호 단위 기기 목록 · OCTA-SELL 1 / 2
      </p>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <h2 className="font-bold text-[14px]">기기 목록</h2>
            <span className="ml-auto text-[12px] text-ink-3">
              총 {devices?.length ?? 0}대
            </span>
            <a
              href="/api/export/devices"
              className="text-[12px] font-semibold text-accent hover:underline"
            >
              엑셀 내보내기
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-3 text-left">
                  <th className="font-semibold px-3 py-2.5">고유번호</th>
                  <th className="font-semibold px-3 py-2.5">모델</th>
                  <th className="font-semibold px-3 py-2.5">구분</th>
                  <th className="font-semibold px-3 py-2.5">위치(병원)</th>
                  <th className="font-semibold px-3 py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {((devices ?? []) as any[]).map((d) => (
                  <tr key={d.id} className="border-t border-line-2">
                    <td className="px-3 py-3 font-mono text-[12.5px] font-semibold">
                      <a
                        href={`/devices/${d.id}`}
                        className="hover:text-accent hover:underline"
                        title="이력 추적 보기"
                      >
                        {d.serial}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {d.model === "OS1" ? "OCTA-SELL 1" : "OCTA-SELL 2"}
                    </td>
                    <td className="px-3 py-3 text-ink-2">{d.category}</td>
                    <td className="px-3 py-3 text-ink-2">
                      {d.hospitals?.name ?? "사내"}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <a
                        href={`/devices/${d.id}/edit`}
                        className="text-[12px] font-semibold text-accent hover:underline px-1.5"
                      >
                        수정
                      </a>
                    </td>
                  </tr>
                ))}
                {(devices ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-ink-3 text-[13px]"
                    >
                      등록된 기기가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">기기 등록</h2>
          <form action={createDevice} className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>고유번호</label>
              <input name="serial" className={inputCls} placeholder="OS2-2406-021" required />
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
                <select name="category" className={inputCls} defaultValue="완성품">
                  {CATS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>위치 병원 (선택)</label>
              <select name="hospital_id" className={inputCls} defaultValue="">
                <option value="">사내 보관</option>
                {(hospitals ?? []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>생산일 (선택)</label>
                <input name="produced_at" type="date" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>납품일 (선택)</label>
                <input name="delivered_at" type="date" className={inputCls} />
              </div>
            </div>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              기기 등록
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
