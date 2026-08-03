import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import PhotoUpload from "@/components/PhotoUpload";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

function typePill(t: string) {
  return t === "정기점검"
    ? "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]"
    : "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]";
}
function statusPill(s: string) {
  return s === "예정"
    ? "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]"
    : "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]";
}
function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v || "[]"));
  } catch {
    return [];
  }
}

async function addAftercare(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let dealer = String(formData.get("dealer") || "");
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role, dealer")
      .eq("id", user.id)
      .single();
    if (prof?.role === "dealer" && prof.dealer) dealer = prof.dealer;
  }
  const usedItem = String(formData.get("used_item") || "").trim();
  const usedQty = Math.max(0, parseInt(String(formData.get("used_qty") || "0"), 10) || 0);
  await supabase.from("aftercare").insert({
    dealer,
    hospital: String(formData.get("hospital") || ""),
    serial: String(formData.get("serial") || ""),
    type: String(formData.get("type") || "정기점검"),
    visit_date: formData.get("visit_date")
      ? String(formData.get("visit_date"))
      : null,
    checked: String(formData.get("checked") || ""),
    replaced: String(formData.get("replaced") || ""),
    photos: parseJson(formData.get("photos")),
    status: String(formData.get("status") || "완료"),
    part_sent: formData.get("part_sent") === "on",
    part_sent_note: String(formData.get("part_sent_note") || ""),
    used_item: usedItem,
    used_qty: usedQty,
    note: String(formData.get("note") || ""),
  });
  // 사용/교체한 부품만큼 대리점 재고 차감
  if (dealer && usedItem && usedQty > 0) {
    const { data: ds } = await supabase
      .from("dealer_stock")
      .select("id, qty")
      .eq("dealer", dealer)
      .eq("item", usedItem)
      .maybeSingle();
    if (ds) {
      await supabase
        .from("dealer_stock")
        .update({ qty: Math.max(0, (ds.qty ?? 0) - usedQty) })
        .eq("id", ds.id);
    }
  }
  await logAudit(
    "등록",
    "사후관리",
    `${dealer} · ${String(formData.get("type") || "정기점검")} · ${String(formData.get("hospital") || "")}`,
  );
  revalidatePath("/aftercare");
}

export default async function AftercarePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, dealer")
    .eq("id", user?.id ?? "")
    .single();
  const isDealer = prof?.role === "dealer";
  const myDealer = prof?.dealer ?? "";

  const [
    { data: recRaw },
    { data: dealersRaw },
    { data: stockRaw },
    { data: partsRaw },
    { data: inLogsRaw },
  ] = await Promise.all([
    supabase
      .from("aftercare")
      .select("*")
      .order("visit_date", { ascending: false, nullsFirst: false }),
    supabase.from("dealers").select("name").order("name"),
    supabase.from("dealer_stock").select("*").order("item"),
    supabase.from("parts").select("name").order("name"),
    supabase.from("dealer_logs").select("serial, dealer, kind").eq("kind", "in"),
  ]);
  const allRecords = (recRaw ?? []) as any[];
  const records = isDealer
    ? allRecords.filter((r) => r.dealer === myDealer)
    : allRecords;
  // 대리점은 자기 것만; 본사는 전체
  const dealers = isDealer ? [] : ((dealersRaw ?? []) as any[]);
  const allStock = (stockRaw ?? []) as any[];
  const myStock = isDealer
    ? allStock.filter((s) => s.dealer === myDealer)
    : allStock;
  const parts = (partsRaw ?? []) as any[];
  // 사용 부품 선택지: 대리점은 자기 재고 품목, 본사는 전체 부품
  const usedOptions = isDealer
    ? myStock.map((s) => s.item)
    : Array.from(new Set(parts.map((p) => p.name)));
  // 본사에서 받은 기기(발송분) — 납품 등록 시 선택
  const inLogs = (inLogsRaw ?? []) as any[];
  const receivedSerials = Array.from(
    new Set(
      inLogs
        .filter((l) => !isDealer || l.dealer === myDealer)
        .map((l) => l.serial)
        .filter(Boolean),
    ),
  );

  const checkDone = records.filter(
    (r) => r.type === "정기점검" && r.status === "완료",
  ).length;
  const checkPlan = records.filter(
    (r) => r.type === "정기점검" && r.status === "예정",
  ).length;

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">대리점 사후관리</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        대리점이 나간 정기점검·A/S 기록 · 점검 사진 · 교체 사항
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12.5px] font-semibold text-ink-2">
            정기점검 완료
          </div>
          <div className="text-3xl font-bold mt-1.5">
            {checkDone}
            <span className="text-sm text-ink-3"> 건</span>
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12.5px] font-semibold text-ink-2">
            정기점검 예정
          </div>
          <div className="text-3xl font-bold mt-1.5">
            {checkPlan}
            <span className="text-sm text-ink-3"> 건</span>
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12.5px] font-semibold text-ink-2">
            전체 기록
          </div>
          <div className="text-3xl font-bold mt-1.5">
            {records.length}
            <span className="text-sm text-ink-3"> 건</span>
          </div>
        </div>
      </div>

      {myStock.length > 0 && (
        <div className="bg-surface border border-line rounded-xl p-4 mb-5">
          <h2 className="font-bold text-[14px] mb-2">
            {isDealer ? "우리 대리점 재고" : "대리점 재고"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {myStock.map((s) => (
              <span
                key={s.id}
                className="text-[12.5px] font-semibold bg-surface-2 border border-line rounded-full px-3 py-1"
              >
                {!isDealer && (
                  <span className="text-ink-3">{s.dealer} · </span>
                )}
                {s.item} <b className="text-accent-ink">{s.qty}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        {/* 목록 */}
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-bold text-[14px]">사후관리 기록</h2>
          </div>
          <div className="divide-y divide-line-2">
            {records.map((r) => {
              const photos: string[] = Array.isArray(r.photos) ? r.photos : [];
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={
                        "text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full " +
                        typePill(r.type)
                      }
                    >
                      {r.type}
                    </span>
                    <a
                      href={`/aftercare/${r.id}`}
                      className="text-[13px] font-semibold hover:text-accent hover:underline"
                      title="상세 보기"
                    >
                      {r.dealer}
                      <span className="text-[12px] font-normal text-ink-2">
                        {" "}
                        → {r.hospital}
                      </span>
                    </a>
                    {r.serial && (
                      <span className="font-mono text-[11.5px] text-ink-3">
                        {r.serial}
                      </span>
                    )}
                    <span
                      className={
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full " +
                        statusPill(r.status)
                      }
                    >
                      {r.status}
                    </span>
                    <span className="ml-auto text-[11.5px] text-ink-3 tabular-nums">
                      {r.visit_date ?? "—"}
                    </span>
                    <a
                      href={`/aftercare/${r.id}`}
                      className="text-[12px] font-semibold px-2 py-1 rounded-md border border-line hover:bg-surface-2"
                    >
                      보기
                    </a>
                    <a
                      href={`/aftercare/${r.id}/edit`}
                      className="text-[12px] font-semibold text-accent hover:underline"
                    >
                      수정
                    </a>
                  </div>
                  {(r.checked || r.replaced) && (
                    <div className="text-[12px] text-ink-2 mt-1.5">
                      {r.checked && <span>점검: {r.checked}</span>}
                      {r.replaced && (
                        <span className="text-[color:var(--warn-ink)]">
                          {r.checked ? " · " : ""}교체: {r.replaced}
                        </span>
                      )}
                    </div>
                  )}
                  {r.used_item && r.used_qty > 0 && (
                    <div className="text-[11.5px] text-ink-3 mt-1">
                      사용 부품: <b className="text-ink-2">{r.used_item}</b>{" "}
                      {r.used_qty}개 (대리점 재고 차감)
                    </div>
                  )}
                  {r.part_sent && (
                    <div className="mt-1.5">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]">
                        본사 부품 발송
                        {r.part_sent_note ? ` · ${r.part_sent_note}` : ""}
                      </span>
                    </div>
                  )}
                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {photos.map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u}
                            alt="점검 사진"
                            className="w-14 h-14 object-cover rounded-lg border border-line"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {records.length === 0 && (
              <div className="px-4 py-10 text-center text-ink-3 text-[13px]">
                기록이 없습니다. 오른쪽에서 등록하세요.
              </div>
            )}
          </div>
        </div>

        {/* 등록 폼 */}
        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-1">사후관리 등록</h2>
          <p className="text-[11.5px] text-ink-3 mb-3">
            정기점검·A/S·<b>납품</b> 기록. 본사에서 받은 기기를 병원에 납품하면
            유형을 「납품」으로 선택하세요.
          </p>
          <form action={addAftercare} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>유형</label>
                <select name="type" className={inputCls} defaultValue="정기점검">
                  <option>정기점검</option>
                  <option>A/S</option>
                  <option>납품</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>상태</label>
                <select name="status" className={inputCls} defaultValue="완료">
                  <option>완료</option>
                  <option>예정</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>대리점</label>
                {isDealer ? (
                  <input
                    name="dealer"
                    className={inputCls + " opacity-70"}
                    defaultValue={myDealer}
                    readOnly
                  />
                ) : (
                  <input name="dealer" className={inputCls} list="dealerNames" placeholder="영남지사" />
                )}
              </div>
              <div>
                <label className={labelCls}>방문일</label>
                <input name="visit_date" type="date" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>병원</label>
                <input name="hospital" className={inputCls} placeholder="창원밝은안과" />
              </div>
              <div>
                <label className={labelCls}>기기 고유번호 (받은 기기)</label>
                <input
                  name="serial"
                  className={inputCls}
                  list="receivedSerials"
                  placeholder="OS2-2403-011"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>점검 사항</label>
              <textarea name="checked" rows={2} className={inputCls + " h-auto py-2"} placeholder="급배수·필터 상태 등" />
            </div>
            <div>
              <label className={labelCls}>교체 사항 (메모)</label>
              <textarea name="replaced" rows={2} className={inputCls + " h-auto py-2"} placeholder="교체한 부품이 있으면" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>사용/교체 부품 (재고 차감)</label>
                <select name="used_item" className={inputCls} defaultValue="">
                  <option value="">없음</option>
                  {usedOptions.map((it) => (
                    <option key={it} value={it}>
                      {it}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>사용 수량</label>
                <input name="used_qty" type="number" min={0} defaultValue={0} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>사진 (점검·납품 환경)</label>
              <PhotoUpload name="photos" />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input name="part_sent" type="checkbox" className="w-4 h-4" />
              고장 부품 본사 발송 (본사에서 직접 점검)
            </label>
            <div>
              <label className={labelCls}>발송 부품 / 방법 (해당 시)</label>
              <input
                name="part_sent_note"
                className={inputCls}
                placeholder="예: 급수 호스 · 택배 송장 0000"
              />
            </div>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              기록 등록
            </button>
          </form>
        </div>
      </div>

      <datalist id="dealerNames">
        {dealers.map((d) => (
          <option key={d.name} value={d.name} />
        ))}
      </datalist>
      <datalist id="receivedSerials">
        {receivedSerials.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
