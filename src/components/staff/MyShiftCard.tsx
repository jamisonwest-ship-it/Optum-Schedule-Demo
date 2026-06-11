import type { ShiftWithRelations } from "@/lib/types";
import { formatDateShort, formatTime } from "@/lib/dates";

export function MyShiftCard({
  shift,
  highlight,
}: {
  shift: ShiftWithRelations;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white p-3 ${
        highlight ? "border-optum-blue ring-1 ring-optum-blue" : "border-gray-200"
      }`}
    >
      <div
        className="h-12 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: shift.department.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">
          {formatDateShort(shift.shift_date)}
          {highlight && (
            <span className="ml-2 rounded bg-optum-blue px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
              Today
            </span>
          )}
        </p>
        <p className="text-sm text-gray-600">
          {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
          <span className="mx-1.5 text-gray-300">·</span>
          {shift.department.name}
        </p>
        <p className="text-xs text-gray-400">
          {shift.work_type.name}
          {shift.shift_code ? ` (${shift.shift_code})` : ""}
        </p>
      </div>
    </div>
  );
}
