import { NextResponse, type NextRequest } from "next/server";
import { createClient, getCurrentStaff } from "@/lib/supabase/server";
import { MANAGER_ROLES } from "@/lib/types";

// Magic-link callback: exchange the OTP code for a session, link the
// auth user to their staff row (first login), and route by role.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const staff = await getCurrentStaff();
      if (!staff || !staff.active) {
        // Logged in but not on the roster — sign out and explain.
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/auth/login?error=not-on-roster`);
      }
      const fullApp =
        MANAGER_ROLES.includes(staff.app_role) || staff.app_role === "read_only";
      return NextResponse.redirect(
        `${origin}${fullApp ? "/dashboard" : "/my-schedule"}`
      );
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}
