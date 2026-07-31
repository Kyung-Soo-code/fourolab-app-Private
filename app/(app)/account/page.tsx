"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "h-10 px-3 rounded-lg border border-line bg-surface-2 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12.5px] font-semibold text-ink-2 mb-1 block";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? "");
      if (data.user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", data.user.id)
          .maybeSingle();
        setName(p?.name ?? "");
      }
    });
  }, []);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (pw1.length < 8) {
      setErr("비밀번호는 8자 이상으로 정해주세요.");
      return;
    }
    if (pw1 !== pw2) {
      setErr("두 번 입력한 비밀번호가 서로 다릅니다.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (error) {
      setErr(`변경 실패: ${error.message}`);
      return;
    }
    setPw1("");
    setPw2("");
    setMsg("비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.");
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    setBusy(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { error } = await supabase
        .from("profiles")
        .update({ name })
        .eq("id", data.user.id);
      if (error) setErr(`이름 저장 실패: ${error.message}`);
      else setMsg("이름이 저장되었습니다.");
    }
    setBusy(false);
  }

  return (
    <div className="max-w-[520px]">
      <h1 className="text-xl font-bold mb-1">내 계정</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        내 이름과 비밀번호를 직접 변경할 수 있습니다.
      </p>

      {msg && (
        <div className="text-[13px] text-[color:var(--ok-ink)] bg-[color:var(--ok-bg)] rounded-lg px-3.5 py-2.5 mb-4">
          {msg}
        </div>
      )}
      {err && (
        <div className="text-[13px] text-[color:var(--crit-ink)] bg-[color:var(--crit-bg)] rounded-lg px-3.5 py-2.5 mb-4">
          {err}
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl p-5 mb-4">
        <h2 className="font-bold text-[14px] mb-3">기본 정보</h2>
        <div className="mb-3">
          <label className={labelCls}>이메일 (변경하려면 관리자에게 요청)</label>
          <div className="h-10 px-3 rounded-lg border border-line bg-surface-2 text-[14px] flex items-center text-ink-3">
            {email || "…"}
          </div>
        </div>
        <form onSubmit={saveName}>
          <label className={labelCls}>이름 (화면에 표시되는 이름)</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 윤준식 과장"
              className={inputCls}
            />
            <button
              disabled={busy}
              className="h-10 px-4 shrink-0 rounded-lg border border-line text-[13px] font-semibold hover:bg-surface-2 disabled:opacity-60"
            >
              저장
            </button>
          </div>
        </form>
      </div>

      <form
        onSubmit={changePw}
        className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-3"
      >
        <h2 className="font-bold text-[14px]">비밀번호 변경</h2>
        <p className="text-[12px] text-ink-3 -mt-1">
          관리자가 발급한 초기 비밀번호를 쓰고 계신다면 꼭 바꿔주세요.
        </p>
        <div>
          <label className={labelCls}>새 비밀번호 (8자 이상)</label>
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className={labelCls}>새 비밀번호 확인</label>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2 disabled:opacity-60"
        >
          {busy ? "변경 중…" : "비밀번호 변경"}
        </button>
      </form>
    </div>
  );
}
