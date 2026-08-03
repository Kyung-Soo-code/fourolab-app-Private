import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const PRI: Record<string, string> = {
  긴급: "bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]",
  진행중: "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]",
  원격: "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]",
  완료: "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]",
};

function fmt(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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

function Photos({ label, urls }: { label: string; urls: unknown }) {
  const list: string[] = Array.isArray(urls) ? (urls as string[]) : [];
  if (list.length === 0) return null;
  return (
    <div>
      <div className="text-[11.5px] font-semibold text-ink-3 mb-1.5">
        {label} ({list.length})
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((u, i) => (
          <a key={i} href={u} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt={label}
              className="w-24 h-24 object-cover rounded-lg border border-line hover:opacity-85"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export default async function AsDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("as_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (!t) {
    return (
      <div>
        <p className="text-ink-3">A/S 접수를 찾을 수 없습니다.</p>
        <Link href="/as" className="text-accent font-semibold">
          ← A/S 목록으로
        </Link>
      </div>
    );
  }

  async function complete() {
    "use server";
    const supabase = await createClient();
    await supabase.from("as_tickets").update({ priority: "완료" }).eq("id", id);
    await logAudit("수정", "A/S", `완료 처리 · ${t?.serial ?? id}`);
    revalidatePath("/as");
    revalidatePath(`/as/${id}`);
    revalidatePath("/");
    redirect(`/as/${id}`);
  }

  const reporters: any[] = Array.isArray(t.reporters) ? t.reporters : [];
  const hasFloor =
    (Array.isArray(t.photos_f1) && t.photos_f1.length > 0) ||
    (Array.isArray(t.photos_f2) && t.photos_f2.length > 0) ||
    (Array.isArray(t.photos_f3) && t.photos_f3.length > 0);

  return (
    <div className="max-w-[760px]">
      <Link href="/as" className="text-[13px] text-accent font-semibold">
        ← A/S 목록으로
      </Link>

      <div className="flex items-center gap-3 mt-2 mb-4 flex-wrap">
        <h1 className="text-xl font-bold font-mono">{t.serial || "기기 미지정"}</h1>
        <span
          className={
            "text-[12px] font-semibold px-2.5 py-0.5 rounded-full " +
            (PRI[t.priority] ?? "bg-surface-2 text-ink-2")
          }
        >
          {t.priority}
        </span>
        <span className="text-[13.5px] text-ink-2">{t.hospital_name}</span>
        <div className="ml-auto flex items-center gap-2">
          {t.priority !== "완료" && (
            <form action={complete}>
              <button className="h-8 px-3 rounded-lg border border-line text-[12.5px] font-semibold hover:bg-surface-2">
                완료 처리
              </button>
            </form>
          )}
          <Link
            href={`/as/${t.id}/edit`}
            className="h-8 px-3 grid place-items-center rounded-lg bg-accent text-white text-[12.5px] font-semibold hover:bg-accent-2"
          >
            수정
          </Link>
        </div>
      </div>

      {/* 접수 정보 */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-3">
        <h2 className="font-bold text-[14px] mb-3">접수 정보</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="접수일시">{fmt(t.received_at)}</Field>
          <Field label="방문일시">{fmt(t.visited_at)}</Field>
          <Field label="담당자">{t.manager || "—"}</Field>
          <Field label="모델">
            {t.model === "OS1"
              ? "OCTA-SELL 1"
              : t.model === "OS2"
                ? "OCTA-SELL 2"
                : t.model || "—"}
          </Field>
          <Field label="수리 주체">
            {t.repair_by || "본사"}
            {t.repair_dealer ? ` · ${t.repair_dealer}` : ""}
          </Field>
          <Field label="부품 택배 발송">{t.ship || "—"}</Field>
        </div>

        {reporters.length > 0 && (
          <div className="mt-4">
            <div className="text-[11.5px] font-semibold text-ink-3 mb-1.5">
              접수자 (병원측)
            </div>
            <div className="flex flex-wrap gap-2">
              {reporters.map((r, i) => (
                <span
                  key={i}
                  className="text-[12px] bg-surface-2 border border-line rounded-full px-2.5 py-1"
                >
                  {r.role && <span className="text-ink-3">{r.role} </span>}
                  <span className="font-semibold">{r.name}</span>
                  {r.tel && <span className="text-ink-3"> · {r.tel}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 내용 */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-3 flex flex-col gap-4">
        <h2 className="font-bold text-[14px]">처리 내용</h2>
        <Field label="증상 / 원인">
          {t.symptom || <span className="text-ink-3">—</span>}
        </Field>
        <Field label="수리 내용 · 사유 (사내 코멘트)">
          {t.fix_comment ? (
            <span className="text-accent-ink">{t.fix_comment}</span>
          ) : (
            <span className="text-ink-3">—</span>
          )}
        </Field>
        <Field label="소비자 코멘트">
          {t.customer_comment || <span className="text-ink-3">—</span>}
        </Field>
        <Field label="교체 부품">
          {t.parts ? (
            <span className="font-semibold">{t.parts}</span>
          ) : (
            <span className="text-ink-3">—</span>
          )}
        </Field>
      </div>

      {/* 사진 */}
      <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-4">
        <h2 className="font-bold text-[14px]">사진</h2>
        <Photos label="진행 전" urls={t.photos_before} />
        <Photos label="진행 후" urls={t.photos_after} />
        {hasFloor && (
          <>
            <Photos label="1층 점검" urls={t.photos_f1} />
            <Photos label="2층 점검" urls={t.photos_f2} />
            <Photos label="3층 점검" urls={t.photos_f3} />
          </>
        )}
        {!(
          (Array.isArray(t.photos_before) && t.photos_before.length) ||
          (Array.isArray(t.photos_after) && t.photos_after.length) ||
          hasFloor
        ) && (
          <p className="text-[13px] text-ink-3">첨부된 사진이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
