"use client";

import { useId, useState } from "react";

type Person = { role: string; name: string; tel: string };

function parse(v?: string): Person[] {
  try {
    const a = JSON.parse(v || "[]");
    if (!Array.isArray(a)) return [];
    return a.map((x) => ({
      role: x.role ?? "",
      name: x.name ?? "",
      tel: x.tel ?? "",
    }));
  } catch {
    return [];
  }
}

const cell =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg";

export default function PeopleEditor({
  name,
  defaultValue,
  withTel = true,
  roles = ["원장", "실장", "간호사", "수간호사", "세척 담당", "구매팀"],
  addLabel = "＋ 담당자 추가",
}: {
  name: string;
  defaultValue?: string;
  withTel?: boolean;
  roles?: string[];
  addLabel?: string;
}) {
  const [rows, setRows] = useState<Person[]>(parse(defaultValue));
  const listId = useId();

  const value = JSON.stringify(
    rows.filter((r) => r.name.trim() || r.role.trim()),
  );

  function add() {
    setRows((r) => [...r, { role: "", name: "", tel: "" }]);
  }
  function upd(i: number, k: keyof Person, v: string) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  }
  function del(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <datalist id={listId}>
        {roles.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              list={listId}
              value={r.role}
              onChange={(e) => upd(i, "role", e.target.value)}
              placeholder="역할"
              className={cell + " w-24 shrink-0"}
            />
            <input
              value={r.name}
              onChange={(e) => upd(i, "name", e.target.value)}
              placeholder="이름"
              className={cell + " flex-1 min-w-0"}
            />
            {withTel && (
              <input
                value={r.tel}
                onChange={(e) => upd(i, "tel", e.target.value)}
                placeholder="연락처"
                className={cell + " w-32 shrink-0"}
              />
            )}
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
            아직 추가된 담당자가 없습니다.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 text-[12.5px] font-semibold text-accent hover:underline"
      >
        {addLabel}
      </button>
    </div>
  );
}
