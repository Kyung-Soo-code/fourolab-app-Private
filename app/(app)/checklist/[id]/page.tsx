import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { CHECKLIST, ALL_KEYS, filledCount } from "@/lib/checklistItems";

export const dynamic = "force-dynamic";

const inputCls =
  "h-8 px-2 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";

function fmt(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function myName(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();
  return data?.name || "직원";
}

export default async function ChecklistDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: c } = await supabase
    .from("checklists")
    .select("*")
    .eq("id", id)
    .single();

  if (!c) {
    return (
      <div>
        <p className="text-ink-3">체크리스트를 찾을 수 없습니다.</p>
        <Link href="/checklist" className="text-accent font-semibold">
          ← 목록으로
        </Link>
      </div>
    );
  }

  const data: Record<string, any> = c.data ?? {};
  const done = filledCount(data);
  const total = ALL_KEYS.length;
  const allFilled = done === total;
  const confirmed = c.status === "확정";
  const meIsChecker1 = c.checker1_id === user?.id;
  const meIsChecker2 = c.checker2_id === user?.id;

  // 항목 저장
  async function save(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const next: Record<string, any> = {};
    for (const item of CHECKLIST) {
      for (const r of item.rows) {
        if (r.kind === "check") next[r.key] = formData.get(r.key) === "on";
        else next[r.key] = String(formData.get(r.key) || "");
      }
    }
    await supabase
      .from("checklists")
      .update({ data: next, note: String(formData.get("note") || "") })
      .eq("id", id);
    revalidatePath(`/checklist/${id}`);
    revalidatePath("/checklist");
  }

  // 기본정보 수정
  async function updateInfo(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("checklists")
      .update({
        serial: String(formData.get("serial") || "").trim(),
        model: String(formData.get("model") || "OS2"),
        purpose: String(formData.get("purpose") || "납품용"),
        hospital: String(formData.get("hospital") || ""),
      })
      .eq("id", id);
    await logAudit(
      "수정",
      "체크리스트",
      `${String(formData.get("serial") || "")} 기본정보 수정`,
    );
    revalidatePath(`/checklist/${id}`);
    revalidatePath("/checklist");
  }

  // 삭제
  async function remove() {
    "use server";
    const supabase = await createClient();
    const { data: cur } = await supabase
      .from("checklists")
      .select("serial")
      .eq("id", id)
      .maybeSingle();
    await supabase.from("checklists").delete().eq("id", id);
    await logAudit("삭제", "체크리스트", cur?.serial ?? id);
    revalidatePath("/checklist");
    redirect("/checklist");
  }

  // 확인 서명 (더블 체크)
  async function sign() {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: cur } = await supabase
      .from("checklists")
      .select("*")
      .eq("id", id)
      .single();
    if (!cur) return;
    if (filledCount(cur.data ?? {}) !== ALL_KEYS.length) return; // 미완성이면 서명 불가
    const name = await myName(supabase, user.id);
    const now = new Date().toISOString();

    if (!cur.checker1_id) {
      await supabase
        .from("checklists")
        .update({ checker1_id: user.id, checker1_name: name, checker1_at: now })
        .eq("id", id);
      await logAudit("수정", "체크리스트", `${cur.serial} 1차 확인 (${name})`);
    } else if (cur.checker1_id !== user.id && !cur.checker2_id) {
      await supabase
        .from("checklists")
        .update({
          checker2_id: user.id,
          checker2_name: name,
          checker2_at: now,
          status: "확정",
        })
        .eq("id", id);
      await logAudit(
        "수정",
        "체크리스트",
        `${cur.serial} 2차 확인·확정 (${name})`,
      );
    }
    revalidatePath(`/checklist/${id}`);
    revalidatePath("/checklist");
  }

  // 확인 취소 (본인 서명만)
  async function unsign() {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: cur } = await supabase
      .from("checklists")
      .select("*")
      .eq("id", id)
      .single();
    if (!cur) return;
    if (cur.checker2_id === user.id) {
      await supabase
        .from("checklists")
        .update({
          checker2_id: null,
          checker2_name: "",
          checker2_at: null,
          status: "작성중",
        })
        .eq("id", id);
    } else if (cur.checker1_id === user.id && !cur.checker2_id) {
      await supabase
        .from("checklists")
        .update({ checker1_id: null, checker1_name: "", checker1_at: null })
        .eq("id", id);
    }
    revalidatePath(`/checklist/${id}`);
    revalidatePath("/checklist");
  }

  const canSign =
    allFilled &&
    !confirmed &&
    !meIsChecker1 &&
    !meIsChecker2 &&
    !(c.checker1_id && c.checker2_id);

  return (
    <div className="max-w-[820px]">
      <Link href="/checklist" className="text-[13px] text-accent font-semibold">
        ← 체크리스트 목록
      </Link>

      <div className="flex items-center gap-3 mt-2 mb-3 flex-wrap">
        <h1 className="text-xl font-bold font-mono">{c.serial}</h1>
        <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 border border-line text-ink-2">
          {c.model === "OS1" ? "OCTA-SELL 1" : "OCTA-SELL 2"}
        </span>
        <span
          className={
            "text-[12px] font-semibold px-2 py-0.5 rounded-full " +
            (c.purpose === "데모용"
              ? "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]"
              : "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]")
          }
        >
          {c.purpose}
        </span>
        {c.hospital && (
          <span className="text-[13px] text-ink-2">{c.hospital}</span>
        )}
      </div>

      {/* 기본정보 수정 · 삭제 */}
      <details className="bg-surface border border-line rounded-xl mb-4">
        <summary className="px-4 py-2.5 text-[12.5px] font-semibold text-accent cursor-pointer select-none">
          기본정보 수정 · 삭제
        </summary>
        <div className="px-4 pb-4">
          <form action={updateInfo} className="flex flex-wrap items-end gap-2.5">
            <div className="flex-1 min-w-[130px]">
              <label className="text-[12px] font-semibold text-ink-2 mb-1 block">
                장비번호
              </label>
              <input name="serial" defaultValue={c.serial ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink-2 mb-1 block">
                모델
              </label>
              <select
                name="model"
                defaultValue={c.model ?? "OS2"}
                className={inputCls + " w-32"}
              >
                <option value="OS2">OCTA-SELL 2</option>
                <option value="OS1">OCTA-SELL 1</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink-2 mb-1 block">
                구분
              </label>
              <select
                name="purpose"
                defaultValue={c.purpose ?? "납품용"}
                className={inputCls + " w-24"}
              >
                <option>납품용</option>
                <option>데모용</option>
              </select>
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="text-[12px] font-semibold text-ink-2 mb-1 block">
                납품처 / 데모처
              </label>
              <input
                name="hospital"
                defaultValue={c.hospital ?? ""}
                className={inputCls}
              />
            </div>
            <button className="h-8 px-4 rounded-lg bg-accent text-white font-semibold text-[12.5px] hover:bg-accent-2">
              정보 저장
            </button>
          </form>

          <form action={remove} className="mt-3 pt-3 border-t border-line-2">
            <button className="h-8 px-4 rounded-lg border border-line text-[12.5px] text-[color:var(--crit-ink)] hover:bg-[color:var(--crit-bg)]">
              이 체크리스트 삭제
            </button>
          </form>
        </div>
      </details>

      {/* 진행률 + 더블 체크 상태 */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
          <span className="text-[12.5px] font-semibold tabular-nums">
            {done}/{total}
          </span>
          <span
            className={
              "text-[12px] font-bold px-2.5 py-1 rounded-full " +
              (confirmed
                ? "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]"
                : "bg-surface-2 text-ink-2")
            }
          >
            {confirmed ? "확정 완료" : "작성중"}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-line p-3">
            <div className="text-[11.5px] text-ink-3 font-semibold">1차 확인</div>
            <div className="text-[14px] font-bold mt-0.5">
              {c.checker1_name || <span className="text-ink-3">미확인</span>}
            </div>
            <div className="text-[11.5px] text-ink-3">{fmt(c.checker1_at)}</div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="text-[11.5px] text-ink-3 font-semibold">2차 확인</div>
            <div className="text-[14px] font-bold mt-0.5">
              {c.checker2_name || <span className="text-ink-3">미확인</span>}
            </div>
            <div className="text-[11.5px] text-ink-3">{fmt(c.checker2_at)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {canSign && (
            <form action={sign}>
              <button className="h-9 px-4 rounded-lg bg-accent text-white font-semibold text-[13px] hover:bg-accent-2">
                {c.checker1_id ? "2차 확인 (확정)" : "1차 확인"} — 내 이름으로
                서명
              </button>
            </form>
          )}
          {(meIsChecker1 || meIsChecker2) && (
            <form action={unsign}>
              <button className="h-9 px-4 rounded-lg border border-line text-[13px] text-ink-2 hover:bg-surface-2">
                내 확인 취소
              </button>
            </form>
          )}
          {!allFilled && (
            <span className="text-[12.5px] text-[color:var(--warn-ink)]">
              모든 항목을 채워야 확인 서명이 가능합니다 ({total - done}개 남음)
            </span>
          )}
          {allFilled && meIsChecker1 && !c.checker2_id && (
            <span className="text-[12.5px] text-ink-3">
              1차 확인 완료 — <b>다른 직원이 2차 확인</b>해야 확정됩니다.
            </span>
          )}
        </div>
      </div>

      {/* 항목 입력 */}
      <form action={save} className="flex flex-col gap-2.5">
        {CHECKLIST.map((item) => {
          const itemDone = item.rows.every((r) => {
            const v = data[r.key];
            return typeof v === "boolean" ? v : String(v ?? "").trim() !== "";
          });
          return (
            <div
              key={item.no}
              className={
                "bg-surface border rounded-xl p-3.5 " +
                (itemDone ? "border-line" : "border-[color:var(--warn-ink)]/30")
              }
            >
              <div className="flex items-start gap-2">
                <span
                  className={
                    "shrink-0 w-6 h-6 rounded-full text-[11px] font-bold grid place-items-center mt-0.5 " +
                    (itemDone
                      ? "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]"
                      : "bg-surface-2 text-ink-3")
                  }
                >
                  {item.no}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink">
                    {item.title}
                  </div>
                  {item.desc && (
                    <div className="text-[11.5px] text-ink-3 mt-1 leading-relaxed">
                      {item.desc}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2.5">
                    {item.rows.map((r) => {
                      if (r.kind === "check") {
                        return (
                          <label
                            key={r.key}
                            className="flex items-center gap-1.5 text-[13px] text-ink-2"
                          >
                            <input
                              type="checkbox"
                              name={r.key}
                              defaultChecked={!!data[r.key]}
                              disabled={confirmed}
                              className="w-4 h-4"
                            />
                            {r.label}
                          </label>
                        );
                      }
                      if (r.kind === "choice") {
                        return (
                          <label
                            key={r.key}
                            className="flex items-center gap-1.5 text-[13px] text-ink-2"
                          >
                            {r.label}
                            <select
                              name={r.key}
                              defaultValue={String(data[r.key] ?? "")}
                              disabled={confirmed}
                              className={inputCls + " w-28"}
                            >
                              <option value="">선택</option>
                              {r.options.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          </label>
                        );
                      }
                      return (
                        <label
                          key={r.key}
                          className="flex items-center gap-1.5 text-[13px] text-ink-2"
                        >
                          {r.label}
                          <input
                            name={r.key}
                            defaultValue={String(data[r.key] ?? "")}
                            placeholder={r.ph}
                            disabled={confirmed}
                            className={inputCls + " w-28"}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="bg-surface border border-line rounded-xl p-3.5">
          <label className="text-[12px] font-semibold text-ink-2 mb-1 block">
            비고 / 특이사항
          </label>
          <textarea
            name="note"
            rows={2}
            defaultValue={c.note ?? ""}
            disabled={confirmed}
            className={inputCls + " h-auto py-2"}
          />
        </div>

        {!confirmed && (
          <div className="sticky bottom-20 md:bottom-4 flex justify-end">
            <button className="h-11 px-6 rounded-xl bg-accent text-white font-bold text-[14px] hover:bg-accent-2 shadow-lg">
              저장
            </button>
          </div>
        )}
        {confirmed && (
          <p className="text-[13px] text-[color:var(--ok-ink)] font-semibold text-center py-2">
            확정된 체크리스트입니다 — 수정하려면 확인을 취소하세요.
          </p>
        )}
      </form>
    </div>
  );
}
