import { redirect } from "next/navigation";
import { createServiceClient, getCurrentStaff } from "@/lib/supabase/server";
import { MANAGER_ROLES } from "@/lib/types";
import type { Department, Location, Staff, WorkType } from "@/lib/types";
import { SchedulePageClient } from "./SchedulePageClient";

export default async function SchedulePage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/auth/login");
  const isManager = MANAGER_ROLES.includes(staff.app_role);
  if (!isManager && staff.app_role !== "read_only") redirect("/my-schedule");

  const admin = createServiceClient();
  const [staffRes, deptRes, locRes, wtRes] = await Promise.all([
    admin.from("staff").select("*").eq("active", true).order("full_name"),
    admin.from("departments").select("*").eq("active", true),
    admin.from("locations").select("*"),
    admin.from("work_types").select("*").order("sort_order"),
  ]);

  return (
    <SchedulePageClient
      canEdit={isManager}
      staffList={(staffRes.data ?? []) as Staff[]}
      departments={(deptRes.data ?? []) as Department[]}
      locations={(locRes.data ?? []) as Location[]}
      workTypes={(wtRes.data ?? []) as WorkType[]}
    />
  );
}
