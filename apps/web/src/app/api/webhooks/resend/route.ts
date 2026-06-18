import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { appendEmailToOwner } from "@/lib/log-email";
import { normalizeResendEmailAttachments } from "./attachments";
import {
  resolveEmailDirection,
  resolveEmailWorkspaceMatch,
  type ContactEmailMatch,
  type ProfileEmailMatch,
} from "./routing";

type ResendReceivedEvent = {
  type: "email.received";
  created_at?: string;
  data: {
    email_id: string;
    created_at?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    message_id?: string;
    subject?: string;
  };
};

type ResendReceivedEmail = {
  id?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  attachments?: unknown;
  headers?: {
    from?: string;
  } | null;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verifyResult = verifyResendWebhook(request, rawBody);
  if (!verifyResult.ok) {
    return NextResponse.json({ error: verifyResult.error }, { status: 401 });
  }

  const parsed = parseJson(rawBody);
  if (!isResendReceivedEvent(parsed)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const email = await fetchReceivedEmail(parsed.data.email_id);
  const from = extractEmailAddress(email?.from ?? parsed.data.from ?? "");
  const recipients = uniqueEmails([
    ...(email?.to ?? parsed.data.to ?? []),
    ...(email?.cc ?? parsed.data.cc ?? []),
    ...(email?.bcc ?? parsed.data.bcc ?? []),
  ]);

  if (!from && recipients.length === 0) {
    return NextResponse.json({ error: "Email event did not include participants." }, { status: 422 });
  }

  const svc = createServiceClient();
  const participantEmails = [from, ...recipients].filter(Boolean);
  const [profileMatches, contactMatches] = await Promise.all([
    findProfilesByEmail(participantEmails),
    findContactsByEmail(participantEmails),
  ]);
  const ownerForWorkspaceId = await findOwnersForWorkspaceContacts(contactMatches, profileMatches);
  const workspaceMatch = resolveEmailWorkspaceMatch({
    profileMatches,
    contactMatches,
    from,
    recipients,
    ownerForWorkspaceId,
  });
  if (!workspaceMatch) {
    return NextResponse.json({ received: true, matched: false });
  }

  const { owner, relatedContact } = workspaceMatch;
  const sender = profileMatches.find((profile) => profile.email.toLowerCase() === from.toLowerCase());
  const direction = resolveEmailDirection({
    owner,
    relatedContact,
    sender,
    from,
    recipients,
  });
  const adminSender = direction === "outbound" ? await findAdminSender(sender) : null;
  const senderId = adminSender?.id ?? owner.id;
  const subject = email?.subject ?? parsed.data.subject ?? "(no subject)";
  const bodyHtml = normalizeEmailBody(email?.html, email?.text);
  const attachments = normalizeResendEmailAttachments(email?.attachments);

  const result = await appendEmailToOwner({
    ownerId: owner.id,
    senderId,
    subject,
    bodyHtml,
    direction,
    from,
    to: recipients,
    messageId: parsed.data.message_id,
    resendEmailId: parsed.data.email_id,
    source: "resend",
    attachments,
    relatedContact: relatedContact
      ? {
          id: relatedContact.id,
          name: relatedContact.fullName,
          workspaceId: relatedContact.workspaceId,
        }
      : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  void svc.from("activity_log").insert({
    action: "email_received",
    entity_type: "message",
    entity_id: "messageId" in result ? result.messageId : result.conversationId,
    actor_id: senderId,
    metadata: {
      owner_id: owner.id,
      direction,
      subject,
      from,
      to: recipients,
      attachment_count: attachments.length,
      resend_email_id: parsed.data.email_id,
      related_contact_id: relatedContact?.id ?? null,
      workspace_id: relatedContact?.workspaceId ?? owner.workspaceId,
    },
  });

  return NextResponse.json({
    received: true,
    conversationId: result.conversationId,
    duplicate: "duplicate" in result,
  });
}

function verifyResendWebhook(request: Request, payload: string): { ok: true } | { ok: false; error: string } {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const fallbackSecret = process.env.EMAIL_WEBHOOK_SECRET;

  if (!secret && !fallbackSecret) {
    return { ok: false, error: "Webhook secret is not configured." };
  }

  if (secret) {
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    if (!id || !timestamp || !signature) {
      return { ok: false, error: "Missing Resend signature headers." };
    }

    if (!verifySvixSignature({ id, timestamp, payload, signature, secret })) {
      return { ok: false, error: "Invalid webhook signature." };
    }

    return { ok: true };
  }

  const providedSecret =
    request.headers.get("x-proxy-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return providedSecret && providedSecret === fallbackSecret
    ? { ok: true }
    : { ok: false, error: "Invalid webhook secret." };
}

function verifySvixSignature(args: {
  id: string;
  timestamp: string;
  payload: string;
  signature: string;
  secret: string;
}) {
  const signedPayload = `${args.id}.${args.timestamp}.${args.payload}`;
  const secret = args.secret.startsWith("whsec_")
    ? Buffer.from(args.secret.slice(6), "base64")
    : Buffer.from(args.secret, "utf8");
  const expected = createHmac("sha256", secret).update(signedPayload).digest();
  const signatures = args.signature
    .split(" ")
    .map((part) => part.trim())
    .flatMap((part) => {
      if (part.startsWith("v1,")) return [part.slice(3)];
      if (part.startsWith("v1=")) return [part.slice(3)];
      return [];
    });

  return signatures.some((candidate) => {
    const actual = Buffer.from(candidate, "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

function parseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function isResendReceivedEvent(value: unknown): value is ResendReceivedEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as { type?: unknown; data?: unknown };
  if (event.type !== "email.received" || !event.data || typeof event.data !== "object") return false;
  return typeof (event.data as { email_id?: unknown }).email_id === "string";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isReceivedEmail(value: unknown): value is ResendReceivedEmail {
  if (!isObject(value)) return false;
  return typeof value.id === "string" || typeof value.html === "string" || typeof value.text === "string";
}

async function fetchReceivedEmail(emailId: string): Promise<ResendReceivedEmail | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as unknown;
  if (isObject(payload) && isReceivedEmail(payload.data)) return payload.data;
  if (isReceivedEmail(payload)) return payload;
  return null;
}

async function findProfilesByEmail(emails: string[]): Promise<ProfileEmailMatch[]> {
  if (emails.length === 0) return [];
  const svc = createServiceClient();
  const { data } = await svc
    .from("profiles")
    .select("id, email, role, workspace_id")
    .in("email", emails);

  return (data ?? []).map((profile) => ({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    workspaceId: profile.workspace_id,
  }));
}

async function findContactsByEmail(emails: string[]): Promise<ContactEmailMatch[]> {
  if (emails.length === 0) return [];
  const svc = createServiceClient();
  const { data } = await svc
    .from("contacts")
    .select("id, email, profile_id, workspace_id, full_name")
    .in("email", emails);

  return (data ?? [])
    .filter((contact) => contact.email)
    .map((contact) => ({
      id: contact.id,
      email: contact.email ?? "",
      profileId: contact.profile_id,
      workspaceId: contact.workspace_id,
      fullName: contact.full_name,
    }));
}

async function findOwnersForWorkspaceContacts(
  contacts: ContactEmailMatch[],
  profileMatches: ProfileEmailMatch[],
): Promise<Map<string, ProfileEmailMatch>> {
  const ownerForWorkspaceId = new Map<string, ProfileEmailMatch>();
  for (const profile of profileMatches) {
    if (profile.role === "owner" && profile.workspaceId) {
      ownerForWorkspaceId.set(profile.workspaceId, profile);
    }
  }

  const workspaceIds = [
    ...new Set(
      contacts
        .map((contact) => contact.workspaceId)
        .filter((workspaceId): workspaceId is string => Boolean(workspaceId)),
    ),
  ].filter((workspaceId) => !ownerForWorkspaceId.has(workspaceId));
  if (workspaceIds.length === 0) return ownerForWorkspaceId;

  const svc = createServiceClient();
  const { data } = await svc
    .from("profiles")
    .select("id, email, role, workspace_id")
    .in("workspace_id", workspaceIds)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(workspaceIds.length);

  for (const profile of data ?? []) {
    if (!profile.workspace_id || ownerForWorkspaceId.has(profile.workspace_id)) continue;
    ownerForWorkspaceId.set(profile.workspace_id, {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      workspaceId: profile.workspace_id,
    });
  }

  return ownerForWorkspaceId;
}

async function findAdminSender(sender: ProfileEmailMatch | undefined): Promise<ProfileEmailMatch> {
  if (sender?.role === "admin") return sender;

  const svc = createServiceClient();
  const { data } = await svc
    .from("profiles")
    .select("id, email, role, workspace_id")
    .eq("role", "admin")
    .limit(1)
    .single();

  if (!data) {
    throw new Error("No admin sender profile found for email log.");
  }

  return { id: data.id, email: data.email, role: data.role, workspaceId: data.workspace_id };
}

function uniqueEmails(values: string[]) {
  return [...new Set(values.map(extractEmailAddress).filter(Boolean))];
}

function extractEmailAddress(value: string) {
  const angleMatch = value.match(/<([^<>@\s]+@[^<>@\s]+)>/);
  const raw = angleMatch?.[1] ?? value;
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? "";
}

function normalizeEmailBody(html: string | null | undefined, text: string | null | undefined) {
  if (html?.trim()) return html;
  const cleanText = text?.trim() || "(Email body unavailable.)";
  return `<p>${escapeHtml(cleanText).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
