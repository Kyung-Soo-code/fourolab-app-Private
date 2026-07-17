import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
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

async function createHospital(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await supabase.from("hospitals").insert({
    name,
    manager: String(formData.get("manager") || ""),
    tel: String(formData.get("tel") || ""),
    biz: String(formData.get("biz") || ""),
    addr: String(formData.get("addr") || ""),
    contacts: parseJson(formData.get("contacts")),
    photos: parseJson(formData.get("photos")),
    checkup_next: formData.get("checkup_next")
      ? String(formData.get("checkup_next"))
      : null,
  });
  await logAudit("등록", "병원", name);
  revalidatePath("/hospitals");
}

export default async function HospitalsPage() {
  const supabase = await createClient();
  const { data: hospitals } = await supabase
    .from("hospitals")
    .select("*, devices(count)")
    .order("name");

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">병원 관리</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        거래 병원 · 담당자 · 정기점검 일정
      </p>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <h2 className="font-bold text-[14px]">병원 목록</h2>
            <a
              href="/api/export/hospitals"
              className="ml-auto text-[12px] font-semibold text-accent hover:underline"
            >
              엑셀 내보내기
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-3 text-left">
                  <th className="font-semibold px-3 py-2.5">병원</th>
                  <th className="font-semibold px-3 py-2.5">담당자</th>
                  <th className="font-semibold px-3 py-2.5">기기</th>
                  <th className="font-semibold px-3 py-2.5">정기점검</th>
                  <th className="font-semibold px-3 py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {((hospitals ?? []) as any[]).map((h) => (
                  <tr key={h.id} className="border-t border-line-2">
                    <td className="px-3 py-3">
                      <a
                        href={`/hospitals/${h.id}`}
                        className="font-semibold text-ink hover:text-accent hover:underline"
                      >
                        {h.name}
                      </a>
                      <div className="text-[11.5px] text-ink-3">{h.biz}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {h.manager}
                      <div className="text-[11.5px] text-ink-3">{h.tel}</div>
                      {Array.isArray(h.contacts) && h.contacts.length > 0 && (
                        <div className="text-[11px] text-ink-3 mt-1 leading-relaxed">
                          {h.contacts
                            .map((c: any) =>
                              [c.role, c.name].filter(Boolean).join(" "),
                            )
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {h.devices?.[0]?.count ?? 0}대
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {h.checkup_next ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <a
                        href={`/hospitals/${h.id}/edit`}
                        className="text-[12px] font-semibold text-accent hover:underline px-1.5"
                      >
                        수정
                      </a>
                    </td>
                  </tr>
                ))}
                {(hospitals ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-ink-3 text-[13px]"
                    >
                      등록된 병원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">병원 등록</h2>
          <form action={createHospital} className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>병원명</label>
              <input name="name" className={inputCls} placeholder="서울굿모닝안과" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>담당자</label>
                <input name="manager" className={inputCls} placeholder="박민수 원장" />
              </div>
              <div>
                <label className={labelCls}>연락처</label>
                <input name="tel" className={inputCls} placeholder="010-0000-0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>영업 주체</label>
                <input name="biz" className={inputCls} placeholder="본사 직영" />
              </div>
              <div>
                <label className={labelCls}>지역</label>
                <input name="addr" className={inputCls} placeholder="서울 강남구" />
              </div>
            </div>
            <div>
              <label className={labelCls}>
                담당자 (여러 명 · 간호사·수간호사·구매팀 등)
              </label>
              <PeopleEditor name="contacts" />
            </div>
            <div>
              <label className={labelCls}>설치 환경 사진</label>
              <PhotoUpload name="photos" />
            </div>
            <div>
              <label className={labelCls}>다음 정기점검일 (선택)</label>
              <input name="checkup_next" type="date" className={inputCls} />
            </div>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              병원 등록
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
