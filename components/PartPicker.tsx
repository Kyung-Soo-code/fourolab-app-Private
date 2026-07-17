"use client";

import { useEffect, useRef, useState } from "react";

export type Part = {
  id: string;
  name: string;
  model?: string | null;
  favorite: boolean;
  as_type?: string | null;
  stock?: number | null;
};

type Sel = { id: string; name: string; qty: number };

function modelLabel(m?: string | null) {
  if (m === "OS1") return "OCTA-SELL 1";
  if (m === "OS2") return "OCTA-SELL 2";
  return m || "공용";
}

function parseDefault(v: string | undefined, parts: Part[]): Sel[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.*?)\s*[×xX]\s*(\d+)$/);
      const name = m ? m[1].trim() : s;
      const qty = m ? parseInt(m[2], 10) || 1 : 1;
      const found = parts.find((p) => p.name === name);
      return { id: found ? found.id : "name:" + name, name, qty };
    });
}

export default function PartPicker({
  parts,
  name,
  defaultValue,
}: {
  parts: Part[];
  name: string;
  defaultValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Sel[]>(() => parseDefault(defaultValue, parts));
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const text = sel.map((s) => `${s.name} ×${s.qty}`).join(", ");
  const itemsJson = JSON.stringify(sel.map((s) => ({ id: s.id, qty: s.qty })));

  const sorted = [...parts].sort(
    (a, b) =>
      (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) ||
      a.name.localeCompare(b.name, "ko"),
  );

  function selOf(id: string) {
    return sel.find((x) => x.id === id);
  }
  function toggle(p: Part) {
    setSel((prev) =>
      prev.find((x) => x.id === p.id)
        ? prev.filter((x) => x.id !== p.id)
        : [...prev, { id: p.id, name: p.name, qty: 1 }],
    );
  }
  function setQty(id: string, q: number) {
    setSel((prev) =>
      prev.map((x) => (x.id === id ? { ...x, qty: Math.max(1, q) } : x)),
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <input type="hidden" name={name} value={text} />
      <input type="hidden" name={`${name}_items`} value={itemsJson} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-9 px-2.5 py-1.5 rounded-lg border border-line bg-surface-2 text-[13px] text-left flex flex-wrap gap-1.5 items-center hover:border-accent"
      >
        {sel.length === 0 ? (
          <span className="text-ink-3">부품 선택… (클릭)</span>
        ) : (
          sel.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 bg-accent-bg text-accent-ink rounded-full px-2 py-0.5 text-[12px] font-semibold"
            >
              {s.name}
              <span className="text-[11px] opacity-80">×{s.qty}</span>
            </span>
          ))
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-surface border border-line rounded-xl shadow-lg p-1.5">
          {sorted.length === 0 && (
            <div className="px-3 py-4 text-center text-ink-3 text-[12.5px]">
              등록된 부품이 없습니다. (재고·생산 관리에서 추가)
            </div>
          )}
          {sorted.map((p, i) => {
            const s = selOf(p.id);
            const firstNonFav = i > 0 && sorted[i - 1].favorite && !p.favorite;
            return (
              <div key={p.id}>
                {firstNonFav && (
                  <div className="text-[11px] text-ink-3 font-semibold px-2 pt-2 pb-1 border-t border-line-2 mt-1">
                    전체 부품
                  </div>
                )}
                <div
                  className={
                    "flex items-center gap-2 px-2 py-1.5 rounded-lg " +
                    (s ? "bg-accent-bg" : "hover:bg-surface-2")
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span
                      className={
                        "w-4 h-4 rounded border grid place-items-center text-[10px] shrink-0 " +
                        (s
                          ? "bg-accent border-accent text-white"
                          : "border-line-2")
                      }
                    >
                      {s ? "✓" : ""}
                    </span>
                    {p.favorite && (
                      <span className="text-[#e0a41c] text-[12px]">★</span>
                    )}
                    <span className="text-[13px] font-medium truncate">
                      {p.name}
                    </span>
                    <span className="text-[10.5px] text-ink-3 shrink-0">
                      {modelLabel(p.model)}
                    </span>
                  </button>

                  {s && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(p.id, s.qty - 1)}
                        className="w-6 h-6 rounded border border-line text-ink-2 hover:bg-surface"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-[13px] font-semibold tabular-nums">
                        {s.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(p.id, s.qty + 1)}
                        className="w-6 h-6 rounded border border-line text-ink-2 hover:bg-surface"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end pt-1.5 mt-1 border-t border-line-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] font-semibold text-accent px-3 py-1"
            >
              완료
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
