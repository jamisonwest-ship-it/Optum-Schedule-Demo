import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyCalloutLogged, notifyRequestSubmitted } from "@/lib/email";
import { MANAGER_ROLES, type Staff } from "@/lib/types";

// GET /api/requests — managers see all; staff see their own.
export async function GET(request: NextRequest) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;

  const admin = createServiceClient();
  const isManager =
    MANAGER_ROLES.includes(auth.app_role) || auth.app_role === "read_only";

  let query = admin
    .from("time_off_requests")
    .select("*, staff:staff_id (id, full_name, preferred_name, email, staff_type)")
    .order("created_at", { ascending: false });

  if (!isManager) query = query.eq("staff_id", auth.id);

  const status = request.nextUrl.searchParams.get("status");
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data });
}

/** Who gets notified about a staff member's request: schedulers + admins,
 *  plus the tech supervisor whose department the requester belongs to. */
async function decisionMakersFor(requester: Staff): Promise<Staff[]> {
  const admin = createServiceClient();
  const { data } = await admin
    .from("staff")
    .select("*")
    .eq("active", true)
    .in("app_role", ["admin", "pharmacist_scheduler", "tech_supervisor"]);

  return ((data ?? []) as Staff[]).filter(
    (s) =>
      s.app_role !== "tech_supervisor" ||
      (requester.primary_department_id !== null &&
        s.supervised_department_id === requester.primary_department_id)
  );
}

// POST /api/requests — submit a time-off request or log a callout.
// Time off: { kind: "time_off", start_date, end_date, request_type, notes? }
// Callout:  { kind: "callout", callout_date, reason? }
export async function POST(request: NextRequest) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.kind) {
    return NextResponse.json({ error: "kind is required" }, { status: 400 });
  }

  const admin = createServiceClient();

  if (body.kind === "callout") {
    if (!body.callout_date) {
      return NextResponse.json({ error: "callout_date is required" }, { status: 400 });
    }
    const { data: callout, error } = await admin
      .from("callouts")
      .insert({
        staff_id: auth.id,
        callout_date: body.callout_date,
        reason: body.reason || null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from("activity_log").insert({
      staff_id: auth.id,
      action_type: "callout_logged",
      entity_type: "callout",
      entity_id: callout.id,
      new_value: { callout_date: body.callout_date, reason: body.reason ?? null },
    });

    const recipients = await decisionMakersFor(auth);
    await notifyCalloutLogged(auth, body.callout_date, body.reason ?? null, recipients);
    return NextResponse.json({ callout }, { status: 201 });
  }

  // time off
  const { start_date, end_date, request_type, notes } = body;
  if (!start_date || !end_date || !request_type) {
    return NextResponse.json(
      { error: "start_date, end_date and request_type are required" },
      { status: 400 }
    );
  }
  if (end_date < start_date) {
    return NextResponse.json(
      { error: "end_date cannot be before start_date" },
      { status: 400 }
    );
  }

  const { data: req, error } = await admin
    .from("time_off_requests")
    .insert({
      staff_id: auth.id,
      start_date,
      end_date,
      request_type,
      notes: notes || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("activity_log").insert({
    staff_id: auth.id,
    action_type: "request_submitted",
    entity_type: "time_off_request",
    entity_id: req.id,
    new_value: { start_date, end_date, request_type },
  });

  const recipients = await decisionMakersFor(auth);
  await notifyRequestSubmitted(req, auth, recipients);

  return NextResponse.json({ request: req }, { status: 201 });
}
