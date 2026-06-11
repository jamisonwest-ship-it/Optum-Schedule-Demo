// Server-side data assembly for the ratio grids.
// Shared by /api/ratio and the manager dashboard.

import { createServiceClient } from "@/lib/supabase/server";
import {
  computeGrid,
  countsAtSlot,
  isOnDuty,
  resolveGridDepartments,
  TIME_SLOTS,
  timeToMinutes,
  type LiveOverride,
} from "@/lib/ratio";
import { addDays, minutesInAppTz, todayISO } from "@/lib/dates";
import { formatTime } from "@/lib/dates";
import type {
  Department,
  Location,
  RatioGridKey,
  RatioGridResult,
  ShiftWithRelations,
  WorkType,
} from "@/lib/types";
import { displayName } from "@/lib/types";

export type SlotCellState = "count" | "present" | "off";

export interface RatioStaffRow {
  staffId: string;
  name: string;
  staffType: string;
  deptCode: string;
  deptColor: string;
  shiftLabel: string; // "8a–4:30p · Working"
  workTypeCode: string;
  liveStatusCode: string | null;
  slots: SlotCellState[];
}

export interface RatioGridWithRows extends RatioGridResult {
  staffRows: RatioStaffRow[];
}

export interface RatioData {
  date: string;
  isToday: boolean;
  grids: Record<RatioGridKey, RatioGridWithRows>;
  /** The five live statuses staff can switch between. */
  statusOptions: Pick<WorkType, "id" | "code" | "name">[];
}

const SHIFT_SELECT = `*,
  staff:staff_id (id, full_name, preferred_name, staff_type, always_exclude_ratio),
  work_type:work_type_id (*),
  department:department_id (id, code, name, color, ratio_isolated)`;

const LIVE_STATUS_CODES = ["WORKING", "LUNCH", "MEETING", "OUT", "NON_TECH"];

export async function fetchRatioData(date: string): Promise<RatioData> {
  const admin = createServiceClient();
  const prevDate = addDays(date, -1);
  const isToday = date === todayISO();

  const [shiftsRes, locationsRes, departmentsRes, workTypesRes, liveRes] =
    await Promise.all([
      admin
        .from("shift_records")
        .select(SHIFT_SELECT)
        .in("shift_date", [date, prevDate])
        .neq("status", "cancelled"),
      admin.from("locations").select("*"),
      admin.from("departments").select("*"),
      admin.from("work_types").select("*").order("sort_order"),
      admin.from("live_statuses").select("*").eq("status_date", date),
    ]);

  const allShifts = (shiftsRes.data ?? []) as unknown as ShiftWithRelations[];
  const locations = (locationsRes.data ?? []) as Location[];
  const departments = (departmentsRes.data ?? []) as Department[];
  const workTypes = (workTypesRes.data ?? []) as WorkType[];
  const workTypesById = new Map(workTypes.map((w) => [w.id, w]));

  const shifts = allShifts.filter((s) => s.shift_date === date);
  // Yesterday's overnight shifts spill into this morning's grid
  const prevDayShifts = allShifts.filter(
    (s) =>
      s.shift_date === prevDate &&
      timeToMinutes(s.end_time) < timeToMinutes(s.start_time)
  );

  const liveOverrides: LiveOverride[] = isToday
    ? (liveRes.data ?? []).map((ls) => ({
        staff_id: ls.staff_id,
        work_type_id: ls.work_type_id,
        fromMinutes: minutesInAppTz(ls.updated_at),
      }))
    : [];
  const liveByStaff = new Map(liveOverrides.map((lo) => [lo.staff_id, lo]));

  const grids = {} as Record<RatioGridKey, RatioGridWithRows>;
  for (const grid of ["smrx", "spc", "smms"] as RatioGridKey[]) {
    const result = computeGrid({
      grid,
      date,
      shifts,
      prevDayShifts,
      departments,
      locations,
      workTypesById,
      liveOverrides,
      isToday,
    });

    // Per-staff detail rows for this grid
    const gridDepts = resolveGridDepartments(grid, departments, locations);
    const entries = [
      ...shifts.map((shift) => ({ shift, fromPrevDay: false })),
      ...prevDayShifts.map((shift) => ({ shift, fromPrevDay: true })),
    ].filter(({ shift }) => gridDepts.has(shift.department.code));

    const staffRows: RatioStaffRow[] = entries.map(({ shift, fromPrevDay }) => {
      const live = liveByStaff.get(shift.staff_id);
      const slots: SlotCellState[] = TIME_SLOTS.map((slot) => {
        const slotMins = timeToMinutes(slot);
        if (!isOnDuty(shift.start_time, shift.end_time, slotMins, fromPrevDay))
          return "off";
        let wt = shift.work_type;
        if (isToday && live && slotMins + 30 > live.fromMinutes) {
          wt = workTypesById.get(live.work_type_id) ?? wt;
        }
        return countsAtSlot(
          wt,
          shift.staff.staff_type,
          shift.staff.always_exclude_ratio,
          slotMins
        )
          ? "count"
          : "present";
      });

      return {
        staffId: shift.staff_id,
        name: displayName(shift.staff),
        staffType: shift.staff.staff_type,
        deptCode: shift.department.code,
        deptColor: shift.department.color,
        shiftLabel: `${formatTime(shift.start_time)}–${formatTime(shift.end_time)} · ${shift.work_type.name}${fromPrevDay ? " (overnight)" : ""}`,
        workTypeCode: shift.work_type.code,
        liveStatusCode: live
          ? (workTypesById.get(live.work_type_id)?.code ?? null)
          : null,
        slots,
      };
    });

    const typeOrder = (t: string) => (t === "rph" ? 0 : t === "tech" ? 1 : 2);
    staffRows.sort(
      (a, b) =>
        typeOrder(a.staffType) - typeOrder(b.staffType) ||
        a.deptCode.localeCompare(b.deptCode) ||
        a.name.localeCompare(b.name)
    );

    grids[grid] = { ...result, staffRows };
  }

  return {
    date,
    isToday,
    grids,
    statusOptions: workTypes
      .filter((w) => LIVE_STATUS_CODES.includes(w.code))
      .map((w) => ({ id: w.id, code: w.code, name: w.name })),
  };
}
