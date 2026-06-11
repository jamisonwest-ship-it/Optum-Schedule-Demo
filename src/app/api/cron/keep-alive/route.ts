import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Supabase free-tier projects pause after 7 days of inactivity.
// Vercel Cron hits this every 3 days (see vercel.json) with
// Authorization: Bearer <CRON_SECRET> to keep the database awake.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  const { count, error } = await admin
    .from("staff")
    .select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    staff_count: count,
    timestamp: new Date().toISOString(),
  });
}
