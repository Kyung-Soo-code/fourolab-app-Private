"use client";

import { useState } from "react";

export type OutItem = { model: string; kind: string; qty: number };

function parse(v?: string): OutItem[] {
  try {
    const a = JSON.parse(v || "[]");
    if (!Array.isArray(a)) return [];
    return a.map((x) => ({
      model: x.model === "OS1" ? "OS1" : "OS2",
      kind: x.kind === "전시용" ? "전시용" : "완성품",
      qty: Math.max(1, parseInt(x.qty, 10) || 1),
    }));
  } catch {
    return [];
  }
}

const cell =
  "h-9 px-2 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg";

export default function OutItemsEditor({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string;
}) {
  const [rows, setRows] = useState<OutItem[]>(parse(defaultValue));

  const value = JSON.stringify(rows.filter((r) => r.qty > 0));
  const total = rows.reduce((s, r) => s + (r.qty || 0), 0);

  function add() {
    setRows((r) => [...r, { model: "OS2", kind: "완성품", qty: 1 }]);
  }
  function upd(i: number, k: keyof OutItem, v: string) {
    setRows((r) =>
      r.map((x, idx) =>
        idx === i
          ? { ...x, [k]: k === "qty" ? Math.max(1, parseInt(v, 10) || 1) : v }
          : x,
      ),
    );
  }
  function del(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <select
              value={r.model}
              onChange={(e) => upd(i, "model", e.target.value)}
              className={cell + " flex-1 min-w-0"}
            >
              <option value="OS2">OCTA-SELL 2</option>
              <option value="OS1">OCTA-SELL 1</option>
            </select>
            <select
              value={r.kind}
              onChange={(e) => upd(i, "kind", e.target.value)}
              className={cell + " w-[92px] shrink-0"}
            >
              <option value="완성품">완제품</option>
              <option value="전시용">전시용</option>
            </select>
            <input
              type="number"
              min={1}
              value={r.qty}
              onChange={(e) => upd(i, "qty", e.target.value)}
              className={cell + " w-14 shrink-0"}
            />
            <button
              type="button"
              onClick={() => del(i)}
              aria-label="삭제"
              className="w-8 h-8 shrink-0 rounded-lg border border-line text-ink-3 hover:bg-surface-2"
            >
              ×
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-[12px] text-ink-3">
            출고 기기가 없으면 비워두세요.
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={add}
          className="text-[12.5px] font-semibold text-accent hover:underline"
        >
          ＋ 출고 기기 추가
        </button>
        {total > 0 && (
          <span className="text-[12px] text-ink-3">총 {total}대</span>
        )}
      </div>
      <p className="text-[11px] text-ink-3 mt-1">
        전시용 = 껍데기(외형) 제품 · 완제품과 구분해 재고 관리
      </p>
    </div>
  );
}
