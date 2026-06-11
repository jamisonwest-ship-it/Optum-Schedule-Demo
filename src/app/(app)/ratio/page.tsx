import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/supabase/server";
import { RatioPageClient } from "./RatioPageClient";

export default async function RatioPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/auth/login");
  if (staff.app_role === "tech") redirect("/my-schedule"); // techs get the portal glance

  const canEditStatuses = [
    "admin",
    "pharmacist_scheduler",
    "tech_supervisor",
    "pharmacist",
  ].includes(staff.app_role);

  return <RatioPageClient canEditStatuses={canEditStatuses} />;
}
