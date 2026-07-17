import { createClient } from "@/lib/supabase/server";

// 수정 이력 기록 — 실패해도 본 작업을 막지 않음
export async function logAudit(action: string, entity: string, detail: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    let actor = user.email?.split("@")[0] ?? "";
    const { data: p } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    if (p?.name) actor = p.name;
    await supabase.from("audit_log").insert({
      actor,
      action,
      entity,
      detail: detail.slice(0, 300),
    });
  } catch {
    // 무시
  }
}
