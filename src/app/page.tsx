import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/supabase/server";
import { MANAGER_ROLES } from "@/lib/types";

export default async function Home() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/auth/login");

  const fullApp =
    MANAGER_ROLES.includes(staff.app_role) || staff.app_role === "read_only";
  redirect(fullApp ? "/dashboard" : "/my-schedule");
}
