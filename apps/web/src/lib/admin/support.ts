"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

async function sendViaResend(args: {
  subject: string;
  html: string;
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Proxy Platform <hello@myproxyhost.com>",
      to: "jo@johanannunez.com",
      subject: args.subject,
      html: args.html,
    }),
  });
}

export async function submitSupportTicket(input: {
  subject: string;
  message: string;
  priority: "low" | "normal" | "urgent";
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.subject.trim() || !input.message.trim()) {
    return { ok: false, error: "Subject and message are required." };
  }
  if (!["low", "normal", "urgent"].includes(input.priority)) {
    return { ok: false, error: "Invalid priority." };
  }

  const svc = createServiceClient();
  // support_tickets not yet in generated types; use the untyped helper.
  const { error } = await untypedDatabase(svc).from("support_tickets").insert({
    subject: input.subject.trim(),
    message: input.message.trim(),
    priority: input.priority,
  });
  if (error) return { ok: false, error: (error as { message: string }).message };

  const priorityLabel = { low: "Low", normal: "Normal", urgent: "URGENT" }[input.priority];
  await sendViaResend({
    subject: `[${priorityLabel}] Support: ${input.subject.trim()}`,
    html: `<p><strong>Priority:</strong> ${priorityLabel}</p><p><strong>Subject:</strong> ${input.subject}</p><p><strong>Message:</strong></p><p style="white-space:pre-wrap">${input.message}</p>`,
  });

  return { ok: true };
}

export async function submitFeedback(input: {
  type: "bug" | "idea" | "compliment" | "other";
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.message.trim()) {
    return { ok: false, error: "Message is required." };
  }
  if (!["bug", "idea", "compliment", "other"].includes(input.type)) {
    return { ok: false, error: "Invalid feedback type." };
  }

  const svc = createServiceClient();
  // feedback_submissions not yet in generated types; use the untyped helper.
  const { error } = await untypedDatabase(svc).from("feedback_submissions").insert({
    type: input.type,
    message: input.message.trim(),
  });
  if (error) return { ok: false, error: (error as { message: string }).message };
  return { ok: true };
}
