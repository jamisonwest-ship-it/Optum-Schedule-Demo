import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaff();
  if (!staff || !staff.active) redirect("/auth/login?error=not-on-roster");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header staff={staff} />
      <div className="mx-auto flex max-w-screen-2xl">
        <Sidebar role={staff.app_role} />
        {/* pb-24 keeps content clear of the fixed mobile bottom nav */}
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
