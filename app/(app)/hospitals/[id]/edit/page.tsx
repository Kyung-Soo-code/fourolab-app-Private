import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import PeopleEditor from "@/components/PeopleEditor";
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

export default async function EditHospitalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: h } = await supabase
    .from("hospitals")
    .select("*")
    .eq("id", id)
    .single();

  if (!h) {
    return (
      <div>
        <p className="text-ink-3">해당 병원을 찾을 수 없습니다.</p>
        <Link href="/hospitals" className="text-accent font-semibold">
          ← 병원 목록으로
        </Link>
      </div>
    );
  }

  async function updateHospital(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("hospitals")
      .update({
        name: String(formData.get("name") || "").trim(),
        manager: String(formData.get("manager") || ""),
        tel: String(formData.get("tel") || ""),
        biz: String(formData.get("biz") || ""),
        addr: String(formData.get("addr") || ""),
        contacts: parseJson(formData.get("contacts")),
        photos: parseJson(formData.get("photos")),
        checkup_next: formData.get("checkup_next")
          ? String(formData.get("checkup_next"))
          : null,
      })
      .eq("id", id);
    await logAudit("수정", "병원", h?.name ?? id);
    revalidatePath("/hospitals");
    redirect("/hospitals");
  }

  async function deleteHospital() {
    "use server";
    const supabase = await createClient();
    await supabase.from("hospitals").delete().eq("id", id);
    await logAudit("삭제", "병원", h?.name ?? id);
    revalidatePath("/hospitals");
    redirect("/hospitals");
  }

  return (
    <div className="max-w-[560px]">
      <Link href="/hospitals" className="text-[13px] text-accent font-semibold">
        ← 병원 목록으로
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-4">병원 정보 수정</h1>

      <form
        action={updateHospital}
        className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-3.5"
      >
        <div>
          <label className={labelCls}>병원명</label>
          <input
            name="name"
            defaultValue={h.name}
            className={inputCls}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>담당자</label>
            <input
              name="manager"
              defaultValue={h.manager ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>연락처</label>
            <input
              name="tel"
              defaultValue={h.tel ?? ""}
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>영업 주체</label>
            <input
              name="biz"
              defaultValue={h.biz ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>지역</label>
            <input
              name="addr"
              defaultValue={h.addr ?? ""}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>
            담당자 (여러 명 · 간호사·수간호사·구매팀 등)
          </label>
          <PeopleEditor
            name="contacts"
            defaultValue={JSON.stringify(h.contacts ?? [])}
          />
        </div>
        <div>
          <label className={labelCls}>설치 환경 사진</label>
          <PhotoUpload
            name="photos"
            defaultValue={JSON.stringify(h.photos ?? [])}
          />
        </div>
        <div>
          <label className={labelCls}>다음 정기점검일</label>
          <input
            name="checkup_next"
            type="date"
            defaultValue={h.checkup_next ?? ""}
            className={inputCls}
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
            href="/hospitals"
            className="h-10 px-4 grid place-items-center rounded-lg border border-line text-[14px] text-ink-2 hover:bg-surface-2"
          >
            취소
          </Link>
          <button
            formAction={deleteHospital}
            className="ml-auto h-10 px-4 rounded-lg border border-line text-[13px] text-[color:var(--crit-ink)] hover:bg-[color:var(--crit-bg)]"
          >
            삭제
          </button>
        </div>
      </form>
    </div>
  );
}
