import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function addMonths(d: Date, m: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

// 납품일 + 3개월마다 → 오늘 이후 첫 점검일
function nextCheckup(delivered: string[]): string | null {
  const dates = delivered.filter(Boolean).sort();
  if (dates.length === 0) return null;
  const base = new Date(dates[dates.length - 1]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = addMonths(base, 3);
  let guard = 0;
  while (next < today && guard++ < 200) next = addMonths(next, 3);
  return next.toISOString().slice(0, 10);
}

// 정기점검을 일정에 등록
async function registerCheckup(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hospital = String(formData.get("hospital") || "");
  const date = String(formData.get("date") || "");
  if (!date) return;
  await supabase.from("events").insert({
    type: "정기점검",
    title: `${hospital} 정기점검`,
    place: hospital,
    event_date: date,
    event_time: "10:00",
    who: "담당 배정 전",
    memo: "설치일 + 3개월 자동",
    out_items: [],
    out_qty: 0,
    created_by: user?.id ?? null,
  });
  revalidatePath("/schedule");
  revalidatePath("/");
}

const PRI: Record<string, string> = {
  긴급: "bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]",
  진행중: "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]",
  원격: "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]",
  완료: "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]",
};

export default async function HospitalDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: h } = await supabase
    .from("hospitals")
    .select("*")
    .eq("id", id)
    .single();

  if (!h) {
    return (
      <div>
        <p className="text-ink-3">해당 병원을 찾을 수 없습니다.</p>
        <Link href="/hospitals" className="text-accent font-semibold">
          ← 병원 목록으로
        </Link>
      </div>
    );
  }

  const [{ data: devices }, { data: tickets }] = await Promise.all([
    supabase
      .from("devices")
      .select("*")
      .eq("hospital_id", id)
      .order("delivered_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("as_tickets")
      .select("*")
      .eq("hospital_id", id)
      .order("received_at", { ascending: false }),
  ]);

  const contacts: any[] = Array.isArray(h.contacts) ? h.contacts : [];
  // 납품일 기준 자동 정기점검일
  const auto = nextCheckup(
    ((devices ?? []) as any[]).map((d) => d.delivered_at).filter(Boolean),
  );

  return (
    <div className="max-w-[900px]">
      <Link href="/hospitals" className="text-[13px] text-accent font-semibold">
        ← 병원 목록으로
      </Link>
      <div className="flex items-center gap-3 mt-2 mb-1">
        <h1 className="text-xl font-bold">{h.name}</h1>
        <Link
          href={`/hospitals/${h.id}/edit`}
          className="text-[12.5px] font-semibold text-accent hover:underline"
        >
          수정
        </Link>
      </div>
      <p className="text-[13px] text-ink-3 mb-5">
        {h.biz} {h.addr && `· ${h.addr}`}
      </p>

      {/* 담당자 */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-4">
        <h2 className="font-bold text-[14px] mb-2">담당자</h2>
        <div className="text-[13px] text-ink-2">
          <span className="font-semibold text-ink">{h.manager}</span>{" "}
          {h.tel && <span className="text-ink-3">· {h.tel}</span>}
        </div>
        {contacts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {contacts.map((c, i) => (
              <span
                key={i}
                className="text-[12px] bg-surface-2 border border-line rounded-full px-2.5 py-1"
              >
                {c.role && (
                  <span className="text-ink-3">{c.role} </span>
                )}
                <span className="font-semibold">{c.name}</span>
                {c.tel && <span className="text-ink-3"> · {c.tel}</span>}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-line-2 flex items-center gap-3 flex-wrap">
          <div className="text-[12px] font-bold text-ink-2">정기점검</div>
          {auto ? (
            <>
              <span className="text-[12.5px] text-ink-2">
                다음 <span className="font-semibold text-ink">{auto}</span>
                <span className="text-ink-3"> · 3개월 주기 (납품일 자동)</span>
              </span>
              <form action={registerCheckup} className="ml-auto">
                <input type="hidden" name="hospital" value={h.name} />
                <input type="hidden" name="date" value={auto} />
                <button className="h-8 px-3 rounded-lg border border-line text-[12px] font-semibold text-accent hover:bg-accent-bg">
                  일정에 등록
                </button>
              </form>
            </>
          ) : (
            <span className="text-[12.5px] text-ink-3">
              납품일이 등록된 기기가 없어 자동 계산 불가 (기기 등록에서 납품일
              입력)
            </span>
          )}
          {h.checkup_next && (
            <span className="text-[11.5px] text-ink-3 w-full">
              수동 지정: {h.checkup_next}
            </span>
          )}
        </div>
      </div>

      {/* 설치 환경 사진 */}
      {Array.isArray(h.photos) && h.photos.length > 0 && (
        <div className="bg-surface border border-line rounded-xl p-4 mb-4">
          <h2 className="font-bold text-[14px] mb-2">설치 환경 사진</h2>
          <div className="flex flex-wrap gap-2">
            {(h.photos as string[]).map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt="설치 환경"
                  className="w-24 h-24 object-cover rounded-lg border border-line"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 납품 기기 */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <h2 className="font-bold text-[14px]">납품 · 설치 기기</h2>
          <span className="ml-auto text-[12px] text-ink-3">
            {devices?.length ?? 0}대
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-3 text-left">
                <th className="font-semibold px-4 py-2.5">고유번호</th>
                <th className="font-semibold px-4 py-2.5">모델</th>
                <th className="font-semibold px-4 py-2.5">구분</th>
                <th className="font-semibold px-4 py-2.5">납품일</th>
                <th className="font-semibold px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {(devices ?? []).map((d) => (
                <tr key={d.id} className="border-t border-line-2">
                  <td className="px-4 py-3 font-mono text-[12.5px] font-semibold">
                    {d.serial}
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {d.model === "OS1" ? "OCTA-SELL 1" : "OCTA-SELL 2"}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{d.category}</td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">
                    {d.delivered_at ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/devices/${d.id}/edit`}
                      className="text-[12px] font-semibold text-accent hover:underline"
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
                    className="px-4 py-8 text-center text-ink-3 text-[13px]"
                  >
                    이 병원에 납품된 기기가 없습니다. 기기 관리에서 위치를 이
                    병원으로 지정하세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* A/S 이력 */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="font-bold text-[14px]">A/S 이력</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-3 text-left">
                <th className="font-semibold px-4 py-2.5">기기</th>
                <th className="font-semibold px-4 py-2.5">증상 / 사내 코멘트</th>
                <th className="font-semibold px-4 py-2.5">상태</th>
              </tr>
            </thead>
            <tbody>
              {(tickets ?? []).map((t) => (
                <tr key={t.id} className="border-t border-line-2 align-top">
                  <td className="px-4 py-3 font-mono text-[12px] font-semibold">
                    <a
                      href={`/as/${t.id}`}
                      className="hover:text-accent hover:underline"
                      title="A/S 상세 보기"
                    >
                      {t.serial}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {t.symptom}
                    {t.fix_comment && (
                      <div className="text-[11px] text-accent-ink mt-0.5">
                        사내: {t.fix_comment}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full " +
                        (PRI[t.priority] ?? "bg-surface-2 text-ink-2")
                      }
                    >
                      {t.priority}
                    </span>
                  </td>
                </tr>
              ))}
              {(tickets ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-ink-3 text-[13px]"
                  >
                    A/S 이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
