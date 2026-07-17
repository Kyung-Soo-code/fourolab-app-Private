import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function actionPill(a: string) {
  if (a === "삭제") return "bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]";
  if (a === "수정") return "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]";
  return "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]";
}

function fmt(ts: string) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function AuditPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);
  const logs = (data ?? []) as any[];

  return (
    <div className="max-w-[860px]">
      <h1 className="text-xl font-bold mb-1">수정 이력</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        누가 언제 무엇을 등록·수정·삭제했는지 (최근 150건)
      </p>

      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="divide-y divide-line-2">
          {logs.map((l) => (
            <div key={l.id} className="px-4 py-3 flex items-center gap-2.5 flex-wrap">
              <span
                className={
                  "text-[11px] font-semibold px-2 py-0.5 rounded-full " +
                  actionPill(l.action)
                }
              >
                {l.action}
              </span>
              <span className="text-[12px] font-semibold text-ink-2 bg-surface-2 border border-line rounded px-1.5 py-0.5">
                {l.entity}
              </span>
              <span className="text-[13px] text-ink">{l.detail}</span>
              <span className="ml-auto text-[12px] text-ink-3">
                {l.actor} · <span className="tabular-nums">{fmt(l.created_at)}</span>
              </span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="px-4 py-10 text-center text-ink-3 text-[13px]">
              아직 기록이 없습니다. 등록·수정·삭제 시 자동으로 쌓입니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
