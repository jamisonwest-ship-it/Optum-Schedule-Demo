"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RatioData, RatioGridWithRows } from "@/lib/ratio-data";
import type { RatioGridKey } from "@/lib/types";
import { RatioBanner } from "@/components/ratio/RatioBanner";
import { RatioGrid } from "@/components/ratio/RatioGrid";
import { addDays, formatDateLong, todayISO } from "@/lib/dates";

const GRID_TABS: { key: RatioGridKey; label: string }[] = [
  { key: "smrx", label: "SMRX — Main" },
  { key: "spc", label: "SMRX — SPC (isolated)" },
  { key: "smms", label: "SMMS" },
];

const DOT: Record<string, string> = {
  green: "bg-ratio-green",
  yellow: "bg-ratio-yellow",
  red: "bg-ratio-red",
  none: "bg-gray-300",
};

export function RatioPageClient({
  canEditStatuses,
}: {
  canEditStatuses: boolean;
}) {
  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState<RatioGridKey>("smrx");
  const [data, setData] = useState<RatioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    const res = await fetch(`/api/ratio?date=${d}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    load(date);
    // Live refresh — co-workers' status changes show up within 30s
    const interval = setInterval(() => load(date), 30_000);
    return () => clearInterval(interval);
  }, [date, load]);

  async function changeStatus(staffId: string, workTypeId: string) {
    setSavingStaffId(staffId);
    await fetch("/api/statuses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staffId, work_type_id: workTypeId }),
    });
    await load(date);
    setSavingStaffId(null);
  }

  const grid: RatioGridWithRows | null = data ? data.grids[tab] : null;

  // Unique people on duty in this grid (for the live status panel)
  const onDuty = useMemo(() => {
    if (!grid) return [];
    const seen = new Map<string, (typeof grid.staffRows)[number]>();
    for (const row of grid.staffRows) {
      if (!seen.has(row.staffId)) seen.set(row.staffId, row);
    }
    return [...seen.values()];
  }, [grid]);

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Ratio</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ←
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setDate(addDays(date, 1))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            →
          </button>
          {date !== todayISO() && (
            <button
              onClick={() => setDate(todayISO())}
              className="rounded-lg bg-optum-blue px-3 py-1.5 text-sm font-medium text-white"
            >
              Today
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-500">{formatDateLong(date)}</p>

      {/* Grid tabs */}
      <div className="flex flex-wrap gap-2">
        {GRID_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium ${
              tab === t.key
                ? "bg-optum-blue text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${DOT[data?.grids[t.key]?.worst ?? "none"]}`}
            />
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading ratio data…
        </div>
      ) : grid ? (
        <>
          <RatioBanner grid={grid} isToday={data!.isToday} />
          <RatioGrid grid={grid} />

          {/* Live status panel — the "change Lucy to Lunch and watch it go yellow" demo */}
          {data!.isToday && canEditStatuses && onDuty.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-bold text-gray-900">
                Live status — today
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Status changes recalculate the ratio immediately and are written
                to the activity log.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {onDuty.map((row) => (
                  <div
                    key={row.staffId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {row.name}
                      </p>
                      <p className="text-[11px] uppercase text-gray-400">
                        {row.staffType === "rph" ? "Pharmacist" : "Technician"} ·{" "}
                        {row.deptCode}
                      </p>
                    </div>
                    <select
                      value={
                        data!.statusOptions.find(
                          (o) => o.code === (row.liveStatusCode ?? "WORKING")
                        )?.id ?? ""
                      }
                      disabled={savingStaffId === row.staffId}
                      onChange={(e) => changeStatus(row.staffId, e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {data!.statusOptions
                        .filter(
                          (o) => row.staffType === "tech" || o.code !== "NON_TECH"
                        )
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
