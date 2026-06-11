"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Department,
  Location,
  Schedule,
  ShiftWithRelations,
  Staff,
  TimeOffRequest,
  WorkType,
} from "@/lib/types";
import { displayName } from "@/lib/types";
import { monthLabel } from "@/lib/dates";
import { MonthlyGrid } from "@/components/schedule/MonthlyGrid";

interface EditorState {
  staff: Staff;
  date: string;
  existing: ShiftWithRelations | null;
  // form fields
  departmentId: string;
  workTypeId: string;
  start: string;
  end: string;
  code: string;
}

export function SchedulePageClient({
  canEdit,
  staffList,
  departments,
  locations,
  workTypes,
}: {
  canEdit: boolean;
  staffList: Staff[];
  departments: Department[];
  locations: Location[];
  workTypes: WorkType[];
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [locationCode, setLocationCode] = useState("SMRX");
  const [shifts, setShifts] = useState<ShiftWithRelations[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const location = locations.find((l) => l.code === locationCode);
  const locationDepts = useMemo(
    () => departments.filter((d) => d.location_id === location?.id),
    [departments, location]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/shifts?month=${month}&year=${year}&location=${locationCode}`
    );
    if (res.ok) {
      const data = await res.json();
      setShifts(data.shifts ?? []);
      setSchedules(data.schedules ?? []);
      setTimeOff(data.timeOff ?? []);
    }
    setLoading(false);
  }, [month, year, locationCode]);

  useEffect(() => {
    load();
  }, [load]);

  const schedule = schedules.find((s) => s.location_id === location?.id);
  const isPublished = schedule?.status === "published";

  // Staff who belong at this location (home) — plus anyone with a shift here
  const staffIdsWithShifts = useMemo(
    () => new Set(shifts.map((s) => s.staff_id)),
    [shifts]
  );
  const visibleStaff = useMemo(
    () =>
      staffList.filter(
        (s) =>
          s.staff_type !== "admin" &&
          (s.home_location_id === location?.id || staffIdsWithShifts.has(s.id))
      ),
    [staffList, location, staffIdsWithShifts]
  );

  function openEditor(person: Staff, date: string, existing: ShiftWithRelations[]) {
    if (!canEdit) return;
    const current = existing[0] ?? null;
    const defaultDept =
      current?.department_id ??
      person.primary_department_id ??
      locationDepts[0]?.id ??
      "";
    const defaultWt =
      current?.work_type_id ??
      workTypes.find((w) => w.code === "WORKING")?.id ??
      "";
    setEditor({
      staff: person,
      date,
      existing: current,
      departmentId: defaultDept,
      workTypeId: defaultWt,
      start: current?.start_time?.slice(0, 5) ?? "08:00",
      end: current?.end_time?.slice(0, 5) ?? "16:30",
      code: current?.shift_code ?? "",
    });
  }

  async function saveShift() {
    if (!editor) return;
    setSaving(true);
    const body = {
      staff_id: editor.staff.id,
      department_id: editor.departmentId,
      shift_date: editor.date,
      start_time: editor.start,
      end_time: editor.end,
      work_type_id: editor.workTypeId,
      shift_code: editor.code || null,
    };
    const res = editor.existing
      ? await fetch(`/api/shifts/${editor.existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    setSaving(false);
    if (res.ok) {
      setEditor(null);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setToast(data?.error ?? "Save failed");
    }
  }

  async function deleteShift() {
    if (!editor?.existing) return;
    setSaving(true);
    await fetch(`/api/shifts/${editor.existing.id}`, { method: "DELETE" });
    setSaving(false);
    setEditor(null);
    load();
  }

  async function publish() {
    if (
      !confirm(
        `Publish the ${monthLabel(year, month)} schedule for ${location?.name}?\n\nAll draft shifts become visible to staff and everyone scheduled gets an email.`
      )
    )
      return;
    setPublishing(true);
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish", location_code: locationCode, month, year }),
    });
    setPublishing(false);
    if (res.ok) {
      const data = await res.json();
      setToast(`Published — ${data.count} staff notified by email.`);
      load();
    }
  }

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  }

  const draftCount = shifts.filter((s) => s.status === "draft").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Pre-scheduling</h1>
        <div className="flex flex-wrap items-center gap-2">
          {locations.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocationCode(l.code)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                locationCode === l.code
                  ? "bg-optum-blue text-white"
                  : "border border-gray-300 bg-white text-gray-700"
              }`}
            >
              {l.code}
              {!l.active && " (pre-launch)"}
            </button>
          ))}
          <span className="mx-1 text-gray-300">|</span>
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            ←
          </button>
          <span className="min-w-32 text-center text-sm font-semibold text-gray-800">
            {monthLabel(year, month)}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            →
          </button>
        </div>
      </div>

      {/* Publish state */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <p className="text-sm">
          {isPublished ? (
            <span className="font-semibold text-ratio-green">
              ✓ Published
              {schedule?.published_at &&
                ` ${new Date(schedule.published_at).toLocaleDateString()}`}
            </span>
          ) : (
            <span className="font-semibold text-ratio-yellow">
              Draft — staff can&apos;t see this month yet
            </span>
          )}
          {draftCount > 0 && (
            <span className="ml-2 text-gray-500">
              {draftCount} unpublished shift{draftCount > 1 ? "s" : ""}
            </span>
          )}
        </p>
        {canEdit && (!isPublished || draftCount > 0) && (
          <button
            onClick={publish}
            disabled={publishing}
            className="rounded-lg bg-optum-blue px-4 py-2 text-sm font-semibold text-white hover:bg-optum-blue-dark disabled:opacity-50"
          >
            {publishing
              ? "Publishing…"
              : isPublished
                ? "Publish new shifts"
                : "Publish month"}
          </button>
        )}
      </div>

      {toast && (
        <div
          className="cursor-pointer rounded-lg bg-ratio-green-bg px-4 py-2 text-sm text-ratio-green"
          onClick={() => setToast(null)}
        >
          {toast} <span className="text-xs opacity-60">(dismiss)</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading schedule…
        </div>
      ) : (
        <MonthlyGrid
          month={month}
          year={year}
          staffList={visibleStaff}
          shifts={shifts}
          timeOff={timeOff}
          onCellClick={openEditor}
        />
      )}
      {canEdit && (
        <p className="text-xs text-gray-400">
          Click any cell to add or edit a shift. Hover a name&apos;s ⓘ for
          scheduling constraints. ⚠ flags a projected week over 40 hours.
        </p>
      )}

      {/* Shift editor modal */}
      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setEditor(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-gray-900">
              {editor.existing ? "Edit shift" : "Add shift"} —{" "}
              {displayName(editor.staff)}
            </h2>
            <p className="text-sm text-gray-500">{editor.date}</p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Start</span>
                  <input
                    type="time"
                    value={editor.start}
                    onChange={(e) => setEditor({ ...editor, start: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">
                    End <span className="text-gray-400">(before start = overnight)</span>
                  </span>
                  <input
                    type="time"
                    value={editor.end}
                    onChange={(e) => setEditor({ ...editor, end: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Department</span>
                <select
                  value={editor.departmentId}
                  onChange={(e) =>
                    setEditor({ ...editor, departmentId: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Work type</span>
                <select
                  value={editor.workTypeId}
                  onChange={(e) =>
                    setEditor({ ...editor, workTypeId: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                >
                  {workTypes.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.counts_for_rph || w.counts_for_tech ? "" : " (no ratio count)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">
                  Shift code <span className="text-gray-400">(optional — Hs, GS, SPC, IV…)</span>
                </span>
                <input
                  value={editor.code}
                  onChange={(e) => setEditor({ ...editor, code: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={saveShift}
                disabled={saving}
                className="flex-1 rounded-lg bg-optum-blue py-2.5 text-sm font-semibold text-white hover:bg-optum-blue-dark disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {editor.existing && (
                <button
                  onClick={deleteShift}
                  disabled={saving}
                  className="rounded-lg border border-ratio-red px-4 py-2.5 text-sm font-semibold text-ratio-red hover:bg-ratio-red-bg disabled:opacity-50"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => setEditor(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600"
              >
                Cancel
              </button>
            </div>
            {isPublished && (
              <p className="mt-3 text-xs text-ratio-yellow">
                This month is published — saving will email{" "}
                {displayName(editor.staff)} about the change.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
