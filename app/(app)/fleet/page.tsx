import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg";

function modelName(m?: string | null) {
  return m === "OS1" ? "OCTA-SELL 1" : m === "OS2" ? "OCTA-SELL 2" : m || "";
}

const TABS = [
  { k: "all", label: "전체" },
  { k: "OS2", label: "OCTA-SELL 2" },
  { k: "OS1", label: "OCTA-SELL 1" },
];

// 데모 회수 → 완성품 재고로 복귀
async function recoverDemo(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const comment = String(formData.get("comment") || "").trim();
  const { data: d } = await supabase
    .from("devices")
    .select("note")
    .eq("id", id)
    .maybeSingle();
  const note = [d?.note || "", comment ? `데모 회수: ${comment}` : ""]
    .filter(Boolean)
    .join(" / ");
  await supabase
    .from("devices")
    .update({
      category: "완성품",
      hospital_id: null,
      status: "회수·완성품",
      note,
    })
    .eq("id", id);
  await logAudit("수정", "기기", `데모 회수 (id ${id.slice(0, 8)})`);
  revalidatePath("/fleet");
  revalidatePath("/devices");
}

// 테스트 중 부품 교체 → 부품 재고 차감 + 기기 이력 기록
async function swapPart(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const deviceId = String(formData.get("device_id"));
  const partId = String(formData.get("part_id"));
  const qty = Math.max(1, parseInt(String(formData.get("qty") || "1"), 10) || 1);
  const reason = String(formData.get("reason") || "").trim();
  if (!partId) return;
  const { data: pr } = await supabase
    .from("parts")
    .select("id, name, stock")
    .eq("id", partId)
    .maybeSingle();
  if (pr) {
    await supabase
      .from("parts")
      .update({ stock: Math.max(0, (pr.stock ?? 0) - qty) })
      .eq("id", pr.id);
    const { data: dv } = await supabase
      .from("devices")
      .select("test_issue")
      .eq("id", deviceId)
      .maybeSingle();
    const issue = [
      dv?.test_issue || "",
      `${pr.name} 교체 (재고 −${qty})${reason ? ` · ${reason}` : ""}`,
    ]
      .filter(Boolean)
      .join(" / ");
    await supabase
      .from("devices")
      .update({ test_issue: issue })
      .eq("id", deviceId);
    await logAudit("수정", "테스트", `${pr.name} ${qty}개 교체 (재고 차감)`);
  }
  revalidatePath("/fleet");
  revalidatePath("/inventory");
}

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string }>;
}) {
  const sp = await searchParams;
  const model = sp.model ?? "all";
  const supabase = await createClient();

  const [{ data: devRaw }, { data: partsRaw }, { data: evRaw }] =
    await Promise.all([
      supabase.from("devices").select("*, hospitals(name)").order("serial"),
      supabase.from("parts").select("id, name, model").order("name"),
      supabase
        .from("events")
        .select("*")
        .order("event_date", { nullsFirst: false }),
    ]);
  const all = (devRaw ?? []) as any[];
  const parts = (partsRaw ?? []) as any[];
  const events = (evRaw ?? []) as any[];

  const devices =
    model === "all" ? all : all.filter((d) => d.model === model);

  const cnt = (c: string) => devices.filter((d) => d.category === c).length;
  const demos = devices.filter((d) => d.category === "데모");
  const builds = devices.filter((d) => d.category === "완성품");

  const done = cnt("완성품");
  const demo = cnt("데모");
  const exhibit = cnt("전시");
  const asCnt = cnt("A/S");
  const deliver = cnt("납품");
  const demoOnsite = demos.filter((d) => d.hospital_id).length;
  const demoInternal = demo - demoOnsite;

  const cntM = (c: string, m: string) =>
    devices.filter((d) => d.category === c && d.model === m).length;

  // 일정에 등록된 출고 예정 (현재 모델 탭 기준)
  const evItems = (e: any) => (Array.isArray(e.out_items) ? e.out_items : []);
  const outEvents = events.filter((e) =>
    evItems(e).some((it: any) => model === "all" || it.model === model),
  );
  const plannedMap: Record<string, number> = {};
  let plannedTotal = 0;
  for (const e of events) {
    for (const it of evItems(e)) {
      if (model !== "all" && it.model !== model) continue;
      const k = `${it.model}|${it.kind}`;
      plannedMap[k] = (plannedMap[k] ?? 0) + (it.qty ?? 0);
      plannedTotal += it.qty ?? 0;
    }
  }
  const plannedKeys = Object.keys(plannedMap);
  const CARDS = [
    { k: "완성품", label: "완성품", total: done },
    { k: "데모", label: "데모용", total: demo },
    { k: "전시", label: "전시용", total: exhibit },
    { k: "A/S", label: "A/S용", total: asCnt },
    { k: "납품", label: "납품 완료", total: deliver },
  ];

  const BAR: [string, number, string][] = [
    ["완성품", done, "var(--accent)"],
    ["데모", demo, "var(--info-ink)"],
    ["전시", exhibit, "var(--warn-ink)"],
    ["A/S", asCnt, "var(--crit-ink)"],
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">기기 현황</h1>
      <p className="text-[13px] text-ink-3 mb-3">
        완성품·데모·전시·A/S 재고 · 데모 회수 · 완성품 테스트
      </p>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TABS.map((t) => {
          const active = model === t.k;
          return (
            <Link
              key={t.k}
              href={t.k === "all" ? "/fleet" : `/fleet?model=${t.k}`}
              className={
                "px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border " +
                (active
                  ? "bg-accent text-white border-accent"
                  : "bg-surface text-ink-2 border-line hover:bg-surface-2")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* 기기 배치 현황 */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-bold text-[14px]">기기 배치 현황</h2>
          <span className="ml-auto text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[color:var(--info-bg)] text-[color:var(--info-ink)]">
            데모 진행 중 {demo}대
          </span>
        </div>
        <div className="flex h-7 rounded-lg overflow-hidden gap-0.5 mb-3">
          {BAR.filter(([, c]) => c > 0).map(([label, c, color]) => (
            <div
              key={label}
              style={{ flex: c, background: color }}
              className="grid place-items-center text-white text-[11px] font-bold min-w-0"
            >
              {label} {c}
            </div>
          ))}
          {done + demo + exhibit + asCnt === 0 && (
            <div className="flex-1 grid place-items-center text-ink-3 text-[12px] bg-surface-2">
              사내 기기 없음
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--accent)" }} />
            완성품 {done}대
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--info-ink)" }} />
            데모 {demo}대 · 현장 {demoOnsite} / 사내 {demoInternal}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--warn-ink)" }} />
            전시 {exhibit}대
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--crit-ink)" }} />
            A/S {asCnt}대
          </span>
          {deliver > 0 && (
            <span className="text-ink-3">· 납품(출고) {deliver}대</span>
          )}
        </div>
      </div>

      {/* 구분별 카드 (OCTA-SELL 1 / 2 분리) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {CARDS.map((c) => (
          <div key={c.k} className="bg-surface border border-line rounded-xl p-4">
            <div className="text-[12px] text-ink-3 font-semibold">
              {c.label}
            </div>
            <div className="text-3xl font-bold mt-1">
              {c.total}
              <span className="text-sm text-ink-3"> 대</span>
            </div>
            <div className="flex gap-3 mt-2 pt-2 border-t border-line-2 text-[12px]">
              <span className="text-ink-2">
                OCTA-SELL 1{" "}
                <b className="text-ink tabular-nums">{cntM(c.k, "OS1")}</b>
              </span>
              <span className="text-ink-2">
                2 <b className="text-ink tabular-nums">{cntM(c.k, "OS2")}</b>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 출고 예정 (일정 연동) */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2 flex-wrap">
          <h2 className="font-bold text-[14px]">출고 예정 (일정 연동)</h2>
          <span className="text-[12px] text-ink-3">
            전시·일정에 등록된 납품·데모·전시 출고
          </span>
          <span className="ml-auto text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[color:var(--info-bg)] text-[color:var(--info-ink)]">
            총 {plannedTotal}대
          </span>
        </div>

        {plannedKeys.length > 0 && (
          <div className="px-4 py-3 border-b border-line-2 flex flex-wrap gap-2">
            {plannedKeys.map((k) => {
              const [m, kind] = k.split("|");
              const p = plannedMap[k];
              const have = devices.filter(
                (d) =>
                  d.model === m &&
                  d.category === (kind === "전시용" ? "전시" : "완성품"),
              ).length;
              const short = p > have;
              return (
                <span
                  key={k}
                  className={
                    "text-[12px] font-semibold px-3 py-1 rounded-full border " +
                    (short
                      ? "border-[color:var(--crit-ink)] text-[color:var(--crit-ink)] bg-[color:var(--crit-bg)]"
                      : "border-line text-ink-2 bg-surface-2")
                  }
                >
                  {modelName(m)} · {kind === "전시용" ? "전시용" : "완제품"} 예정{" "}
                  {p} / 보유 {have}
                  {short ? ` · ${p - have}대 부족` : ""}
                </span>
              );
            })}
          </div>
        )}

        <div className="divide-y divide-line-2">
          {outEvents.map((e) => (
            <div key={e.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-[12px] font-mono text-ink-3 w-16 shrink-0">
                {e.event_date ?? "—"}
              </span>
              <span className="text-[13px] font-semibold">{e.title}</span>
              <span className="text-[11.5px] text-ink-3">{e.place}</span>
              {evItems(e)
                .filter((it: any) => model === "all" || it.model === model)
                .map((it: any, i: number) => (
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
              <span className="ml-auto text-[11.5px] text-ink-3">{e.who}</span>
            </div>
          ))}
          {outEvents.length === 0 && (
            <div className="px-4 py-8 text-center text-ink-3 text-[13px]">
              예정된 출고가 없습니다. 전시·일정에서 출고 기기를 등록하세요.
            </div>
          )}
        </div>
      </div>

      {/* 데모 진행 중 */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <h2 className="font-bold text-[14px]">데모 진행 중 기기</h2>
          <span className="ml-auto text-[12px] text-ink-3">
            {demos.length}대 · 회수 시 완성품으로 복귀
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-3 text-left">
                <th className="font-semibold px-4 py-2.5">고유번호</th>
                <th className="font-semibold px-4 py-2.5">모델</th>
                <th className="font-semibold px-4 py-2.5">데모처</th>
                <th className="font-semibold px-4 py-2.5">회수 (사용자 코멘트)</th>
              </tr>
            </thead>
            <tbody>
              {demos.map((d) => (
                <tr key={d.id} className="border-t border-line-2">
                  <td className="px-4 py-3 font-mono text-[12.5px] font-semibold">
                    {d.serial}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{modelName(d.model)}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {d.hospitals?.name ?? "사내"}
                  </td>
                  <td className="px-4 py-3">
                    <form action={recoverDemo} className="flex gap-2">
                      <input type="hidden" name="id" value={d.id} />
                      <input
                        name="comment"
                        placeholder="데모 반응·구매 의향 등"
                        className={inputCls + " flex-1 min-w-0"}
                      />
                      <button className="h-9 px-3 rounded-lg bg-accent text-white text-[12.5px] font-semibold hover:bg-accent-2 whitespace-nowrap">
                        회수
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {demos.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-ink-3 text-[13px]"
                  >
                    데모 진행 중인 기기가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 완성품 테스트 보드 */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <h2 className="font-bold text-[14px]">완성품 · 테스트 보드</h2>
          <span className="ml-auto text-[12px] text-ink-3">
            {builds.length}대 · 부품 교체 시 재고 자동 차감
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-3 text-left">
                <th className="font-semibold px-4 py-2.5">고유번호</th>
                <th className="font-semibold px-4 py-2.5">테스트</th>
                <th className="font-semibold px-4 py-2.5">문제점</th>
                <th className="font-semibold px-4 py-2.5">부품 교체</th>
              </tr>
            </thead>
            <tbody>
              {builds.map((d) => {
                const modelParts = parts.filter(
                  (p) => p.model === d.model || (p.model ?? "공용") === "공용",
                );
                return (
                  <tr key={d.id} className="border-t border-line-2 align-top">
                    <td className="px-4 py-3">
                      <div className="font-mono text-[12.5px] font-semibold">
                        {d.serial}
                      </div>
                      <Link
                        href={`/devices/${d.id}/edit`}
                        className="text-[11px] text-accent font-semibold hover:underline"
                      >
                        테스트 기록 수정
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2 text-[12px] whitespace-nowrap">
                      {d.test_start ? `시작 ${d.test_start}` : "—"}
                      <div className="text-ink-3">
                        {d.test_count ? `${d.test_count}회` : ""}
                        {d.test_end ? ` · 종료 ${d.test_end}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-ink-2 max-w-[220px]">
                      {d.test_issue || (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={swapPart}
                        className="flex flex-wrap gap-1.5 items-center"
                      >
                        <input type="hidden" name="device_id" value={d.id} />
                        <select
                          name="part_id"
                          className={inputCls + " max-w-[130px]"}
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            부품…
                          </option>
                          {modelParts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <input
                          name="qty"
                          type="number"
                          min={1}
                          defaultValue={1}
                          className={inputCls + " w-14"}
                        />
                        <input
                          name="reason"
                          placeholder="사유"
                          className={inputCls + " w-24"}
                        />
                        <button className="h-9 px-2.5 rounded-lg border border-line text-[12px] font-semibold hover:bg-surface-2 whitespace-nowrap">
                          교체
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {builds.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-ink-3 text-[13px]"
                  >
                    완성품 기기가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 납품 완료 기기 */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden mt-6">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <h2 className="font-bold text-[14px]">납품 완료 기기</h2>
          <span className="ml-auto text-[12px] text-ink-3">{deliver}대</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-3 text-left">
                <th className="font-semibold px-4 py-2.5">고유번호</th>
                <th className="font-semibold px-4 py-2.5">모델</th>
                <th className="font-semibold px-4 py-2.5">병원</th>
                <th className="font-semibold px-4 py-2.5">납품일</th>
              </tr>
            </thead>
            <tbody>
              {devices
                .filter((d) => d.category === "납품")
                .map((d) => (
                  <tr key={d.id} className="border-t border-line-2">
                    <td className="px-4 py-3 font-mono text-[12.5px] font-semibold">
                      {d.serial}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {modelName(d.model)}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {d.hospitals?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">
                      {d.delivered_at ?? "—"}
                    </td>
                  </tr>
                ))}
              {deliver === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-ink-3 text-[13px]"
                  >
                    납품 완료 기기가 없습니다.
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
