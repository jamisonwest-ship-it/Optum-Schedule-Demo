"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="rounded-md border border-blue-300/40 px-2.5 py-1.5 text-xs text-blue-100 hover:bg-optum-blue-dark"
    >
      Sign out
    </button>
  );
}
