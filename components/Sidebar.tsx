"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "대시보드" },
  { href: "/search", label: "통합 검색" },
  { href: "/as", label: "A/S 관리" },
  { href: "/devices", label: "기기 등록" },
  { href: "/fleet", label: "기기 현황" },
  { href: "/hospitals", label: "병원 관리" },
  { href: "/dealers", label: "대리점 관리" },
  { href: "/aftercare", label: "대리점 사후관리" },
  { href: "/inventory", label: "재고·생산" },
  { href: "/schedule", label: "전시·일정" },
  { href: "/audit", label: "수정 이력" },
];

export default function Sidebar({
  userName,
  role = "staff",
}: {
  userName: string;
  role?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // 대리점 계정은 사후관리만 노출
  const nav =
    role === "dealer"
      ? NAV.filter((n) => n.href === "/aftercare")
      : NAV;

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 bg-surface border-r border-line flex-col p-3 min-h-screen">
      <div className="flex items-center gap-2.5 px-2.5 py-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-accent text-white grid place-items-center font-bold">
          포
        </div>
        <div>
          <div className="font-bold text-[15px] leading-tight">포오랩</div>
          <div className="text-[11px] text-ink-3">Four-O LAB</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {nav.map((n) => {
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={
                "px-3 py-2 rounded-lg text-[13.5px] font-medium " +
                (active
                  ? "bg-accent-bg text-accent-ink font-semibold"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink")
              }
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line pt-3 flex items-center gap-2.5 px-1">
        <div className="w-8 h-8 rounded-full bg-accent-bg text-accent-ink grid place-items-center text-[12px] font-bold">
          {userName.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold truncate">{userName}</div>
        </div>
        <button
          onClick={logout}
          className="text-[12px] text-ink-3 hover:text-ink underline"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
