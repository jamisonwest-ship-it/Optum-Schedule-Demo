import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";

// GET /api/statuses?date=YYYY-MM-DD — live statuses for a date.
export async function GET(request: NextRequest) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;

  const date = request.nextUrl.searchParams.get("date") ?? todayISO();
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("live_statuses")
    .select("*, work_type:work_type_id (code, name)")
    .eq("status_date", date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ statuses: data });
}

// PUT /api/statuses — set someone's live status for today.
// Body: { staff_id, work_type_id }
// Techs may only update their own; pharmacists and managers can update anyone.
export async function PUT(request: NextRequest) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.staff_id || !body?.work_type_id) {
    return NextResponse.json(
      { error: "staff_id and work_type_id are required" },
      { status: 400 }
    );
  }

  const canEditOthers = ["admin", "pharmacist_scheduler", "tech_supervisor", "pharmacist"].includes(
    auth.app_role
  );
  if (body.staff_id !== auth.id && !canEditOthers) {
    return NextResponse.json(
      { error: "You can only update your own status" },
      { status: 403 }
    );
  }

  const date = todayISO();
  const admin = createServiceClient();

  // Previous status for the audit log
  const { data: existing } = await admin
    .from("live_statuses")
    .select("work_type_id, work_type:work_type_id (name)")
    .eq("staff_id", body.staff_id)
    .eq("status_date", date)
    .maybeSingle();

  const { data: updated, error } = await admin
    .from("live_statuses")
    .upsert(
      {
        staff_id: body.staff_id,
        status_date: date,
        work_type_id: body.work_type_id,
        updated_at: new Date().toISOString(),
        updated_by: auth.id,
      },
      { onConflict: "staff_id,status_date" }
    )
    .select("*, work_type:work_type_id (code, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("activity_log").insert({
    staff_id: auth.id,
    action_type: "status_change",
    entity_type: "live_status",
    entity_id: updated.id,
    old_value: existing
      ? { work_type_id: existing.work_type_id }
      : null,
    new_value: {
      staff_id: body.staff_id,
      work_type_id: body.work_type_id,
      date,
    },
  });

  return NextResponse.json({ status: updated });
}
