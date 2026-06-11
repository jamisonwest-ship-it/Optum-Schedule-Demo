// ============================================================
// PRE-LAUNCH EMAIL SAFETY GATE
// ============================================================
// Until this app is live beyond testing, ONLY the addresses below may
// receive ANY email from the system — both app notifications (Resend)
// and sign-in magic links. Everyone else is silently dropped (in-app
// notification rows are still written, with email_sent = false).
//
// TO GO LIVE: set the EMAIL_ALLOWLIST env var (Vercel + .env.local):
//   EMAIL_ALLOWLIST=*                 → gate fully open, email everyone
//   EMAIL_ALLOWLIST=a@x.com,b@y.com   → extend the allowlist
// The hardcoded default below is deliberately closed — forgetting to
// configure anything means NO real staff can ever be emailed.

export const PRELAUNCH_ALLOWLIST = [
  "jamison.west@outlook.com", // Jamison — platform admin
  "dr.monahan@yahoo.com", // Susie — primary stakeholder (personal)
  "susie.monahan@optum.com", // Susie — work desktop login
];

function activeAllowlist(): string[] | null {
  const env = process.env.EMAIL_ALLOWLIST ?? process.env.NEXT_PUBLIC_EMAIL_ALLOWLIST;
  if (env?.trim() === "*") return null; // gate open
  if (env?.trim()) {
    return [
      ...PRELAUNCH_ALLOWLIST,
      ...env.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    ];
  }
  return PRELAUNCH_ALLOWLIST;
}

export function isEmailAllowed(email: string): boolean {
  const list = activeAllowlist();
  if (list === null) return true;
  return list.includes(email.trim().toLowerCase());
}

/** Split recipients into deliverable and blocked under the current gate. */
export function filterRecipients(emails: string[]): {
  allowed: string[];
  blocked: string[];
} {
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const e of emails) {
    (isEmailAllowed(e) ? allowed : blocked).push(e);
  }
  return { allowed, blocked };
}
