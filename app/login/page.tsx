"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [keep, setKeep] = useState(true);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const supabase = createClient(keep);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pw,
    });
    if (error) {
      const m = error.message || "";
      if (m.includes("Invalid login credentials"))
        setErr("이메일 또는 비밀번호가 일치하지 않습니다. (관리자에게 계정 확인 요청)");
      else if (m.includes("Email not confirmed"))
        setErr("이메일 미인증 계정입니다. 관리자에게 'Auto Confirm' 재발급을 요청하세요.");
      else if (m.toLowerCase().includes("fetch") || m.toLowerCase().includes("network"))
        setErr("서버 연결에 실패했습니다. 인터넷 연결을 확인하세요.");
      else setErr(`로그인 실패: ${m}`);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-xl bg-accent text-white grid place-items-center font-bold text-lg">
            포
          </div>
          <div>
            <div className="font-bold text-[17px] text-ink">포오랩</div>
            <div className="text-xs text-ink-3">Four-O LAB · 사내 공유 시스템</div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-surface border border-line rounded-2xl p-7 shadow-sm flex flex-col gap-4"
        >
          <h1 className="text-lg font-bold text-ink">로그인</h1>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">이메일</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="name@fourolab.com"
              className="h-10 px-3 rounded-lg border border-line bg-surface-2 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">비밀번호</span>
            <input
              type="password"
              required
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="h-10 px-3 rounded-lg border border-line bg-surface-2 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg"
            />
          </label>

          <label className="flex items-start gap-2 text-[13px] text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
              className="w-4 h-4 mt-0.5"
            />
            <span>
              이 기기에서 로그인 유지 (30일)
              <span className="block text-[11.5px] text-ink-3">
                공용 컴퓨터라면 체크를 해제하세요 — 브라우저를 닫으면
                로그아웃됩니다.
              </span>
            </span>
          </label>

          {err && (
            <div className="text-[13px] text-[color:var(--crit-ink)] bg-[color:var(--crit-bg)] rounded-lg px-3 py-2">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2 disabled:opacity-60"
          >
            {loading ? "로그인 중…" : "로그인"}
          </button>

          <p className="text-[12px] text-ink-3 text-center leading-relaxed">
            계정은 관리자가 발급합니다. 외부 공유가 제한된 사내 전용 시스템입니다.
          </p>
        </form>
      </div>
    </div>
  );
}
