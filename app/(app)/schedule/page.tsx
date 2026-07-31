import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import OutItemsEditor from "@/components/OutItemsEditor";
import PhotoUpload from "@/components/PhotoUpload";

export const dynamic = "force-dynamic";

function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v || "[]"));
  } catch {
    return [];
  }
}

type OutItem = { model: string; kind: string; qty: number };

function parseItems(v: FormDataEntryValue | null): OutItem[] {
  try {
    const a = JSON.parse(String(v || "[]"));
    if (!Array.isArray(a)) return [];
    return a
      .map((x: any) => ({
        model: x.model === "OS1" ? "OS1" : "OS2",
        kind: x.kind === "전시용" ? "전시용" : "완성품",
        qty: Math.max(0, parseInt(x.qty, 10) || 0),
      }))
      .filter((x) => x.qty > 0);
  } catch {
    return [];
  }
}
function itemsOf(e: any): OutItem[] {
  return Array.isArray(e.out_items) ? e.out_items : [];
}

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

const EVENT_TYPES = [
  "정기점검",
  "A/S 방문",
  "데모 출고",
  "설치·납품",
  "대리점 공급",
  "전시·세미나",
  "기타",
];
const LEAVE_TYPES = ["연차", "휴가", "교육", "출장"];
const STAFF = ["김포오", "이수리", "박기술", "최현장", "정영업"];

function evPill(t: string) {
  if (t === "정기점검") return "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]";
  if (t === "A/S 방문") return "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]";
  if (t === "기타") return "bg-surface-2 text-ink-2";
  return "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]";
}
function lvPill(t: string) {
  if (t === "교육") return "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]";
  if (t === "출장") return "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]";
  return "bg-surface-2 text-ink-2";
}
function md(d?: string | null) {
  if (!d) return "";
  const p = d.split("-");
  return `${+p[1]}/${+p[2]}`;
}
const SHORT: Record<string, string> = {
  정기점검: "점검",
  "A/S 방문": "A/S",
  "데모 출고": "데모",
  "설치·납품": "설치",
  "대리점 공급": "대리점",
  "전시·세미나": "전시",
  기타: "기타",
};
function shortEv(e: any) {
  // 이벤트명이 있으면 그대로, 비워두면 유형명 (등록 시 유형명이 자동 저장됨)
  const label = (e.title && String(e.title).trim()) || SHORT[e.type] || e.type;
  const qty = Array.isArray(e.out_items)
    ? e.out_items.reduce((s: number, i: any) => s + (i.qty ?? 0), 0)
    : e.out_qty ?? 0;
  return label + (qty ? ` ${qty}대` : "");
}
function fmtTs(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function n(v: FormDataEntryValue | null) {
  const x = parseInt(String(v ?? "0"), 10);
  return Number.isFinite(x) ? x : 0;
}
function ts(date: FormDataEntryValue | null, time: FormDataEntryValue | null) {
  const dd = String(date || "").trim();
  if (!dd) return null;
  const tt = String(time || "00:00").trim() || "00:00";
  const d = new Date(`${dd}T${tt}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function addEvent(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const items = parseItems(formData.get("out_items"));
  await supabase.from("events").insert({
    type: String(formData.get("type") || "기타"),
    title: String(formData.get("title") || "").trim() || String(formData.get("type") || "일정"),
    place: String(formData.get("place") || ""),
    event_date: formData.get("event_date")
      ? String(formData.get("event_date"))
      : null,
    event_time: String(formData.get("event_time") || ""),
    end_date: formData.get("end_date") ? String(formData.get("end_date")) : null,
    who: String(formData.get("who") || ""),
    memo: String(formData.get("memo") || ""),
    out_items: items,
    out_model: items.length === 1 ? items[0].model : "",
    out_qty: items.reduce((s, i) => s + i.qty, 0),
    booth_photos: parseJson(formData.get("booth_photos")),
    buyers: String(formData.get("buyers") || ""),
    shipping_items: String(formData.get("shipping_items") || ""),
    created_by: user?.id ?? null,
  });
  revalidatePath("/schedule");
  revalidatePath("/");
}

async function addLeave(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("leaves").insert({
    type: String(formData.get("type") || "연차"),
    who: String(formData.get("who") || ""),
    start_at: ts(formData.get("sd"), formData.get("st")),
    end_at: ts(formData.get("ed"), formData.get("et")),
    memo: String(formData.get("memo") || ""),
    created_by: user?.id ?? null,
  });
  revalidatePath("/schedule");
}

async function deleteEvent(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", String(formData.get("id")));
  revalidatePath("/schedule");
}
async function deleteLeave(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("leaves").delete().eq("id", String(formData.get("id")));
  revalidatePath("/schedule");
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: evRaw }, { data: lvRaw }, { data: devRaw }] = await Promise.all([
    supabase.from("events").select("*").order("event_date", { nullsFirst: false }),
    supabase.from("leaves").select("*").order("start_at", { nullsFirst: false }),
    supabase.from("devices").select("model, category"),
  ]);
  const events = (evRaw ?? []) as any[];
  const leaves = (lvRaw ?? []) as any[];
  const devices = (devRaw ?? []) as any[];

  // 예정 출고 집계 (모델 × 구분)
  const planned: Record<string, number> = {};
  let plannedTotal = 0;
  for (const e of events) {
    for (const it of itemsOf(e)) {
      const k = `${it.model}|${it.kind}`;
      planned[k] = (planned[k] ?? 0) + (it.qty ?? 0);
      plannedTotal += it.qty ?? 0;
    }
  }
  const avail = (model: string, kind: string) =>
    devices.filter(
      (d) =>
        d.model === model &&
        d.category === (kind === "전시용" ? "전시" : "완성품"),
    ).length;
  const COMBOS = [
    { model: "OS2", kind: "완성품" },
    { model: "OS2", kind: "전시용" },
    { model: "OS1", kind: "완성품" },
    { model: "OS1", kind: "전시용" },
  ];

  // 월간 캘린더 (ym=YYYY-MM 으로 이동, 없으면 이번 달)
  const today = new Date();
  const ymParam = sp.ym ?? "";
  const m0 = ymParam.match(/^(\d{4})-(\d{1,2})$/);
  const year = m0 ? parseInt(m0[1], 10) : today.getFullYear();
  const month = m0 ? parseInt(m0[2], 10) - 1 : today.getMonth();
  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const ymOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const isThisMonth =
    year === today.getFullYear() && month === today.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysIn = new Date(year, month + 1, 0).getDate();
  const pad2 = (x: number) => String(x).padStart(2, "0");
  const monthLabel = `${year}년 ${month + 1}월`;
  const dayCells: { day: number | null; evs: any[] }[] = [];
  for (let i = 0; i < firstDow; i++) dayCells.push({ day: null, evs: [] });
  for (let d = 1; d <= daysIn; d++) {
    const ds = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const evs = events.filter(
      (e) =>
        e.event_date === ds ||
        (e.end_date &&
          e.event_date &&
          e.event_date <= ds &&
          ds <= e.end_date),
    );
    dayCells.push({ day: d, evs });
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">전시·일정</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        정기점검·A/S·데모·설치·대리점·전시 일정 · 예정 출고 · 직원 근태
      </p>

      {/* 예정 출고 vs 보유 */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-5">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="text-[13px] font-bold">다가오는 출고 예정</div>
          <div className="text-2xl font-bold">
            {plannedTotal}
            <span className="text-sm text-ink-3"> 대</span>
          </div>
          <div className="text-[11.5px] text-ink-3 ml-auto">
            예정보다 보유가 적으면 미리 제작하세요.
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {COMBOS.map((c) => {
            const p = planned[`${c.model}|${c.kind}`] ?? 0;
            const a = avail(c.model, c.kind);
            const short = p > a;
            return (
              <div
                key={c.model + c.kind}
                className="rounded-lg border border-line p-2.5"
              >
                <div className="text-[11.5px] text-ink-3 font-semibold">
                  {c.model === "OS1" ? "OCTA-SELL 1" : "OCTA-SELL 2"} ·{" "}
                  {c.kind === "전시용" ? "전시용" : "완제품"}
                </div>
                <div className="text-[13px] mt-1">
                  예정{" "}
                  <b
                    className={
                      short ? "text-[color:var(--crit-ink)]" : "text-ink"
                    }
                  >
                    {p}
                  </b>
                  <span className="text-ink-3"> / 보유 {a}</span>
                </div>
                {short && (
                  <div className="text-[11px] text-[color:var(--crit-ink)] font-semibold mt-0.5">
                    {p - a}대 부족
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 월간 캘린더 */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h2 className="font-bold text-[14px]">{monthLabel}</h2>
          <span className="text-[12px] text-ink-3 hidden sm:inline">
            전시 · 설치 · 정기점검 · A/S · 데모
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {!isThisMonth && (
              <Link
                href="/schedule"
                className="h-8 px-3 grid place-items-center rounded-lg border border-line text-[12px] font-semibold text-ink-2 hover:bg-surface-2"
              >
                오늘
              </Link>
            )}
            <Link
              href={`/schedule?ym=${ymOf(prev)}`}
              aria-label="이전 달"
              className="w-8 h-8 grid place-items-center rounded-lg border border-line text-ink-2 hover:bg-surface-2 text-[15px]"
            >
              ‹
            </Link>
            <Link
              href={`/schedule?ym=${ymOf(next)}`}
              aria-label="다음 달"
              className="w-8 h-8 grid place-items-center rounded-lg border border-line text-ink-2 hover:bg-surface-2 text-[15px]"
            >
              ›
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
            <div
              key={w}
              className="text-[11px] text-ink-3 font-semibold text-center pb-1"
            >
              {w}
            </div>
          ))}
          {dayCells.map((c, i) => {
            const isToday =
              c.day !== null && isThisMonth && c.day === today.getDate();
            return c.day === null ? (
              <div key={i} />
            ) : (
              <div
                key={i}
                className={
                  "min-h-[64px] rounded-lg p-1.5 flex flex-col gap-1 " +
                  (isToday
                    ? "bg-accent-bg ring-1 ring-accent"
                    : "bg-surface-2")
                }
              >
                <span
                  className={
                    "text-[11px] font-semibold " +
                    (isToday ? "text-accent-ink" : "text-ink-2")
                  }
                >
                  {c.day}
                </span>
                {c.evs.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    title={e.title}
                    className={
                      "text-[9.5px] font-semibold px-1 py-px rounded truncate " +
                      evPill(e.type)
                    }
                  >
                    {shortEv(e)}
                  </span>
                ))}
                {c.evs.length > 3 && (
                  <span className="text-[9.5px] text-ink-3">
                    +{c.evs.length - 3}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 이벤트 */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 mb-6">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-bold text-[14px]">다가오는 이벤트</h2>
          </div>
          <div className="divide-y divide-line-2">
            {events.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[12px] font-mono text-ink-3 w-11 shrink-0">
                  {md(e.event_date)}
                </span>
                <span
                  className={
                    "text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full " +
                    evPill(e.type)
                  }
                >
                  {e.type}
                </span>
                <span className="text-[13px] font-semibold">{e.title}</span>
                {itemsOf(e).map((it: any, i: number) => (
                  <span
                    key={i}
                    className={
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full " +
                      (it.kind === "전시용"
                        ? "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]"
                        : "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]")
                    }
                  >
                    {it.model === "OS1" ? "OS1" : "OS2"}{" "}
                    {it.kind === "전시용" ? "전시용" : "완제품"} {it.qty}대
                  </span>
                ))}
                <span className="text-[11.5px] text-ink-3">
                  {e.place}
                  {e.event_time ? ` · ${e.event_time}` : ""}
                  {e.who ? ` · ${e.who}` : ""}
                </span>
                  <form action={deleteEvent} className="ml-auto">
                    <input type="hidden" name="id" value={e.id} />
                    <button className="text-[12px] text-ink-3 hover:text-[color:var(--crit-ink)]">
                      삭제
                    </button>
                  </form>
                </div>

                {(e.buyers ||
                  e.shipping_items ||
                  (Array.isArray(e.booth_photos) && e.booth_photos.length > 0)) && (
                  <div className="mt-2 flex flex-col gap-1.5 pl-1">
                    {e.buyers && (
                      <div className="text-[11.5px] text-ink-2">
                        <span className="text-ink-3">컨택 바이어 · </span>
                        {e.buyers}
                      </div>
                    )}
                    {e.shipping_items && (
                      <div className="text-[11.5px] text-ink-2">
                        <span className="text-ink-3">선적 동봉 · </span>
                        {e.shipping_items}
                      </div>
                    )}
                    {Array.isArray(e.booth_photos) &&
                      e.booth_photos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(e.booth_photos as string[]).map((u, i) => (
                            <a key={i} href={u} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={u}
                                alt="부스"
                                className="w-14 h-14 object-cover rounded-lg border border-line"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))}
            {events.length === 0 && (
              <div className="px-4 py-8 text-center text-ink-3 text-[13px]">
                등록된 이벤트가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">이벤트 등록</h2>
          <form action={addEvent} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>유형</label>
                <select name="type" className={inputCls} defaultValue="정기점검">
                  {EVENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>담당/인력</label>
                <input name="who" className={inputCls} placeholder="이수리" />
              </div>
            </div>
            <div>
              <label className={labelCls}>이벤트명 · 직접 입력</label>
              <input name="title" className={inputCls} placeholder="예: 신제품 시연회" />
            </div>
            <div>
              <label className={labelCls}>장소 / 병원</label>
              <input name="place" className={inputCls} placeholder="병원·전시장" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>시작일</label>
                <input name="event_date" type="date" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>시간</label>
                <input name="event_time" type="time" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>종료일</label>
                <input name="end_date" type="date" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>
                출고 기기 (예정 · 여러 대 · 모델/구분별)
              </label>
              <OutItemsEditor name="out_items" />
            </div>
            <div>
              <label className={labelCls}>메모</label>
              <input name="memo" className={inputCls} placeholder="세부 내용" />
            </div>

            <details className="border border-line rounded-lg">
              <summary className="px-3 py-2 text-[12.5px] font-semibold text-accent cursor-pointer select-none">
                전시·세미나 상세 (부스 · 바이어 · 선적)
              </summary>
              <div className="p-3 pt-1 flex flex-col gap-3">
                <div>
                  <label className={labelCls}>부스 설치 사진</label>
                  <PhotoUpload name="booth_photos" />
                </div>
                <div>
                  <label className={labelCls}>컨택 바이어 / 병원 리스트</label>
                  <textarea
                    name="buyers"
                    rows={2}
                    className={inputCls + " h-auto py-2"}
                    placeholder="예: A사 김대표(구매 검토), 부산○○안과 원장"
                  />
                </div>
                <div>
                  <label className={labelCls}>해외 선적 동봉 품목</label>
                  <textarea
                    name="shipping_items"
                    rows={2}
                    className={inputCls + " h-auto py-2"}
                    placeholder="배너, 백월, 브로셔, 에어건, 리크테스트 어댑터, 랩 등"
                  />
                </div>
              </div>
            </details>

            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              이벤트 등록
            </button>
          </form>
        </div>
      </div>

      {/* 직원 근태 */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-bold text-[14px]">직원 일정 · 근태</h2>
          </div>
          <div className="divide-y divide-line-2">
            {leaves.map((l) => (
              <div key={l.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <span
                  className={
                    "text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full " +
                    lvPill(l.type)
                  }
                >
                  {l.type}
                </span>
                <span className="text-[13px] font-semibold">{l.who}</span>
                <span className="text-[12px] text-ink-2 tabular-nums">
                  {fmtTs(l.start_at)}
                  {l.end_at ? ` ~ ${fmtTs(l.end_at)}` : ""}
                </span>
                {l.memo && (
                  <span className="text-[11.5px] text-ink-3">· {l.memo}</span>
                )}
                <form action={deleteLeave} className="ml-auto">
                  <input type="hidden" name="id" value={l.id} />
                  <button className="text-[12px] text-ink-3 hover:text-[color:var(--crit-ink)]">
                    삭제
                  </button>
                </form>
              </div>
            ))}
            {leaves.length === 0 && (
              <div className="px-4 py-8 text-center text-ink-3 text-[13px]">
                등록된 근태가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">근태 등록</h2>
          <form action={addLeave} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>유형</label>
                <select name="type" className={inputCls} defaultValue="연차">
                  {LEAVE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>대상 직원</label>
                <input name="who" className={inputCls} list="staff" placeholder="직원" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>시작일</label>
                <input name="sd" type="date" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>시작 시간</label>
                <input name="st" type="time" className={inputCls} defaultValue="09:00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>종료일</label>
                <input name="ed" type="date" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>종료 시간</label>
                <input name="et" type="time" className={inputCls} defaultValue="18:00" />
              </div>
            </div>
            <div>
              <label className={labelCls}>메모</label>
              <input name="memo" className={inputCls} placeholder="사유·장소" />
            </div>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              근태 등록
            </button>
          </form>
        </div>
      </div>

      <datalist id="staff">
        {STAFF.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
