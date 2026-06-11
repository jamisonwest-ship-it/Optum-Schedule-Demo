import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { sendNotificationEmail } from "@/lib/email";

// POST /api/notify — internal endpoint for ad-hoc notifications (managers).
// Body: { staff_ids: string[], subject: string, message: string }
export async function POST(request: NextRequest) {
  const auth = await requireStaff([
    "admin",
    "pharmacist_scheduler",
    "tech_supervisor",
  ]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.staff_ids?.length || !body.subject || !body.message) {
    return NextResponse.json(
      { error: "staff_ids, subject and message are required" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  const { data: recipients } = await admin
    .from("staff")
    .select("*")
    .in("id", body.staff_ids)
    .eq("active", true);

  if (!recipients?.length) {
    return NextResponse.json({ error: "No active recipients" }, { status: 400 });
  }

  const sent = await sendNotificationEmail({
    to: recipients.map((r) => r.email),
    subject: body.subject,
    title: body.subject,
    bodyHtml: `<p style="font-size:14px;color:#374151;">${String(body.message)}</p>`,
    notify: {
      staffIds: recipients.map((r) => r.id),
      type: "manual",
      message: body.message,
    },
  });

  return NextResponse.json({ sent, recipients: recipients.length });
}
