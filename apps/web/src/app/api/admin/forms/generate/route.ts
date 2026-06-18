import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type {
  FormField,
  FormFieldType,
  FieldCondition,
  FieldConditionGroup,
  ConditionOperator,
} from "@/lib/admin/forms-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONDITION_OPERATORS: ConditionOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
];

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
  "page_break",
];

// Curated form icon + tint keys (mirror of FORM_ICONS / FORM_TINTS in
// src/app/(admin)/admin/paperwork/forms/form-icon.tsx — kept as plain arrays
// here because that module is client-only).
const ICON_KEYS = [
  "form", "house", "wifi", "key", "file", "clipboard", "calendar", "card",
  "id", "camera", "wrench", "sparkle", "confetti", "pin", "bed", "bath",
  "car", "paw", "bulb", "shield", "receipt", "notebook", "chat", "star", "broom",
] as const;
const TINT_KEYS = [
  "blue", "sky", "cyan", "teal", "pine", "emerald", "lime", "amber", "orange",
  "red", "rose", "fuchsia", "purple", "violet", "indigo", "slate",
] as const;

const SYSTEM_PROMPT = `You are a form builder assistant for a property management platform called Proxy.
The user will describe a form they need. Return ONLY a valid JSON object with these top-level keys:
- title: a concise, human Title Case name for the form, 2 to 5 words (e.g. "Key & Lock Information", "Guest Check-in Survey"). Never echo the user's raw sentence.
- icon: the single best-matching key from this list, by meaning:
  form=generic, house=property, wifi=internet, key=keys/locks/access, file=document, clipboard=checklist/inspection, calendar=scheduling, card=payment, id=identity/verification, camera=photos, wrench=maintenance/repairs, sparkle=cleaning, confetti=welcome, pin=location/directions, bed=bedrooms, bath=bathrooms, car=parking, paw=pets, bulb=tips, shield=insurance/safety, receipt=fees/expenses, notebook=notes, chat=survey/feedback, star=review/rating, broom=turnover.
- iconColor: one accent key from: ${TINT_KEYS.join(", ")}. Pick one that fits the topic (e.g. payment=emerald, keys=amber, review=violet).
- fields: an array of form field objects. Each field has:
  - id: unique string like "field_001", "field_002". Number them in order.
  - type: one of: short_text, long_text, number, email, phone, date, single_choice, multiple_choice, dropdown, file_upload, rating, section_header, description, divider, page_break
  - label: descriptive label string
  - required: boolean (true for important fields, false for optional)
  - placeholder: optional hint string (omit for layout types)
  - options: string array (required for single_choice, multiple_choice, dropdown types)
  - ratingMax: number (5 or 10, only for rating type)
  - conditions: OPTIONAL. Include ONLY when a field should stay hidden until an earlier answer matches. Shape:
      { "combinator": "and" | "or", "conditions": [ { "field": "<id of an EARLIER field>", "operator": "<op>", "value": "<trigger>" } ] }
    Operators: equals, not_equals, contains, not_contains, is_empty, is_not_empty.
    Rules: reference the controlling field by the exact "id" you gave it earlier; "value" must be one of that controlling field's exact "options" strings; omit "value" for is_empty/is_not_empty; a controlling field must be a single_choice, multiple_choice, or dropdown that appears BEFORE this field.

Layout types (section_header, description, divider, page_break) have no required/placeholder/options/conditions.
Section headers group related fields. Use them liberally for long forms.
Descriptions provide instructional text under a section header.
page_break splits the form into a new page for the respondent — use it to separate long forms into steps.

CONDITIONAL LOGIC IS IMPORTANT: whenever the user asks for branching, follow-ups, or "only show X if Y", you MUST express it with the conditions property. Example — a yes/no question gating a follow-up:
{ "fields": [
  { "id": "field_001", "type": "single_choice", "label": "Do you have an Airbnb account?", "required": true, "options": ["Yes, I have one", "No, create one for me"] },
  { "id": "field_002", "type": "email", "label": "Airbnb account email", "required": true, "placeholder": "you@example.com", "conditions": { "combinator": "and", "conditions": [ { "field": "field_001", "operator": "equals", "value": "Yes, I have one" } ] } },
  { "id": "field_003", "type": "short_text", "label": "Confirmation code we should expect", "required": false, "conditions": { "combinator": "and", "conditions": [ { "field": "field_001", "operator": "equals", "value": "No, create one for me" } ] } }
] }

Return ONLY the JSON object. No markdown. No explanation. No code fences.`;

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

  // Extract conditional visibility, keeping the model's raw field references.
  // The references are remapped to the final assigned ids in a second pass
  // (the model numbers fields itself, which may not match our ids exactly).
  const cond = parseConditions(obj.conditions);
  if (cond) field.conditions = cond;

  return field;
}

/** Parse a model-provided conditions object into a validated group, or null. */
function parseConditions(raw: unknown): FieldConditionGroup | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const combinator = obj.combinator === "or" ? "or" : "and";
  const list = Array.isArray(obj.conditions) ? obj.conditions : [];
  const conditions: FieldCondition[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    const fieldRef = typeof c.field === "string" ? c.field : null;
    const operator =
      typeof c.operator === "string" &&
      (CONDITION_OPERATORS as string[]).includes(c.operator)
        ? (c.operator as ConditionOperator)
        : null;
    if (!fieldRef || !operator) continue;
    const condition: FieldCondition = { field: fieldRef, operator };
    if (typeof c.value === "string") condition.value = c.value;
    conditions.push(condition);
  }
  return conditions.length > 0 ? { combinator, conditions } : null;
}

/**
 * Snap a model-written condition value onto one of the controlling field's
 * real options. The evaluator compares with exact `===`, so a paraphrased
 * value ("Yes" vs "Yes, I have one") would hide the field forever. Returns the
 * matched option, or null when nothing reasonably matches (caller drops it).
 */
function resolveOptionValue(value: string, options: string[]): string | null {
  const exact = options.find((o) => o === value);
  if (exact) return exact;
  const ci = options.find((o) => o.toLowerCase() === value.toLowerCase());
  if (ci) return ci;
  const v = value.toLowerCase().trim();
  if (!v) return null;
  const partial = options.find((o) => {
    const ol = o.toLowerCase().trim();
    return ol.startsWith(v) || v.startsWith(ol) || ol.includes(v) || v.includes(ol);
  });
  return partial ?? null;
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
      max_tokens: 4096,
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
    // Try to extract a JSON object (preferred) or a bare fields array.
    const objMatch = raw.match(/\{[\s\S]*\}/);
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    const candidate = objMatch?.[0] ?? arrMatch?.[0];
    if (candidate) {
      try {
        parsed = JSON.parse(candidate);
      } catch {
        return NextResponse.json({ error: "AI returned invalid JSON." }, { status: 502 });
      }
    } else {
      return NextResponse.json({ error: "AI returned invalid JSON." }, { status: 502 });
    }
  }

  // Accept the new object shape; tolerate a bare array for resilience.
  const root = Array.isArray(parsed)
    ? { fields: parsed }
    : (parsed as Record<string, unknown>);

  const rawFields = root?.fields;
  if (!Array.isArray(rawFields)) {
    return NextResponse.json({ error: "AI returned unexpected shape." }, { status: 502 });
  }

  // Map the model's own field ids → the ids we assign by position, so any
  // conditions referencing the model's ids can be remapped to ours.
  const idMap = new Map<string, string>();
  rawFields.forEach((item, i) => {
    if (item && typeof item === "object") {
      const mid = (item as Record<string, unknown>).id;
      if (typeof mid === "string") idMap.set(mid, generateFieldId(i));
    }
  });

  const fields: FormField[] = rawFields
    .map((item, i) => validateField(item, i))
    .filter((f): f is FormField => f !== null);

  // Remap condition field references, snap values onto real options, and drop
  // any that don't resolve — so AI conditional logic actually works (and never
  // hides a field forever because of a paraphrased option value).
  const validIds = new Set(fields.map((f) => f.id));
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  for (const f of fields) {
    if (!f.conditions) continue;
    const remapped = f.conditions.conditions
      .map((c) => ({ ...c, field: idMap.get(c.field) ?? c.field }))
      .filter((c) => validIds.has(c.field) && c.field !== f.id)
      .map((c): FieldCondition | null => {
        if (c.value === undefined) return c; // is_empty / is_not_empty
        const ctrl = fieldById.get(c.field);
        if (ctrl?.options && ctrl.options.length > 0) {
          const snapped = resolveOptionValue(c.value, ctrl.options);
          // No matching option → drop this condition so the field shows always
          // (visible + editable) rather than being hidden forever.
          if (!snapped) return null;
          return { ...c, value: snapped };
        }
        return c;
      })
      .filter((c): c is FieldCondition => c !== null);
    if (remapped.length > 0) {
      f.conditions = { combinator: f.conditions.combinator, conditions: remapped };
    } else {
      delete f.conditions;
    }
  }

  const title =
    typeof root.title === "string" && root.title.trim()
      ? root.title.trim().slice(0, 80)
      : null;
  const icon =
    typeof root.icon === "string" && (ICON_KEYS as readonly string[]).includes(root.icon)
      ? root.icon
      : null;
  const iconColor =
    typeof root.iconColor === "string" && (TINT_KEYS as readonly string[]).includes(root.iconColor)
      ? root.iconColor
      : null;

  return NextResponse.json({ title, icon, iconColor, fields });
}
