import type { RatioSlotResult } from "@/lib/types";
import { formatSlotLabel } from "@/lib/ratio";

const STATUS_CLASSES: Record<string, string> = {
  green: "bg-ratio-green text-white",
  yellow: "bg-ratio-yellow text-white",
  red: "bg-ratio-red text-white",
  none: "bg-gray-100 text-gray-400",
};

export function RatioSlot({ slot }: { slot: RatioSlotResult }) {
  const tooltip =
    slot.status === "none"
      ? `${formatSlotLabel(slot.time)} — no one on shift`
      : `${formatSlotLabel(slot.time)} — ${slot.rphs} RPh : ${slot.techs} Tech\nRPh: ${slot.rphNames.join(", ") || "—"}\nTech: ${slot.techNames.join(", ") || "—"}`;

  return (
    <div
      title={tooltip}
      className={`flex h-12 w-full min-w-9 flex-col items-center justify-center rounded ${STATUS_CLASSES[slot.status]}`}
    >
      <span className="text-[11px] font-bold leading-tight">
        {slot.status === "none" ? "—" : `${slot.rphs}:${slot.techs}`}
      </span>
    </div>
  );
}
