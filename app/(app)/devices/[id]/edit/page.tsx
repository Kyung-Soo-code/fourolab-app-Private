import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import PhotoUpload from "@/components/PhotoUpload";

export const dynamic = "force-dynamic";

function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v || "[]"));
  } catch {
    return [];
  }
}

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";
const CATS = ["완성품", "데모", "전시", "A/S", "납품"];

function n(v: FormDataEntryValue | null) {
  const x = parseInt(String(v ?? "0"), 10);
  return Number.isFinite(x) ? x : 0;
}

export default async function EditDevicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: d }, { data: hospitals }] = await Promise.all([
    supabase.from("devices").select("*").eq("id", id).single(),
    supabase.from("hospitals").select("id, name").order("name"),
  ]);

  if (!d) {
    return (
      <div>
        <p className="text-ink-3">해당 기기를 찾을 수 없습니다.</p>
        <Link href="/devices" className="text-accent font-semibold">
          ← 기기 목록으로
        </Link>
      </div>
    );
  }

  async function updateDevice(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("devices")
      .update({
        serial: String(formData.get("serial") || "").trim(),
        model: String(formData.get("model") || "OS2"),
        category: String(formData.get("category") || "완성품"),
        status: String(formData.get("status") || ""),
        hospital_id: (formData.get("hospital_id") as string) || null,
        produced_at: formData.get("produced_at")
          ? String(formData.get("produced_at"))
          : null,
        delivered_at: formData.get("delivered_at")
          ? String(formData.get("delivered_at"))
          : null,
        install_place: String(formData.get("install_place") || ""),
        water_pressure: String(formData.get("water_pressure") || ""),
        water_time: String(formData.get("water_time") || ""),
        survey: String(formData.get("survey") || ""),
        crew: String(formData.get("crew") || ""),
        transport: String(formData.get("transport") || ""),
        improvement: String(formData.get("improvement") || ""),
        improvement_done: String(formData.get("improvement_done") || ""),
        biz: String(formData.get("biz") || ""),
        install_photos: parseJson(formData.get("install_photos")),
        note: String(formData.get("note") || ""),
        test_start: formData.get("test_start")
          ? String(formData.get("test_start"))
          : null,
        test_count: n(formData.get("test_count")),
        test_end: formData.get("test_end")
          ? String(formData.get("test_end"))
          : null,
        test_issue: String(formData.get("test_issue") || ""),
      })
      .eq("id", id);
    await logAudit("수정", "기기", d?.serial ?? id);
    revalidatePath("/devices");
    redirect("/devices");
  }

  async function deleteDevice() {
    "use server";
    const supabase = await createClient();
    await supabase.from("devices").delete().eq("id", id);
    await logAudit("삭제", "기기", d?.serial ?? id);
    revalidatePath("/devices");
    redirect("/devices");
  }

  return (
    <div className="max-w-[560px]">
      <Link href="/devices" className="text-[13px] text-accent font-semibold">
        ← 기기 목록으로
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-4">기기 정보 수정</h1>

      <form
        action={updateDevice}
        className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-3.5"
      >
        <div>
          <label className={labelCls}>고유번호</label>
          <input
            name="serial"
            defaultValue={d.serial}
            className={inputCls}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>모델</label>
            <select name="model" defaultValue={d.model} className={inputCls}>
              <option value="OS2">OCTA-SELL 2</option>
              <option value="OS1">OCTA-SELL 1</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>구분</label>
            <select
              name="category"
              defaultValue={d.category}
              className={inputCls}
            >
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>상태</label>
            <input
              name="status"
              defaultValue={d.status ?? ""}
              className={inputCls}
              placeholder="설치 완료 / 데모중 등"
            />
          </div>
          <div>
            <label className={labelCls}>생산일</label>
            <input
              name="produced_at"
              type="date"
              defaultValue={d.produced_at ?? ""}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>납품일</label>
          <input
            name="delivered_at"
            type="date"
            defaultValue={d.delivered_at ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>위치 병원</label>
          <select
            name="hospital_id"
            defaultValue={d.hospital_id ?? ""}
            className={inputCls}
          >
            <option value="">사내 보관</option>
            {((hospitals ?? []) as any[]).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div className="border-t border-line-2 pt-3 mt-1">
          <div className="text-[13px] font-bold text-ink mb-2">설치 정보</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>설치 층수 / 장소</label>
              <input
                name="install_place"
                defaultValue={d.install_place ?? ""}
                className={inputCls}
                placeholder="3층 검사실"
              />
            </div>
            <div>
              <label className={labelCls}>수압 체크</label>
              <input
                name="water_pressure"
                defaultValue={d.water_pressure ?? ""}
                className={inputCls}
                placeholder="2.8 bar"
              />
            </div>
            <div>
              <label className={labelCls}>급수 설정 시간</label>
              <input
                name="water_time"
                defaultValue={d.water_time ?? ""}
                className={inputCls}
                placeholder="45초"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <label className={labelCls}>사전 답사</label>
              <input
                name="survey"
                defaultValue={d.survey ?? ""}
                className={inputCls}
                placeholder="완료 (7/10)"
              />
            </div>
            <div>
              <label className={labelCls}>투입 인력</label>
              <input
                name="crew"
                defaultValue={d.crew ?? ""}
                className={inputCls}
                placeholder="이수리, 최현장"
              />
            </div>
            <div>
              <label className={labelCls}>운송 방법</label>
              <input
                name="transport"
                defaultValue={d.transport ?? ""}
                className={inputCls}
                placeholder="자차 / 화물"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className={labelCls}>영업 주체</label>
              <input
                name="biz"
                defaultValue={d.biz ?? ""}
                className={inputCls}
                placeholder="본사 직영 / 대리점 / 소개"
              />
            </div>
            <div>
              <label className={labelCls}>개선 요구 반영 여부</label>
              <input
                name="improvement_done"
                defaultValue={d.improvement_done ?? ""}
                className={inputCls}
                placeholder="반영 완료 / 검토중"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>현장 개선 요구사항</label>
            <textarea
              name="improvement"
              rows={2}
              defaultValue={d.improvement ?? ""}
              className={inputCls + " h-auto py-2"}
              placeholder="배수 호스 1m 연장 요청 등"
            />
          </div>
          <div className="mt-3">
            <label className={labelCls}>설치 완료 사진</label>
            <PhotoUpload
              name="install_photos"
              defaultValue={JSON.stringify(d.install_photos ?? [])}
            />
          </div>
        </div>

        <div className="border-t border-line-2 pt-3 mt-1">
          <div className="text-[13px] font-bold text-ink mb-2">
            완성품 테스트 기록
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>테스트 시작일</label>
              <input
                name="test_start"
                type="date"
                defaultValue={d.test_start ?? ""}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>테스트 횟수</label>
              <input
                name="test_count"
                type="number"
                defaultValue={d.test_count ?? 0}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>테스트 종료일</label>
              <input
                name="test_end"
                type="date"
                defaultValue={d.test_end ?? ""}
                className={inputCls}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>문제점 / 특이사항</label>
            <textarea
              name="test_issue"
              rows={2}
              defaultValue={d.test_issue ?? ""}
              className={inputCls + " h-auto py-2"}
              placeholder="테스트 중 부품 교체·이상 등"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>메모</label>
          <input
            name="note"
            defaultValue={d.note ?? ""}
            className={inputCls}
            placeholder="데모 회수 코멘트 · 기타 메모"
          />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            type="submit"
            className="h-10 px-5 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
          >
            저장
          </button>
          <Link
            href="/devices"
            className="h-10 px-4 grid place-items-center rounded-lg border border-line text-[14px] text-ink-2 hover:bg-surface-2"
          >
            취소
          </Link>
          <button
            formAction={deleteDevice}
            className="ml-auto h-10 px-4 rounded-lg border border-line text-[13px] text-[color:var(--crit-ink)] hover:bg-[color:var(--crit-bg)]"
          >
            삭제
          </button>
        </div>
      </form>
    </div>
  );
}
