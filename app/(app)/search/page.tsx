import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PRI: Record<string, string> = {
  긴급: "bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]",
  진행중: "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]",
  원격: "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]",
  완료: "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const supabase = await createClient();

  let devices: any[] = [];
  let hospitals: any[] = [];
  let tickets: any[] = [];
  let parts: any[] = [];

  if (q) {
    const like = `%${q}%`;
    const [d, h, t, p] = await Promise.all([
      supabase
        .from("devices")
        .select("*, hospitals(name)")
        .or(`serial.ilike.${like},status.ilike.${like}`)
        .limit(20),
      supabase
        .from("hospitals")
        .select("*")
        .or(`name.ilike.${like},manager.ilike.${like},addr.ilike.${like}`)
        .limit(20),
      supabase
        .from("as_tickets")
        .select("*")
        .or(
          `serial.ilike.${like},hospital_name.ilike.${like},symptom.ilike.${like},fix_comment.ilike.${like}`,
        )
        .order("received_at", { ascending: false })
        .limit(20),
      supabase.from("parts").select("*").ilike("name", like).limit(20),
    ]);
    devices = (d.data ?? []) as any[];
    hospitals = (h.data ?? []) as any[];
    tickets = (t.data ?? []) as any[];
    parts = (p.data ?? []) as any[];
  }

  const total = devices.length + hospitals.length + tickets.length + parts.length;

  return (
    <div className="max-w-[860px]">
      <h1 className="text-xl font-bold mb-1">통합 검색</h1>
      <p className="text-[13px] text-ink-3 mb-4">
        기기번호 · 병원 · A/S 증상 · 부품명으로 검색
      </p>

      <form action="/search" className="flex gap-2 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="예: OS2-2405, 굿모닝, 급수, 필터"
          className="flex-1 h-11 px-3.5 rounded-xl border border-line bg-surface text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg"
          autoFocus
        />
        <button className="h-11 px-5 rounded-xl bg-accent text-white font-semibold text-[14px] hover:bg-accent-2">
          검색
        </button>
      </form>

      {q && (
        <p className="text-[13px] text-ink-2 mb-4">
          &ldquo;<b>{q}</b>&rdquo; 검색 결과 <b>{total}</b>건
        </p>
      )}

      {q && devices.length > 0 && (
        <div className="bg-surface border border-line rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-line font-bold text-[13.5px]">
            기기 ({devices.length})
          </div>
          <div className="divide-y divide-line-2">
            {devices.map((d) => (
              <Link
                key={d.id}
                href={`/devices/${d.id}`}
                className="px-4 py-3 flex items-center gap-3 hover:bg-surface-2"
              >
                <span className="font-mono text-[12.5px] font-semibold">
                  {d.serial}
                </span>
                <span className="text-[12.5px] text-ink-2">
                  {d.model === "OS1" ? "OCTA-SELL 1" : "OCTA-SELL 2"} ·{" "}
                  {d.category}
                </span>
                <span className="ml-auto text-[12px] text-ink-3">
                  {d.hospitals?.name ?? "사내"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {q && hospitals.length > 0 && (
        <div className="bg-surface border border-line rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-line font-bold text-[13.5px]">
            병원 ({hospitals.length})
          </div>
          <div className="divide-y divide-line-2">
            {hospitals.map((h) => (
              <Link
                key={h.id}
                href={`/hospitals/${h.id}`}
                className="px-4 py-3 flex items-center gap-3 hover:bg-surface-2"
              >
                <span className="text-[13px] font-semibold">{h.name}</span>
                <span className="text-[12px] text-ink-3">
                  {h.manager} {h.addr && `· ${h.addr}`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {q && tickets.length > 0 && (
        <div className="bg-surface border border-line rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-line font-bold text-[13.5px]">
            A/S ({tickets.length})
          </div>
          <div className="divide-y divide-line-2">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/as/${t.id}/edit`}
                className="px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-surface-2"
              >
                <span className="font-mono text-[12px] font-semibold">
                  {t.serial}
                </span>
                <span className="text-[12.5px] text-ink-2">
                  {t.hospital_name} · {t.symptom}
                </span>
                <span
                  className={
                    "ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full " +
                    (PRI[t.priority] ?? "bg-surface-2 text-ink-2")
                  }
                >
                  {t.priority}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {q && parts.length > 0 && (
        <div className="bg-surface border border-line rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-line font-bold text-[13.5px]">
            부품 ({parts.length})
          </div>
          <div className="divide-y divide-line-2">
            {parts.map((p) => (
              <Link
                key={p.id}
                href={`/inventory/${p.id}/edit`}
                className="px-4 py-3 flex items-center gap-3 hover:bg-surface-2"
              >
                <span className="text-[13px] font-semibold">{p.name}</span>
                <span className="text-[12px] text-ink-3">
                  {p.model ?? "공용"} · {p.vendor}
                </span>
                <span className="ml-auto text-[12.5px] tabular-nums">
                  재고 {p.stock}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {q && total === 0 && (
        <p className="text-center text-ink-3 text-[13px] py-10">
          검색 결과가 없습니다.
        </p>
      )}
    </div>
  );
}
