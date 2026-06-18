import { NextRequest, NextResponse } from "next/server";

interface InquiryBody {
  name: string;
  email: string;
  phone?: string;
  address: string;
  message?: string;
}

const BRAND_FROM = '"Proxy" <hello@myproxyhost.com>';
const LOGO_URL = "https://www.myproxyhost.com/brand/logo-full-color.png";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function brandedShell(opts: {
  heading: string;
  bodyHtml: string;
  footerHint: string;
}): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F9F7F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1C1A17;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9F7F4;padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(28,26,23,0.06);">
<tr><td align="center" style="padding:32px 32px 8px 32px;background:#F9F7F4;">
<img src="${LOGO_URL}" alt="Proxy" width="180" style="display:block;border:0;outline:none;max-width:180px;height:auto;">
</td></tr>
<tr><td style="padding:32px 40px 8px 40px;">
<h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.3;color:#1C1A17;font-weight:500;">${opts.heading}</h1>
${opts.bodyHtml}
</td></tr>
<tr><td style="padding:24px 40px 32px 40px;border-top:1px solid #eee8df;">
<p style="margin:0 0 6px 0;font-size:13px;line-height:1.6;color:#8a8680;">Proxy &middot; Rentals Made Easy</p>
<p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#8a8680;">Questions? Just reply to this email or write us at <a href="mailto:hello@myproxyhost.com" style="color:#3D6B61;text-decoration:none;">hello@myproxyhost.com</a>.</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#b3ada4;">${opts.footerHint}</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function buildOwnerAutoReply(name: string, address: string): string {
  const firstName = escapeHtml(name.trim().split(/\s+/)[0] ?? "there");
  const safeAddress = escapeHtml(address);
  return brandedShell({
    heading: `Thanks, ${firstName}`,
    bodyHtml: `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#4a4641;">We got your inquiry about <strong style="color:#1C1A17;">${safeAddress}</strong> and we're excited to learn more about your property.</p>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#4a4641;">A real human (hi, I'm Johan) will review your details and get back to you personally within 24 hours. We'll walk you through how Proxy Co turns investment homes into hands-off rental income.</p>
<p style="margin:0 0 4px 0;font-size:16px;line-height:1.6;color:#4a4641;">In the meantime, if anything comes to mind, just reply to this email.</p>`,
    footerHint: "You received this because you submitted an inquiry at myproxyhost.com.",
  });
}

function buildInternalNotification(params: {
  name: string;
  email: string;
  phone?: string;
  address: string;
  message?: string;
}): string {
  const rows: Array<[string, string]> = [
    ["Name", params.name],
    ["Email", params.email],
  ];
  if (params.phone) rows.push(["Phone", params.phone]);
  rows.push(["Property Address", params.address]);

  const rowsHtml = rows
    .map(
      ([label, value]) => `<tr>
<td style="padding:10px 0;font-size:13px;color:#8a8680;width:140px;vertical-align:top;">${escapeHtml(label)}</td>
<td style="padding:10px 0;font-size:15px;color:#1C1A17;vertical-align:top;">${escapeHtml(value)}</td>
</tr>`
    )
    .join("");

  const messageBlock = params.message
    ? `<div style="margin-top:20px;padding:16px 20px;background:#F9F7F4;border-radius:8px;">
<p style="margin:0 0 6px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#8a8680;">Message</p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#1C1A17;white-space:pre-wrap;">${escapeHtml(params.message)}</p>
</div>`
    : "";

  return brandedShell({
    heading: "New owner inquiry",
    bodyHtml: `<p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#4a4641;">Someone just submitted an inquiry through myproxyhost.com. Details below.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #eee8df;">${rowsHtml}</table>
${messageBlock}
<p style="margin:24px 0 0 0;font-size:14px;line-height:1.6;color:#8a8680;">Reply directly to this email to respond to <a href="mailto:${escapeHtml(params.email)}" style="color:#3D6B61;text-decoration:none;">${escapeHtml(params.email)}</a>.</p>`,
    footerHint: "Internal notification from the inquiry form.",
  });
}

async function sendEmail(params: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: BRAND_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function POST(req: NextRequest) {
  let body: InquiryBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, email, address } = body;

  if (!name?.trim() || !email?.trim() || !address?.trim()) {
    return NextResponse.json(
      { error: "Name, email, and property address are required." },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Inquiry] RESEND_API_KEY not set, skipping email", { name, email, address });
    }
    return NextResponse.json({ success: true });
  }

  const internalTo = process.env.INQUIRY_TO_EMAIL ?? "hello@myproxyhost.com";

  const internalHtml = buildInternalNotification({
    name,
    email,
    phone: body.phone,
    address,
    message: body.message,
  });
  const autoReplyHtml = buildOwnerAutoReply(name, address);

  const [internalResult, autoReplyResult] = await Promise.all([
    sendEmail({
      apiKey: resendKey,
      to: internalTo,
      subject: `New owner inquiry from ${name}`,
      html: internalHtml,
      replyTo: email,
    }),
    sendEmail({
      apiKey: resendKey,
      to: email,
      subject: "We got your inquiry — Proxy",
      html: autoReplyHtml,
    }),
  ]);

  if (!internalResult.ok) {
    console.error("[Inquiry] Internal email failed:", internalResult.error);
  }
  if (!autoReplyResult.ok) {
    console.error("[Inquiry] Auto-reply failed:", autoReplyResult.error);
  }

  return NextResponse.json({ success: true });
}
