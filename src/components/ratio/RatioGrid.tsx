import type { RatioGridWithRows, RatioStaffRow } from "@/lib/ratio-data";
import { formatSlotLabel, TIME_SLOTS } from "@/lib/ratio";
import { RatioSlot } from "./RatioSlot";

const CELL: Record<string, string> = {
  count: "bg-ratio-green",
  present: "bg-gray-300",
  off: "bg-gray-50",
};

function StaffRowCells({ row }: { row: RatioStaffRow }) {
  return (
    <>
      {row.slots.map((state, i) => (
        <td key={i} className="p-px">
          <div
            className={`h-5 w-full min-w-9 rounded-sm ${CELL[state]}`}
            title={
              state === "off"
                ? undefined
                : `${row.name} — ${formatSlotLabel(TIME_SLOTS[i])} ${state === "count" ? "(counts)" : "(present, not counting)"}`
            }
          />
        </td>
      ))}
    </>
  );
}

export function RatioGrid({ grid }: { grid: RatioGridWithRows }) {
  const rphRows = grid.staffRows.filter((r) => r.staffType === "rph");
  const techRows = grid.staffRows.filter((r) => r.staffType === "tech");

  if (grid.staffRows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        No shifts scheduled on this grid for this date.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-3">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-44 bg-white px-2 text-left text-xs font-semibold text-gray-500">
              {grid.slots.filter((s) => s.status !== "none").length > 0
                ? "RPh : Tech per ½ hour"
                : ""}
            </th>
            {TIME_SLOTS.map((slot) => (
              <th
                key={slot}
                className="px-px pb-1 text-center text-[10px] font-medium text-gray-500"
              >
                {formatSlotLabel(slot)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Summary strip — the color-coded ratio per slot */}
          <tr>
            <td className="sticky left-0 z-10 bg-white px-2 text-xs font-bold text-gray-700">
              Ratio
            </td>
            {grid.slots.map((slot) => (
              <td key={slot.time} className="p-px">
                <RatioSlot slot={slot} />
              </td>
            ))}
          </tr>

          {/* Spacer */}
          <tr>
            <td colSpan={TIME_SLOTS.length + 1} className="h-3" />
          </tr>

          {/* Pharmacists */}
          {rphRows.length > 0 && (
            <tr>
              <td
                colSpan={TIME_SLOTS.length + 1}
                className="sticky left-0 px-2 pb-1 text-xs font-bold uppercase tracking-wide text-optum-blue"
              >
                Pharmacists ({rphRows.length})
              </td>
            </tr>
          )}
          {rphRows.map((row, idx) => (
            <tr key={`${row.staffId}-${idx}`}>
              <td className="sticky left-0 z-10 max-w-52 truncate bg-white px-2 text-xs text-gray-800">
                <span className="font-medium">{row.name}</span>
                <span className="ml-1 text-[10px] text-gray-400">
                  {row.shiftLabel}
                </span>
                {row.liveStatusCode && row.liveStatusCode !== "WORKING" && (
                  <span className="ml-1 rounded bg-ratio-yellow-bg px-1 text-[10px] font-semibold text-ratio-yellow">
                    {row.liveStatusCode}
                  </span>
                )}
              </td>
              <StaffRowCells row={row} />
            </tr>
          ))}

          {/* Technicians */}
          {techRows.length > 0 && (
            <tr>
              <td
                colSpan={TIME_SLOTS.length + 1}
                className="sticky left-0 px-2 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-optum-blue"
              >
                Technicians ({techRows.length})
              </td>
            </tr>
          )}
          {techRows.map((row, idx) => (
            <tr key={`${row.staffId}-${idx}`}>
              <td className="sticky left-0 z-10 max-w-52 truncate bg-white px-2 text-xs text-gray-800">
                <span className="font-medium">{row.name}</span>
                <span className="ml-1 text-[10px] text-gray-400">
                  {row.shiftLabel}
                </span>
                {row.liveStatusCode && row.liveStatusCode !== "WORKING" && (
                  <span className="ml-1 rounded bg-ratio-yellow-bg px-1 text-[10px] font-semibold text-ratio-yellow">
                    {row.liveStatusCode}
                  </span>
                )}
              </td>
              <StaffRowCells row={row} />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap gap-4 px-2 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-ratio-green" /> Counts toward ratio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-gray-300" /> Present, not counting
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-gray-50 ring-1 ring-gray-200" /> Off shift
        </span>
      </div>
    </div>
  );
}
