"use client";

import { Fragment, useMemo } from "react";
import type { ShiftWithRelations, Staff, TimeOffRequest } from "@/lib/types";
import { displayName } from "@/lib/types";
import { timeToMinutes } from "@/lib/ratio";
import { ShiftCell } from "./ShiftCell";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function shiftHours(s: ShiftWithRelations): number {
  const start = timeToMinutes(s.start_time);
  const end = timeToMinutes(s.end_time);
  const mins = end > start ? end - start : 24 * 60 - start + end; // overnight
  return mins / 60;
}

/** ISO date for the Monday of the week containing this date. */
function weekKey(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

export function MonthlyGrid({
  month,
  year,
  staffList,
  shifts,
  timeOff,
  onCellClick,
}: {
  month: number;
  year: number;
  staffList: Staff[];
  shifts: ShiftWithRelations[];
  timeOff: TimeOffRequest[];
  onCellClick: (staff: Staff, date: string, existing: ShiftWithRelations[]) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dow = new Date(`${iso}T12:00:00`).getDay();
    return { day, iso, dow, isWeekend: dow === 0 || dow === 6 };
  });

  const shiftsByStaffDay = useMemo(() => {
    const map = new Map<string, ShiftWithRelations[]>();
    for (const s of shifts) {
      const key = `${s.staff_id}|${s.shift_date}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [shifts]);

  const ptoByStaff = useMemo(() => {
    const map = new Map<string, { start: string; end: string }[]>();
    for (const t of timeOff) {
      if (!map.has(t.staff_id)) map.set(t.staff_id, []);
      map.get(t.staff_id)!.push({ start: t.start_date, end: t.end_date });
    }
    return map;
  }, [timeOff]);

  // Weekly hour totals per staff — overtime flag at >40h in any week
  const overtime = useMemo(() => {
    const totals = new Map<string, Map<string, number>>();
    for (const s of shifts) {
      if (s.status === "cancelled") continue;
      const wk = weekKey(s.shift_date);
      if (!totals.has(s.staff_id)) totals.set(s.staff_id, new Map());
      const weeks = totals.get(s.staff_id)!;
      weeks.set(wk, (weeks.get(wk) ?? 0) + shiftHours(s));
    }
    const flagged = new Map<string, number>();
    for (const [staffId, weeks] of totals) {
      const worst = Math.max(...weeks.values());
      if (worst > 40) flagged.set(staffId, Math.round(worst * 10) / 10);
    }
    return flagged;
  }, [shifts]);

  const groups: { label: string; rows: Staff[] }[] = [
    { label: "Pharmacists", rows: staffList.filter((s) => s.staff_type === "rph") },
    { label: "Technicians", rows: staffList.filter((s) => s.staff_type === "tech") },
    {
      label: "Supervisors",
      rows: staffList.filter((s) => s.staff_type === "supervisor"),
    },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full border-separate border-spacing-0.5 p-2">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-44 bg-white px-2 text-left text-xs font-semibold text-gray-500">
              Staff
            </th>
            {days.map((d) => (
              <th
                key={d.iso}
                className={`min-w-16 pb-1 text-center text-[10px] font-medium ${
                  d.isWeekend ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {WEEKDAY_LETTERS[d.dow]}
                <br />
                <span className="text-xs font-bold">{d.day}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups
            .filter((g) => g.rows.length > 0)
            .map((group) => (
              <Fragment key={group.label}>
                <tr>
                  <td
                    colSpan={daysInMonth + 1}
                    className="sticky left-0 px-2 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-optum-blue"
                  >
                    {group.label} ({group.rows.length})
                  </td>
                </tr>
                {group.rows.map((person) => {
                  const ot = overtime.get(person.id);
                  return (
                    <tr key={person.id}>
                      <td className="sticky left-0 z-10 max-w-48 bg-white px-2 text-xs">
                        <span className="font-medium text-gray-800">
                          {displayName(person)}
                        </span>
                        {person.employment_type === "per_diem" && (
                          <span
                            className="ml-1 rounded bg-gray-100 px-1 text-[9px] font-bold uppercase text-gray-500"
                            title="Per-diem — 960 hr/year cap"
                          >
                            PD
                          </span>
                        )}
                        {ot && (
                          <span
                            className="ml-1 rounded bg-ratio-red-bg px-1 text-[9px] font-bold text-ratio-red"
                            title={`Projected ${ot} hrs in one week — over the 40-hr Nevada overtime threshold`}
                          >
                            ⚠ {ot}h
                          </span>
                        )}
                        {person.constraints_notes && (
                          <span
                            className="ml-1 cursor-help text-gray-400"
                            title={person.constraints_notes}
                          >
                            ⓘ
                          </span>
                        )}
                      </td>
                      {days.map((d) => {
                        const cellShifts =
                          shiftsByStaffDay.get(`${person.id}|${d.iso}`) ?? [];
                        const hasPto = (ptoByStaff.get(person.id) ?? []).some(
                          (p) => d.iso >= p.start && d.iso <= p.end
                        );
                        return (
                          <td key={d.iso} className="align-top">
                            <ShiftCell
                              shifts={cellShifts}
                              hasPto={hasPto}
                              isWeekend={d.isWeekend}
                              onClick={() => onCellClick(person, d.iso, cellShifts)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
        </tbody>
      </table>
    </div>
  );
}
