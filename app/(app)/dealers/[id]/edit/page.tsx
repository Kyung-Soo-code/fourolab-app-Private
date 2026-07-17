import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const inputCls =
  "h-9 px-2.5 rounded-lg border border-line bg-surface-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg w-full";
const labelCls = "text-[12px] font-semibold text-ink-2 mb-1 block";

export default async function EditDealerLog({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: l } = await supabase
    .from("dealer_logs")
    .select("*")
    .eq("id", id)
    .single();

  if (!l) {
    return (
      <div>
        <p className="text-ink-3">기록을 찾을 수 없습니다.</p>
        <Link href="/dealers" className="text-accent font-semibold">
          ← 대리점 관리로
        </Link>
      </div>
    );
  }

  const isIn = l.kind === "in";

  async function update(formData: FormData) {
    "use server";
    const supabase = await createClient();
    await supabase
      .from("dealer_logs")
      .update({
        serial: String(formData.get("serial") || "").trim(),
        model: String(formData.get("model") || ""),
        purpose: String(formData.get("purpose") || "완성품"),
        dealer: String(formData.get("dealer") || ""),
        hospital: String(formData.get("hospital") || ""),
        method: String(formData.get("method") || ""),
        status: String(formData.get("status") || ""),
        log_date: formData.get("log_date")
          ? String(formData.get("log_date"))
          : null,
      })
      .eq("id", id);
    revalidatePath("/dealers");
    redirect("/dealers");
  }

  async function del() {
    "use server";
    const supabase = await createClient();
    await supabase.from("dealer_logs").delete().eq("id", id);
    revalidatePath("/dealers");
    redirect("/dealers");
  }

  return (
    <div className="max-w-[520px]">
      <Link href="/dealers" className="text-[13px] text-accent font-semibold">
        ← 대리점 관리로
      </Link>
      <h1 className="text-xl font-bold mt-2 mb-4">
        {isIn ? "본사 → 대리점 발송 수정" : "대리점 → 병원 출고 수정"}
      </h1>

      <form
        action={update}
        className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-3.5"
      >
        <div>
          <label className={labelCls}>고유번호</label>
          <input name="serial" defaultValue={l.serial ?? ""} className={inputCls} required />
        </div>
        {isIn ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>모델</label>
                <select name="model" defaultValue={l.model ?? "OS2"} className={inputCls}>
                  <option value="OS2">OCTA-SELL 2</option>
                  <option value="OS1">OCTA-SELL 1</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>용도</label>
                <select name="purpose" defaultValue={l.purpose ?? "완성품"} className={inputCls}>
                  <option>완성품</option>
                  <option>데모용</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>대리점</label>
              <input name="dealer" defaultValue={l.dealer ?? ""} className={inputCls} />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>대리점</label>
              <input name="dealer" defaultValue={l.dealer ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>납품 병원</label>
              <input name="hospital" defaultValue={l.hospital ?? ""} className={inputCls} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{isIn ? "발송일" : "출고일"}</label>
            <input
              name="log_date"
              type="date"
              defaultValue={l.log_date ?? ""}
              className={inputCls}
            />
          </div>
          {isIn && (
            <div>
              <label className={labelCls}>운송 방법</label>
              <select name="method" defaultValue={l.method ?? "화물"} className={inputCls}>
                <option>화물</option>
                <option>직접</option>
                <option>택배</option>
              </select>
            </div>
          )}
        </div>
        <div>
          <label className={labelCls}>상태</label>
          <input name="status" defaultValue={l.status ?? ""} className={inputCls} />
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
