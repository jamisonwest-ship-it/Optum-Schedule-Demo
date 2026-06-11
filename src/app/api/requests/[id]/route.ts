import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyRequestDecision } from "@/lib/email";
import { displayName, type Staff } from "@/lib/types";

// PATCH /api/requests/[id] — approve or deny. Managers only.
// Body: { action: "approve" | "deny", reviewer_notes? }
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
  if (!body?.action || !["approve", "deny"].includes(body.action)) {
    return NextResponse.json(
      { error: 'action must be "approve" or "deny"' },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  const { data: existing } = await admin
    .from("time_off_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: `Request was already ${existing.status}` },
      { status: 409 }
    );
  }

  const newStatus = body.action === "approve" ? "approved" : "denied";
  const { data: updated, error } = await admin
    .from("time_off_requests")
    .update({
      status: newStatus,
      reviewed_by: auth.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: body.reviewer_notes || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("activity_log").insert({
    staff_id: auth.id,
    action_type: `request_${newStatus}`,
    entity_type: "time_off_request",
    entity_id: id,
    old_value: { status: "pending" },
    new_value: { status: newStatus, reviewer_notes: body.reviewer_notes ?? null },
  });

  // Email the requester — this is the Scene 4 demo moment.
  const { data: requester } = await admin
    .from("staff")
    .select("*")
    .eq("id", existing.staff_id)
    .single();
  if (requester) {
    await notifyRequestDecision(
      updated,
      requester as Staff,
      newStatus === "approved",
      displayName(auth)
    );
  }

  return NextResponse.json({ request: updated });
}
