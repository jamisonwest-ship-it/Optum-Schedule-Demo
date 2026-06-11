// Email notifications via Resend. Server-side only.
// From: schedule@jamisonwest.ai (Resend account: jamison.west@outlook.com —
// the jamisonwest.ai domain account, NOT the thewest.casa one).

import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import type { Staff, TimeOffRequest } from "@/lib/types";
import { displayName } from "@/lib/types";

const FROM = () =>
  `Pharmacy Scheduling <${process.env.RESEND_FROM_EMAIL || "schedule@jamisonwest.ai"}>`;
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3102";

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f5f7;padding:24px 12px;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr><td style="background:#002677;padding:16px 24px;">
      <span style="color:#ffffff;font-size:18px;font-weight:700;">Optum<span style="color:#f5820d;">.</span></span>
      <span style="color:#c7d2e8;font-size:14px;margin-left:8px;">Scheduling</span>
    </td></tr>
    <tr><td style="padding:24px;">
      <h1 style="margin:0 0 12px;font-size:18px;color:#111827;">${title}</h1>
      ${bodyHtml}
      <p style="margin:24px 0 0;">
        <a href="${APP_URL()}" style="display:inline-block;background:#002677;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">Open Scheduling</a>
      </p>
    </td></tr>
    <tr><td style="padding:12px 24px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#6b7280;">SMRX / SMMS Pharmacy Scheduling — automated notification. Do not reply.</p>
    </td></tr>
  </table>
</body></html>`;
}

interface SendArgs {
  to: string | string[];
  subject: string;
  title: string;
  bodyHtml: string;
  /** Record an in-app notification for these staff ids. */
  notify?: { staffIds: string[]; type: string; message: string };
}

/**
 * Send an email and record in-app notification rows.
 * Never throws — email failure must not break the underlying action.
 * Returns true when the email was accepted by Resend.
 */
export async function sendNotificationEmail(args: SendArgs): Promise<boolean> {
  let sent = false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM(),
      to: Array.isArray(args.to) ? args.to : [args.to],
      subject: args.subject,
      html: layout(args.title, args.bodyHtml),
    });
    if (error) console.error("Resend error:", error);
    sent = !error;
  } catch (err) {
    console.error("Email send failed:", err);
  }

  if (args.notify && args.notify.staffIds.length > 0) {
    try {
      const admin = createServiceClient();
      await admin.from("notifications").insert(
        args.notify.staffIds.map((staffId) => ({
          recipient_id: staffId,
          type: args.notify!.type,
          title: args.subject,
          message: args.notify!.message,
          email_sent: sent,
          email_sent_at: sent ? new Date().toISOString() : null,
        }))
      );
    } catch (err) {
      console.error("Notification insert failed:", err);
    }
  }
  return sent;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  pto: "PTO",
  sick: "Sick",
  personal: "Personal",
  unpaid: "Unpaid",
};

function fmtDateRange(start: string, end: string): string {
  const f = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
}

/** request_submitted → notify the schedulers/supervisors who decide. */
export async function notifyRequestSubmitted(
  request: TimeOffRequest,
  requester: Staff,
  recipients: Staff[]
): Promise<boolean> {
  const range = fmtDateRange(request.start_date, request.end_date);
  const type = REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type;
  return sendNotificationEmail({
    to: recipients.map((r) => r.email),
    subject: `Time-off request: ${displayName(requester)} — ${range}`,
    title: "New time-off request",
    bodyHtml: `
      <p style="font-size:14px;color:#374151;"><strong>${displayName(requester)}</strong> submitted a <strong>${type}</strong> request for <strong>${range}</strong>.</p>
      ${request.notes ? `<p style="font-size:14px;color:#6b7280;font-style:italic;">"${request.notes}"</p>` : ""}
      <p style="font-size:14px;color:#374151;">Review it in the request queue.</p>`,
    notify: {
      staffIds: recipients.map((r) => r.id),
      type: "request_submitted",
      message: `${displayName(requester)} requested ${type} for ${range}.`,
    },
  });
}

/** request_approved / request_denied → notify the requester. */
export async function notifyRequestDecision(
  request: TimeOffRequest,
  requester: Staff,
  approved: boolean,
  reviewerName: string
): Promise<boolean> {
  const range = fmtDateRange(request.start_date, request.end_date);
  const verdict = approved ? "approved" : "denied";
  return sendNotificationEmail({
    to: requester.email,
    subject: `Your time-off request was ${verdict} — ${range}`,
    title: `Request ${verdict}`,
    bodyHtml: `
      <p style="font-size:14px;color:#374151;">Your ${REQUEST_TYPE_LABELS[request.request_type] ?? request.request_type} request for <strong>${range}</strong> was <strong style="color:${approved ? "#118c4f" : "#c42b1c"};">${verdict}</strong> by ${reviewerName}.</p>
      ${request.reviewer_notes ? `<p style="font-size:14px;color:#6b7280;font-style:italic;">"${request.reviewer_notes}"</p>` : ""}`,
    notify: {
      staffIds: [requester.id],
      type: `request_${verdict}`,
      message: `Your request for ${range} was ${verdict} by ${reviewerName}.`,
    },
  });
}

/** schedule_published → notify all affected staff. */
export async function notifySchedulePublished(
  affectedStaff: Staff[],
  monthLabel: string,
  locationName: string
): Promise<boolean> {
  if (affectedStaff.length === 0) return false;
  return sendNotificationEmail({
    to: affectedStaff.map((s) => s.email),
    subject: `${monthLabel} schedule published — ${locationName}`,
    title: "Schedule published",
    bodyHtml: `
      <p style="font-size:14px;color:#374151;">The <strong>${monthLabel}</strong> schedule for <strong>${locationName}</strong> has been published. Open the app to see your shifts.</p>`,
    notify: {
      staffIds: affectedStaff.map((s) => s.id),
      type: "schedule_published",
      message: `The ${monthLabel} schedule for ${locationName} is published.`,
    },
  });
}

/** shift_changed → notify the affected staff member (post-publish edits). */
export async function notifyShiftChanged(
  staff: Staff,
  shiftDate: string,
  description: string
): Promise<boolean> {
  const day = fmtDateRange(shiftDate, shiftDate);
  return sendNotificationEmail({
    to: staff.email,
    subject: `Your shift on ${day} changed`,
    title: "Shift changed",
    bodyHtml: `<p style="font-size:14px;color:#374151;">${description}</p>`,
    notify: {
      staffIds: [staff.id],
      type: "shift_changed",
      message: description,
    },
  });
}

/** callout_logged → notify schedulers (Lucy + Susie). */
export async function notifyCalloutLogged(
  caller: Staff,
  calloutDate: string,
  reason: string | null,
  recipients: Staff[]
): Promise<boolean> {
  const day = fmtDateRange(calloutDate, calloutDate);
  return sendNotificationEmail({
    to: recipients.map((r) => r.email),
    subject: `Callout: ${displayName(caller)} — ${day}`,
    title: "Callout logged",
    bodyHtml: `
      <p style="font-size:14px;color:#374151;"><strong>${displayName(caller)}</strong> called out for <strong>${day}</strong>.</p>
      ${reason ? `<p style="font-size:14px;color:#6b7280;font-style:italic;">"${reason}"</p>` : ""}
      <p style="font-size:14px;color:#374151;">Check today's ratio for coverage impact.</p>`,
    notify: {
      staffIds: recipients.map((r) => r.id),
      type: "callout_logged",
      message: `${displayName(caller)} called out for ${day}.`,
    },
  });
}
