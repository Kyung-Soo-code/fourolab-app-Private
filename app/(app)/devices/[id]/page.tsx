import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ev = { date: string; title: string; detail: string; tag: string };

const TAG: Record<string, string> = {
  생산: "bg-surface-2 text-ink-2",
  설치: "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]",
  "A/S": "bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]",
  대리점: "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]",
  사후관리: "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]",
};

export default async function DeviceHistory({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("devices")
    .select("*, hospitals(name)")
    .eq("id", id)
    .single();

  if (!d) {
    return (
      <div>
        <p className="text-ink-3">기기를 찾을 수 없습니다.</p>
        <Link href="/devices" className="text-accent font-semibold">
          ← 기기 등록으로
        </Link>
      </div>
    );
  }

  const serial = d.serial;
  const [{ data: asRows }, { data: dlRows }, { data: acRows }] =
    await Promise.all([
      supabase.from("as_tickets").select("*").eq("serial", serial),
      supabase.from("dealer_logs").select("*").eq("serial", serial),
      supabase.from("aftercare").select("*").eq("serial", serial),
    ]);

  const evs: Ev[] = [];
  if (d.produced_at)
    evs.push({
      date: d.produced_at,
      title: "생산 완료",
      detail: d.test_count ? `테스트 ${d.test_count}회` : "",
      tag: "생산",
    });
  if (d.delivered_at)
    evs.push({
      date: d.delivered_at,
      title: "납품 · 설치",
      detail: [(d as any).hospitals?.name, d.install_place, d.biz]
        .filter(Boolean)
        .join(" · "),
      tag: "설치",
    });
  for (const t of (asRows ?? []) as any[])
    evs.push({
      date: (t.received_at ?? "").slice(0, 10),
      title: `A/S ${t.priority ?? ""}`,
      detail: [t.hospital_name, t.symptom, t.parts && `교체: ${t.parts}`]
        .filter(Boolean)
        .join(" · "),
      tag: "A/S",
    });
  for (const l of (dlRows ?? []) as any[])
    evs.push({
      date: l.log_date ?? "",
      title:
        l.kind === "in"
          ? `대리점 발송${l.purpose === "데모용" ? " (데모용)" : ""}`
          : "대리점 → 병원 출고",
      detail: [l.dealer, l.hospital, l.method].filter(Boolean).join(" · "),
      tag: "대리점",
    });
  for (const a of (acRows ?? []) as any[])
    evs.push({
      date: a.visit_date ?? "",
      title: `대리점 ${a.type}`,
      detail: [a.dealer, a.hospital, a.checked, a.replaced && `교체: ${a.replaced}`]
        .filter(Boolean)
        .join(" · "),
      tag: "사후관리",
    });

  evs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="max-w-[760px]">
      <Link href="/devices" className="text-[13px] text-accent font-semibold">
        ← 기기 등록으로
      </Link>
      <div className="flex items-center gap-3 mt-2 mb-1 flex-wrap">
        <h1 className="text-xl font-bold font-mono">{serial}</h1>
        <span className="text-[13px] text-ink-2">
          {d.model === "OS1" ? "OCTA-SELL 1" : "OCTA-SELL 2"} · {d.category}
        </span>
        <Link
          href={`/devices/${d.id}/edit`}
          className="text-[12.5px] font-semibold text-accent hover:underline"
        >
          수정
        </Link>
      </div>
      <p className="text-[13px] text-ink-3 mb-5">
        현재 위치: {(d as any).hospitals?.name ?? "사내"}
        {d.status ? ` · ${d.status}` : ""}
      </p>

      <div className="bg-surface border border-line rounded-xl p-5">
        <h2 className="font-bold text-[14px] mb-4">이력 추적</h2>
        {evs.length === 0 ? (
          <p className="text-[13px] text-ink-3">기록된 이력이 없습니다.</p>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-1.5 bottom-1.5 w-0.5 bg-line" />
            <div className="flex flex-col gap-5">
              {evs.map((e, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-surface border-2 border-accent" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full " +
                        (TAG[e.tag] ?? "bg-surface-2 text-ink-2")
                      }
                    >
                      {e.tag}
                    </span>
                    <span className="text-[13px] font-semibold">{e.title}</span>
                    <span className="text-[12px] text-ink-3 tabular-nums ml-auto">
                      {e.date || "—"}
                    </span>
                  </div>
                  {e.detail && (
                    <div className="text-[12px] text-ink-2 mt-1">{e.detail}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
