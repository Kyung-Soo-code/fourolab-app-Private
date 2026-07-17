import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PRI: Record<string, string> = {
  긴급: "bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]",
  진행중: "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]",
  원격: "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]",
  완료: "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]",
};

function Kpi({
  label,
  value,
  unit,
  sub,
  color,
  href,
}: {
  label: string;
  value: number | string;
  unit: string;
  sub?: string;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-surface border border-line rounded-xl p-4 hover:border-accent transition-colors"
    >
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-2">
        <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
        {label}
      </div>
      <div className="text-3xl font-bold mt-2 tracking-tight">
        {value}
        <span className="text-sm font-semibold text-ink-3"> {unit}</span>
      </div>
      {sub && <div className="text-[11.5px] text-ink-3 mt-1">{sub}</div>}
    </Link>
  );
}

function md(d?: string | null) {
  if (!d) return "";
  const p = d.split("-");
  return `${+p[1]}/${+p[2]}`;
}

// "급수 호스 ×1, 피팅 ×2" → [{name,qty}]
function parsePartsStr(s?: string | null) {
  if (!s) return [] as { name: string; qty: number }[];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const m = x.match(/^(.*?)\s*[×xX]\s*(\d+)$/);
      return m
        ? { name: m[1].trim(), qty: parseInt(m[2], 10) || 1 }
        : { name: x, qty: 1 };
    });
}

export default async function Dashboard() {
  const supabase = await createClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const since90 = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

  const [
    openAs,
    demoCount,
    hospCount,
    partsRes,
    eventsRes,
    recentAs,
    failRes,
    leavesRes,
  ] = await Promise.all([
      supabase
        .from("as_tickets")
        .select("*", { count: "exact", head: true })
        .neq("priority", "완료"),
      supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("category", "데모"),
      supabase.from("hospitals").select("*", { count: "exact", head: true }),
      supabase.from("parts").select("stock, per_unit"),
      supabase
        .from("events")
        .select("*")
        .gte("event_date", todayStr)
        .order("event_date")
        .limit(8),
      supabase
        .from("as_tickets")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(6),
      supabase
        .from("as_tickets")
        .select("parts, received_at")
        .gte("received_at", since90),
      supabase
        .from("leaves")
        .select("*")
        .gte("end_at", new Date().toISOString())
        .order("start_at")
        .limit(6),
    ]);

  // 부품별 고장률 (최근 90일 · A/S 교체 부품 기준)
  const failMap: Record<string, number> = {};
  for (const t of (failRes.data ?? []) as any[]) {
    for (const p of parsePartsStr(t.parts)) {
      failMap[p.name] = (failMap[p.name] ?? 0) + p.qty;
    }
  }
  const failTotal = Object.values(failMap).reduce((s, v) => s + v, 0);
  const failRank = Object.entries(failMap)
    .map(([name, qty]) => ({ name, qty, pct: failTotal ? (qty / failTotal) * 100 : 0 }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6);

  const parts = (partsRes.data ?? []) as any[];
  const shortParts = parts.filter(
    (p) => (p.per_unit ?? 0) > 0 && (p.stock ?? 0) < (p.per_unit ?? 0),
  ).length;
  const events = (eventsRes.data ?? []) as any[];
  const checkupCount = events.filter((e) => e.type === "정기점검").length;
  const exhibitCount = events.filter((e) => e.type === "전시·세미나").length;
  const outQty = events.reduce((s, e) => s + (e.out_qty ?? 0), 0);
  const recent = (recentAs.data ?? []) as any[];
  const leaves = (leavesRes.data ?? []) as any[];
  const lvPill = (t: string) =>
    t === "교육"
      ? "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]"
      : t === "출장"
        ? "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]"
        : "bg-surface-2 text-ink-2";
  const fmtTs = (ts?: string | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    const p = (x: number) => String(x).padStart(2, "0");
    return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">대시보드</h1>
      <p className="text-[13px] text-ink-3 mb-5">사내 현황 요약</p>

      {/* 6 KPI (3x2) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Kpi
          label="진행중 A/S"
          value={openAs.count ?? 0}
          unit="건"
          sub="미완료 접수"
          color="var(--crit-ink)"
          href="/as"
        />
        <Kpi
          label="데모 진행 중"
          value={demoCount.count ?? 0}
          unit="대"
          sub="회수 대상"
          color="var(--info-ink)"
          href="/fleet"
        />
        <Kpi
          label="재고 부족 부품"
          value={shortParts}
          unit="종"
          sub="재고 < 소요"
          color="var(--warn-ink)"
          href="/inventory"
        />
        <Kpi
          label="예정 정기점검"
          value={checkupCount}
          unit="건"
          sub="다가오는 일정"
          color="var(--accent)"
          href="/schedule"
        />
        <Kpi
          label="다가오는 전시·세미나"
          value={exhibitCount}
          unit="건"
          sub="일정 등록됨"
          color="var(--info-ink)"
          href="/schedule"
        />
        <Kpi
          label="예정 출고"
          value={outQty}
          unit="대"
          sub="제작 계획 참고"
          color="var(--ok-ink)"
          href="/schedule"
        />
      </div>

      {/* 부품별 고장률 */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-bold text-[14px]">부품별 고장률</h2>
          <span className="text-[12px] text-ink-3">
            최근 90일 · A/S 교체 부품 기준
          </span>
          <span className="ml-auto text-[12px] text-ink-3">
            총 {failTotal}개 교체
          </span>
        </div>
        {failRank.length === 0 ? (
          <p className="text-[13px] text-ink-3 py-4 text-center">
            최근 90일간 교체된 부품 기록이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {failRank.map((f, i) => (
              <div key={f.name} className="flex items-center gap-3">
                <span className="text-[12.5px] text-ink-2 w-24 shrink-0 text-right truncate">
                  {f.name}
                </span>
                <div className="flex-1 h-5 rounded-md bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-md"
                    style={{
                      width: `${Math.max(4, f.pct)}%`,
                      background:
                        i === 0
                          ? "var(--crit-ink)"
                          : i === 1
                            ? "var(--warn-ink)"
                            : "var(--accent)",
                    }}
                  />
                </div>
                <span className="text-[12.5px] font-bold w-14 text-right tabular-nums">
                  {f.pct.toFixed(0)}%
                  <span className="text-ink-3 font-normal"> ({f.qty})</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
        {/* 최근 A/S */}
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
            <h2 className="font-bold text-[14px]">최근 A/S 접수</h2>
            <Link
              href="/as"
              className="ml-auto text-[12px] text-accent font-semibold"
            >
              전체 보기 →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-3 text-left">
                  <th className="font-semibold px-4 py-2.5">기기번호</th>
                  <th className="font-semibold px-4 py-2.5">병원 / 증상</th>
                  <th className="font-semibold px-4 py-2.5">담당</th>
                  <th className="font-semibold px-4 py-2.5">상태</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="border-t border-line-2">
                    <td className="px-4 py-3 font-mono text-[12.5px] font-semibold">
                      {t.serial}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {t.hospital_name}
                      <span className="text-ink-3"> · {t.symptom}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{t.manager}</td>
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
                {recent.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-ink-3 text-[13px]"
                    >
                      아직 접수된 A/S가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 다가오는 일정 */}
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
            <h2 className="font-bold text-[14px]">다가오는 일정</h2>
            <Link
              href="/schedule"
              className="ml-auto text-[12px] text-accent font-semibold"
            >
              일정 →
            </Link>
          </div>
          <div className="divide-y divide-line-2">
            {events.slice(0, 6).map((e) => (
              <div key={e.id} className="px-4 py-3 flex items-center gap-2.5">
                <span className="text-[12px] font-mono text-ink-3 w-10 shrink-0">
                  {md(e.event_date)}
                </span>
                <span className="text-[13px] font-semibold truncate">
                  {e.title}
                </span>
                {(e.out_qty ?? 0) > 0 && (
                  <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-[color:var(--info-bg)] text-[color:var(--info-ink)] shrink-0">
                    출고 {e.out_qty}
                  </span>
                )}
                <span className="ml-auto text-[11.5px] text-ink-3 shrink-0">
                  {e.who}
                </span>
              </div>
            ))}
            {events.length === 0 && (
              <div className="px-4 py-8 text-center text-ink-3 text-[13px]">
                다가오는 일정이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 팀 근태 현황 */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden mt-4">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <h2 className="font-bold text-[14px]">팀 근태 현황</h2>
          <span className="text-[12px] text-ink-3">진행 중 · 예정</span>
          <Link
            href="/schedule"
            className="ml-auto text-[12px] text-accent font-semibold"
          >
            근태 →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          {leaves.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-2 border border-line rounded-full pl-1.5 pr-3 py-1"
            >
              <span
                className={
                  "text-[11px] font-semibold px-2 py-0.5 rounded-full " +
                  lvPill(l.type)
                }
              >
                {l.type}
              </span>
              <span className="text-[12.5px] font-semibold">{l.who}</span>
              <span className="text-[11.5px] text-ink-3 tabular-nums">
                {fmtTs(l.start_at)}
                {l.end_at ? ` ~ ${fmtTs(l.end_at)}` : ""}
              </span>
            </span>
          ))}
          {leaves.length === 0 && (
            <span className="text-[13px] text-ink-3">
              진행 중이거나 예정된 근태가 없습니다.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
