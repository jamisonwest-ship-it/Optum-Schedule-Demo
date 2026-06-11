import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient, getCurrentStaff } from "@/lib/supabase/server";
import { fetchRatioData } from "@/lib/ratio-data";
import { minutesInAppTz, todayISO, formatDateLong } from "@/lib/dates";
import { timeToMinutes } from "@/lib/ratio";
import { MANAGER_ROLES, displayName, type RatioGridKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const GRID_LABELS: Record<RatioGridKey, string> = {
  smrx: "SMRX — Main",
  spc: "SMRX — SPC",
  smms: "SMMS",
};

const CHIP: Record<string, string> = {
  green: "bg-ratio-green-bg text-ratio-green border-ratio-green/30",
  yellow: "bg-ratio-yellow-bg text-ratio-yellow border-ratio-yellow/30",
  red: "bg-ratio-red-bg text-ratio-red border-ratio-red/30",
  none: "bg-gray-50 text-gray-400 border-gray-200",
};

const ACTION_LABELS: Record<string, string> = {
  status_change: "changed a live status",
  request_submitted: "submitted a time-off request",
  request_approved: "approved a request",
  request_denied: "denied a request",
  callout_logged: "logged a callout",
  schedule_published: "published a schedule",
  shift_created: "added a shift",
  shift_updated: "updated a shift",
  shift_deleted: "removed a shift",
  staff_updated: "updated a staff record",
};

export default async function DashboardPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/auth/login");
  if (!MANAGER_ROLES.includes(staff.app_role) && staff.app_role !== "read_only")
    redirect("/my-schedule");

  const today = todayISO();
  const admin = createServiceClient();

  const [ratio, pendingRes, activityRes, calloutsRes] = await Promise.all([
    fetchRatioData(today),
    admin
      .from("time_off_requests")
      .select("*, staff:staff_id (full_name, preferred_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    admin
      .from("activity_log")
      .select("*, staff:staff_id (full_name, preferred_name)")
      .order("created_at", { ascending: false })
      .limit(12),
    admin
      .from("callouts")
      .select("*, staff:staff_id (full_name, preferred_name)")
      .eq("callout_date", today)
      .order("logged_at", { ascending: false }),
  ]);

  const pending = pendingRes.data ?? [];
  const activity = activityRes.data ?? [];
  const callouts = calloutsRes.data ?? [];
  const now = minutesInAppTz();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">{formatDateLong(today)}</p>
      </div>

      {/* Today's callouts — urgent, top of page when present */}
      {callouts.length > 0 && (
        <div className="rounded-xl border border-ratio-red/30 bg-ratio-red-bg p-4">
          <h2 className="text-sm font-bold text-ratio-red">
            ⚠ {callouts.length} callout{callouts.length > 1 ? "s" : ""} today
          </h2>
          <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
            {callouts.map((c) => (
              <li key={c.id}>
                <strong>{displayName(c.staff)}</strong>
                {c.reason ? ` — "${c.reason}"` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ratio summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(GRID_LABELS) as RatioGridKey[]).map((key) => {
          const grid = ratio.grids[key];
          const nowSlot =
            grid.slots.find(
              (s) =>
                now >= timeToMinutes(s.time) && now < timeToMinutes(s.time) + 30
            ) ?? null;
          return (
            <Link
              key={key}
              href="/ratio"
              className={`rounded-xl border p-4 transition hover:shadow-md ${CHIP[grid.worst]}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                {GRID_LABELS[key]}
              </p>
              <p className="mt-1 text-2xl font-black">
                {nowSlot && nowSlot.status !== "none"
                  ? `${nowSlot.rphs} : ${nowSlot.techs}`
                  : "—"}
              </p>
              <p className="text-xs font-medium">
                {grid.banner ??
                  (grid.worst === "green"
                    ? "In ratio all day"
                    : grid.worst === "yellow"
                      ? "At the limit today"
                      : grid.worst === "none"
                        ? "No shifts today"
                        : "")}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pending requests */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">
              Pending requests{" "}
              {pending.length > 0 && (
                <span className="ml-1 rounded-full bg-ratio-yellow px-2 py-0.5 text-xs font-bold text-white">
                  {pending.length}
                </span>
              )}
            </h2>
            <Link
              href="/requests"
              className="text-xs font-medium text-optum-blue hover:underline"
            >
              Review all →
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Queue is clear. 🎉</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pending.slice(0, 5).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>
                    <strong>{displayName(r.staff)}</strong>{" "}
                    <span className="text-gray-500">
                      · {r.request_type.toUpperCase()} · {r.start_date}
                      {r.end_date !== r.start_date ? ` → ${r.end_date}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity log */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Nothing logged yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {activity.map((a) => (
                <li key={a.id} className="text-sm text-gray-600">
                  <span className="font-medium text-gray-800">
                    {a.staff ? displayName(a.staff) : "System"}
                  </span>{" "}
                  {ACTION_LABELS[a.action_type] ?? a.action_type}
                  <span className="ml-1.5 text-xs text-gray-400">
                    {new Date(a.created_at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
