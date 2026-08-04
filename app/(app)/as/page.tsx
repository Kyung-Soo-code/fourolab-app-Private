import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import PartPicker from "@/components/PartPicker";
import PeopleEditor from "@/components/PeopleEditor";
import PhotoUpload from "@/components/PhotoUpload";
import ResetForm from "@/components/ResetForm";

export const dynamic = "force-dynamic";

function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v || "[]"));
  } catch {
    return [];
  }
}

const PRI: Record<string, string> = {
  긴급: "bg-[color:var(--crit-bg)] text-[color:var(--crit-ink)]",
  진행중: "bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]",
  원격: "bg-[color:var(--info-bg)] text-[color:var(--info-ink)]",
  완료: "bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]",
};

function fmt(ts: string | null) {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

// 서버 액션 — A/S 접수 등록
async function createTicket(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const deviceId = String(formData.get("device_id") || "");
  let serial = "",
    model = "",
    hospitalId: string | null = null,
    hospitalName = "";

  if (deviceId) {
    const { data: dev } = await supabase
      .from("devices")
      .select("serial, model, hospital_id, hospitals(name)")
      .eq("id", deviceId)
      .single();
    if (dev) {
      serial = dev.serial;
      model = dev.model;
      hospitalId = dev.hospital_id;
      hospitalName = (dev as any).hospitals?.name ?? "";
    }
  }

  await supabase.from("as_tickets").insert({
    device_id: deviceId || null,
    serial,
    model,
    hospital_id: hospitalId,
    hospital_name: hospitalName,
    reporters: parseJson(formData.get("reporters")),
    photos_before: parseJson(formData.get("photos_before")),
    photos_after: parseJson(formData.get("photos_after")),
    photos_f1: parseJson(formData.get("photos_f1")),
    photos_f2: parseJson(formData.get("photos_f2")),
    photos_f3: parseJson(formData.get("photos_f3")),
    customer_comment: String(formData.get("customer_comment") || ""),
    symptom: String(formData.get("symptom") || ""),
    fix_comment: String(formData.get("fix_comment") || ""),
    parts: String(formData.get("parts") || ""),
    ship: String(formData.get("ship") || ""),
    manager: String(formData.get("manager") || ""),
    priority: String(formData.get("priority") || "진행중"),
    repair_by: String(formData.get("repair_by") || "본사"),
    repair_dealer: String(formData.get("repair_dealer") || ""),
    received_at: formData.get("received_at")
      ? new Date(String(formData.get("received_at"))).toISOString()
      : new Date().toISOString(),
    visited_at: formData.get("visited_at")
      ? new Date(String(formData.get("visited_at"))).toISOString()
      : null,
    created_by: user?.id ?? null,
  });

  // 교체 부품만큼 재고 자동 차감 (부품 id 기준)
  let items: { id: string; qty: number }[] = [];
  try {
    items = JSON.parse(String(formData.get("parts_items") || "[]"));
  } catch {
    items = [];
  }
  for (const it of items) {
    if (!it.id || it.id.startsWith("name:")) continue;
    const { data: pr } = await supabase
      .from("parts")
      .select("id, stock")
      .eq("id", it.id)
      .maybeSingle();
    if (pr) {
      await supabase
        .from("parts")
        .update({ stock: Math.max(0, (pr.stock ?? 0) - (it.qty || 0)) })
        .eq("id", pr.id);
    }
  }

  await logAudit("등록", "A/S", `${serial} · ${hospitalName}`);
  revalidatePath("/as");
  revalidatePath("/inventory");
  revalidatePath("/");
}

// 서버 액션 — A/S 완료 처리
async function completeTicket(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { data: t } = await supabase
    .from("as_tickets")
    .select("serial, hospital_name")
    .eq("id", id)
    .maybeSingle();
  await supabase.from("as_tickets").update({ priority: "완료" }).eq("id", id);
  await logAudit("수정", "A/S", `완료 처리 · ${t?.serial ?? id}`);
  revalidatePath("/as");
  revalidatePath("/");
}

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

export default async function AsPage() {
  const supabase = await createClient();
  const [{ data: tickets }, { data: devices }, { data: parts }] =
    await Promise.all([
      supabase
        .from("as_tickets")
        .select("*")
        .order("received_at", { ascending: false }),
      supabase
        .from("devices")
        .select("id, serial, model, hospitals(name)")
        .order("serial"),
      supabase
        .from("parts")
        .select("id, name, model, favorite, as_type, stock, note, category")
        .order("name"),
    ]);

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">A/S 관리</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        기기별 A/S 접수 · 사내 수리 코멘트 기록
      </p>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
        {/* 목록 */}
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <h2 className="font-bold text-[14px]">A/S 접수 목록</h2>
            <a
              href="/api/export/as"
              className="ml-auto text-[12px] font-semibold text-accent hover:underline"
            >
              엑셀 내보내기
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-ink-3 text-left">
                  <th className="font-semibold px-3 py-2.5">기기번호</th>
                  <th className="font-semibold px-3 py-2.5">접수 / 처리</th>
                  <th className="font-semibold px-3 py-2.5">병원 / 증상</th>
                  <th className="font-semibold px-3 py-2.5">상태</th>
                  <th className="font-semibold px-3 py-2.5 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {(tickets ?? []).map((t) => (
                  <tr key={t.id} className="border-t border-line-2 align-top">
                    <td className="px-3 py-3 font-mono text-[12px] font-semibold">
                      <a
                        href={`/as/${t.id}`}
                        className="hover:text-accent hover:underline"
                        title="상세 보기"
                      >
                        {t.serial || "-"}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-[12px] whitespace-nowrap">
                      <div className="text-ink-2">
                        <span className="text-ink-3">접수</span>{" "}
                        {fmt(t.received_at)}
                      </div>
                      <div className={t.visited_at ? "text-accent-ink" : "text-ink-3"}>
                        <span className="text-ink-3">처리</span>{" "}
                        {t.visited_at ? fmt(t.visited_at) : "미완료"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-2">
                      <a
                        href={`/as/${t.id}`}
                        className="hover:text-accent hover:underline"
                        title="상세 보기"
                      >
                        {t.hospital_name}
                        <div className="text-[11.5px] text-ink-3">{t.symptom}</div>
                      </a>
                      {t.repair_by && t.repair_by !== "본사" && (
                        <span className="inline-block text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-[color:var(--info-bg)] text-[color:var(--info-ink)] mt-0.5">
                          수리: {t.repair_by}
                          {t.repair_dealer ? ` · ${t.repair_dealer}` : ""}
                        </span>
                      )}
                      {Array.isArray(t.reporters) && t.reporters.length > 0 && (
                        <div className="text-[11px] text-ink-3 mt-0.5">
                          접수자:{" "}
                          {t.reporters
                            .map((r: any) =>
                              [r.role, r.name].filter(Boolean).join(" "),
                            )
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                      {t.fix_comment && (
                        <div className="text-[11px] text-accent-ink mt-0.5">
                          사내: {t.fix_comment}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          "text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap " +
                          (PRI[t.priority] ?? "bg-surface-2 text-ink-2")
                        }
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={`/as/${t.id}`}
                          className="text-[12px] font-semibold px-2 py-1 rounded-md border border-line hover:bg-surface-2"
                        >
                          보기
                        </a>
                        <a
                          href={`/as/${t.id}/edit`}
                          className="text-[12px] font-semibold text-accent hover:underline px-1.5"
                        >
                          수정
                        </a>
                        {t.priority !== "완료" && (
                          <form action={completeTicket}>
                            <input type="hidden" name="id" value={t.id} />
                            <button className="text-[12px] font-semibold px-2 py-1 rounded-md border border-line hover:bg-surface-2">
                              완료
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(tickets ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-ink-3 text-[13px]"
                    >
                      아직 접수된 A/S가 없습니다. 오른쪽에서 등록해 보세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 접수 등록 폼 */}
        <div className="bg-surface border border-line rounded-xl p-4 h-fit">
          <h2 className="font-bold text-[14px] mb-3">A/S 접수 등록</h2>
          <ResetForm action={createTicket} className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>대상 기기</label>
              <select name="device_id" className={inputCls} required>
                <option value="">기기 선택…</option>
                {((devices ?? []) as any[]).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.serial} · {d.model}
                    {d.hospitals?.name ? ` · ${d.hospitals.name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>
                접수자 (병원측 · 여러 명 · 간호사·수간호사·세척담당 등)
              </label>
              <PeopleEditor name="reporters" addLabel="＋ 접수자 추가" />
            </div>

            <div>
              <label className={labelCls}>증상 / 원인</label>
              <textarea
                name="symptom"
                rows={2}
                className={inputCls + " h-auto py-2"}
                placeholder="예: 급수 불량 · 호스 누수"
              />
            </div>

            <div>
              <label className={labelCls}>수리 내용 · 사유 (사내 코멘트)</label>
              <textarea
                name="fix_comment"
                rows={2}
                className={inputCls + " h-auto py-2"}
                placeholder="어떻게 수리했고 왜 필요했는지 · 재발 방지 조치"
              />
            </div>

            <div>
              <label className={labelCls}>
                교체 부품 (즐겨찾기 우선 · 여러 개 선택 · 수량)
              </label>
              <PartPicker parts={(parts ?? []) as any} name="parts" />
            </div>
            <div>
              <label className={labelCls}>담당자</label>
              <input name="manager" className={inputCls} placeholder="이수리" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>수리 주체</label>
                <select name="repair_by" className={inputCls} defaultValue="본사">
                  <option>본사</option>
                  <option>대리점</option>
                  <option>제3업체</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>대리점/업체명 (해당 시)</label>
                <input name="repair_dealer" className={inputCls} placeholder="영남지사 등" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>접수일시 (비우면 지금 시각)</label>
                <input
                  name="received_at"
                  type="datetime-local"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>방문·처리일시 (실제 A/S 실행일)</label>
                <input
                  name="visited_at"
                  type="datetime-local"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>긴급도</label>
                <select name="priority" className={inputCls} defaultValue="진행중">
                  <option>긴급</option>
                  <option>진행중</option>
                  <option>원격</option>
                  <option>완료</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>부품 택배 발송 (지방)</label>
              <input name="ship" className={inputCls} placeholder="한진택배 · 송장 0000" />
            </div>

            <div>
              <label className={labelCls}>소비자 코멘트 (고객 반응)</label>
              <textarea
                name="customer_comment"
                rows={2}
                className={inputCls + " h-auto py-2"}
                placeholder="예: 현장 응대 만족 · 대기 시간 문의"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>진행 전 사진</label>
                <PhotoUpload name="photos_before" />
              </div>
              <div>
                <label className={labelCls}>진행 후 사진</label>
                <PhotoUpload name="photos_after" />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                층별 점검 사진 (1·2·3층 이상 유무)
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <div className="text-[11px] text-ink-3 mb-1">1층</div>
                  <PhotoUpload name="photos_f1" />
                </div>
                <div>
                  <div className="text-[11px] text-ink-3 mb-1">2층</div>
                  <PhotoUpload name="photos_f2" />
                </div>
                <div>
                  <div className="text-[11px] text-ink-3 mb-1">3층</div>
                  <PhotoUpload name="photos_f3" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="h-10 mt-1 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
            >
              A/S 접수 등록
            </button>
          </ResetForm>
        </div>
      </div>
    </div>
  );
}
