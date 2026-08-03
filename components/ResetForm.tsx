"use client";

import { useState } from "react";

// 제출이 끝나면 폼 전체를 새로 그려 입력값·사진·선택 부품을 초기화한다.
export default function ResetForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);

  return (
    <form
      key={round}
      className={className}
      action={async (fd) => {
        setBusy(true);
        try {
          await action(fd);
          setRound((r) => r + 1); // 초기화
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
