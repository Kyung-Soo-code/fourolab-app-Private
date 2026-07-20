import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function modelLabel(m?: string | null) {
  if (m === "OS1") return "OCTA-SELL 1";
  if (m === "OS2") return "OCTA-SELL 2";
  return m || "공용";
}

const TABS = [
  { k: "all", label: "전체" },
  { k: "공용", label: "공용" },
  { k: "OS2", label: "OCTA-SELL 2" },
  { k: "OS1", label: "OCTA-SELL 1" },
];

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

function n(v: FormDataEntryValue | null) {
  const x = parseInt(String(v ?? "0"), 10);
  return Number.isFinite(x) ? x : 0;
}

async function createPart(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await supabase.from("parts").insert({
    name,
    model: String(formData.get("model") || "공용"),
    vendor: String(formData.get("vendor") || ""),
    buy_url: String(formData.get("buy_url") || ""),
    price: n(formData.get("price")),
    per_unit: n(formData.get("per_unit")),
    stock: n(formData.get("stock")),
    floor1: n(formData.get("floor1")),
    floor2: n(formData.get("floor2")),
    floor3: n(formData.get("floor3")),
    toolbox: n(formData.get("toolbox")),
    as_type: String(formData.get("as_type") || ""),
    category: String(formData.get("category") || ""),
    note: String(formData.get("note") || ""),
    unit: String(formData.get("unit") || "개"),
    favorite: formData.get("favorite") === "on",
  });
  await logAudit("등록", "부품", name);
  revalidatePath("/inventory");
}

// 완성품 제작 → 해당 모델 BOM(1기당 소요) × 대수만큼 부품 재고 일괄 차감
async function produceUnits(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const model = String(formData.get("model") || "OS2"); // OS1 / OS2
  const qty = Math.max(1, n(formData.get("qty")) || 1);
  const serial = String(formData.get("serial") || "").trim();

  const { data: bomRaw } = await supabase
    .from("parts")
    .select("id, name, per_unit, stock, model")
    .gt("per_unit", 0);
  const bom = ((bomRaw ?? []) as any[]).filter(
    (p) => p.model === model || (p.model ?? "공용") === "공용",
  );

  for (const p of bom) {
    const need = (p.per_unit ?? 0) * qty;
    await supabase
      .from("parts")
      .update({ stock: Math.max(0, (p.stock ?? 0) - need) })
      .eq("id", p.id);
  }

  // 고유번호를 적었으면 완성품 기기로 자동 등록
  if (serial) {
    await supabase.from("devices").insert({
      serial,
      model,
      category: "완성품",
      status: "제작 완료",
      produced_at: new Date().toISOString().slice(0, 10),
    });
  }

  await logAudit(
    "등록",
    "제작",
    `${model === "OS1" ? "OCTA-SELL 1" : "OCTA-SELL 2"} ${qty}대 제작 · 부품 ${bom.length}종 차감${serial ? ` · ${serial}` : ""}`,
  );
  revalidatePath("/inventory");
  revalidatePath("/devices");
  revalidatePath("/fleet");
}

// 불량 / 재고 로스 기록 → 재고 차감
async function addIssue(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const part = String(formData.get("part") || "").trim();
  const qty = n(formData.get("qty"));
  if (!part || qty <= 0) return;
  await supabase.from("stock_issues").insert({
    part,
    type: String(formData.get("type") || "불량"),
    qty,
    reason: String(formData.get("reason") || ""),
    issued_at: formData.get("issued_at")
      ? String(formData.get("issued_at"))
      : null,
  });
  const { data: pr } = await supabase
    .from("parts")
    .select("id, stock")
    .eq("name", part)
    .limit(1)
    .maybeSingle();
  if (pr) {
    await supabase
      .from("parts")
      .update({ stock: Math.max(0, (pr.stock ?? 0) - qty) })
      .eq("id", pr.id);
  }
  await logAudit(
    "등록",
    "불량·로스",
    `${part} ${qty}개 (${String(formData.get("type") || "불량")})`,
  );
  revalidatePath("/inventory");
}

// 발주 등록
async function addOrder(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const part = String(formData.get("part") || "").trim();
  if (!part) return;
  await supabase.from("part_orders").insert({
    part,
    vendor: String(formData.get("vendor") || ""),
    qty: n(formData.get("qty")),
    price: n(formData.get("price")),
    ordered_at: formData.get("ordered_at")
      ? String(formData.get("ordered_at"))
      : null,
    eta: formData.get("eta") ? String(formData.get("eta")) : null,
    note: String(formData.get("note") || ""),
  });
  await logAudit("등록", "발주", `${part} ${n(formData.get("qty"))}개`);
  revalidatePath("/inventory");
}

// 발주 도착 처리 → 재고 자동 반영
async function arriveOrder(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { data: o } = await supabase
    .from("part_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!o || o.arrived) return;
  await supabase
    .from("part_orders")
    .update({
      arrived: true,
      arrived_at: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);
  const { data: pr } = await supabase
    .from("parts")
    .select("id, stock")
    .eq("name", o.part)
    .limit(1)
    .maybeSingle();
  if (pr) {
    await supabase
      .from("parts")
      .update({ stock: (pr.stock ?? 0) + (o.qty ?? 0) })
      .eq("id", pr.id);
  }
  await logAudit("수정", "발주", `도착 처리 · ${o.part} ${o.qty}개`);
  revalidatePath("/inventory");
}

async function toggleFavorite(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const cur = formData.get("cur") === "1";
  await supabase.from("parts").update({ favorite: !cur }).eq("id", id);
  revalidatePath("/inventory");
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    model?: string;
    sort?: string;
    filt?: string;
    cat?: string;
  }>;
}) {
  const sp = await searchParams;
  const model = sp.model ?? "all";
  const sort = sp.sort ?? "name";
  const filt = sp.filt ?? "all";
  const cat = sp.cat ?? "all";
  const qs = (over: {
    model?: string;
    sort?: string;
    filt?: string;
    cat?: string;
  }) => {
    const p = new URLSearchParams();
    const m = over.model ?? model;
    const s = over.sort ?? sort;
    const f = over.filt ?? filt;
    const c = over.cat ?? cat;
    if (m && m !== "all") p.set("model", m);
    if (s && s !== "name") p.set("sort", s);
    if (f && f !== "all") p.set("filt", f);
    if (c && c !== "all") p.set("cat", c);
    const str = p.toString();
    return "/inventory" + (str ? "?" + str : "");
  };
  const supabase = await createClient();
  const [{ data: partsRaw }, { data: issuesRaw }, { data: ordersRaw }] =
    await Promise.all([
      supabase
        .from("parts")
        .select("*")
        .order("favorite", { ascending: false })
        .order("name"),
      supabase
        .from("stock_issues")
        .select("*")
        .order("issued_at", { ascending: false, nullsFirst: false })
        .limit(30),
      supabase
        .from("part_orders")
        .select("*")
        .order("ordered_at", { ascending: false, nullsFirst: false })
        .limit(30),
    ]);
  const all = (partsRaw ?? []) as any[];
  const issues = (issuesRaw ?? []) as any[];
  const orders = (ordersRaw ?? []) as any[];

  // 불량률 = 불량 수량 ÷ 도착(입고) 수량
  const defectQty = issues
    .filter((i) => i.type === "불량")
    .reduce((s, i) => s + (i.qty ?? 0), 0);
  const lossQty = issues
    .filter((i) => i.type === "로스")
    .reduce((s, i) => s + (i.qty ?? 0), 0);
  const arrivedQty = orders
    .filter((o) => o.arrived)
    .reduce((s, o) => s + (o.qty ?? 0), 0);
  const defectRate = arrivedQty > 0 ? (defectQty / arrivedQty) * 100 : null;

  // 모델 필터 (OS1/OS2 선택 시 공용 부품도 포함)
  const parts = all.filter((p) => {
    const m = p.model || "공용";
    if (model === "all") return true;
    if (model === "공용") return m === "공용";
    return m === model || m === "공용";
  });

  const withPer = parts.filter((p) => (p.per_unit ?? 0) > 0);
  const buildable = withPer.length
    ? Math.min(...withPer.map((p) => Math.floor((p.stock ?? 0) / p.per_unit)))
    : 0;
  const bottleneck = withPer
    .filter((p) => Math.floor((p.stock ?? 0) / p.per_unit) === buildable)
    .map((p) => p.name);
  const totalQty = parts.reduce((s, p) => s + (p.stock ?? 0), 0);
  const isShort = (p: any) =>
    (p.per_unit ?? 0) > 0 && (p.stock ?? 0) < (p.per_unit ?? 0);
  const shortCnt = withPer.filter(isShort).length;
  const shortParts = parts.filter(isShort);

  // 필터
  // 분류 목록 (등록된 부품에서 자동 수집)
  const CAT_ORDER = [
    "1단", "2단", "3단", "소독조", "소독조 피팅류", "뚜껑", "PCB판", "케이스",
    "피팅류", "PP부품류", "신주 니플류", "PVC 니플류", "호스류", "패널류", "기타",
  ];
  const cats = Array.from(
    new Set(parts.map((p) => p.category).filter(Boolean)),
  ).sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a);
    const ib = CAT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "ko");
  });

  let view = parts.filter((p) => {
    if (cat !== "all" && (p.category || "") !== cat) return false;
    if (filt === "fav") return !!p.favorite;
    if (filt === "as") return !!p.as_type;
    if (filt === "short") return isShort(p);
    return true;
  });
  // 정렬
  const ratio = (p: any) =>
    (p.per_unit ?? 0) > 0 ? (p.stock ?? 0) / p.per_unit : Number.POSITIVE_INFINITY;
  const mainFloor = (p: any) => {
    const f = [p.floor1 ?? 0, p.floor2 ?? 0, p.floor3 ?? 0];
    const max = Math.max(...f);
    return max > 0 ? f.indexOf(max) : 9;
  };
  view = view.slice().sort((a, b) => {
    if (sort === "short") return ratio(a) - ratio(b);
    if (sort === "floor")
      return mainFloor(a) - mainFloor(b) || a.name.localeCompare(b.name, "ko");
    return a.name.localeCompare(b.name, "ko");
  });

  const SORTS = [
    { k: "name", label: "이름순" },
    { k: "short", label: "재고 부족순" },
    { k: "floor", label: "층별" },
  ];
  const FILTS = [
    { k: "all", label: "전체" },
    { k: "fav", label: "★ 즐겨찾기" },
    { k: "as", label: "A/S 교체품" },
    { k: "short", label: "부족만" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">재고·생산 관리</h1>
      <p className="text-[13px] text-ink-3 mb-3">
        부품 마스터 · 모델별/층별/공구함 재고 · 제작 가능 대수
      </p>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TABS.map((t) => {
          const active = model === t.k;
          return (
            <Link
              key={t.k}
              href={qs({ model: t.k })}
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

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12.5px] font-semibold text-ink-2">
            제작 가능 완성품
            {model !== "all" && (
              <span className="text-ink-3"> · {modelLabel(model)}</span>
            )}
          </div>
          <div className="text-3xl font-bold mt-1.5">
            {buildable}
            <span className="text-sm text-ink-3"> 대</span>
          </div>
          <div className="text-[11.5px] text-ink-3 mt-1">
            병목: {bottleneck[0] ?? "—"}
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12.5px] font-semibold text-ink-2">
            부족 부품
          </div>
          <div className="text-3xl font-bold mt-1.5">
            {shortCnt}
            <span className="text-sm text-ink-3"> 종</span>
          </div>
          <div className="text-[11.5px] text-ink-3 mt-1">재고 &lt; 소요</div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12.5px] font-semibold text-ink-2">
            등록 부품
          </div>
          <div className="text-3xl font-bold mt-1.5">
            {parts.length}
            <span className="text-sm text-ink-3"> 종</span>
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12.5px] font-semibold text-ink-2">
            총 부품 수량
          </div>
          <div className="text-3xl font-bold mt-1.5">
            {totalQty}
            <span className="text-sm text-ink-3"> 개</span>
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12.5px] font-semibold text-ink-2">불량률</div>
          <div className="text-3xl font-bold mt-1.5">
            {defectRate === null ? "—" : defectRate.toFixed(1)}
            <span className="text-sm text-ink-3">%</span>
          </div>
          <div className="text-[11.5px] text-ink-3 mt-1">
            불량 {defectQty} / 입고 {arrivedQty} · 로스 {lossQty}
          </div>
        </div>
      </div>

      {/* 완성품 제작 → BOM 일괄 차감 */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-bold text-[14px]">완성품 제작 (부품 일괄 차감)</h2>
        </div>
        <p className="text-[12px] text-ink-3 mb-3">
          제작한 대수만큼 해당 모델(+공용) 부품이 1기당 소요량 × 대수로 한 번에
          차감됩니다. 소요량 0인 부품(호스류 등)은 차감되지 않으니 필요 시 수동
          조정하세요. 고유번호를 적으면 완성품 기기로도 자동 등록됩니다.
        </p>
        <form action={produceUnits} className="flex flex-wrap items-end gap-2.5">
          <div>
            <label className={labelCls}>모델</label>
            <select name="model" className={inputCls + " w-40"} defaultValue="OS2">
              <option value="OS2">OCTA-SELL 2</option>
              <option value="OS1">OCTA-SELL 1</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>제작 대수</label>
            <input
              name="qty"
              type="number"
              min={1}
              defaultValue={1}
              className={inputCls + " w-24"}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className={labelCls}>기기 고유번호 (선택)</label>
            <input
              name="serial"
              className={inputCls}
              placeholder="OS2-2607-031 (적으면 기기 자동 등록)"
            />
          </div>
          <button className="h-9 px-5 rounded-lg bg-accent text-white font-semibold text-[13px] hover:bg-accent-2">
            제작 완료 · 재고 차감
          </button>
        </form>
      </div>

      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4">
        {/* 부품 목록 */}
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <h2 className="font-bold text-[14px]">부품 마스터</h2>
            <a
              href="/api/export/parts"
              className="ml-auto text-[12px] font-semibold text-accent hover:underline"
            >
              엑셀 내보내기
            </a>
          </div>

          {/* 정렬 · 필터 · 부족품 링크 */}
          <div className="px-4 py-3 border-b border-line-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] text-ink-3 font-bold mr-1">정렬</span>
            {SORTS.map((s) => (
              <Link
                key={s.k}
                href={qs({ sort: s.k })}
                className={
                  "px-2.5 py-1 rounded-md text-[12px] font-semibold border " +
                  (sort === s.k
                    ? "bg-accent-bg border-accent text-accent-ink"
                    : "bg-surface border-line text-ink-2 hover:bg-surface-2")
                }
              >
                {s.label}
              </Link>
            ))}
            <span className="w-2" />
            <span className="text-[11.5px] text-ink-3 font-bold mr-1">필터</span>
            {FILTS.map((f) => (
              <Link
                key={f.k}
                href={qs({ filt: f.k })}
                className={
                  "px-2.5 py-1 rounded-md text-[12px] font-semibold border " +
                  (filt === f.k
                    ? "bg-accent-bg border-accent text-accent-ink"
                    : "bg-surface border-line text-ink-2 hover:bg-surface-2")
                }
              >
                {f.label}
              </Link>
            ))}
          </div>

          {/* 분류 필터 */}
          {cats.length > 0 && (
            <div className="px-4 py-2.5 border-b border-line-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11.5px] text-ink-3 font-bold mr-1">분류</span>
              <Link
                href={qs({ cat: "all" })}
                className={
                  "px-2.5 py-1 rounded-md text-[12px] font-semibold border " +
                  (cat === "all"
                    ? "bg-accent-bg border-accent text-accent-ink"
                    : "bg-surface border-line text-ink-2 hover:bg-surface-2")
                }
              >
                전체
              </Link>
              {cats.map((c) => (
                <Link
                  key={c}
                  href={qs({ cat: c })}
                  className={
                    "px-2.5 py-1 rounded-md text-[12px] font-semibold border " +
                    (cat === c
                      ? "bg-accent-bg border-accent text-accent-ink"
                      : "bg-surface border-line text-ink-2 hover:bg-surface-2")
                  }
                >
                  {c}
                </Link>
              ))}
            </div>
          )}

          <details className="border-b border-line-2">
            <summary className="px-4 py-2.5 text-[12.5px] font-semibold text-accent cursor-pointer select-none">
              부족품 구매링크 모음 ({shortParts.length})
            </summary>
            <div className="px-4 pb-3 flex flex-col gap-1.5">
              {shortParts.length === 0 && (
                <span className="text-[12px] text-ink-3">
                  부족한 부품이 없습니다.
                </span>
              )}
              {shortParts.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="font-semibold text-ink">{p.name}</span>
                  <span className="text-ink-3">
                    재고 {p.stock} / 소요 {p.per_unit} · {p.vendor}
                  </span>
                  {p.buy_url ? (
                    <a
                      href={p.buy_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-accent font-semibold hover:underline"
                    >
                      구매처 열기 →
                    </a>
                  ) : (
                    <span className="ml-auto text-ink-3 text-[11.5px]">
                      구매 링크 없음
                    </span>
                  )}
                </div>
              ))}
            </div>
          </details>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-3 text-left">
                  <th className="font-semibold px-2 py-2.5"></th>
                  <th className="font-semibold px-2 py-2.5">부품명</th>
                  <th className="font-semibold px-2 py-2.5">분류</th>
                  <th className="font-semibold px-2 py-2.5">구매처</th>
                  <th className="font-semibold px-2 py-2.5">1기당</th>
                  <th className="font-semibold px-2 py-2.5">현재고</th>
                  <th className="font-semibold px-2 py-2.5">공구함</th>
                  <th className="font-semibold px-2 py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {view.map((p) => {
                  const short = isShort(p);
                  return (
                    <tr key={p.id} className="border-t border-line-2">
                      <td className="px-2 py-2.5">
                        <form action={toggleFavorite}>
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            type="hidden"
                            name="cur"
                            value={p.favorite ? "1" : "0"}
                          />
                          <button
                            className={
                              "text-[15px] " +
                              (p.favorite ? "text-[#e0a41c]" : "text-ink-3")
                            }
                            title="즐겨찾기"
                          >
                            {p.favorite ? "★" : "☆"}
                          </button>
                        </form>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-ink">
                            {p.name}
                          </span>
                          <span className="text-[10.5px] text-ink-3 border border-line rounded px-1 py-px">
                            {modelLabel(p.model)}
                          </span>
                        </div>
                        {p.note && (
                          <div className="text-[11px] text-accent-ink">
                            {p.note}
                          </div>
                        )}
                        {p.as_type && (
                          <div className="text-[11px] text-ink-3">
                            {p.as_type}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        {p.category ? (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface-2 border border-line text-ink-2 whitespace-nowrap">
                            {p.category}
                          </span>
                        ) : (
                          <span className="text-ink-3 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-ink-2">
                        {p.vendor}
                        {p.buy_url && (
                          <a
                            href={p.buy_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[11px] text-accent font-semibold hover:underline"
                          >
                            구매 링크
                          </a>
                        )}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-ink-2">
                        {p.per_unit}
                      </td>
                      <td
                        className={
                          "px-2 py-2.5 tabular-nums font-semibold " +
                          (short ? "text-[color:var(--crit-ink)]" : "text-ink")
                        }
                      >
                        {p.stock}
                        {p.unit && p.unit !== "개" && (
                          <span className="text-[10.5px] text-ink-3 font-normal">
                            {" "}
                            {p.unit}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-ink-2">
                        {p.toolbox}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <a
                          href={`/inventory/${p.id}/edit`}
                          className="text-[12px] font-semibold text-accent hover:underline"
                        >
                          수정
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {view.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-ink-3 text-[13px]"
                    >
                      조건에 맞는 부품이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 부품 추가 */}
        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">부품 추가</h2>
          <form action={createPart} className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>부품명</label>
              <input name="name" className={inputCls} placeholder="급수 호스" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>모델</label>
                <select name="model" className={inputCls} defaultValue="공용">
                  <option>공용</option>
                  <option>OS2</option>
                  <option>OS1</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>A/S 구분</label>
                <select name="as_type" className={inputCls} defaultValue="">
                  <option value="">해당 없음</option>
                  <option>교체 대상</option>
                  <option>정기점검</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>분류</label>
                <input
                  name="category"
                  className={inputCls}
                  list="catList"
                  placeholder="피팅류"
                />
              </div>
              <div>
                <label className={labelCls}>단위</label>
                <input name="unit" className={inputCls} defaultValue="개" list="unitList" />
              </div>
            </div>
            <div>
              <label className={labelCls}>비고 (자재 설명)</label>
              <input
                name="note"
                className={inputCls}
                placeholder="예: 급수모터 T피팅"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>구매처</label>
                <input name="vendor" className={inputCls} placeholder="대성유압" />
              </div>
              <div>
                <label className={labelCls}>단가(원)</label>
                <input name="price" type="number" className={inputCls} defaultValue={0} />
              </div>
            </div>
            <div>
              <label className={labelCls}>구매 링크</label>
              <input name="buy_url" className={inputCls} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>1기당 소요</label>
                <input name="per_unit" type="number" className={inputCls} defaultValue={0} />
              </div>
              <div>
                <label className={labelCls}>현재고</label>
                <input name="stock" type="number" className={inputCls} defaultValue={0} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className={labelCls}>1층</label>
                <input name="floor1" type="number" className={inputCls} defaultValue={0} />
              </div>
              <div>
                <label className={labelCls}>2층</label>
                <input name="floor2" type="number" className={inputCls} defaultValue={0} />
              </div>
              <div>
                <label className={labelCls}>3층</label>
                <input name="floor3" type="number" className={inputCls} defaultValue={0} />
              </div>
              <div>
                <label className={labelCls}>공구함</label>
                <input name="toolbox" type="number" className={inputCls} defaultValue={0} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input name="favorite" type="checkbox" className="w-4 h-4" />
              즐겨찾기 (A/S에서 위에 표시)
            </label>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              부품 추가
            </button>
          </form>
        </div>
      </div>

      {/* 발주 관리 */}
      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4 mt-6">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <h2 className="font-bold text-[14px]">부품 발주</h2>
            <span className="ml-auto text-[12px] text-ink-3">
              도착 처리 시 재고 자동 반영
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-3 text-left">
                  <th className="font-semibold px-3 py-2.5">부품</th>
                  <th className="font-semibold px-3 py-2.5">구매처</th>
                  <th className="font-semibold px-3 py-2.5">수량</th>
                  <th className="font-semibold px-3 py-2.5">발주일 / 도착예정</th>
                  <th className="font-semibold px-3 py-2.5 text-right">상태</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-line-2">
                    <td className="px-3 py-3 font-semibold text-ink">{o.part}</td>
                    <td className="px-3 py-3 text-ink-2">{o.vendor}</td>
                    <td className="px-3 py-3 text-ink-2 tabular-nums">{o.qty}</td>
                    <td className="px-3 py-3 text-ink-2 tabular-nums whitespace-nowrap">
                      {o.ordered_at ?? "—"}
                      {o.eta && <span className="text-ink-3"> → {o.eta}</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {o.arrived ? (
                        <span className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]">
                          도착 {o.arrived_at ?? ""}
                        </span>
                      ) : (
                        <form action={arriveOrder}>
                          <input type="hidden" name="id" value={o.id} />
                          <button className="text-[12px] font-semibold px-2.5 py-1 rounded-md border border-line hover:bg-surface-2">
                            도착 처리
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-ink-3 text-[13px]"
                    >
                      발주 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">발주 등록</h2>
          <form action={addOrder} className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>부품</label>
              <select name="part" className={inputCls} required defaultValue="">
                <option value="" disabled>
                  부품 선택…
                </option>
                {all.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>구매처</label>
                <input name="vendor" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>수량</label>
                <input name="qty" type="number" className={inputCls} defaultValue={0} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>발주일</label>
                <input name="ordered_at" type="date" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>도착 예정일</label>
                <input name="eta" type="date" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>단가(원)</label>
              <input name="price" type="number" className={inputCls} defaultValue={0} />
            </div>
            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              발주 등록
            </button>
          </form>
        </div>
      </div>

      {/* 불량 · 재고 로스 */}
      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4 mt-6">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <h2 className="font-bold text-[14px]">불량 · 재고 로스</h2>
            <span className="ml-auto text-[12px] text-ink-3">
              기록 시 재고 차감
            </span>
          </div>
          <div className="divide-y divide-line-2">
            {issues.map((i) => (
              <div key={i.id} className="px-4 py-3 flex items-center gap-2.5 flex-wrap">
                <span
                  className={
                    "text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full " +
                    (i.type === "불량"
                      ? "bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]"
                      : "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]")
                  }
                >
                  {i.type}
                </span>
                <span className="text-[13px] font-semibold">{i.part}</span>
                <span className="text-[12.5px] text-ink-2">{i.qty}개</span>
                {i.reason && (
                  <span className="text-[11.5px] text-ink-3">· {i.reason}</span>
                )}
                <span className="ml-auto text-[11.5px] text-ink-3 tabular-nums">
                  {i.issued_at ?? ""}
                </span>
              </div>
            ))}
            {issues.length === 0 && (
              <div className="px-4 py-8 text-center text-ink-3 text-[13px]">
                기록이 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">불량 · 로스 등록</h2>
          <form action={addIssue} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>유형</label>
                <select name="type" className={inputCls} defaultValue="불량">
                  <option>불량</option>
                  <option>로스</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>수량</label>
                <input name="qty" type="number" min={1} className={inputCls} defaultValue={1} />
              </div>
            </div>
            <div>
              <label className={labelCls}>부품</label>
              <select name="part" className={inputCls} required defaultValue="">
                <option value="" disabled>
                  부품 선택…
                </option>
                {all.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>발생일</label>
              <input name="issued_at" type="date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>원인 / 사유</label>
              <input
                name="reason"
                className={inputCls}
                placeholder="불량 원인 · 재고 불일치 사유"
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

      <datalist id="catList">
        {CAT_ORDER.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="unitList">
        <option value="개" />
        <option value="cm" />
        <option value="m" />
        <option value="set" />
        <option value="포" />
      </datalist>
    </div>
  );
}
