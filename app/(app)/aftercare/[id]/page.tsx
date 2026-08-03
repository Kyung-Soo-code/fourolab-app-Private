import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function typePill(t: string) {
  if (t === "정기점검")
    return "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]";
  if (t === "납품")
    return "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]";
  return "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold text-ink-3 mb-0.5">{label}</div>
      <div className="text-[13.5px] text-ink whitespace-pre-wrap break-words">
        {children}
      </div>
    </div>
  );
}

export default async function AftercareDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: r }, { data: prof }] = await Promise.all([
    supabase.from("aftercare").select("*").eq("id", id).single(),
    supabase
      .from("profiles")
      .select("role, dealer")
      .eq("id", user?.id ?? "")
      .maybeSingle(),
  ]);

  if (!r) {
    return (
      <div>
        <p className="text-ink-3">기록을 찾을 수 없습니다.</p>
        <Link href="/aftercare" className="text-accent font-semibold">
          ← 대리점 사후관리로
        </Link>
      </div>
    );
  }

  // 대리점 계정은 자기 대리점 기록만 열람
  if (prof?.role === "dealer" && r.dealer !== prof.dealer) {
    return (
      <div>
        <p className="text-ink-3">열람 권한이 없는 기록입니다.</p>
        <Link href="/aftercare" className="text-accent font-semibold">
          ← 대리점 사후관리로
        </Link>
      </div>
    );
  }

  const photos: string[] = Array.isArray(r.photos) ? r.photos : [];

  return (
    <div className="max-w-[760px]">
      <Link href="/aftercare" className="text-[13px] text-accent font-semibold">
        ← 대리점 사후관리로
      </Link>

      <div className="flex items-center gap-2.5 mt-2 mb-4 flex-wrap">
        <span
          className={
            "text-[12px] font-semibold px-2.5 py-0.5 rounded-full " +
            typePill(r.type)
          }
        >
          {r.type}
        </span>
        <h1 className="text-xl font-bold">{r.dealer}</h1>
        <span className="text-[14px] text-ink-2">→ {r.hospital}</span>
        <span
          className={
            "text-[11.5px] font-semibold px-2 py-0.5 rounded-full " +
            (r.status === "예정"
              ? "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]"
              : "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]")
          }
        >
          {r.status}
        </span>
        <Link
          href={`/aftercare/${r.id}/edit`}
          className="ml-auto h-8 px-3 grid place-items-center rounded-lg bg-accent text-white text-[12.5px] font-semibold hover:bg-accent-2"
        >
          수정
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mb-3">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="방문일">{r.visit_date ?? "—"}</Field>
          <Field label="기기 고유번호">
            <span className="font-mono">{r.serial || "—"}</span>
          </Field>
          <Field label="병원">{r.hospital || "—"}</Field>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mb-3 flex flex-col gap-4">
        <h2 className="font-bold text-[14px]">점검 · 처리 내용</h2>
        <Field label="점검 사항">
          {r.checked || <span className="text-ink-3">—</span>}
        </Field>
        <Field label="교체 사항">
          {r.replaced ? (
            <span className="text-[color:var(--warn-ink)]">{r.replaced}</span>
          ) : (
            <span className="text-ink-3">—</span>
          )}
        </Field>
        <Field label="사용 부품 (대리점 재고 차감)">
          {r.used_item ? (
            <span className="font-semibold">
              {r.used_item} {r.used_qty}개
            </span>
          ) : (
            <span className="text-ink-3">—</span>
          )}
        </Field>
        <Field label="고장 부품 본사 발송">
          {r.part_sent ? (
            <span className="text-[color:var(--crit-ink)] font-semibold">
              발송함{r.part_sent_note ? ` · ${r.part_sent_note}` : ""}
            </span>
          ) : (
            <span className="text-ink-3">해당 없음</span>
          )}
        </Field>
        {r.note && <Field label="메모">{r.note}</Field>}
      </div>

      <div className="bg-surface border border-line rounded-xl p-4">
        <h2 className="font-bold text-[14px] mb-3">
          현장 사진 {photos.length > 0 && `(${photos.length})`}
        </h2>
        {photos.length === 0 ? (
          <p className="text-[13px] text-ink-3">첨부된 사진이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {photos.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt="현장 사진"
                  className="w-28 h-28 object-cover rounded-lg border border-line hover:opacity-85"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
