"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AppRole,
  Department,
  EmploymentType,
  Location,
  Staff,
  StaffType,
  WorkType,
} from "@/lib/types";

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "pharmacist_scheduler", label: "Scheduler (RPh)" },
  { value: "tech_supervisor", label: "Tech supervisor" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "tech", label: "Technician" },
  { value: "read_only", label: "Read-only" },
];

const STAFF_TYPES: { value: StaffType; label: string }[] = [
  { value: "rph", label: "RPh" },
  { value: "tech", label: "Tech" },
  { value: "supervisor", label: "Supervisor" },
  { value: "admin", label: "Admin" },
];

type Tab = "staff" | "work_types" | "org";

export function SetupPageClient({
  currentStaffId,
  initialStaff,
  initialWorkTypes,
  departments,
  locations,
}: {
  currentStaffId: string;
  initialStaff: Staff[];
  initialWorkTypes: WorkType[];
  departments: Department[];
  locations: Location[];
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("staff");
  const [staff, setStaff] = useState(initialStaff);
  const [workTypes, setWorkTypes] = useState(initialWorkTypes);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newStaff, setNewStaff] = useState({
    full_name: "",
    email: "",
    app_role: "tech" as AppRole,
    staff_type: "tech" as StaffType,
    employment_type: "ft" as EmploymentType,
    primary_department_id: "",
  });

  async function updateStaff(id: string, patch: Partial<Staff>) {
    setError(null);
    const { error } = await supabase.from("staff").update(patch).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await supabase.from("activity_log").insert({
      staff_id: currentStaffId,
      action_type: "staff_updated",
      entity_type: "staff",
      entity_id: id,
      new_value: patch as Record<string, unknown>,
    });
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dept = departments.find((d) => d.id === newStaff.primary_department_id);
    const { data, error } = await supabase
      .from("staff")
      .insert({
        ...newStaff,
        email: newStaff.email.trim().toLowerCase(),
        primary_department_id: newStaff.primary_department_id || null,
        home_location_id: dept?.location_id ?? locations[0]?.id ?? null,
        annual_hours_cap: newStaff.employment_type === "per_diem" ? 960 : null,
      })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setStaff((prev) =>
      [...prev, data as Staff].sort((a, b) => a.full_name.localeCompare(b.full_name))
    );
    setAdding(false);
    setNewStaff({
      full_name: "",
      email: "",
      app_role: "tech",
      staff_type: "tech",
      employment_type: "ft",
      primary_department_id: "",
    });
  }

  async function toggleWorkType(
    id: string,
    field: "counts_for_rph" | "counts_for_tech",
    value: boolean
  ) {
    setError(null);
    const { error } = await supabase
      .from("work_types")
      .update({ [field]: value })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setWorkTypes((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    );
  }

  const visibleStaff = staff.filter((s) => showInactive || s.active);
  const deptName = (id: string | null) =>
    departments.find((d) => d.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Setup</h1>

      <div className="flex gap-2">
        {(
          [
            ["staff", "Staff roster"],
            ["work_types", "Work types & ratio rules"],
            ["org", "Locations & departments"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium ${
              tab === key
                ? "bg-optum-blue text-white"
                : "border border-gray-300 bg-white text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-ratio-red-bg px-3 py-2 text-sm text-ratio-red">
          {error}
        </p>
      )}

      {tab === "staff" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
            <button
              onClick={() => setAdding(!adding)}
              className="rounded-lg bg-optum-blue px-3 py-2 text-sm font-semibold text-white"
            >
              + Add staff
            </button>
          </div>

          {adding && (
            <form
              onSubmit={addStaff}
              className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <input
                required
                placeholder="Full name"
                value={newStaff.full_name}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, full_name: e.target.value })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                required
                type="email"
                placeholder="Email (used for login)"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={newStaff.app_role}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, app_role: e.target.value as AppRole })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                value={newStaff.staff_type}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, staff_type: e.target.value as StaffType })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {STAFF_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={newStaff.employment_type}
                onChange={(e) =>
                  setNewStaff({
                    ...newStaff,
                    employment_type: e.target.value as EmploymentType,
                  })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="ft">Full-time</option>
                <option value="per_diem">Per-diem (960 hr cap)</option>
              </select>
              <select
                value={newStaff.primary_department_id}
                onChange={(e) =>
                  setNewStaff({ ...newStaff, primary_department_id: e.target.value })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg bg-ratio-green px-3 py-2 text-sm font-semibold text-white sm:col-span-2 lg:col-span-3"
              >
                Add to roster
              </button>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">App role</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Employment</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2" title="Never counts toward ratio">
                    Excl. ratio
                  </th>
                  <th className="px-3 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {visibleStaff.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-100 ${s.active ? "" : "opacity-50"}`}
                  >
                    <td className="px-3 py-1.5 font-medium text-gray-800">
                      {s.full_name}
                      {s.preferred_name && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({s.preferred_name})
                        </span>
                      )}
                      {s.email.endsWith("@example.com") && (
                        <span
                          className="ml-1 cursor-help rounded bg-ratio-yellow-bg px-1 text-[10px] font-bold text-ratio-yellow"
                          title="Placeholder email — this person can't log in until you set their real address"
                        >
                          placeholder
                        </span>
                      )}
                    </td>
                    <td className="max-w-48 truncate px-3 py-1.5 text-gray-500">
                      {s.email}
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={s.app_role}
                        onChange={(e) =>
                          updateStaff(s.id, { app_role: e.target.value as AppRole })
                        }
                        className="rounded border border-gray-200 px-1 py-0.5 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-xs uppercase text-gray-500">
                      {s.staff_type}
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={s.employment_type}
                        onChange={(e) =>
                          updateStaff(s.id, {
                            employment_type: e.target.value as EmploymentType,
                            annual_hours_cap:
                              e.target.value === "per_diem" ? 960 : null,
                          })
                        }
                        className="rounded border border-gray-200 px-1 py-0.5 text-xs"
                      >
                        <option value="ft">FT</option>
                        <option value="per_diem">Per-diem</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={s.primary_department_id ?? ""}
                        onChange={(e) =>
                          updateStaff(s.id, {
                            primary_department_id: e.target.value || null,
                          })
                        }
                        className="max-w-36 rounded border border-gray-200 px-1 py-0.5 text-xs"
                      >
                        <option value="">—</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={s.always_exclude_ratio}
                        onChange={(e) =>
                          updateStaff(s.id, { always_exclude_ratio: e.target.checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={s.active}
                        onChange={(e) => updateStaff(s.id, { active: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            Staff are never deleted — deactivate instead (turnover-safe, keeps
            history). Department changes here set the default; shifts carry
            their own department.
          </p>
        </div>
      )}

      {tab === "work_types" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-center">Counts — RPh</th>
                <th className="px-3 py-2 text-center">Counts — Tech</th>
                <th className="px-3 py-2">Time window</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {workTypes.map((w) => (
                <tr key={w.id} className="border-b border-gray-100">
                  <td className="px-3 py-1.5 font-mono text-xs text-gray-600">
                    {w.code}
                  </td>
                  <td className="px-3 py-1.5 font-medium text-gray-800">{w.name}</td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={w.counts_for_rph}
                      onChange={(e) =>
                        toggleWorkType(w.id, "counts_for_rph", e.target.checked)
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={w.counts_for_tech}
                      onChange={(e) =>
                        toggleWorkType(w.id, "counts_for_tech", e.target.checked)
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-500">
                    {w.exclude_before
                      ? `No count before ${w.exclude_before.slice(0, 5)}`
                      : w.exclude_after
                        ? `No count after ${w.exclude_after.slice(0, 5)}`
                        : "—"}
                  </td>
                  <td className="max-w-64 truncate px-3 py-1.5 text-xs text-gray-400">
                    {w.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-gray-400">
            These flags drive the entire ratio calculation — changes apply
            immediately, no code involved.
          </p>
        </div>
      )}

      {tab === "org" && (
        <div className="grid gap-4 md:grid-cols-2">
          {locations.map((l) => (
            <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="font-bold text-gray-900">
                {l.code}{" "}
                <span className="text-sm font-normal text-gray-500">{l.name}</span>
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Hours {l.opens_at.slice(0, 5)}–{l.closes_at.slice(0, 5)} ·{" "}
                {l.active ? (
                  <span className="font-semibold text-ratio-green">Active</span>
                ) : (
                  <span className="font-semibold text-ratio-yellow">
                    Opens July 1, 2026
                  </span>
                )}
              </p>
              <ul className="mt-3 space-y-1.5">
                {departments
                  .filter((d) => d.location_id === l.id)
                  .map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name}
                      {d.ratio_isolated && (
                        <span className="rounded bg-gray-100 px-1 text-[10px] font-bold uppercase text-gray-500">
                          isolated ratio
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
