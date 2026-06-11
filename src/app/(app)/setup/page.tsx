import { redirect } from "next/navigation";
import { createServiceClient, getCurrentStaff } from "@/lib/supabase/server";
import type { Department, Location, Staff, WorkType } from "@/lib/types";
import { SetupPageClient } from "./SetupPageClient";

export default async function SetupPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/auth/login");
  if (staff.app_role !== "admin") redirect("/dashboard");

  const admin = createServiceClient();
  const [staffRes, wtRes, deptRes, locRes] = await Promise.all([
    admin.from("staff").select("*").order("full_name"),
    admin.from("work_types").select("*").order("sort_order"),
    admin.from("departments").select("*").order("code"),
    admin.from("locations").select("*").order("code"),
  ]);

  return (
    <SetupPageClient
      currentStaffId={staff.id}
      initialStaff={(staffRes.data ?? []) as Staff[]}
      initialWorkTypes={(wtRes.data ?? []) as WorkType[]}
      departments={(deptRes.data ?? []) as Department[]}
      locations={(locRes.data ?? []) as Location[]}
    />
  );
}
