"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function parse(v?: string): string[] {
  try {
    const a = JSON.parse(v || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export default function PhotoUpload({
  name,
  defaultValue,
  accept = "image/*",
}: {
  name: string;
  defaultValue?: string;
  accept?: string;
}) {
  const [urls, setUrls] = useState<string[]>(parse(defaultValue));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setErr("");
    const supabase = createClient();
    const added: string[] = [];
    for (const f of Array.from(files)) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name.replace(/[^\w.]/g, "_")}`;
      const { error } = await supabase.storage
        .from("photos")
        .upload(path, f, { upsert: false });
      if (error) {
        setErr("업로드 실패: 스토리지 설정을 확인하세요.");
        continue;
      }
      const { data } = supabase.storage.from("photos").getPublicUrl(path);
      added.push(data.publicUrl);
    }
    setUrls((u) => [...u, ...added]);
    setBusy(false);
    e.target.value = "";
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(urls)} />
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => {
          const isImg = /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(u);
          return (
            <div key={i} className="relative">
              {isImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u}
                  alt="첨부"
                  className="w-16 h-16 object-cover rounded-lg border border-line"
                />
              ) : (
                <a
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  className="w-16 h-16 rounded-lg border border-line bg-surface-2 grid place-items-center text-[10px] text-ink-2 text-center px-1 break-all"
                >
                  파일 열기
                </a>
              )}
              <button
                type="button"
                onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                aria-label="삭제"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[color:var(--crit-ink)] text-white text-[11px] grid place-items-center"
              >
                ×
              </button>
            </div>
          );
        })}
        <label className="w-16 h-16 rounded-lg border border-dashed border-line grid place-items-center cursor-pointer text-ink-3 text-[12px] hover:border-accent hover:text-accent">
          {busy ? "…" : "＋"}
          <input
            type="file"
            accept={accept}
            multiple
            className="hidden"
            onChange={onFile}
          />
        </label>
      </div>
      {err && (
        <p className="text-[11.5px] text-[color:var(--crit-ink)] mt-1.5">{err}</p>
      )}
    </div>
  );
}
