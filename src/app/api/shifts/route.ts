import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notifySchedulePublished, notifyShiftChanged } from "@/lib/email";
import { monthLabel } from "@/lib/dates";
import { formatTime } from "@/lib/dates";
import { displayName, type Staff } from "@/lib/types";

const SHIFT_SELECT = `*,
  staff:staff_id (id, full_name, preferred_name, staff_type, always_exclude_ratio),
  work_type:work_type_id (*),
  department:department_id (id, code, name, color, ratio_isolated)`;

// GET /api/shifts?month=6&year=2026&location=SMRX — a month of shifts (managers).
export async function GET(request: NextRequest) {
  const auth = await requireStaff([
    "admin",
    "pharmacist_scheduler",
    "tech_supervisor",
    "read_only",
  ]);
  if (auth instanceof NextResponse) return auth;

  const params = request.nextUrl.searchParams;
  const month = Number(params.get("month"));
  const year = Number(params.get("year"));
  const location = params.get("location") ?? "SMRX";
  if (!month || !year) {
    return NextResponse.json({ error: "month and year are required" }, { status: 400 });
  }

  const admin = createServiceClient();
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;

  const [shiftsRes, scheduleRes, timeOffRes] = await Promise.all([
    admin
      .from("shift_records")
      .select(SHIFT_SELECT)
      .gte("shift_date", first)
      .lte("shift_date", lastDay)
      .neq("status", "cancelled")
      .eq("location_id", (
        await admin.from("locations").select("id").eq("code", location).single()
      ).data?.id ?? ""),
    admin
      .from("schedules")
      .select("*")
      .eq("month", month)
      .eq("year", year),
    admin
      .from("time_off_requests")
      .select("*, staff:staff_id (id)")
      .eq("status", "approved")
      .lte("start_date", lastDay)
      .gte("end_date", first),
  ]);

  return NextResponse.json({
    shifts: shiftsRes.data ?? [],
    schedules: scheduleRes.data ?? [],
    timeOff: timeOffRes.data ?? [],
  });
}

// POST /api/shifts — create a shift, or publish a month.
// Create:  { staff_id, department_id, shift_date, start_time, end_time, work_type_id, shift_code? }
// Publish: { action: "publish", location_code, month, year }
export async function POST(request: NextRequest) {
  const auth = await requireStaff([
    "admin",
    "pharmacist_scheduler",
    "tech_supervisor",
  ]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const admin = createServiceClient();

  // ---- Publish a month ----
  if (body.action === "publish") {
    const { location_code, month, year } = body;
    const { data: location } = await admin
      .from("locations")
      .select("*")
      .eq("code", location_code)
      .single();
    if (!location) {
      return NextResponse.json({ error: "Unknown location" }, { status: 400 });
    }

    const { data: schedule } = await admin
      .from("schedules")
      .upsert(
        { location_id: location.id, month, year },
        { onConflict: "location_id,month,year", ignoreDuplicates: false }
      )
      .select()
      .single();

    await admin
      .from("schedules")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        published_by: auth.id,
      })
      .eq("id", schedule!.id);

    // Promote this month's drafts at this location
    const first = `${year}-${String(month).padStart(2, "0")}-01`;
    const last = new Date(year, month, 0).getDate();
    const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    const { data: promoted } = await admin
      .from("shift_records")
      .update({ status: "published", schedule_id: schedule!.id })
      .eq("location_id", location.id)
      .gte("shift_date", first)
      .lte("shift_date", lastDay)
      .in("status", ["draft", "scheduled"])
      .select("staff_id");

    await admin.from("activity_log").insert({
      staff_id: auth.id,
      action_type: "schedule_published",
      entity_type: "schedule",
      entity_id: schedule!.id,
      new_value: { location: location_code, month, year },
    });

    // Email everyone with shifts in this month at this location
    const staffIds = [...new Set((promoted ?? []).map((s) => s.staff_id))];
    if (staffIds.length > 0) {
      const { data: affected } = await admin
        .from("staff")
        .select("*")
        .in("id", staffIds)
        .eq("active", true);
      await notifySchedulePublished(
        (affected ?? []) as Staff[],
        monthLabel(year, month),
        location.name
      );
    }

    return NextResponse.json({ published: true, count: staffIds.length });
  }

  // ---- Create a shift ----
  const { staff_id, department_id, shift_date, start_time, end_time, work_type_id, shift_code, notes } = body;
  if (!staff_id || !department_id || !shift_date || !start_time || !end_time || !work_type_id) {
    return NextResponse.json(
      { error: "staff_id, department_id, shift_date, start_time, end_time and work_type_id are required" },
      { status: 400 }
    );
  }

  const { data: dept } = await admin
    .from("departments")
    .select("*")
    .eq("id", department_id)
    .single();
  if (!dept) return NextResponse.json({ error: "Unknown department" }, { status: 400 });

  // If this month is already published, new shifts go straight to published
  // and the affected person is notified (business rule 7).
  const [y, m] = String(shift_date).split("-").map(Number);
  const { data: schedule } = await admin
    .from("schedules")
    .select("*")
    .eq("location_id", dept.location_id)
    .eq("month", m)
    .eq("year", y)
    .maybeSingle();
  const isPublished = schedule?.status === "published";

  const { data: shift, error } = await admin
    .from("shift_records")
    .insert({
      staff_id,
      location_id: dept.location_id,
      department_id,
      shift_date,
      start_time,
      end_time,
      work_type_id,
      shift_code: shift_code || null,
      notes: notes || null,
      status: isPublished ? "published" : "draft",
      schedule_id: schedule?.id ?? null,
    })
    .select(SHIFT_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("activity_log").insert({
    staff_id: auth.id,
    action_type: "shift_created",
    entity_type: "shift_record",
    entity_id: shift.id,
    new_value: { staff_id, shift_date, start_time, end_time },
  });

  if (isPublished) {
    const { data: person } = await admin
      .from("staff")
      .select("*")
      .eq("id", staff_id)
      .single();
    if (person) {
      await notifyShiftChanged(
        person as Staff,
        shift_date,
        `${displayName(auth)} added a shift for you on ${shift_date}: ${formatTime(start_time)}–${formatTime(end_time)} (${dept.name}).`
      );
    }
  }

  return NextResponse.json({ shift }, { status: 201 });
}
