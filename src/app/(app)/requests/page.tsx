import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/supabase/server";
import { MANAGER_ROLES } from "@/lib/types";
import { RequestQueue } from "./RequestQueue";

export default async function RequestsPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/auth/login");
  const isManager = MANAGER_ROLES.includes(staff.app_role);
  if (!isManager && staff.app_role !== "read_only") redirect("/my-schedule");

  return <RequestQueue canDecide={isManager} />;
}
