import type { RatioGridWithRows } from "@/lib/ratio-data";
import { MAX_RATIO } from "@/lib/ratio";
import { minutesInAppTz } from "@/lib/dates";
import { timeToMinutes } from "@/lib/ratio";

const WORST_LABELS: Record<string, { label: string; cls: string }> = {
  green: { label: "In ratio all day", cls: "bg-ratio-green-bg text-ratio-green border-ratio-green/30" },
  yellow: { label: "At the limit", cls: "bg-ratio-yellow-bg text-ratio-yellow border-ratio-yellow/30" },
  red: { label: "OVER RATIO", cls: "bg-ratio-red-bg text-ratio-red border-ratio-red/30" },
  none: { label: "No shifts", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

export function RatioBanner({
  grid,
  isToday,
}: {
  grid: RatioGridWithRows;
  isToday: boolean;
}) {
  const worst = WORST_LABELS[grid.worst];

  // "Right now" counts from the slot containing the current time (today only)
  let nowSlot = null;
  if (isToday) {
    const now = minutesInAppTz();
    nowSlot =
      grid.slots.find(
        (s) => now >= timeToMinutes(s.time) && now < timeToMinutes(s.time) + 30
      ) ?? null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-4 py-3 ${worst.cls}`}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          Day status
        </p>
        <p className="text-lg font-bold leading-tight">{worst.label}</p>
      </div>
      {nowSlot && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">
            Right now
          </p>
          <p className="text-lg font-bold leading-tight">
            {nowSlot.rphs} RPh : {nowSlot.techs} Tech
          </p>
        </div>
      )}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          Legal limit
        </p>
        <p className="text-lg font-bold leading-tight">1 : {MAX_RATIO}</p>
      </div>
      {grid.banner && (
        <p className="basis-full text-sm font-bold sm:basis-auto">
          ⚠ {grid.banner}
        </p>
      )}
    </div>
  );
}
