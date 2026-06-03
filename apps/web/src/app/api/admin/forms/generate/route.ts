import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { FormField, FormFieldType } from "@/lib/admin/forms-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_FIELD_TYPES: FormFieldType[] = [
  "short_text",
  "long_text",
  "number",
  "email",
  "phone",
  "date",
  "single_choice",
  "multiple_choice",
  "dropdown",
  "file_upload",
  "rating",
  "signature",
  "section_header",
  "description",
  "divider",
];

const SYSTEM_PROMPT = `You are a form builder assistant for a property management platform called Proxy.
The user will describe a form they need. Return ONLY a valid JSON array of form fields.
Each field must be a JSON object with these properties:
- id: unique string like "field_001", "field_002", etc.
- type: one of: short_text, long_text, number, email, phone, date, single_choice, multiple_choice, dropdown, file_upload, rating, section_header, description, divider
- label: descriptive label string
- required: boolean (true for important fields, false for optional)
- placeholder: optional hint string (omit for layout types)
- options: string array (required for single_choice, multiple_choice, dropdown types)
- ratingMax: number (5 or 10, only for rating type)

Layout types (section_header, description, divider) have no required/placeholder/options.
Section headers group related fields. Use them liberally for long forms.
Descriptions provide instructional text under a section header.

Return ONLY the JSON array. No markdown. No explanation. No code fences.`;

function generateFieldId(index: number): string {
  return `field_${String(index + 1).padStart(3, "0")}`;
}

function validateField(raw: unknown, index: number): FormField | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const type = obj.type as FormFieldType;
  if (!VALID_FIELD_TYPES.includes(type)) return null;

  const field: FormField = {
    id: generateFieldId(index),
    type,
    label: typeof obj.label === "string" ? obj.label : `Field ${index + 1}`,
    required: typeof obj.required === "boolean" ? obj.required : false,
  };

  if (typeof obj.placeholder === "string" && obj.placeholder) {
    field.placeholder = obj.placeholder;
  }
  if (Array.isArray(obj.options) && obj.options.every((o) => typeof o === "string")) {
    field.options = obj.options as string[];
  }
  if (type === "rating" && typeof obj.ratingMax === "number") {
    field.ratingMax = obj.ratingMax;
  }

  return field;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { description: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { description, context } = body;
  if (!description || typeof description !== "string" || description.trim().length < 5) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const userMessage = context
    ? `Form description: ${description.trim()}\nAudience/context: ${context.trim()}`
    : description.trim();

  const client = new Anthropic();
  let resp;
  try {
    resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI service unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const rawText = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  // Strip markdown code fences if the model wrapped the JSON
  const raw = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract a JSON array from anywhere in the response
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return NextResponse.json({ error: "AI returned invalid JSON." }, { status: 502 });
      }
    } else {
      return NextResponse.json({ error: "AI returned invalid JSON." }, { status: 502 });
    }
  }

  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: "AI returned unexpected shape." }, { status: 502 });
  }

  const fields: FormField[] = parsed
    .map((item, i) => validateField(item, i))
    .filter((f): f is FormField => f !== null);

  return NextResponse.json({ fields });
}
