"use server";

import { createServiceClient } from "@/lib/supabase/service";

const AI_SYSTEM_PROMPT = `You analyze documents and images for a property management company. Classify the document and provide a brief, useful summary.

Document types you might see:
- Receipt (purchase, repair, cleaning supply, maintenance)
- Invoice (contractor, vendor, utility)
- Insurance document (policy, claim, certificate)
- Legal document (lease, agreement, contract, notice)
- Maintenance photo (damage, repair needed, before/after)
- Property photo (interior, exterior, amenity)
- Tax document (W-9, 1099, tax return)
- ID document (driver's license, passport)
- Other

Respond in JSON:
{
  "documentType": "receipt",
  "summary": "Home Depot receipt for $127.43. Items: smoke detectors (3), carbon monoxide detector (1), 9V batteries (6). Dated March 15, 2026.",
  "keyDetails": {
    "vendor": "Home Depot",
    "amount": "$127.43",
    "date": "March 15, 2026"
  }
}

Keep the summary under 2 sentences. Extract specific amounts, dates, names, and addresses when visible. For photos, describe what you see and any maintenance issues.`;

/**
 * Run AI analysis on an uploaded file and update the message metadata.
 * Called AFTER the message is sent, so the user never waits.
 * Fire-and-forget from the client.
 */
export async function analyzeAttachment(args: {
  messageId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  try {
    // Fetch the file from the public URL
    const response = await fetch(args.fileUrl);
    if (!response.ok) return;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const aiResult = await callClaudeHaiku(apiKey, buffer, args.fileType, args.fileName);
    if (!aiResult) return;

    // Update the message metadata with the AI summary
    const svc = createServiceClient();
    const { data: msg } = await svc
      .from("messages")
      .select("metadata")
      .eq("id", args.messageId)
      .single();

    if (!msg) return;

    const existingMeta = (msg.metadata ?? {}) as Record<string, unknown>;
    const attachments = (existingMeta.attachments ?? []) as Array<Record<string, unknown>>;

    // Find the matching attachment and add the AI data
    const updated = attachments.map((att) => {
      if (att.url === args.fileUrl) {
        return {
          ...att,
          aiSummary: aiResult.summary,
          documentType: aiResult.documentType,
          keyDetails: aiResult.keyDetails,
        };
      }
      return att;
    });

    await svc
      .from("messages")
      .update({
        metadata: { ...existingMeta, attachments: updated } as unknown as import("@/types/supabase").Json,
      })
      .eq("id", args.messageId);
  } catch (err) {
    console.error("[AI analysis] Failed:", err);
  }
}

async function callClaudeHaiku(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ summary: string; documentType: string; keyDetails: Record<string, string> } | null> {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  const content: Array<Record<string, unknown>> = [];

  if (isImage) {
    const base64 = buffer.toString("base64");
    const mediaType = mimeType === "image/heic" ? "image/jpeg" : mimeType;
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });
    content.push({
      type: "text",
      text: `Analyze this image (filename: ${fileName}). Respond with JSON only.`,
    });
  } else if (isPdf) {
    const base64 = buffer.toString("base64");
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    });
    content.push({
      type: "text",
      text: `Analyze this PDF document (filename: ${fileName}). Respond with JSON only.`,
    });
  } else {
    return null;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    console.error("[AI] API error:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) return null;

  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      summary: parsed.summary ?? "",
      documentType: parsed.documentType ?? "Other",
      keyDetails: parsed.keyDetails ?? null,
    };
  } catch {
    return {
      summary: text.slice(0, 200),
      documentType: "Other",
      keyDetails: {} as Record<string, string>,
    };
  }
}
