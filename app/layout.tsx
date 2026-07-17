import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "포오랩 사내 공유 시스템",
  description: "직원 간 일정·설치·데모·A/S·재고 통합 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
