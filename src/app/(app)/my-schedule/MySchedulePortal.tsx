"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  LiveStatus,
  RatioGridKey,
  RatioSlotResult,
  RatioStatus,
  ShiftWithRelations,
  Staff,
  TimeOffRequest,
  WorkType,
} from "@/lib/types";
import { displayName } from "@/lib/types";
import { timeToMinutes } from "@/lib/ratio";
import { minutesInAppTz } from "@/lib/dates";
import { MyShiftCard } from "@/components/staff/MyShiftCard";
import { StatusButton } from "@/components/staff/StatusButton";
import { RequestForm } from "@/components/staff/RequestForm";

const GRID_LABELS: Record<RatioGridKey, string> = {
  smrx: "SMRX",
  spc: "SPC room",
  smms: "SMMS",
};

const RATIO_CHIP: Record<string, string> = {
  green: "bg-ratio-green-bg text-ratio-green",
  yellow: "bg-ratio-yellow-bg text-ratio-yellow",
  red: "bg-ratio-red-bg text-ratio-red",
  none: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

export function MySchedulePortal({
  staff,
  today,
  shifts,
  liveStatus,
  requests,
  statusOptions,
  ratioGlance,
}: {
  staff: Staff;
  today: string;
  shifts: ShiftWithRelations[];
  liveStatus: LiveStatus | null;
  requests: TimeOffRequest[];
  statusOptions: Pick<WorkType, "id" | "code" | "name">[];
  ratioGlance: {
    grid: RatioGridKey;
    worst: RatioStatus;
    banner: string | null;
    slots: RatioSlotResult[];
  };
}) {
  const router = useRouter();
  const [savingStatus, setSavingStatus] = useState(false);

  const todayShifts = shifts.filter((s) => s.shift_date === today);
  const overnightTail = shifts.find((s) => s.shift_date < today);
  const upcoming = shifts.filter((s) => s.shift_date > today);

  const currentStatusCode = liveStatus
    ? (statusOptions.find((o) => o.id === liveStatus.work_type_id)?.code ?? null)
    : "WORKING";

  // Ratio right now — for the pharmacist glance
  const now = minutesInAppTz();
  const nowSlot =
    ratioGlance.slots.find(
      (s) => now >= timeToMinutes(s.time) && now < timeToMinutes(s.time) + 30
    ) ?? null;

  async function setStatus(workTypeId: string) {
    setSavingStatus(true);
    await fetch("/api/statuses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_id: staff.id, work_type_id: workTypeId }),
    });
    setSavingStatus(false);
    router.refresh();
  }

  const myOptions = statusOptions.filter(
    (o) => staff.staff_type === "tech" || o.code !== "NON_TECH"
  );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Hi, {displayName(staff).split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500">
          {new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Ratio glance — especially for pharmacists */}
      <div
        className={`flex items-center justify-between rounded-xl px-4 py-3 ${RATIO_CHIP[ratioGlance.worst]}`}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">
            {GRID_LABELS[ratioGlance.grid]} ratio
          </p>
          <p className="text-base font-bold">
            {ratioGlance.banner
              ? ratioGlance.banner
              : ratioGlance.worst === "green"
                ? "In ratio"
                : ratioGlance.worst === "yellow"
                  ? "At the limit"
                  : ratioGlance.worst === "none"
                    ? "No shifts today"
                    : "Check coverage"}
          </p>
        </div>
        {nowSlot && nowSlot.status !== "none" && (
          <p className="text-2xl font-black">
            {nowSlot.rphs}:{nowSlot.techs}
          </p>
        )}
      </div>

      {/* Today */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
          Today
        </h2>
        {overnightTail && (
          <div className="mb-2">
            <MyShiftCard shift={overnightTail} />
            <p className="mt-1 text-xs text-gray-400">
              Overnight shift from yesterday — runs into this morning.
            </p>
          </div>
        )}
        {todayShifts.length > 0 ? (
          <div className="space-y-2">
            {todayShifts.map((s) => (
              <MyShiftCard key={s.id} shift={s} highlight />
            ))}
          </div>
        ) : !overnightTail ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-500">
            No shift scheduled today.
          </p>
        ) : null}

        {/* One-tap status — only meaningful when on the schedule today */}
        {(todayShifts.length > 0 || overnightTail) && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-gray-600">
              My status right now
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {myOptions.map((o) => (
                <StatusButton
                  key={o.id}
                  code={o.code}
                  name={o.name.split(" ")[0]}
                  active={currentStatusCode === o.code}
                  disabled={savingStatus}
                  onClick={() => setStatus(o.id)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* This week */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
          This week
        </h2>
        {upcoming.length > 0 ? (
          <div className="space-y-2">
            {upcoming.map((s) => (
              <MyShiftCard key={s.id} shift={s} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-500">
            No more published shifts this week.
          </p>
        )}
      </section>

      {/* Requests */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
          Time off & callouts
        </h2>
        <RequestForm today={today} />
        {requests.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-gray-700">
                  {r.request_type.toUpperCase()} · {r.start_date}
                  {r.end_date !== r.start_date ? ` → ${r.end_date}` : ""}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    r.status === "approved"
                      ? "bg-ratio-green-bg text-ratio-green"
                      : r.status === "denied"
                        ? "bg-ratio-red-bg text-ratio-red"
                        : "bg-ratio-yellow-bg text-ratio-yellow"
                  }`}
                >
                  {STATUS_LABELS[r.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
