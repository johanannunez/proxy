# Workspace Request Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Build a workspace request system that can assign requests to a workspace or specific people, notify one or more workspace parties by email and SMS, support CC behavior for email, and send premium request emails with editable subject, message, CTA, trust note, footer, and optional attachments.

**Architecture:** Add a first-class request model that separates assignment from notification. The admin composer creates a workspace request, request items, recipients, and optional attachments. Email delivery uses a request-specific template, SMS uses compact text with the portal link, and the portal resolves the same workspace request link for each logged-in person.

**Tech Stack:** Next.js App Router, TypeScript strict mode, CSS modules, Supabase, Resend, OpenPhone, existing workspace contact/profile model.


## Current Context

The workspace detail page already fetches workspace members from `contacts` and `profiles` by `workspace_id`. The Documents tab currently opens a request modal with selected document cards, editable subject, editable body, editable button text, and editable trust note. Email delivery currently routes through `sendWorkspaceDocumentRequestAction`, which calls `sendMessage` with optional request-specific `emailHtml` and `smsBody`.

The next pass should turn that modal into a true request composer:

- Requests can be assigned to the workspace, one person, or multiple people.
- Notifications can go to assigned people, all workspace contacts, or selected CC contacts.
- The same workspace request link should work for multiple people with different logins.
- Completion can be "anyone can complete" for workspace requests or "each assigned person must complete" for specific person requests.
- Email supports To and CC.
- SMS supports direct selected recipients only.
- Attachments are allowed for reference files, but sensitive documents stay in the portal.

## File Map

- Create: `supabase/migrations/20260529_workspace_requests.sql`
  - Adds `workspace_requests`, `workspace_request_items`, `workspace_request_recipients`, and `workspace_request_attachments`.
- Create: `apps/web/src/lib/admin/workspace-requests.ts`
  - Server-only data access for request records, members, and portal links.
- Create: `apps/web/src/lib/admin/workspace-request-email.ts`
  - Request email template helpers and recipient formatting.
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
  - Replace the request modal with a request composer.
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.module.css`
  - Add layout and states for recipients, assignment, delivery, attachments, and preview.
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/workspace-document-actions.ts`
  - Create request records and deliver to selected recipients.
- Modify: `apps/web/src/app/(admin)/admin/inbox/actions.ts`
  - Add CC support for email delivery without affecting existing inbox sends.
- Modify: `apps/web/src/lib/email-template.ts`
  - Keep generic inbox template and request template separate.
- Modify: `apps/web/src/app/(portal)/portal/setup/page.tsx`
  - Read request query parameters and show relevant workspace request context.
- Create: `apps/web/scripts/verify-workspace-request-routing.ts`
  - Pure verification for assignment and recipient routing.

## Data Model

### Request Scope

`workspace_requests.assignment_scope`

- `workspace`: anyone with access to the workspace can complete the request.
- `person`: one selected person is responsible.
- `multiple_people`: multiple selected people are responsible.

### Completion Rule

`workspace_requests.completion_rule`

- `any_assignee`: completion by one allowed person completes the request.
- `each_assignee`: every assigned person must complete their own part.

### Recipient Role

`workspace_request_recipients.role`

- `to`: responsible recipient in email.
- `cc`: copied recipient in email.
- `notify_only`: notified but not responsible.

### Delivery Channels

`workspace_request_recipients.delivery_channels`

Use a text array with values:

- `email`
- `sms`

SMS has no real CC. If a CC recipient has SMS selected, treat it as a direct notification text and label it as copied in metadata.


## Task 1: Add Workspace Request Tables

**Files:**

- Create: `supabase/migrations/20260529_workspace_requests.sql`

- [ ] **Step 1: Add request enums and tables**

```sql
create type public.workspace_request_assignment_scope as enum (
  'workspace',
  'person',
  'multiple_people'
);

create type public.workspace_request_completion_rule as enum (
  'any_assignee',
  'each_assignee'
);

create type public.workspace_request_status as enum (
  'draft',
  'sent',
  'viewed',
  'partially_completed',
  'completed',
  'cancelled'
);

create type public.workspace_request_recipient_role as enum (
  'to',
  'cc',
  'notify_only'
);

create table public.workspace_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assignment_scope public.workspace_request_assignment_scope not null default 'workspace',
  completion_rule public.workspace_request_completion_rule not null default 'any_assignee',
  status public.workspace_request_status not null default 'draft',
  subject text not null,
  message_html text not null,
  message_text text not null,
  cta_label text not null,
  trust_note text not null,
  created_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workspace_requests(id) on delete cascade,
  document_key text not null,
  label text not null,
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open',
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.workspace_request_recipients (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workspace_requests(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  role public.workspace_request_recipient_role not null,
  delivery_channels text[] not null default array['email']::text[],
  email text,
  phone text,
  last_email_sent_at timestamptz,
  last_sms_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.workspace_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workspace_requests(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Add indexes and RLS**

```sql
create index workspace_requests_workspace_idx
  on public.workspace_requests (workspace_id, status, created_at desc);

create index workspace_request_items_request_idx
  on public.workspace_request_items (request_id, status);

create index workspace_request_recipients_request_idx
  on public.workspace_request_recipients (request_id, role);

create index workspace_request_attachments_request_idx
  on public.workspace_request_attachments (request_id);

alter table public.workspace_requests enable row level security;
alter table public.workspace_request_items enable row level security;
alter table public.workspace_request_recipients enable row level security;
alter table public.workspace_request_attachments enable row level security;

create policy workspace_requests_admin_all
  on public.workspace_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy workspace_request_items_admin_all
  on public.workspace_request_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy workspace_request_recipients_admin_all
  on public.workspace_request_recipients for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy workspace_request_attachments_admin_all
  on public.workspace_request_attachments for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 3: Apply migration**

Run through Supabase MCP for project `pwoxwpryummqeqsxdgyc`.

Expected: migration applies cleanly.

## Task 2: Add Request Routing Helpers

**Files:**

- Create: `apps/web/src/lib/admin/workspace-requests.ts`
- Test: `apps/web/scripts/verify-workspace-request-routing.ts`

- [ ] **Step 1: Create request types and portal URL helper**

```ts
import "server-only";

export type WorkspaceRequestAssignmentScope = "workspace" | "person" | "multiple_people";
export type WorkspaceRequestCompletionRule = "any_assignee" | "each_assignee";
export type WorkspaceRequestRecipientRole = "to" | "cc" | "notify_only";
export type WorkspaceRequestDeliveryChannel = "email" | "sms";

export function buildWorkspaceRequestUrl(origin: string, workspaceId: string, requestId: string): string {
  const params = new URLSearchParams({
    workspace: workspaceId,
    request: requestId,
    source: "documents",
  });
  return `${origin.replace(/\/$/, "")}/portal/setup?${params.toString()}`;
}
```

- [ ] **Step 2: Add pure recipient routing helper**

```ts
export type ComposerRecipient = {
  contactId: string;
  profileId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: WorkspaceRequestRecipientRole;
  channels: WorkspaceRequestDeliveryChannel[];
};

export function splitEmailRecipients(recipients: ComposerRecipient[]): {
  to: string[];
  cc: string[];
} {
  const to = recipients
    .filter((recipient) => recipient.role === "to" && recipient.channels.includes("email") && recipient.email)
    .map((recipient) => recipient.email as string);

  const cc = recipients
    .filter((recipient) => recipient.role === "cc" && recipient.channels.includes("email") && recipient.email)
    .map((recipient) => recipient.email as string);

  return { to, cc };
}

export function splitSmsRecipients(recipients: ComposerRecipient[]): ComposerRecipient[] {
  return recipients.filter((recipient) => recipient.channels.includes("sms") && recipient.phone);
}
```

- [ ] **Step 3: Add verification script**

```ts
import assert from "node:assert/strict";
import { splitEmailRecipients, splitSmsRecipients } from "../src/lib/admin/workspace-requests";

const recipients = [
  {
    contactId: "tina-contact",
    profileId: "tina-profile",
    fullName: "Tina Olive",
    email: "tina@example.com",
    phone: "509-555-0101",
    role: "to" as const,
    channels: ["email", "sms"] as const,
  },
  {
    contactId: "darryl-contact",
    profileId: "darryl-profile",
    fullName: "Darryl Olive",
    email: "darryl@example.com",
    phone: "509-555-0102",
    role: "cc" as const,
    channels: ["email"] as const,
  },
];

assert.deepEqual(splitEmailRecipients(recipients), {
  to: ["tina@example.com"],
  cc: ["darryl@example.com"],
});

assert.equal(splitSmsRecipients(recipients).length, 1);
assert.equal(splitSmsRecipients(recipients)[0]?.fullName, "Tina Olive");
```

- [ ] **Step 4: Run verification**

Run: `pnpm exec tsx scripts/verify-workspace-request-routing.ts`

Expected: no output and exit code `0`.

## Task 3: Extend Email Sending With CC

**Files:**

- Modify: `apps/web/src/app/(admin)/admin/inbox/actions.ts`

- [ ] **Step 1: Extend `sendViaResend`**

```ts
async function sendViaResend(args: {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; resendId?: string; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[Messages] RESEND_API_KEY not set, skipping email");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Parcel <hello@theparcelco.com>",
        to: args.to,
        cc: args.cc && args.cc.length > 0 ? args.cc : undefined,
        subject: args.subject,
        html: args.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Messages] Resend error:", text);
      return { ok: false, error: text };
    }

    const data = await res.json();
    return { ok: true, resendId: data.id };
  } catch (err) {
    console.error("[Messages] Resend send failed:", err);
    return { ok: false, error: String(err) };
  }
}
```

- [ ] **Step 2: Add optional `emailCc` to `sendMessage`**

```ts
export async function sendMessage(args: {
  ownerId: string;
  body: string;
  deliveryMethod?: "portal" | "email" | "sms";
  subject?: string;
  conversationId?: string;
  emailHtml?: string;
  emailCc?: string[];
  smsBody?: string;
}) {
```

- [ ] **Step 3: Pass CC into Resend and metadata**

```ts
const result = await sendViaResend({
  to: emailRecipients,
  cc: args.emailCc,
  subject,
  html,
});

if (args.emailCc && args.emailCc.length > 0) {
  metadata.cc = args.emailCc;
}
```

## Task 4: Create Request Records And Deliver To Recipients

**Files:**

- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/workspace-document-actions.ts`
- Modify: `apps/web/src/lib/admin/workspace-requests.ts`

- [ ] **Step 1: Update action input**

```ts
export type WorkspaceDocumentRequestDelivery = "email" | "sms" | "email_sms";

export type WorkspaceDocumentRequestRecipientInput = {
  contactId: string;
  profileId: string | null;
  role: "to" | "cc" | "notify_only";
  channels: Array<"email" | "sms">;
  email: string | null;
  phone: string | null;
};

export async function sendWorkspaceDocumentRequestAction(input: {
  workspaceId: string;
  profileId: string;
  assignmentScope: "workspace" | "person" | "multiple_people";
  completionRule: "any_assignee" | "each_assignee";
  recipients: WorkspaceDocumentRequestRecipientInput[];
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrlOrigin: string;
  trustNote: string;
  documentKeys: WorkspaceDocumentKey[];
}): Promise<WorkspaceDocumentActionResult> {
```

- [ ] **Step 2: Insert request, items, and recipients**

```ts
const { data: request, error: requestError } = await svc
  .from("workspace_requests")
  .insert({
    workspace_id: input.workspaceId,
    assignment_scope: input.assignmentScope,
    completion_rule: input.completionRule,
    status: "sent",
    subject: input.subject,
    message_html: input.body,
    message_text: textFromHtml(input.body),
    cta_label: input.ctaLabel,
    trust_note: input.trustNote,
    created_by: user.id,
    sent_at: new Date().toISOString(),
  })
  .select("id")
  .single();

if (requestError || !request) {
  return { ok: false, error: requestError?.message ?? "Request could not be created." };
}
```

- [ ] **Step 3: Build request URL after insert**

```ts
const requestUrl = buildWorkspaceRequestUrl(input.ctaUrlOrigin, input.workspaceId, request.id);
```

- [ ] **Step 4: Send one email with To and CC**

Use `splitEmailRecipients(input.recipients)`.

```ts
const emailRecipients = splitEmailRecipients(input.recipients);
if (emailRecipients.to.length > 0) {
  const emailResult = await sendMessage({
    ownerId: input.profileId,
    deliveryMethod: "email",
    subject: input.subject,
    body: input.body,
    emailCc: emailRecipients.cc,
    emailHtml: buildWorkspaceRequestEmail({
      subject: input.subject,
      body: input.body,
      ctaLabel: input.ctaLabel,
      ctaUrl: requestUrl,
      trustNote: input.trustNote,
      requestedItems: eligibleKeys.map((key) => WORKSPACE_DOCUMENT_DEFINITIONS[key].label),
    }),
  });

  if ("error" in emailResult && emailResult.error) {
    return { ok: false, error: emailResult.error };
  }
}
```

- [ ] **Step 5: Send SMS to selected SMS recipients**

Loop over `splitSmsRecipients(input.recipients)` and call `sendMessage` with `deliveryMethod: "sms"` for each recipient profile that exists. If the SMS recipient has no `profileId`, return a clear error that portal SMS requires linked portal access.

## Task 5: Redesign The Request Composer

**Files:**

- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.module.css`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/page.tsx`

- [ ] **Step 1: Pass all workspace members into `DocumentsTab`**

`page.tsx` already fetches `members`. Extend `DocumentsTabProps` to accept `members: WorkspaceDetailMember[]`.

- [ ] **Step 2: Add assignment state**

```ts
const [assignmentScope, setAssignmentScope] = useState<"workspace" | "person" | "multiple_people">("workspace");
const [completionRule, setCompletionRule] = useState<"any_assignee" | "each_assignee">("any_assignee");
```

- [ ] **Step 3: Add recipient state**

Default:

- All members with email are selected for email.
- Primary owner is role `to`.
- Other members are role `cc`.
- SMS defaults off.

```ts
const [recipients, setRecipients] = useState(() =>
  members.map((member, index) => ({
    contactId: member.id,
    profileId: member.id,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    role: index === 0 ? "to" : "cc",
    channels: member.email ? ["email"] : [],
  })),
);
```

- [ ] **Step 4: UI sections**

The modal order should be:

1. `Recipients`
2. `Assignment`
3. `Requested items`
4. `Message`
5. `Delivery preview`

Use compact rows:

```text
Tina Olive       To       Email on       Text off
Darryl Olive     CC       Email on       Text off
```

- [ ] **Step 5: Rename confusing copy**

Replace:

- `One checklist link`
- `Copy checklist`
- `Parcel checklist link copied`

With:

- `Owner portal link`
- `Copy portal link`
- `Portal request link copied`

- [ ] **Step 6: Add action button label logic**

```ts
function deliveryButtonLabel(recipients: ComposerRecipient[]): string {
  const emailCount = recipients.filter((recipient) => recipient.channels.includes("email")).length;
  const smsCount = recipients.filter((recipient) => recipient.channels.includes("sms")).length;
  if (emailCount > 0 && smsCount > 0) return "Send email and text";
  if (emailCount > 1) return `Send email to ${emailCount} people`;
  if (emailCount === 1) return "Send email";
  if (smsCount > 1) return `Send text to ${smsCount} people`;
  if (smsCount === 1) return "Send text";
  return "Choose delivery";
}
```

## Task 6: Add Attachments For Reference Files

**Files:**

- Modify: `DocumentsTab.tsx`
- Modify: `DocumentsTab.module.css`
- Modify: `workspace-document-actions.ts`

- [ ] **Step 1: Add attachment picker UI**

Use a normal file input only if the repo already allows file inputs. If not, reuse the existing attachment upload pattern from admin inbox or document upload.

Attachment rules:

- Allowed: PDF, PNG, JPG, JPEG, HEIC, TXT.
- Max size: 10 MB per file.
- Max count: 5 files.
- Sensitive documents warning: do not attach W9, IDs, bank documents, or card forms.

- [ ] **Step 2: Store attachments**

Store files in the same Supabase storage bucket pattern used for workspace documents, under:

```text
workspace-requests/{workspaceId}/{requestId}/{fileName}
```

- [ ] **Step 3: Email rendering**

Do not attach files directly in Resend for this pass. Add an email section:

```text
Reference files
2 files are available in the secure portal.
```

SMS says:

```text
Reference files are available in the portal.
```

## Task 7: Portal Request Resolution

**Files:**

- Modify: `apps/web/src/app/(portal)/portal/setup/page.tsx`
- Create: `apps/web/src/lib/portal/workspace-request-context.ts`

- [ ] **Step 1: Read request params**

```ts
const requestId = searchParams.request ?? null;
const workspaceId = searchParams.workspace ?? null;
```

- [ ] **Step 2: Verify logged-in user can access workspace**

Rules:

- If request is workspace assigned and user belongs to workspace, allow.
- If request is person assigned, allow viewing for workspace members but show who is responsible.
- If request requires each assignee, show the logged-in person's own required items first.

- [ ] **Step 3: Show request context above setup steps**

Copy:

```text
Requested items
These items are needed for this workspace. Anyone with access can complete workspace-level items.
```

For person assigned:

```text
Assigned to Tina Olive
This request is visible to the workspace, but Tina is responsible for completing it.
```

## Task 8: Dev Testing Safety

**Files:**

- Modify: `apps/web/src/app/(admin)/admin/inbox/actions.ts`
- Modify: `apps/web/src/lib/admin/sms-delivery.ts`
- Create: `apps/web/src/lib/admin/dev-delivery-guard.ts`

- [ ] **Step 1: Add dev redirect env support**

Environment variables:

```text
DEV_EMAIL_RECIPIENT=hello+parceltest@theparcelco.com
DEV_SMS_RECIPIENT=509-579-9685
```

- [ ] **Step 2: Redirect in development only**

If `NODE_ENV === "development"` and `DEV_EMAIL_RECIPIENT` is set:

- Send all emails to `DEV_EMAIL_RECIPIENT`.
- Prefix subject with `[DEV]`.
- Add original recipients into the footer or metadata.

If `NODE_ENV === "development"` and `DEV_SMS_RECIPIENT` is set:

- Send all SMS to `DEV_SMS_RECIPIENT`.
- Prefix text with `[DEV]`.

## Task 9: Verification

**Files:**

- Verify app behavior only.

- [ ] **Step 1: Typecheck**

Run:

```bash
cd /Users/johanannunez/workspace/parcel/apps/web
pnpm exec tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 2: Diff check**

Run:

```bash
cd /Users/johanannunez/workspace/parcel
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Browser test**

Open:

```text
http://localhost:4000/admin/workspaces/face0001-cafe-4000-8000-bb0000000001?tab=documents
```

Verify:

- Recipient rows show all workspace parties.
- Primary person defaults to `To`.
- Other workspace people default to `CC`.
- Email and SMS can be selected independently.
- Assignment can switch between workspace and specific person.
- The CTA label is editable.
- The message body includes greeting.
- The email preview does not show the raw URL as main content.
- The trust note and footer are visible.
- Send button text changes based on selected delivery.
- Workspace request link opens the same request for different logged-in users.

- [ ] **Step 4: Real delivery test with Alex Mercer test owner**

Use:

```text
hello+parceltest@theparcelco.com
509-579-9685
```

Send one request by email only.

Expected:

- Email arrives at `hello@theparcelco.com`.
- Email has one greeting.
- Email has one primary button.
- Requested items appear in a premium box.
- Trust note appears.
- Footer is clear.

## Open Product Decisions

1. Should a CC recipient be allowed to complete a workspace-level request, or are they view only?
   - Recommended: yes for workspace-level requests, no for person-specific requests unless they are also assigned.

2. Should SMS ever go to CC recipients?
   - Recommended: yes only if explicitly toggled on for that person. Label it as a notification, not a CC.

3. Should attachments be email attachments or portal-only reference files?
   - Recommended: portal-only for now. It is safer and keeps sensitive data out of email threads.

4. Should the request composer support direct item links?
   - Recommended: keep them hidden under advanced options. Default to one workspace request link.

## Self Review

- The plan covers assignment, notification, CC, email and SMS delivery, portal link behavior, attachments, trust section, footer, and testing safety.
- The plan avoids changing unrelated workspace finance features.
- The plan uses existing contacts and profiles tied to `workspace_id`.
- The plan separates data creation from delivery and portal resolution.
- No placeholders remain.
