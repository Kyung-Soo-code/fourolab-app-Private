"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const MAIN = [
  { href: "/", label: "홈" },
  { href: "/as", label: "A/S" },
  { href: "/fleet", label: "기기" },
  { href: "/hospitals", label: "병원" },
];

const ALL = [
  { href: "/", label: "대시보드" },
  { href: "/search", label: "통합 검색" },
  { href: "/as", label: "A/S 관리" },
  { href: "/devices", label: "기기 등록" },
  { href: "/fleet", label: "기기 현황" },
  { href: "/checklist", label: "납품 체크리스트" },
  { href: "/hospitals", label: "병원 관리" },
  { href: "/dealers", label: "대리점 관리" },
  { href: "/aftercare", label: "대리점 사후관리" },
  { href: "/inventory", label: "재고·생산" },
  { href: "/schedule", label: "전시·일정" },
  { href: "/audit", label: "수정 이력" },
  { href: "/help", label: "사용 안내" },
  { href: "/account", label: "내 계정" },
];

export default function MobileTabs({ role = "staff" }: { role?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 대리점 계정: 사후관리 단일 탭
  if (role === "dealer") {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line flex justify-around py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        <Link
          href="/aftercare"
          className="text-[12px] font-bold text-accent-ink px-6 py-1.5 rounded-lg bg-accent-bg"
        >
          대리점 사후관리
        </Link>
        <Link
          href="/help"
          className="text-[12px] font-bold text-ink-3 px-6 py-1.5 rounded-lg"
        >
          사용 안내
        </Link>
      </nav>
    );
  }

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute bottom-[64px] left-3 right-3 bg-surface border border-line rounded-2xl p-3 grid grid-cols-2 gap-1.5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {ALL.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={
                  "px-3 py-2.5 rounded-lg text-[13px] font-semibold " +
                  (active(n.href)
                    ? "bg-accent-bg text-accent-ink"
                    : "text-ink-2 hover:bg-surface-2")
                }
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line flex justify-around items-stretch pb-[max(4px,env(safe-area-inset-bottom))]">
        {MAIN.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={
              "flex-1 text-center py-2.5 text-[12px] font-bold " +
              (active(t.href) ? "text-accent" : "text-ink-3")
            }
          >
            {t.label}
          </Link>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className={
            "flex-1 text-center py-2.5 text-[12px] font-bold " +
            (open ? "text-accent" : "text-ink-3")
          }
        >
          전체
        </button>
      </nav>
    </>
  );
}
