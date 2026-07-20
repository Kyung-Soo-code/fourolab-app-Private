import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) =>
    r.map(csvEscape).join(","),
  );
  // BOM → 엑셀에서 한글 깨짐 방지
  return "﻿" + lines.join("\r\n");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("로그인이 필요합니다", { status: 401 });

  let csv = "";
  let filename = "export";

  if (kind === "devices") {
    const { data } = await supabase
      .from("devices")
      .select("*, hospitals(name)")
      .order("serial");
    csv = toCsv(
      ["고유번호", "모델", "구분", "상태", "위치병원", "생산일", "납품일", "메모"],
      ((data ?? []) as any[]).map((d) => [
        d.serial,
        d.model === "OS1" ? "OCTA-SELL 1" : "OCTA-SELL 2",
        d.category,
        d.status,
        d.hospitals?.name ?? "사내",
        d.produced_at,
        d.delivered_at,
        d.note,
      ]),
    );
    filename = "기기목록";
  } else if (kind === "as") {
    const { data } = await supabase
      .from("as_tickets")
      .select("*")
      .order("received_at", { ascending: false });
    csv = toCsv(
      [
        "기기번호", "모델", "병원", "접수일시", "방문일시", "증상",
        "사내코멘트", "소비자코멘트", "교체부품", "택배", "담당", "수리주체", "상태",
      ],
      ((data ?? []) as any[]).map((t) => [
        t.serial, t.model, t.hospital_name, t.received_at, t.visited_at,
        t.symptom, t.fix_comment, t.customer_comment, t.parts, t.ship,
        t.manager, t.repair_by, t.priority,
      ]),
    );
    filename = "AS이력";
  } else if (kind === "parts") {
    const { data } = await supabase.from("parts").select("*").order("name");
    csv = toCsv(
      [
        "부품명", "분류", "모델", "비고", "단위", "구매처", "단가",
        "1기당소요", "현재고", "공구함", "A/S구분", "즐겨찾기", "구매링크",
      ],
      ((data ?? []) as any[]).map((p) => [
        p.name, p.category, p.model, p.note, p.unit, p.vendor, p.price,
        p.per_unit, p.stock, p.toolbox, p.as_type,
        p.favorite ? "★" : "", p.buy_url,
      ]),
    );
    filename = "부품재고";
  } else if (kind === "hospitals") {
    const { data } = await supabase.from("hospitals").select("*").order("name");
    csv = toCsv(
      ["병원명", "담당자", "연락처", "영업주체", "지역", "정기점검일", "추가담당자"],
      ((data ?? []) as any[]).map((h) => [
        h.name, h.manager, h.tel, h.biz, h.addr, h.checkup_next,
        Array.isArray(h.contacts)
          ? h.contacts
              .map((c: any) => [c.role, c.name, c.tel].filter(Boolean).join(" "))
              .join(" / ")
          : "",
      ]),
    );
    filename = "병원목록";
  } else {
    return new NextResponse("지원하지 않는 항목", { status: 400 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        `${filename}_${date}.csv`,
      )}`,
    },
  });
}
