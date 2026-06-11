"use client";

import { useCallback, useEffect, useState } from "react";
import type { RequestWithStaff } from "@/lib/types";
import { displayName } from "@/lib/types";
import { formatDateShort } from "@/lib/dates";

const TYPE_BADGE: Record<string, string> = {
  pto: "bg-optum-blue/10 text-optum-blue",
  sick: "bg-ratio-red-bg text-ratio-red",
  personal: "bg-ratio-yellow-bg text-ratio-yellow",
  unpaid: "bg-gray-100 text-gray-600",
};

function range(r: RequestWithStaff) {
  return r.start_date === r.end_date
    ? formatDateShort(r.start_date)
    : `${formatDateShort(r.start_date)} – ${formatDateShort(r.end_date)}`;
}

export function RequestQueue({ canDecide }: { canDecide: boolean }) {
  const [requests, setRequests] = useState<RequestWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/requests");
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, action: "approve" | "deny") {
    setDecidingId(id);
    await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        reviewer_notes: noteFor === id ? note : undefined,
      }),
    });
    setNoteFor(null);
    setNote("");
    await load();
    setDecidingId(null);
  }

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Time-off requests</h1>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
          Pending ({pending.length})
        </h2>
        {loading ? (
          <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Loading…
          </p>
        ) : pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            Nothing waiting on you. 🎉
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {displayName(r.staff)}
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-xs font-bold uppercase ${TYPE_BADGE[r.request_type]}`}
                      >
                        {r.request_type}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-gray-600">{range(r)}</p>
                    {r.notes && (
                      <p className="mt-1 text-sm italic text-gray-500">
                        &ldquo;{r.notes}&rdquo;
                      </p>
                    )}
                  </div>
                  {canDecide && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        disabled={decidingId === r.id}
                        onClick={() => decide(r.id, "approve")}
                        className="rounded-lg bg-ratio-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={decidingId === r.id}
                        onClick={() => decide(r.id, "deny")}
                        className="rounded-lg bg-ratio-red px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
                {canDecide &&
                  (noteFor === r.id ? (
                    <input
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note to the requester (sent in the email)"
                      className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setNoteFor(r.id);
                        setNote("");
                      }}
                      className="mt-2 text-xs text-optum-blue hover:underline"
                    >
                      + Add a note to your decision
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
          History
        </h2>
        {decided.length === 0 ? (
          <p className="text-sm text-gray-400">No decided requests yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {decided.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-gray-700">
                  <strong>{displayName(r.staff)}</strong> ·{" "}
                  {r.request_type.toUpperCase()} · {range(r)}
                  {r.reviewer_notes && (
                    <span className="ml-1 italic text-gray-400">
                      — &ldquo;{r.reviewer_notes}&rdquo;
                    </span>
                  )}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    r.status === "approved"
                      ? "bg-ratio-green-bg text-ratio-green"
                      : "bg-ratio-red-bg text-ratio-red"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
