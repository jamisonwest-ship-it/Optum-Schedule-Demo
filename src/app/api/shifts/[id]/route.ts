import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyShiftChanged } from "@/lib/email";
import { formatTime } from "@/lib/dates";
import { displayName, type Staff } from "@/lib/types";

const EDITABLE = [
  "department_id",
  "shift_date",
  "start_time",
  "end_time",
  "work_type_id",
  "shift_code",
  "notes",
  "status",
] as const;

// PATCH /api/shifts/[id] — update a shift (managers).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaff([
    "admin",
    "pharmacist_scheduler",
    "tech_supervisor",
  ]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const admin = createServiceClient();
  const { data: existing } = await admin
    .from("shift_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields in body" }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("shift_records")
    .update(updates)
    .eq("id", id)
    .select(
      `*,
       staff:staff_id (id, full_name, preferred_name, staff_type, always_exclude_ratio),
       work_type:work_type_id (*),
       department:department_id (id, code, name, color, ratio_isolated)`
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("activity_log").insert({
    staff_id: auth.id,
    action_type: "shift_updated",
    entity_type: "shift_record",
    entity_id: id,
    old_value: {
      shift_date: existing.shift_date,
      start_time: existing.start_time,
      end_time: existing.end_time,
      work_type_id: existing.work_type_id,
    },
    new_value: updates,
  });

  // Post-publish edits notify the affected person (business rule 7).
  if (existing.status === "published") {
    const { data: person } = await admin
      .from("staff")
      .select("*")
      .eq("id", existing.staff_id)
      .single();
    if (person) {
      await notifyShiftChanged(
        person as Staff,
        updated.shift_date,
        `${displayName(auth)} updated your shift on ${updated.shift_date}: now ${formatTime(updated.start_time)}–${formatTime(updated.end_time)} (${updated.department.name}, ${updated.work_type.name}).`
      );
    }
  }

  return NextResponse.json({ shift: updated });
}

// DELETE /api/shifts/[id] — cancel a shift (soft delete; managers).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaff([
    "admin",
    "pharmacist_scheduler",
    "tech_supervisor",
  ]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const admin = createServiceClient();
  const { data: existing } = await admin
    .from("shift_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  const { error } = await admin
    .from("shift_records")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("activity_log").insert({
    staff_id: auth.id,
    action_type: "shift_deleted",
    entity_type: "shift_record",
    entity_id: id,
    old_value: {
      staff_id: existing.staff_id,
      shift_date: existing.shift_date,
      start_time: existing.start_time,
      end_time: existing.end_time,
    },
  });

  if (existing.status === "published") {
    const { data: person } = await admin
      .from("staff")
      .select("*")
      .eq("id", existing.staff_id)
      .single();
    if (person) {
      await notifyShiftChanged(
        person as Staff,
        existing.shift_date,
        `${displayName(auth)} removed your ${formatTime(existing.start_time)}–${formatTime(existing.end_time)} shift on ${existing.shift_date}.`
      );
    }
  }

  return NextResponse.json({ cancelled: true });
}
