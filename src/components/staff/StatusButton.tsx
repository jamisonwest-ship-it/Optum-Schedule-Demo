"use client";

const STATUS_STYLES: Record<string, { icon: string; active: string }> = {
  WORKING: { icon: "💼", active: "bg-ratio-green text-white border-ratio-green" },
  LUNCH: { icon: "🥪", active: "bg-ratio-yellow text-white border-ratio-yellow" },
  MEETING: { icon: "📅", active: "bg-optum-blue text-white border-optum-blue" },
  OUT: { icon: "🚪", active: "bg-ratio-red text-white border-ratio-red" },
  NON_TECH: { icon: "🧹", active: "bg-gray-600 text-white border-gray-600" },
};

export function StatusButton({
  code,
  name,
  active,
  disabled,
  onClick,
}: {
  code: string;
  name: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const style = STATUS_STYLES[code] ?? { icon: "•", active: "bg-gray-700 text-white border-gray-700" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition disabled:opacity-50 ${
        active
          ? style.active
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className="text-lg" aria-hidden>
        {style.icon}
      </span>
      {name}
    </button>
  );
}
