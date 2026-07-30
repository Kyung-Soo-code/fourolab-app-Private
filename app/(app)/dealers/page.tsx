import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import PeopleEditor from "@/components/PeopleEditor";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

const okPill = "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]";
const infoPill = "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]";
const warnPill = "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]";

function statusPill(s: string) {
  if (s.includes("예정")) return infoPill;
  if (s.includes("대기")) return warnPill;
  return okPill;
}
function n(v: FormDataEntryValue | null) {
  const x = parseInt(String(v ?? "0"), 10);
  return Number.isFinite(x) ? x : 0;
}
function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v || "[]"));
  } catch {
    return [];
  }
}

async function addDealer(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await supabase.from("dealers").insert({
    name,
    region: String(formData.get("region") || ""),
    addr: String(formData.get("addr") || ""),
    tel: String(formData.get("tel") || ""),
    fax: String(formData.get("fax") || ""),
    email: String(formData.get("email") || ""),
    note: String(formData.get("note") || ""),
    contacts: parseJson(formData.get("contacts")),
  });
  revalidatePath("/dealers");
}

async function addIn(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const serial = String(formData.get("serial") || "").trim();
  if (!serial) return;
  await supabase.from("dealer_logs").insert({
    kind: "in",
    serial,
    model: String(formData.get("model") || "OS2"),
    purpose: String(formData.get("purpose") || "완성품"),
    dealer: String(formData.get("dealer") || ""),
    method: String(formData.get("method") || ""),
    status: String(formData.get("status") || "대리점 보관"),
    log_date: formData.get("log_date") ? String(formData.get("log_date")) : null,
  });
  revalidatePath("/dealers");
}

async function addOut(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const serial = String(formData.get("serial") || "").trim();
  if (!serial) return;
  await supabase.from("dealer_logs").insert({
    kind: "out",
    serial,
    dealer: String(formData.get("dealer") || ""),
    hospital: String(formData.get("hospital") || ""),
    status: String(formData.get("status") || "납품 완료"),
    log_date: formData.get("log_date") ? String(formData.get("log_date")) : null,
  });
  revalidatePath("/dealers");
}

async function addSupply(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const item = String(formData.get("item") || "").trim();
  if (!item) return;
  const qty = n(formData.get("qty"));
  await supabase.from("dealer_supplies").insert({
    dealer: String(formData.get("dealer") || ""),
    item,
    qty,
    unit: String(formData.get("unit") || ""),
    method: String(formData.get("method") || "택배"),
    sent_at: formData.get("sent_at") ? String(formData.get("sent_at")) : null,
    note: String(formData.get("note") || ""),
  });
  // 본사 부품 재고 차감 (통일)
  const { data: pr } = await supabase
    .from("parts")
    .select("id, stock")
    .eq("name", item)
    .limit(1)
    .maybeSingle();
  if (pr) {
    await supabase
      .from("parts")
      .update({ stock: Math.max(0, (pr.stock ?? 0) - qty) })
      .eq("id", pr.id);
  }
  // 대리점 재고 증가
  const dealerName = String(formData.get("dealer") || "").trim();
  if (dealerName) {
    const { data: ds } = await supabase
      .from("dealer_stock")
      .select("id, qty")
      .eq("dealer", dealerName)
      .eq("item", item)
      .maybeSingle();
    if (ds) {
      await supabase
        .from("dealer_stock")
        .update({ qty: (ds.qty ?? 0) + qty })
        .eq("id", ds.id);
    } else {
      await supabase
        .from("dealer_stock")
        .insert({ dealer: dealerName, item, qty });
    }
  }
  revalidatePath("/dealers");
  revalidatePath("/inventory");
  revalidatePath("/aftercare");
}

async function deleteSupply(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase
    .from("dealer_supplies")
    .delete()
    .eq("id", String(formData.get("id")));
  revalidatePath("/dealers");
}

export default async function DealersPage() {
  const supabase = await createClient();
  const [
    { data: dealersRaw },
    { data: logsRaw },
    { data: supRaw },
    { data: partsRaw },
  ] = await Promise.all([
    supabase.from("dealers").select("*").order("name"),
    supabase
      .from("dealer_logs")
      .select("*")
      .order("log_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("dealer_supplies")
      .select("*")
      .order("sent_at", { ascending: false, nullsFirst: false }),
    supabase.from("parts").select("id, name").order("name"),
  ]);
  const dealers = (dealersRaw ?? []) as any[];
  const parts = (partsRaw ?? []) as any[];
  const logs = (logsRaw ?? []) as any[];
  const supplies = (supRaw ?? []) as any[];
  const ins = logs.filter((l) => l.kind === "in");
  const outs = logs.filter((l) => l.kind === "out");

  // 총 발송 현황 (품목별 합계)
  const summary = new Map<string, { item: string; unit: string; qty: number }>();
  for (const s of supplies) {
    const key = `${s.item}__${s.unit}`;
    const cur = summary.get(key) ?? { item: s.item, unit: s.unit, qty: 0 };
    cur.qty += s.qty ?? 0;
    summary.set(key, cur);
  }
  const summaryArr = [...summary.values()].sort((a, b) => b.qty - a.qty);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-bold mb-1">대리점 관리</h1>
        <p className="text-[13px] text-ink-3">
          거래처·담당자 · 기기 발송/출고 · 부품·정제염 발송
        </p>
      </div>

      {/* 1. 대리점 거래처 */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-bold text-[14px]">대리점 거래처</h2>
          </div>
          <div className="divide-y divide-line-2">
            {dealers.map((d) => {
              const contacts: any[] = Array.isArray(d.contacts) ? d.contacts : [];
              return (
                <div key={d.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{d.name}</span>
                      {d.region && (
                        <span className="text-[11.5px] text-ink-3">
                          {d.region}
                        </span>
                      )}
                    </div>
                    {contacts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {contacts.map((c, i) => (
                          <span
                            key={i}
                            className="text-[11.5px] bg-surface-2 border border-line rounded-full px-2 py-0.5"
                          >
                            {c.role && <span className="text-ink-3">{c.role} </span>}
                            <span className="font-semibold">{c.name}</span>
                            {c.tel && <span className="text-ink-3"> · {c.tel}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                    {(d.addr || d.tel || d.fax || d.email) && (
                      <div className="text-[11.5px] text-ink-3 mt-1.5 leading-relaxed">
                        {d.addr && <div>{d.addr}</div>}
                        <div className="flex flex-wrap gap-x-3">
                          {d.tel && <span>Tel {d.tel}</span>}
                          {d.fax && <span>Fax {d.fax}</span>}
                          {d.email && <span>{d.email}</span>}
                        </div>
                      </div>
                    )}
                    {d.note && (
                      <div className="text-[11.5px] text-accent-ink mt-1">
                        {d.note}
                      </div>
                    )}
                  </div>
                  <a
                    href={`/dealers/registry/${d.id}/edit`}
                    className="text-[12px] font-semibold text-accent hover:underline shrink-0"
                  >
                    수정
                  </a>
                </div>
              );
            })}
            {dealers.length === 0 && (
              <div className="px-4 py-8 text-center text-ink-3 text-[13px]">
                등록된 대리점이 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">거래처 등록</h2>
          <form action={addDealer} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>대리점명</label>
                <input name="name" className={inputCls} placeholder="영남지사" required />
              </div>
              <div>
                <label className={labelCls}>지역</label>
                <input name="region" className={inputCls} placeholder="부산·경남" />
              </div>
            </div>
            <div>
              <label className={labelCls}>주소</label>
              <input name="addr" className={inputCls} placeholder="시/도 시군구 도로명" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>대표번호</label>
                <input name="tel" className={inputCls} placeholder="053-000-0000" />
              </div>
              <div>
                <label className={labelCls}>팩스</label>
                <input name="fax" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>이메일</label>
              <input name="email" className={inputCls} placeholder="name@company.com" />
            </div>
            <div>
              <label className={labelCls}>담당자 (여러 명)</label>
              <PeopleEditor name="contacts" />
            </div>
            <div>
              <label className={labelCls}>메모 (담당 병원 등)</label>
              <input name="note" className={inputCls} placeholder="담당: ○○병원" />
            </div>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              거래처 등록
            </button>
          </form>
        </div>
      </div>

      {/* 2. 본사 → 대리점 발송 */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-bold text-[14px]">본사 → 대리점 기기 발송</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-3 text-left">
                  <th className="font-semibold px-3 py-2.5">고유번호</th>
                  <th className="font-semibold px-3 py-2.5">대리점</th>
                  <th className="font-semibold px-3 py-2.5">발송일/방법</th>
                  <th className="font-semibold px-3 py-2.5">상태</th>
                  <th className="font-semibold px-3 py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {ins.map((l) => (
                  <tr key={l.id} className="border-t border-line-2">
                    <td className="px-3 py-3 font-mono text-[12px] font-semibold">
                      {l.serial}
                      {l.purpose === "데모용" && (
                        <span className="ml-1.5 font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[color:var(--info-bg)] text-[color:var(--info-ink)]">
                          데모용
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-2">{l.dealer}</td>
                    <td className="px-3 py-3 text-ink-2 tabular-nums whitespace-nowrap">
                      {l.log_date ?? "—"}
                      {l.method && <span className="text-ink-3"> · {l.method}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          "text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap " +
                          statusPill(l.status || "")
                        }
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <a
                        href={`/dealers/${l.id}/edit`}
                        className="text-[12px] font-semibold text-accent hover:underline"
                      >
                        수정
                      </a>
                    </td>
                  </tr>
                ))}
                {ins.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-3 text-[13px]">
                      발송 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">기기 발송 등록</h2>
          <form action={addIn} className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>고유번호</label>
              <input name="serial" className={inputCls} placeholder="OS2-2406-024" required />
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
                <label className={labelCls}>대리점</label>
                <input name="dealer" className={inputCls} list="dealerNames" placeholder="영남지사" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>발송일</label>
                <input name="log_date" type="date" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>운송 방법</label>
                <select name="method" className={inputCls} defaultValue="화물">
                  <option>화물</option>
                  <option>직접</option>
                  <option>택배</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>용도</label>
                <select name="purpose" className={inputCls} defaultValue="완성품">
                  <option>완성품</option>
                  <option>데모용</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>상태</label>
                <select name="status" className={inputCls} defaultValue="대리점 보관">
                  <option>대리점 보관</option>
                  <option>출고 예정</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              발송 등록
            </button>
          </form>
        </div>
      </div>

      {/* 3. 대리점 → 병원 출고 */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h2 className="font-bold text-[14px]">대리점 → 병원 출고</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-3 text-left">
                  <th className="font-semibold px-3 py-2.5">고유번호</th>
                  <th className="font-semibold px-3 py-2.5">대리점 → 병원</th>
                  <th className="font-semibold px-3 py-2.5">출고일</th>
                  <th className="font-semibold px-3 py-2.5">상태</th>
                  <th className="font-semibold px-3 py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {outs.map((l) => (
                  <tr key={l.id} className="border-t border-line-2">
                    <td className="px-3 py-3 font-mono text-[12px] font-semibold">
                      {l.serial}
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      {l.dealer} → {l.hospital}
                    </td>
                    <td className="px-3 py-3 text-ink-2 tabular-nums">
                      {l.log_date ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          "text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap " +
                          statusPill(l.status || "")
                        }
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <a
                        href={`/dealers/${l.id}/edit`}
                        className="text-[12px] font-semibold text-accent hover:underline"
                      >
                        수정
                      </a>
                    </td>
                  </tr>
                ))}
                {outs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-3 text-[13px]">
                      출고 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">병원 출고 등록</h2>
          <form action={addOut} className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>고유번호</label>
              <input name="serial" className={inputCls} placeholder="OS2-2403-011" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>대리점</label>
                <input name="dealer" className={inputCls} list="dealerNames" placeholder="영남지사" />
              </div>
              <div>
                <label className={labelCls}>출고일</label>
                <input name="log_date" type="date" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>납품 병원</label>
              <input name="hospital" className={inputCls} placeholder="창원밝은안과" />
            </div>
            <div>
              <label className={labelCls}>상태</label>
              <select name="status" className={inputCls} defaultValue="납품 완료">
                <option>납품 완료</option>
                <option>설치 대기</option>
              </select>
            </div>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              출고 등록
            </button>
          </form>
        </div>
      </div>

      {/* 4. 부품·소모품(정제염) 발송 */}
      <div>
        {summaryArr.length > 0 && (
          <div className="bg-surface border border-line rounded-xl p-4 mb-4">
            <div className="text-[13px] font-bold mb-2">총 발송 현황 (품목별 합계)</div>
            <div className="flex flex-wrap gap-2">
              {summaryArr.map((s) => (
                <span
                  key={s.item + s.unit}
                  className="text-[12.5px] font-semibold bg-accent-bg text-accent-ink rounded-full px-3 py-1"
                >
                  {s.item} {s.qty}
                  {s.unit}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-line">
              <h2 className="font-bold text-[14px]">부품·소모품 발송 (정제염 등)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-ink-3 text-left">
                    <th className="font-semibold px-3 py-2.5">발송일</th>
                    <th className="font-semibold px-3 py-2.5">대리점</th>
                    <th className="font-semibold px-3 py-2.5">품목</th>
                    <th className="font-semibold px-3 py-2.5">수량</th>
                    <th className="font-semibold px-3 py-2.5">방법</th>
                    <th className="font-semibold px-3 py-2.5 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {supplies.map((s) => (
                    <tr key={s.id} className="border-t border-line-2">
                      <td className="px-3 py-3 text-ink-2 tabular-nums whitespace-nowrap">
                        {s.sent_at ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-ink-2">{s.dealer}</td>
                      <td className="px-3 py-3 font-semibold text-ink">
                        {s.item}
                        {s.note && (
                          <span className="text-[11px] text-ink-3 font-normal">
                            {" "}
                            · {s.note}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-ink-2 tabular-nums">
                        {s.qty}
                        {s.unit}
                      </td>
                      <td className="px-3 py-3 text-ink-2">{s.method}</td>
                      <td className="px-3 py-3 text-right">
                        <form action={deleteSupply}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="text-[12px] text-ink-3 hover:text-[color:var(--crit-ink)]">
                            삭제
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {supplies.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ink-3 text-[13px]">
                        발송 기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-xl p-4 h-fit">
            <h2 className="font-bold text-[14px] mb-3">소모품 발송 등록</h2>
            <form action={addSupply} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>대리점</label>
                  <input name="dealer" className={inputCls} list="dealerNames" placeholder="영남지사" />
                </div>
                <div>
                  <label className={labelCls}>발송일</label>
                  <input name="sent_at" type="date" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>품목 (부품 목록에서 선택)</label>
                <select name="item" className={inputCls} required defaultValue="">
                  <option value="" disabled>
                    부품 선택…
                  </option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>수량</label>
                  <input name="qty" type="number" className={inputCls} defaultValue={0} />
                </div>
                <div>
                  <label className={labelCls}>단위</label>
                  <input name="unit" className={inputCls} list="units" placeholder="포" />
                </div>
                <div>
                  <label className={labelCls}>방법</label>
                  <select name="method" className={inputCls} defaultValue="택배">
                    <option>택배</option>
                    <option>화물</option>
                    <option>직접</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>메모</label>
                <input name="note" className={inputCls} placeholder="송장번호·용도 등" />
              </div>
              <button
                type="submit"
                className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
              >
                발송 등록
              </button>
            </form>
          </div>
        </div>
      </div>

      <datalist id="dealerNames">
        {dealers.map((d) => (
          <option key={d.id} value={d.name} />
        ))}
      </datalist>
      <datalist id="itemNames">
        <option value="정제염" />
        <option value="필터" />
        <option value="급수 호스" />
        <option value="피팅" />
        <option value="A/S 공구세트" />
      </datalist>
      <datalist id="units">
        <option value="포" />
        <option value="개" />
        <option value="set" />
        <option value="박스" />
      </datalist>
    </div>
  );
}
