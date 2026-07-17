import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PeopleEditor from "@/components/PeopleEditor";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v || "[]"));
  } catch {
    return [];
  }
}

export default async function EditDealer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("dealers")
    .select("*")
    .eq("id", id)
    .single();

  if (!d) {
    return (
      <div>
        <p className="text-ink-3">대리점을 찾을 수 없습니다.</p>
        <Link href="/dealers" className="text-accent font-semibold">
          ← 대리점 관리로
        </Link>
      </div>
    );
  }

  async function update(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("dealers")
      .update({
        name: String(formData.get("name") || "").trim(),
        region: String(formData.get("region") || ""),
        contacts: parseJson(formData.get("contacts")),
        note: String(formData.get("note") || ""),
      })
      .eq("id", id);
    revalidatePath("/dealers");
    redirect("/dealers");
  }

  async function del() {
    "use server";
    const supabase = await createClient();
    await supabase.from("dealers").delete().eq("id", id);
    revalidatePath("/dealers");
    redirect("/dealers");
  }

  return (
    <div className="max-w-[560px]">
      <Link href="/dealers" className="text-[13px] text-accent font-semibold">
        ← 대리점 관리로
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-4">대리점 거래처 수정</h1>

      <form
        action={update}
        className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-3.5"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>대리점명</label>
            <input name="name" defaultValue={d.name} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>지역</label>
            <input name="region" defaultValue={d.region ?? ""} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>담당자 (여러 명 · 변경 가능)</label>
          <PeopleEditor
            name="contacts"
            defaultValue={JSON.stringify(d.contacts ?? [])}
          />
        </div>
        <div>
          <label className={labelCls}>메모</label>
          <input name="note" defaultValue={d.note ?? ""} className={inputCls} />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            type="submit"
            className="h-10 px-5 rounded-lg bg-accent text-white font-semibold text-[14px] hover:bg-accent-2"
          >
            저장
          </button>
          <Link
            href="/dealers"
            className="h-10 px-4 grid place-items-center rounded-lg border border-line text-[14px] text-ink-2 hover:bg-surface-2"
          >
            취소
          </Link>
          <button
            formAction={del}
            className="ml-auto h-10 px-4 rounded-lg border border-line text-[13px] text-[color:var(--crit-ink)] hover:bg-[color:var(--crit-bg)]"
          >
            삭제
          </button>
        </div>
      </form>
    </div>
  );
}
