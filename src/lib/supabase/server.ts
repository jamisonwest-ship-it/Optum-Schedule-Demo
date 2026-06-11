import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Staff } from "@/lib/types";

/** Cookie-aware client for server components and route handlers (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware refreshes sessions.
          }
        },
      },
    }
  );
}

/** Service-role client — bypasses RLS. Server-side only, never import in client code. */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Resolve the logged-in auth user to their staff record.
 * On first login, links staff.auth_user_id by email match.
 * Returns null when not logged in or email is not on the roster.
 */
export async function getCurrentStaff(): Promise<Staff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const admin = createServiceClient();

  const { data: byId } = await admin
    .from("staff")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (byId) return byId as Staff;

  const { data: byEmail } = await admin
    .from("staff")
    .select("*")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!byEmail) return null;

  if (!byEmail.auth_user_id) {
    await admin
      .from("staff")
      .update({ auth_user_id: user.id })
      .eq("id", byEmail.id);
    byEmail.auth_user_id = user.id;
  }
  return byEmail as Staff;
}
