"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isEmailAllowed } from "@/lib/launch-gate";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "not-on-roster"
      ? "That email is not on the staff roster. Ask your scheduler to add you."
      : null
  );

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    // PRE-LAUNCH GATE: don't trigger sign-in emails to anyone outside the
    // test group, even for addresses that exist on the roster.
    if (!isEmailAllowed(cleanEmail)) {
      setError(
        "Sign-in is limited to test accounts during pre-launch. Contact your administrator."
      );
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="inline-block rounded-lg bg-optum-blue px-5 py-3">
            <span className="text-xl font-bold text-white">
              Optum<span className="text-optum-orange">.</span>
            </span>
            <span className="ml-2 text-sm text-blue-200">Scheduling</span>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            SMRX / SMMS Pharmacy — schedules, live status, and ratio
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {sent ? (
            <div className="text-center">
              <p className="text-2xl">📬</p>
              <h1 className="mt-2 font-semibold text-gray-900">
                Check your email
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                We sent a sign-in link to <strong>{email}</strong>. Open it on
                this device to log in — no password needed.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-sm text-optum-blue underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={sendLink}>
              <h1 className="font-semibold text-gray-900">Sign in</h1>
              <p className="mt-1 text-sm text-gray-600">
                Enter your work email and we&apos;ll send you a sign-in link.
              </p>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@optum.com"
                className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-optum-blue focus:outline-none"
              />
              {error && (
                <p className="mt-2 rounded-md bg-ratio-red-bg px-3 py-2 text-sm text-ratio-red">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="mt-4 w-full rounded-lg bg-optum-blue py-2.5 text-sm font-semibold text-white hover:bg-optum-blue-dark disabled:opacity-50"
              >
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
