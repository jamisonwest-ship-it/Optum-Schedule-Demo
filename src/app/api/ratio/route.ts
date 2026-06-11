import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { fetchRatioData } from "@/lib/ratio-data";
import { todayISO } from "@/lib/dates";

// GET /api/ratio?date=YYYY-MM-DD — all three grids for a date.
// Techs use the staff portal's ratio glance; the full grid is for
// pharmacists and managers (per the role access matrix).
export async function GET(request: NextRequest) {
  const auth = await requireStaff([
    "admin",
    "pharmacist_scheduler",
    "tech_supervisor",
    "pharmacist",
    "read_only",
  ]);
  if (auth instanceof NextResponse) return auth;

  const date =
    request.nextUrl.searchParams.get("date") ?? todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const data = await fetchRatioData(date);
  return NextResponse.json(data);
}
