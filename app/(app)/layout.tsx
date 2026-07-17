import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import MobileTabs from "@/components/MobileTabs";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let name = user.email?.split("@")[0] ?? "직원";
  let role = "staff";
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .single();
  if (profile?.name) name = profile.name;
  if (profile?.role) role = profile.role;

  return (
    <div className="flex min-h-screen">
      <Sidebar userName={name} role={role} />
      <main className="flex-1 min-w-0 p-4 md:p-6 pb-24 md:pb-6 max-w-[1180px] mx-auto w-full">
        {children}
      </main>
      <MobileTabs role={role} />
    </div>
  );
}
