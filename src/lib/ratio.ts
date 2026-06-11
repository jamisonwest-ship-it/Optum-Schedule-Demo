// Ratio calculation engine — the heart of the platform.
// Pure functions, no database access. All counting rules come from the
// work_types table and staff flags; nothing role-specific is hard-coded here.

import type {
  Department,
  Location,
  RatioGridKey,
  RatioGridResult,
  RatioSlotResult,
  RatioStatus,
  ShiftWithRelations,
  WorkType,
} from "@/lib/types";
import { displayName } from "@/lib/types";

/** Legal maximum techs per pharmacist (Nevada pharmacy law). */
export const MAX_RATIO = 3;

// 28 half-hour slots: 7:00am to 7:30pm (7:00, 7:30, 8:00 ... 19:00, 19:30)
export const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export function getSlotStatus(rphs: number, techs: number): RatioStatus {
  if (rphs === 0 && techs === 0) return "none";
  if (rphs === 0 && techs > 0) return "red"; // no supervision
  if (techs > rphs * MAX_RATIO) return "red"; // over 3:1
  if (techs >= rphs * MAX_RATIO) return "yellow"; // at the limit
  return "green";
}

/** "07:30" or "07:30:00" → minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatSlotLabel(slot: string): string {
  const mins = timeToMinutes(slot);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "p" : "a";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

/**
 * Is this shift on duty at a given slot of the grid's date?
 * Overnight shifts (end < start, e.g. Ashley's graveyard 20:00–07:30) split:
 * the evening part belongs to the shift's own date, the morning tail belongs
 * to the NEXT day — pass fromPrevDay=true when evaluating yesterday's shift
 * against today's grid.
 */
export function isOnDuty(
  startTime: string,
  endTime: string,
  slotMinutes: number,
  fromPrevDay = false
): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const overnight = end < start;
  if (fromPrevDay) return overnight && slotMinutes < end;
  if (overnight) return slotMinutes >= start;
  return slotMinutes >= start && slotMinutes < end;
}

/**
 * Does this person count toward the ratio at this slot, doing this work type?
 * Reads everything from data: work type count flags, time-window exclusions,
 * and the per-staff always_exclude_ratio override.
 */
export function countsAtSlot(
  workType: Pick<
    WorkType,
    "counts_for_rph" | "counts_for_tech" | "exclude_before" | "exclude_after"
  >,
  staffType: string,
  alwaysExclude: boolean,
  slotMinutes: number
): boolean {
  if (alwaysExclude) return false;
  if (workType.exclude_before && slotMinutes < timeToMinutes(workType.exclude_before))
    return false;
  if (workType.exclude_after && slotMinutes >= timeToMinutes(workType.exclude_after))
    return false;
  if (staffType === "rph") return workType.counts_for_rph;
  if (staffType === "tech") return workType.counts_for_tech;
  return false; // supervisors and admins never count
}

/**
 * Which department codes belong to each ratio grid — derived from data,
 * so adding a department is a config change, not a code change.
 *   smrx → SMRX departments that are not ratio-isolated (HI + HOSPICE)
 *   spc  → ratio-isolated departments (SPC)
 *   smms → SMMS departments (SPECIALTY + TC)
 */
export function resolveGridDepartments(
  grid: RatioGridKey,
  departments: Department[],
  locations: Location[]
): Set<string> {
  const locById = new Map(locations.map((l) => [l.id, l.code]));
  const codes = new Set<string>();
  for (const d of departments) {
    const loc = locById.get(d.location_id);
    if (grid === "spc" && d.ratio_isolated) codes.add(d.code);
    else if (grid === "smrx" && loc === "SMRX" && !d.ratio_isolated) codes.add(d.code);
    else if (grid === "smms" && loc === "SMMS") codes.add(d.code);
  }
  return codes;
}

/** A live status override, with the update time pre-converted to minutes-since-midnight in pharmacy-local time. */
export interface LiveOverride {
  staff_id: string;
  work_type_id: string;
  fromMinutes: number;
}

export interface ComputeGridOptions {
  grid: RatioGridKey;
  date: string; // YYYY-MM-DD being viewed
  shifts: ShiftWithRelations[]; // this date's shifts, non-cancelled
  /** Yesterday's shifts — only their overnight morning tails are counted. */
  prevDayShifts?: ShiftWithRelations[];
  departments: Department[];
  locations: Location[];
  workTypesById: Map<string, WorkType>;
  /**
   * Live status overrides — only applied when viewing today. An override
   * replaces the scheduled work type from the slot containing fromMinutes
   * onward (past slots keep the schedule; current status is "now").
   */
  liveOverrides?: LiveOverride[];
  isToday?: boolean;
}

export function computeGrid(opts: ComputeGridOptions): RatioGridResult {
  const {
    grid,
    date,
    shifts,
    prevDayShifts = [],
    departments,
    locations,
    workTypesById,
    liveOverrides = [],
    isToday = false,
  } = opts;

  const gridDepts = resolveGridDepartments(grid, departments, locations);
  const inGrid = (s: ShiftWithRelations) =>
    gridDepts.has(s.department.code) && s.status !== "cancelled";
  const gridShifts: Array<{ shift: ShiftWithRelations; fromPrevDay: boolean }> = [
    ...shifts.filter(inGrid).map((shift) => ({ shift, fromPrevDay: false })),
    ...prevDayShifts.filter(inGrid).map((shift) => ({ shift, fromPrevDay: true })),
  ];

  const liveByStaff = new Map(liveOverrides.map((lo) => [lo.staff_id, lo]));

  const slots: RatioSlotResult[] = TIME_SLOTS.map((slot) => {
    const slotMins = timeToMinutes(slot);
    let rphs = 0;
    let techs = 0;
    const rphNames: string[] = [];
    const techNames: string[] = [];

    for (const { shift, fromPrevDay } of gridShifts) {
      if (!isOnDuty(shift.start_time, shift.end_time, slotMins, fromPrevDay))
        continue;

      // Effective work type: live status override (today, from its slot onward)
      let workType: WorkType | undefined = shift.work_type;
      if (isToday) {
        const live = liveByStaff.get(shift.staff_id);
        // applies to the slot containing the update and everything after
        if (live && slotMins + 30 > live.fromMinutes) {
          workType = workTypesById.get(live.work_type_id) ?? workType;
        }
      }
      if (!workType) continue;

      const counts = countsAtSlot(
        workType,
        shift.staff.staff_type,
        shift.staff.always_exclude_ratio,
        slotMins
      );
      if (!counts) continue;

      if (shift.staff.staff_type === "rph") {
        rphs++;
        rphNames.push(displayName(shift.staff));
      } else if (shift.staff.staff_type === "tech") {
        techs++;
        techNames.push(displayName(shift.staff));
      }
    }

    return { time: slot, rphs, techs, status: getSlotStatus(rphs, techs), rphNames, techNames };
  });

  // Worst status across the day + over-ratio banner from the worst slot
  const severity: Record<RatioStatus, number> = { none: 0, green: 1, yellow: 2, red: 3 };
  let worst: RatioStatus = "none";
  let maxExcess = 0;
  for (const s of slots) {
    if (severity[s.status] > severity[worst]) worst = s.status;
    if (s.status === "red") {
      const excess = s.rphs === 0 ? s.techs : s.techs - s.rphs * MAX_RATIO;
      if (excess > maxExcess) maxExcess = excess;
    }
  }

  const banner =
    worst === "red"
      ? `OVER RATIO — ${maxExcess} tech(s) must be reassigned`
      : null;

  return { grid, date, slots, worst, banner };
}
