"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REQUEST_TYPES = [
  { value: "pto", label: "PTO" },
  { value: "sick", label: "Sick" },
  { value: "personal", label: "Personal" },
  { value: "unpaid", label: "Unpaid" },
];

export function RequestForm({ today }: { today: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"time_off" | "callout">("time_off");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requestType, setRequestType] = useState("pto");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    const body =
      mode === "callout"
        ? { kind: "callout", callout_date: today, reason: notes }
        : {
            kind: "time_off",
            start_date: startDate,
            end_date: endDate || startDate,
            request_type: requestType,
            notes,
          };

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);

    if (res.ok) {
      setMessage({
        ok: true,
        text:
          mode === "callout"
            ? "Callout logged — your schedulers have been notified."
            : "Request submitted — you'll get an email when it's reviewed.",
      });
      setStartDate("");
      setEndDate("");
      setNotes("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setMessage({ ok: false, text: data?.error ?? "Something went wrong." });
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-gray-200 bg-white p-4"
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("time_off")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mode === "time_off"
              ? "bg-optum-blue text-white"
              : "border border-gray-200 text-gray-600"
          }`}
        >
          Request time off
        </button>
        <button
          type="button"
          onClick={() => setMode("callout")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            mode === "callout"
              ? "bg-ratio-red text-white"
              : "border border-gray-200 text-gray-600"
          }`}
        >
          Call out today
        </button>
      </div>

      {mode === "time_off" ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">First day</span>
              <input
                type="date"
                required
                min={today}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Last day <span className="text-gray-400">(optional)</span>
              </span>
              <input
                type="date"
                min={startDate || today}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Type</span>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-ratio-red-bg px-3 py-2 text-xs text-ratio-red">
          This logs a same-day callout for <strong>today</strong> and
          immediately notifies your schedulers.
        </p>
      )}

      <label className="mt-3 block">
        <span className="text-xs font-medium text-gray-600">
          {mode === "callout" ? "Reason (optional)" : "Notes (optional)"}
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
        />
      </label>

      {message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            message.ok
              ? "bg-ratio-green-bg text-ratio-green"
              : "bg-ratio-red-bg text-ratio-red"
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-optum-blue py-2.5 text-sm font-semibold text-white hover:bg-optum-blue-dark disabled:opacity-50"
      >
        {busy ? "Submitting…" : mode === "callout" ? "Log callout" : "Submit request"}
      </button>
    </form>
  );
}
