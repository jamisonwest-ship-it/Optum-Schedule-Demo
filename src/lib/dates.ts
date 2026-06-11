// Date helpers pinned to pharmacy-local time (Las Vegas).
// The server may run in UTC — never use bare `new Date()` date math for
// "today" or "now" without going through these.

export const APP_TIME_ZONE = "America/Los_Angeles";

/** Today's date in pharmacy-local time, as YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
}

/** Minutes since midnight, pharmacy-local, for a timestamp (default: now). */
export function minutesInAppTz(ts?: string | Date): number {
  const d = ts ? new Date(ts) : new Date();
  const [h, m] = d
    .toLocaleTimeString("en-GB", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .split(":")
    .map(Number);
  return h * 60 + m;
}

/** Add days to a YYYY-MM-DD string (no timezone surprises — pure date math). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateLong(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** "07:30:00" → "7:30a" */
export function formatTime(t: string): string {
  const [h24, m] = t.split(":").map(Number);
  const ampm = h24 >= 12 ? "p" : "a";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}
