"use client";

import type { ShiftWithRelations } from "@/lib/types";
import { formatTime } from "@/lib/dates";

export function ShiftCell({
  shifts,
  hasPto,
  isWeekend,
  onClick,
}: {
  shifts: ShiftWithRelations[];
  hasPto: boolean;
  isWeekend: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`block h-full min-h-11 w-full min-w-16 rounded border p-0.5 text-left align-top transition hover:ring-2 hover:ring-optum-blue ${
        isWeekend ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
      }`}
    >
      {hasPto && (
        <span className="mb-0.5 block rounded-sm bg-purple-100 px-1 text-[9px] font-bold uppercase text-purple-700">
          PTO
        </span>
      )}
      {shifts.map((s) => (
        <span
          key={s.id}
          title={`${formatTime(s.start_time)}–${formatTime(s.end_time)} · ${s.department.name} · ${s.work_type.name}${s.status === "draft" ? " (draft)" : ""}`}
          className={`mb-0.5 block truncate rounded-sm px-1 text-[10px] font-semibold leading-4 text-white ${
            s.status === "draft" ? "opacity-60" : ""
          }`}
          style={{ backgroundColor: s.department.color }}
        >
          {s.shift_code || `${formatTime(s.start_time)}–${formatTime(s.end_time)}`}
        </span>
      ))}
    </button>
  );
}
