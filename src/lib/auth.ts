import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/supabase/server";
import type { AppRole, Staff } from "@/lib/types";

/**
 * API route guard. Returns the staff record, or a ready-to-return 401/403 response.
 * Usage:
 *   const auth = await requireStaff(MANAGER_ROLES);
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireStaff(
  allowedRoles?: AppRole[]
): Promise<Staff | NextResponse> {
  const staff = await getCurrentStaff();
  if (!staff || !staff.active) {
    return NextResponse.json(
      { error: "Not authorized — no active staff record for this login" },
      { status: 401 }
    );
  }
  if (allowedRoles && !allowedRoles.includes(staff.app_role)) {
    return NextResponse.json(
      { error: "Forbidden for your role" },
      { status: 403 }
    );
  }
  return staff;
}
