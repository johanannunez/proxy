import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase, type UntypedDatabaseClient } from "@/lib/supabase/untyped";

/**
 * Workstream A3: automated document reminder sequences.
 *
 * Candidate discovery runs in Postgres (`find_reminder_candidates()`, see
 * supabase/migrations/20260610110002_reminder_candidates_fn.sql). The pure
 * `findDueRound` helper below is the unit-tested TypeScript spec of the same
 * eligibility rules — if one changes, change both.
 *
 * Runs from the daily cron at /api/cron/document-reminders with the service
 * role client: there is no user session in a cron, and RLS on
 * document_reminders is service-role-only by design.
 */

export interface ReminderCandidate {
  document_id: string;
  owner_id: string;
  owner_email: string;
  owner_name: string;
  document_key: string;
  document_title: string;
  workspace_id: string | null;
  agency_id: string;
  /** Which reminder round to send (1, 2, or 3). */
  round: number;
  /** Days since creation at which this round fires. */
  config_days: number;
}

export interface ReminderCadence {
  round1Days: number;
  round2Days: number;
  round3Days: number;
}

/** Mirrors the document_reminder_config column defaults (3 / 7 / 14). */
export const DEFAULT_CADENCE: ReminderCadence = {
  round1Days: 3,
  round2Days: 7,
  round3Days: 14,
};

/**
 * Statuses that never receive reminders: complete, expired/expiring (those get
 * renewal requests from the expiry workflow instead), or explicitly closed.
 */
export const REMINDER_EXEMPT_STATUSES = [
  "on_file",
  "expired",
  "expiring",
  "waived",
  "declined",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure eligibility check: which reminder round (if any) is due for a document.
 * Returns null when the document is complete, waived, fully reminded, or not
 * yet past the day threshold for its next round.
 */
export function findDueRound(args: {
  status: string;
  createdAt: string | Date;
  lastRoundSent: number;
  waived?: boolean;
  cadence?: ReminderCadence;
  now?: Date;
}): { round: 1 | 2 | 3; configDays: number } | null {
  const { status, createdAt, lastRoundSent, waived = false } = args;
  const cadence = args.cadence ?? DEFAULT_CADENCE;
  const now = args.now ?? new Date();

  if (waived) return null;
  if ((REMINDER_EXEMPT_STATUSES as readonly string[]).includes(status)) return null;
  if (lastRoundSent >= 3) return null;

  const round = (lastRoundSent + 1) as 1 | 2 | 3;
  const configDays =
    round === 1 ? cadence.round1Days : round === 2 ? cadence.round2Days : cadence.round3Days;

  const ageMs = now.getTime() - new Date(createdAt).getTime();
  if (ageMs < configDays * DAY_MS) return null;

  return { round, configDays };
}

/**
 * Finds all documents that need a reminder sent today.
 * A document is eligible if:
 * - status is not on_file, expired, expiring, waived, or declined
 * - created_at is >= round_N_days ago
 * - no reminder of this round has been sent yet
 */
export async function findReminderCandidates(
  db?: UntypedDatabaseClient,
): Promise<ReminderCandidate[]> {
  const client = db ?? untypedDatabase(createServiceClient());

  const { data, error } = await client.rpc<ReminderCandidate[]>("find_reminder_candidates");
  if (error) {
    throw new Error(`find_reminder_candidates failed: ${error.message}`);
  }
  return data ?? [];
}

export type ReminderEmail = { to: string; subject: string; html: string };
export type ReminderEmailSender = (email: ReminderEmail) => Promise<void>;

export type ReminderSendResult =
  | { sent: true; round: number }
  | { sent: false; reason: string };

export interface SendReminderDeps {
  db?: UntypedDatabaseClient;
  sendEmail?: ReminderEmailSender;
}

/**
 * Sends one reminder email, logs the round in document_reminders, and on
 * round 3 escalates the document to urgent.
 *
 * Tolerant of a missing RESEND_API_KEY: skips with a logged warning instead
 * of throwing, so the cron stays green in environments without email.
 */
export async function sendDocumentReminder(
  candidate: ReminderCandidate,
  deps: SendReminderDeps = {},
): Promise<ReminderSendResult> {
  if (!candidate.owner_email) {
    console.warn(
      `[document-reminders] Skipping ${candidate.document_id}: owner has no email on file.`,
    );
    return { sent: false, reason: "Owner has no email on file" };
  }

  let sendEmail = deps.sendEmail;
  if (!sendEmail) {
    if (!process.env.RESEND_API_KEY) {
      console.warn(
        `[document-reminders] Skipping ${candidate.document_id}: RESEND_API_KEY is not configured.`,
      );
      return { sent: false, reason: "RESEND_API_KEY is not configured" };
    }
    sendEmail = sendViaResend;
  }

  await sendEmail({
    to: candidate.owner_email,
    subject: `Reminder: ${candidate.document_title} is still needed`,
    html: buildReminderEmail(candidate),
  });

  const db = deps.db ?? untypedDatabase(createServiceClient());

  // Record that we sent it — this is what advances the round sequence.
  const { error: insertError } = await db.from("document_reminders").insert({
    document_id: candidate.document_id,
    channel: "email",
    round: candidate.round,
    delivered: true,
  });
  if (insertError) {
    // The email already went out; surface loudly so the failed log write is
    // investigated (otherwise tomorrow's run repeats the same round).
    throw new Error(
      `Reminder sent for ${candidate.document_id} but logging failed: ${insertError.message}`,
    );
  }

  // Final round: escalate so the admin cockpit surfaces it.
  if (candidate.round === 3) {
    const { error: urgentError } = await db
      .from("documents")
      .update({ is_urgent: true })
      .eq("id", candidate.document_id);
    if (urgentError) {
      throw new Error(
        `Round 3 reminder sent for ${candidate.document_id} but is_urgent update failed: ${urgentError.message}`,
      );
    }
  }

  return { sent: true, round: candidate.round };
}

const PORTAL_DOCUMENTS_URL = "https://www.myproxyhost.com/workspace/documents";

function buildReminderEmail(candidate: ReminderCandidate): string {
  const urgencyNote =
    candidate.round === 3
      ? "<p><strong>This document is now overdue. Please complete it as soon as possible.</strong></p>"
      : "";
  return `
    <p>Hi ${escapeHtml(candidate.owner_name)},</p>
    <p>This is a reminder that your <strong>${escapeHtml(candidate.document_title)}</strong> is still needed.</p>
    ${urgencyNote}
    <p><a href="${PORTAL_DOCUMENTS_URL}">Complete it now</a></p>
  `;
}

/** Default sender: Resend HTTP API (no SDK dependency, matching the repo). */
async function sendViaResend(email: ReminderEmail): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Proxy <noreply@myproxyhost.com>",
      to: email.to,
      subject: email.subject,
      html: email.html,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend ${response.status}: ${body}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
