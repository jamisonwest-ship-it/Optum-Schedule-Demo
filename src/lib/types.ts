// Shared types for the OptumRx Scheduling Platform.
// These mirror the database schema in supabase/migrations/001_schema.sql.

export type AppRole =
  | "admin"
  | "pharmacist_scheduler"
  | "tech_supervisor"
  | "pharmacist"
  | "tech"
  | "read_only";

export type StaffType = "rph" | "tech" | "supervisor" | "admin";
export type EmploymentType = "ft" | "per_diem";
export type ShiftStatus = "draft" | "scheduled" | "published" | "cancelled";
export type ScheduleStatus = "draft" | "published";
export type RequestType = "pto" | "sick" | "personal" | "unpaid";
export type RequestStatus = "pending" | "approved" | "denied";
export type RatioStatus = "green" | "yellow" | "red" | "none";

/** Roles that get the full manager app (dashboard, schedule, requests). */
export const MANAGER_ROLES: AppRole[] = [
  "admin",
  "pharmacist_scheduler",
  "tech_supervisor",
];

/** Roles allowed to write schedules. */
export const SCHEDULER_ROLES: AppRole[] = ["admin", "pharmacist_scheduler"];

export interface Location {
  id: string;
  code: "SMRX" | "SMMS";
  name: string;
  opens_at: string; // "07:00:00"
  closes_at: string;
  active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  location_id: string;
  code: string;
  name: string;
  color: string;
  ratio_isolated: boolean;
  active: boolean;
}

export interface WorkType {
  id: string;
  code: string;
  name: string;
  counts_for_rph: boolean;
  counts_for_tech: boolean;
  exclude_before: string | null; // "08:30:00" — IV tech rule
  exclude_after: string | null;
  notes: string | null;
  sort_order: number;
}

export interface Staff {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  preferred_name: string | null;
  app_role: AppRole;
  staff_type: StaffType;
  employment_type: EmploymentType;
  home_location_id: string | null;
  primary_department_id: string | null;
  supervised_department_id: string | null;
  annual_hours_cap: number | null; // 960 for per-diem
  always_exclude_ratio: boolean;
  constraints_notes: string | null;
  waw_position: string | null;
  active: boolean;
}

export interface Schedule {
  id: string;
  location_id: string;
  month: number;
  year: number;
  status: ScheduleStatus;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
}

export interface ShiftRecord {
  id: string;
  staff_id: string;
  location_id: string;
  department_id: string;
  shift_date: string; // "2026-06-11"
  start_time: string; // "07:30:00"
  end_time: string;
  work_type_id: string;
  shift_code: string | null; // raw code: 'Hs', 'GS', 'SPC', 'IV', ...
  status: ShiftStatus;
  schedule_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface LiveStatus {
  id: string;
  staff_id: string;
  status_date: string;
  work_type_id: string;
  updated_at: string;
  updated_by: string | null;
}

export interface TimeOffRequest {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  request_type: RequestType;
  notes: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
}

export interface Callout {
  id: string;
  staff_id: string;
  shift_id: string | null;
  callout_date: string;
  reason: string | null;
  logged_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  email_sent: boolean;
  email_sent_at: string | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  staff_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

// ---- Joined shapes used by pages/components ----

export interface ShiftWithRelations extends ShiftRecord {
  staff: Pick<
    Staff,
    "id" | "full_name" | "preferred_name" | "staff_type" | "always_exclude_ratio"
  >;
  work_type: WorkType;
  department: Pick<Department, "id" | "code" | "name" | "color" | "ratio_isolated">;
}

export interface RequestWithStaff extends TimeOffRequest {
  staff: Pick<Staff, "id" | "full_name" | "preferred_name" | "email" | "staff_type">;
}

// ---- Ratio engine output ----

export interface RatioSlotResult {
  time: string; // "07:00"
  rphs: number;
  techs: number;
  status: RatioStatus;
  rphNames: string[];
  techNames: string[];
}

export interface RatioGridResult {
  grid: RatioGridKey;
  date: string;
  slots: RatioSlotResult[];
  worst: RatioStatus;
  /** Over-ratio message when red, e.g. "OVER RATIO — 2 tech(s) must be reassigned" */
  banner: string | null;
}

export type RatioGridKey = "smrx" | "spc" | "smms";

export function displayName(s: {
  full_name: string;
  preferred_name?: string | null;
}): string {
  return s.preferred_name || s.full_name;
}
