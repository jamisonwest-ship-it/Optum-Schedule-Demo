import { redirect } from "next/navigation";
import { createServiceClient, getCurrentStaff } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/dates";
import { fetchRatioData } from "@/lib/ratio-data";
import { timeToMinutes } from "@/lib/ratio";
import type {
  Department,
  Location,
  RatioGridKey,
  ShiftWithRelations,
  TimeOffRequest,
} from "@/lib/types";
import { MySchedulePortal } from "./MySchedulePortal";

export default async function MySchedulePage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/auth/login");

  const admin = createServiceClient();
  const today = todayISO();
  const prevDay = addDays(today, -1);
  const weekEnd = addDays(today, 6);

  const [shiftsRes, liveRes, requestsRes, deptRes, locRes, ratioData] =
    await Promise.all([
      admin
        .from("shift_records")
        .select(
          `*,
           staff:staff_id (id, full_name, preferred_name, staff_type, always_exclude_ratio),
           work_type:work_type_id (*),
           department:department_id (id, code, name, color, ratio_isolated)`
        )
        .eq("staff_id", staff.id)
        .eq("status", "published")
        .gte("shift_date", prevDay)
        .lte("shift_date", weekEnd)
        .order("shift_date")
        .order("start_time"),
      admin
        .from("live_statuses")
        .select("*")
        .eq("staff_id", staff.id)
        .eq("status_date", today)
        .maybeSingle(),
      admin
        .from("time_off_requests")
        .select("*")
        .eq("staff_id", staff.id)
        .order("created_at", { ascending: false })
        .limit(10),
      admin.from("departments").select("*"),
      admin.from("locations").select("*"),
      fetchRatioData(today),
    ]);

  const allShifts = (shiftsRes.data ?? []) as unknown as ShiftWithRelations[];
  // Yesterday's row only matters if it's an overnight shift still running
  const shifts = allShifts.filter(
    (s) =>
      s.shift_date >= today ||
      (s.shift_date === prevDay &&
        timeToMinutes(s.end_time) < timeToMinutes(s.start_time))
  );

  // Which ratio grid does this person's department belong to?
  const departments = (deptRes.data ?? []) as Department[];
  const locations = (locRes.data ?? []) as Location[];
  const myDept = departments.find((d) => d.id === staff.primary_department_id);
  const locCode = myDept
    ? locations.find((l) => l.id === myDept.location_id)?.code
    : "SMRX";
  const myGrid: RatioGridKey = myDept?.ratio_isolated
    ? "spc"
    : locCode === "SMMS"
      ? "smms"
      : "smrx";
  const gridResult = ratioData.grids[myGrid];

  return (
    <MySchedulePortal
      staff={staff}
      today={today}
      shifts={shifts}
      liveStatus={liveRes.data ?? null}
      requests={(requestsRes.data ?? []) as TimeOffRequest[]}
      statusOptions={ratioData.statusOptions}
      ratioGlance={{
        grid: myGrid,
        worst: gridResult.worst,
        banner: gridResult.banner,
        slots: gridResult.slots,
      }}
    />
  );
}
