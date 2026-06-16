# Plate.js Document Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Plate.js-powered "Write" tab to signature template detail pages so admins can author HTML document content in Proxy instead of uploading a PDF; DocuSeal remains the signing engine for field placement.

**Architecture:** A new `source_html text null` column on `document_templates` discriminates HTML-authored templates (non-null) from PDF uploads (null). The "Write" tab renders a Plate.js editor; saving serializes to HTML, creates a DocuSeal template via the existing `createTemplateFromHtml` adapter, and stores both the HTML and the new DocuSeal template ID. The existing "Fields" tab (DocuSeal embedded builder) handles all field placement — including mid-document positions — unchanged.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase, `@udecode/plate`, `@udecode/plate-html`, Tailwind v4, CSS Modules, Phosphor Icons, motion/react

---

## File Map

**New:**
- `supabase/migrations/20260616000000_document_templates_source_html.sql`
- `apps/web/src/app/(admin)/admin/paperwork/templates/html-actions.ts`
- `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/TemplateEditor.tsx`
- `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/TemplateEditor.module.css`

**Modified:**
- `apps/web/src/lib/admin/document-templates-types.ts` — add `source_html` to types
- `apps/web/src/lib/admin/document-templates.ts` — normalize + create/update helpers
- `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/SignatureTemplateDetail.tsx` — Write tab, gating
- `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/page.tsx` — read `source_html`, pass `?tab=write`
- `apps/web/src/app/(admin)/admin/paperwork/templates/CreateTemplateModal.tsx` — add "html" docMode
- `apps/web/src/app/(admin)/admin/paperwork/PaperworkShell.tsx` — navigate to `?tab=write` on HTML template creation

---

## Task 1: DB migration

**Files:**
- Create: `supabase/migrations/20260616000000_document_templates_source_html.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260616000000_document_templates_source_html.sql
-- Adds source_html to document_templates.
-- null   = PDF-based template (existing behavior, untouched).
-- ''     = HTML template created but not yet authored.
-- '<..>' = HTML fragment authored in Plate editor and pushed to DocuSeal.

alter table public.document_templates
  add column if not exists source_html text null;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the `mcp__claude_ai_Supabase__apply_migration` tool with:
- `project_id: "pwoxwpryummqeqsxdgyc"`
- `name: "document_templates_source_html"`
- `query`: the SQL above

Expected: success, no error.

- [ ] **Step 3: Verify the column exists**

Use `mcp__claude_ai_Supabase__execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'document_templates'
  and column_name = 'source_html';
```
Expected: one row, `text`, `YES`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260616000000_document_templates_source_html.sql
git commit -m "feat: add source_html column to document_templates"
```

---

## Task 2: Type and lib updates

**Files:**
- Modify: `apps/web/src/lib/admin/document-templates-types.ts`
- Modify: `apps/web/src/lib/admin/document-templates.ts`

- [ ] **Step 1: Update `DocumentTemplate` type**

In `apps/web/src/lib/admin/document-templates-types.ts`, add `source_html` after `settings`:

```typescript
export type DocumentTemplate = {
  id: string;
  org_id: string | null;
  document_key: string;
  display_name: string;
  description: string | null;
  docuseal_template_id: number | null;
  signer_roles: string[];
  requires_countersignature: boolean;
  gate_step: number | null;
  is_system: boolean;
  is_active: boolean;
  tracked: boolean;
  category: string | null;
  title: string | null;
  settings: TemplateSettings;
  source_html: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: Update `CreateDocumentTemplateInput`**

Add `source_html` as optional:

```typescript
export type CreateDocumentTemplateInput = {
  org_id?: string;
  document_key: string;
  display_name: string;
  description?: string;
  docuseal_template_id?: number;
  signer_roles: string[];
  requires_countersignature: boolean;
  gate_step?: number;
  source_html?: string | null;
};
```

- [ ] **Step 3: Update `UpdateDocumentTemplateInput`**

Add `"source_html"` to the Pick union:

```typescript
export type UpdateDocumentTemplateInput = Partial<Pick<
  DocumentTemplate,
  | "title"
  | "display_name"
  | "description"
  | "document_key"
  | "docuseal_template_id"
  | "signer_roles"
  | "requires_countersignature"
  | "gate_step"
  | "is_active"
  | "tracked"
  | "category"
  | "settings"
  | "source_html"
>>;
```

- [ ] **Step 4: Update `normalizeTemplate` in `document-templates.ts`**

In the `normalizeTemplate` function, add the `source_html` normalization line:

```typescript
function normalizeTemplate(row: DocumentTemplate): DocumentTemplate {
  return {
    ...row,
    tracked: row.tracked ?? false,
    category: row.category ?? null,
    title: row.title ?? null,
    settings: row.settings ?? {},
    source_html: row.source_html ?? null,
  };
}
```

- [ ] **Step 5: Update `createDocumentTemplateRecord` in `document-templates.ts`**

Pass `source_html` in the insert body:

```typescript
export async function createDocumentTemplateRecord(
  input: CreateDocumentTemplateInput,
): Promise<DocumentTemplate | null> {
  const { data, error } = await db()
    .from("document_templates")
    .insert({
      org_id: input.org_id ?? null,
      document_key: input.document_key,
      display_name: input.display_name,
      description: input.description ?? null,
      docuseal_template_id: input.docuseal_template_id ?? null,
      signer_roles: input.signer_roles,
      requires_countersignature: input.requires_countersignature,
      gate_step: input.gate_step ?? null,
      is_system: false,
      is_active: false,
      source_html: input.source_html ?? null,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[document-templates] create:", error.message);
    return null;
  }
  return data as DocumentTemplate;
}
```

- [ ] **Step 6: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `source_html`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/admin/document-templates-types.ts \
        apps/web/src/lib/admin/document-templates.ts
git commit -m "feat: add source_html to DocumentTemplate type and DB helpers"
```

---

## Task 3: Install Plate.js packages

**Files:**
- `apps/web/package.json` (updated by pnpm)

- [ ] **Step 1: Install packages**

```bash
cd apps/web && pnpm add @udecode/plate @udecode/plate-html
```

Expected: packages appear in `package.json` dependencies.

- [ ] **Step 2: Verify installation**

```bash
ls apps/web/node_modules/@udecode/ | grep -E "^plate$|^plate-html$"
```

Expected: both `plate` and `plate-html` directories listed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat: add @udecode/plate and @udecode/plate-html dependencies"
```

---

## Task 4: Server actions for HTML editor

**Files:**
- Create: `apps/web/src/app/(admin)/admin/paperwork/templates/html-actions.ts`

- [ ] **Step 1: Create `html-actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTemplateFromHtml } from "@/lib/signing/docuseal";
import {
  createDocumentTemplateRecord,
  updateDocumentTemplateRecord,
  getDocumentTemplate,
} from "@/lib/admin/document-templates";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";

export type HtmlTemplateResult =
  | { ok: true; template: DocumentTemplate }
  | { ok: false; error: string };

async function requireAdmin(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin")
    return { error: "Admin access required." };
  return { error: null };
}

/**
 * Creates a document_templates row with source_html = '' (empty string, not
 * null) so the Write tab appears immediately. No DocuSeal template is created
 * here; that happens when the admin saves content from the Plate editor.
 */
export async function createHtmlTemplateRecord(
  formData: FormData,
): Promise<HtmlTemplateResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const documentKey = (formData.get("document_key") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || undefined;
  const signerRolesRaw = formData.get("signer_roles") as string | null;
  const requiresCounter = formData.get("requires_countersignature") === "true";
  const gateStepRaw = formData.get("gate_step") as string | null;

  if (!displayName || !documentKey) {
    return { ok: false, error: "Display name and document key are required." };
  }
  if (!/^[a-z0-9_]+$/.test(documentKey)) {
    return {
      ok: false,
      error: "Document key must be lowercase letters, numbers, and underscores only.",
    };
  }

  const signerRoles: string[] = signerRolesRaw
    ? (JSON.parse(signerRolesRaw) as string[])
    : ["Owner"];
  if (signerRoles.length === 0) {
    return { ok: false, error: "At least one signer role is required." };
  }
  const gateStep =
    gateStepRaw && gateStepRaw !== "" ? parseInt(gateStepRaw, 10) : undefined;

  const record = await createDocumentTemplateRecord({
    document_key: documentKey,
    display_name: displayName,
    description,
    signer_roles: signerRoles,
    requires_countersignature: requiresCounter,
    gate_step: gateStep,
    source_html: "",
  });

  if (!record) {
    return {
      ok: false,
      error: "Could not save the template record. The document key may already exist.",
    };
  }

  revalidatePath("/admin/paperwork/templates");
  return { ok: true, template: record };
}

/** Legal document shell: matches the CSS aesthetic from `authority-addendum-html.ts`. */
function wrapInDocumentShell(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #1a1a1a;
    padding: 56px 72px;
    max-width: 800px;
    margin: 0 auto;
  }
  h1, h2, h3 {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    margin-top: 24px;
    margin-bottom: 8px;
  }
  h1 { font-size: 17pt; text-transform: uppercase; letter-spacing: -0.3px; }
  h2 { font-size: 13pt; }
  h3 { font-size: 11pt; }
  p { margin-bottom: 12px; }
  ul, ol { margin: 0 0 12px 24px; }
  li { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-size: 10.5pt; }
  th { background: #1a1a1a; color: #fff; text-align: left; padding: 8px 12px;
       font-family: Arial, sans-serif; font-size: 9pt; font-weight: 700;
       text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  u { text-decoration: underline; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Called by TemplateEditor when the admin clicks "Save Document."
 * Wraps the Plate-serialized HTML fragment in the document shell, creates a
 * fresh DocuSeal template, and updates both docuseal_template_id and
 * source_html in the DB. Returns the new DocuSeal template ID so the client
 * can switch to the Fields tab.
 *
 * Note: Creating a new DocuSeal template on each save resets field positions.
 * The admin must re-place fields in the DocuSeal builder after any content
 * change. The client shows a warning banner for this.
 */
export async function saveTemplateHtmlAction(
  templateId: string,
  htmlFragment: string,
): Promise<{ ok: true; newDocusealId: number } | { ok: false; error: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  if (!templateId?.trim()) return { ok: false, error: "Invalid template ID." };

  const template = await getDocumentTemplate(templateId);
  if (!template) return { ok: false, error: "Template not found." };
  if (template.source_html === null) {
    return { ok: false, error: "This template is not an HTML document." };
  }

  const fullHtml = wrapInDocumentShell(htmlFragment);
  const result = await createTemplateFromHtml(template.display_name, fullHtml);
  if (!result) {
    return {
      ok: false,
      error: "Could not create the DocuSeal template. Check DOCUSEAL_API_TOKEN in Doppler.",
    };
  }

  const ok = await updateDocumentTemplateRecord(templateId, {
    source_html: htmlFragment,
    docuseal_template_id: result.templateId,
  });

  if (!ok) {
    return {
      ok: false,
      error: "DocuSeal template created but the DB update failed. Try saving again.",
    };
  }

  revalidatePath("/admin/paperwork/templates");
  revalidatePath(`/admin/paperwork/templates/${templateId}`);
  return { ok: true, newDocusealId: result.templateId };
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `html-actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(admin)/admin/paperwork/templates/html-actions.ts
git commit -m "feat: add createHtmlTemplateRecord and saveTemplateHtmlAction"
```

---

## Task 5: TemplateEditor component

**Files:**
- Create: `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/TemplateEditor.tsx`
- Create: `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/TemplateEditor.module.css`

Context: Plate.js is a rich text editor framework for React. The pattern used here is:
1. Create an editor instance with `usePlateEditor` (hook, runs inside a component).
2. Wrap content in `<Plate editor={editor}>`.
3. Render the editable area with `<PlateContent>`.
4. Read content via `editor.children` (Plate AST); serialize to HTML with `serializeHtml`.
5. Load existing HTML with `deserializeHtml` to get initial Plate nodes.

**Before writing this file**, look up the current Plate.js API via context7:
```
Use mcp__plugin_context7_context7__resolve-library-id with library "@udecode/plate"
Then mcp__plugin_context7_context7__query-docs for "usePlateEditor PlateContent serializeHtml deserializeHtml"
```

Implement based on the docs. The structure below shows what to build; verify exact import paths from the docs before writing.

- [ ] **Step 1: Create `TemplateEditor.module.css`**

```css
.editorWrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-warm-gray-50);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 8px 16px;
  background: var(--color-surface, #fff);
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.toolbarDivider {
  width: 1px;
  height: 18px;
  background: #e5e7eb;
  margin: 0 4px;
}

.toolbarBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-sans);
  transition: background 0.12s, color 0.12s;
}

.toolbarBtn:hover {
  background: var(--color-warm-gray-50);
  color: var(--color-text-primary);
}

.toolbarBtn:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 1px;
}

.toolbarBtnActive {
  background: color-mix(in srgb, var(--color-brand) 12%, transparent);
  color: var(--color-brand);
}

.toolbarHeading {
  width: auto;
  padding: 0 8px;
  font-size: 11px;
}

.saveArea {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.dirtyDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-brand);
  flex-shrink: 0;
}

.saveBtn {
  height: 30px;
  padding: 0 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-brand);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: opacity 0.12s;
}

.saveBtn:hover { opacity: 0.88; }
.saveBtn:disabled { opacity: 0.5; cursor: not-allowed; }

.canvas {
  flex: 1;
  overflow-y: auto;
  padding: 40px 0;
  display: flex;
  justify-content: center;
}

.page {
  width: 780px;
  min-height: 1010px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06);
  border-radius: 2px;
  padding: 56px 72px;
}

.warning {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: #92400e;
  margin-bottom: 8px;
}

.error {
  padding: 8px 12px;
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-error) 25%, transparent);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-error);
}

/* Plate editor content styles inside the page canvas */
.page :global([data-slate-editor]) {
  outline: none;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 11pt;
  line-height: 1.65;
  color: #1a1a1a;
}

.page :global(h1) {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 17pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: -0.3px;
  margin-top: 24px;
  margin-bottom: 8px;
}

.page :global(h2) {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13pt;
  font-weight: 700;
  margin-top: 20px;
  margin-bottom: 8px;
}

.page :global(h3) {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11pt;
  font-weight: 700;
  margin-top: 16px;
  margin-bottom: 6px;
}

.page :global(p) {
  margin-bottom: 12px;
}

.page :global(ul),
.page :global(ol) {
  margin: 0 0 12px 24px;
}

.page :global(li) {
  margin-bottom: 4px;
}

.page :global(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 20px;
  font-size: 10.5pt;
}

.page :global(th) {
  background: #1a1a1a;
  color: #fff;
  text-align: left;
  padding: 8px 12px;
  font-family: Arial, sans-serif;
  font-size: 9pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.page :global(td) {
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}
```

- [ ] **Step 2: Create `TemplateEditor.tsx`**

First look up the exact Plate.js API for the installed version using context7. Then implement the component with this structure:

```typescript
"use client";

/**
 * TemplateEditor — Plate.js rich text editor for HTML-authored document
 * templates. Write tab only. The Fields tab (DocuSeal builder) handles
 * all signature/field placement after content is saved here.
 *
 * Save flow:
 * 1. Serialize Plate AST to HTML fragment via serializeHtml.
 * 2. Call saveTemplateHtmlAction (server action) which wraps the fragment in
 *    the document shell and creates a new DocuSeal template.
 * 3. Update local state to clear dirty flag and store the new docuseal ID.
 *
 * On subsequent saves: a new DocuSeal template is always created, which
 * resets field positions. A warning banner communicates this to the admin.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  // Import from @udecode/plate/react — verify exact paths from installed version
  Plate,
  PlateContent,
  usePlateEditor,
  // Plugins — verify from @udecode/plate docs
  ParagraphPlugin,
} from "@udecode/plate/react";
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
} from "@udecode/plate-basic-marks/react";
import { HeadingPlugin } from "@udecode/plate-heading/react";
import { ListPlugin } from "@udecode/plate-list/react";
import { TablePlugin } from "@udecode/plate-table/react";
import { serializeHtml, deserializeHtml } from "@udecode/plate-html";
import {
  TextB,
  TextItalic,
  TextUnderline,
  ListBullets,
  ListNumbers,
  Table,
  Warning,
} from "@phosphor-icons/react";
import { saveTemplateHtmlAction } from "./html-actions";
import styles from "./TemplateEditor.module.css";

const PLUGINS = [
  ParagraphPlugin,
  HeadingPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  ListPlugin,
  TablePlugin,
];

function getInitialValue(initialHtml: string) {
  // Empty string means brand new document — start with an empty paragraph.
  if (!initialHtml) {
    return [{ type: "p", children: [{ text: "" }] }];
  }
  // Deserialize existing HTML back to Plate nodes.
  // deserializeHtml returns an array of Plate node objects.
  const div = document.createElement("div");
  div.innerHTML = initialHtml;
  return deserializeHtml(div);
}

export function TemplateEditor({
  templateId,
  initialHtml,
  hasExistingDocusealId,
}: {
  templateId: string;
  initialHtml: string;
  hasExistingDocusealId: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedDocusealId, setSavedDocusealId] = useState<number | null>(null);

  // usePlateEditor — creates and memoizes the editor instance.
  // Verify this hook name against the installed @udecode/plate version.
  const editor = usePlateEditor({
    plugins: PLUGINS,
    // NOTE: initialValue must be set on the editor before first render.
    // deserializeHtml runs in a useEffect so the div is available in browser.
  });

  // Warn before navigating away with unsaved changes.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      // serializeHtml converts Plate AST to an HTML string.
      // The exact API depends on the Plate version — verify from docs.
      const html = serializeHtml(editor);
      const result = await saveTemplateHtmlAction(templateId, html);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setDirty(false);
      setSavedDocusealId(result.newDocusealId);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // Toolbar button helper
  function ToolBtn({
    label,
    active,
    onClick,
    children,
  }: {
    label: string;
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        className={`${styles.toolbarBtn} ${active ? styles.toolbarBtnActive : ""}`}
        aria-label={label}
        aria-pressed={active}
        onMouseDown={(e) => {
          // Prevent focus loss from the editor
          e.preventDefault();
          onClick();
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={styles.editorWrap}>
      <Plate
        editor={editor}
        onChange={() => setDirty(true)}
      >
        <div className={styles.toolbar}>
          {/* Heading level buttons */}
          {(["h1", "h2", "h3"] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={`${styles.toolbarBtn} ${styles.toolbarHeading}`}
              aria-label={`Heading ${level.slice(1)}`}
              onMouseDown={(e) => {
                e.preventDefault();
                // Toggle heading block type — verify the exact toggle API from docs
                // e.g.: editor.tf.toggleBlock({ type: level })
              }}
            >
              {level.toUpperCase()}
            </button>
          ))}

          <span className={styles.toolbarDivider} aria-hidden />

          <ToolBtn
            label="Bold"
            onClick={() => {
              // editor.tf.toggleMark({ type: "bold" }) — verify from docs
            }}
          >
            <TextB size={14} weight="bold" />
          </ToolBtn>
          <ToolBtn
            label="Italic"
            onClick={() => {
              // editor.tf.toggleMark({ type: "italic" }) — verify from docs
            }}
          >
            <TextItalic size={14} weight="bold" />
          </ToolBtn>
          <ToolBtn
            label="Underline"
            onClick={() => {
              // editor.tf.toggleMark({ type: "underline" }) — verify from docs
            }}
          >
            <TextUnderline size={14} weight="bold" />
          </ToolBtn>

          <span className={styles.toolbarDivider} aria-hidden />

          <ToolBtn
            label="Bulleted list"
            onClick={() => {
              // Verify list toggle API from docs
            }}
          >
            <ListBullets size={14} weight="bold" />
          </ToolBtn>
          <ToolBtn
            label="Numbered list"
            onClick={() => {
              // Verify list toggle API from docs
            }}
          >
            <ListNumbers size={14} weight="bold" />
          </ToolBtn>
          <ToolBtn
            label="Insert table"
            onClick={() => {
              // Verify table insert API from docs
            }}
          >
            <Table size={14} weight="bold" />
          </ToolBtn>

          <div className={styles.saveArea}>
            {dirty && <span className={styles.dirtyDot} aria-label="Unsaved changes" />}
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? "Saving…" : "Save Document"}
            </button>
          </div>
        </div>

        {(hasExistingDocusealId || savedDocusealId !== null) && dirty && (
          <div className={styles.warning}>
            <Warning size={14} weight="fill" />
            Saving will reset field positions. Review the Fields tab after saving.
          </div>
        )}

        {saveError && <div className={styles.error}>{saveError}</div>}

        <div className={styles.canvas}>
          <div className={styles.page}>
            <PlateContent
              placeholder="Start writing your document…"
              aria-label="Document editor"
            />
          </div>
        </div>
      </Plate>
    </div>
  );
}
```

**IMPORTANT:** Before committing this file, look up the exact Plate.js v45 APIs for:
- `usePlateEditor` hook (or equivalent)
- `editor.tf.toggleBlock` / `editor.tf.toggleMark` (or equivalent)
- `serializeHtml(editor)` signature
- `deserializeHtml(element)` signature
- List toggle API for `ListPlugin`
- Table insert API for `TablePlugin`

Use `mcp__plugin_context7_context7__resolve-library-id` with `@udecode/plate` and then `mcp__plugin_context7_context7__query-docs` for each.

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | head -40
```

Fix any type errors before committing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(admin)/admin/paperwork/templates/\[id\]/TemplateEditor.tsx \
        apps/web/src/app/(admin)/admin/paperwork/templates/\[id\]/TemplateEditor.module.css
git commit -m "feat: add Plate.js TemplateEditor component for HTML document authoring"
```

---

## Task 6: SignatureTemplateDetail — Write tab

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/SignatureTemplateDetail.tsx`
- Modify: `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/page.tsx`

- [ ] **Step 1: Update `TabKey` type and tab list**

In `SignatureTemplateDetail.tsx`, change:

```typescript
type TabKey = "fields" | "settings";
```
to:
```typescript
type TabKey = "write" | "fields" | "settings";
```

Update the `tabs` array inside `SignatureTemplateDetail` (currently hardcoded). Make it conditional on `source_html`:

```typescript
// props add source_html
export function SignatureTemplateDetail({
  template,
  initialTab,
  missingRoles,
  hasBeenSent,
}: {
  template: DocumentTemplate;
  initialTab: TabKey;
  missingRoles: string[] | null;
  hasBeenSent: boolean;
}) {
  // ...
  const tabs: Array<{ key: TabKey; label: string }> = [
    ...(template.source_html !== null ? [{ key: "write" as const, label: "Write" }] : []),
    { key: "fields", label: "Fields" },
    { key: "settings", label: "Settings" },
  ];
```

- [ ] **Step 2: Add Write tab render in the content area**

Find the `<div className={styles.content}>` block and add Write tab rendering before the existing `{tab === "fields" && ...}` block:

```tsx
{tab === "write" && (
  <TemplateEditor
    templateId={template.id}
    initialHtml={template.source_html ?? ""}
    hasExistingDocusealId={template.docuseal_template_id !== null}
  />
)}
```

Add the import at the top of the file:
```typescript
import { TemplateEditor } from "./TemplateEditor";
```

- [ ] **Step 3: Gate the Fields tab for HTML templates without a DocuSeal ID**

Find the section:
```tsx
{tab === "fields" &&
  (template.docuseal_template_id ? (
    <DocuSealBuilderView ... />
  ) : (
    <div className={styles.builderEmpty}>
      <FilePdf size={40} weight="duotone" />
      <p className={styles.builderEmptyTitle}>No PDF uploaded yet</p>
      ...
    </div>
  ))}
```

Replace the else branch with a two-case check:
```tsx
{tab === "fields" &&
  (template.docuseal_template_id ? (
    <DocuSealBuilderView
      templateId={template.docuseal_template_id}
      dbTemplateId={template.id}
    />
  ) : template.source_html !== null ? (
    <div className={styles.builderEmpty}>
      <PencilSimple size={40} weight="duotone" />
      <p className={styles.builderEmptyTitle}>Write the document first</p>
      <p className={styles.builderEmptyBody}>
        Save your document content on the Write tab. Field placement
        opens here automatically after saving.
      </p>
    </div>
  ) : (
    <div className={styles.builderEmpty}>
      <FilePdf size={40} weight="duotone" />
      <p className={styles.builderEmptyTitle}>No PDF uploaded yet</p>
      <p className={styles.builderEmptyBody}>
        This template has no document behind it. Use the New document
        button and choose Upload a PDF to create a fresh template with
        a field layout.
      </p>
    </div>
  ))}
```

Add `PencilSimple` to the Phosphor imports at the top (it is already imported elsewhere in the file — verify before adding a duplicate).

- [ ] **Step 4: Update `page.tsx` — recognize `?tab=write`**

In `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/page.tsx`, find:

```typescript
const initialTab = tab === "settings" ? "settings" : "fields";
```

Replace with:
```typescript
const initialTab =
  tab === "write" && template.source_html !== null
    ? "write"
    : tab === "settings"
    ? "settings"
    : "fields";
```

Also update the `SignatureTemplateDetail` prop type annotation in this file if TypeScript requires it (it will pick up the new `TabKey` union automatically since it imports from the component).

- [ ] **Step 5: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(admin)/admin/paperwork/templates/\[id\]/SignatureTemplateDetail.tsx \
        apps/web/src/app/(admin)/admin/paperwork/templates/\[id\]/page.tsx
git commit -m "feat: add Write tab to SignatureTemplateDetail for HTML templates"
```

---

## Task 7: CreateTemplateModal — HTML creation mode

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/paperwork/templates/CreateTemplateModal.tsx`
- Modify: `apps/web/src/app/(admin)/admin/paperwork/PaperworkShell.tsx`

- [ ] **Step 1: Add `"html"` docMode to the modal**

In `CreateTemplateModal.tsx`, change the `docMode` state:

```typescript
const [docMode, setDocMode] = useState<"upload" | "write" | "html">("upload");
```

- [ ] **Step 2: Import `createHtmlTemplateRecord`**

Add to the existing action imports:
```typescript
import {
  uploadAndCreateTemplate,
  createWrittenTemplate,
  checkDocumentKeyAvailable,
} from "./template-actions";
import { createHtmlTemplateRecord } from "./html-actions";
```

- [ ] **Step 3: Add "HTML document" tab to the mode toggle**

Find the `<div className={styles.modeToggle}>` block. Add a third button after the existing two:

```tsx
<button
  type="button"
  role="tab"
  aria-selected={docMode === "html"}
  className={`${styles.modeBtn} ${docMode === "html" ? styles.modeActive : ""}`}
  onClick={() => setDocMode("html")}
>
  HTML document
</button>
```

- [ ] **Step 4: Add step 2 content for `"html"` mode**

In the `<AnimatePresence>` step 2 pane, inside the `docMode` conditionals, add the "html" branch. Find the block that starts with:

```tsx
{docMode === "write" ? (
  <div className={styles.writeWrap}>
```

Add `html` mode as the first case:

```tsx
{docMode === "html" ? (
  <div className={styles.writeWrap}>
    <p className={styles.hint}>
      You will write this document in the full editor after creating it. The
      editor opens on the next screen with a blank canvas.
    </p>
  </div>
) : docMode === "write" ? (
  // existing textarea block unchanged
  ...
) : pdfUrl ? (
  // existing PDF preview
  ...
) : (
  // existing upload zone
  ...
)}
```

- [ ] **Step 5: Update `canBuild` to handle `"html"` mode**

Find:
```typescript
const canBuild = docMode === "upload" ? pdfFile !== null : bodyText.trim() !== "";
```

Replace with:
```typescript
const canBuild =
  docMode === "upload"
    ? pdfFile !== null
    : docMode === "write"
    ? bodyText.trim() !== ""
    : true; // "html" mode: no content required in the modal
```

- [ ] **Step 6: Update `handleBuild` to call `createHtmlTemplateRecord` for html mode**

Find the block inside `handleBuild`:
```typescript
let result;
if (docMode === "upload" && pdfFile) {
  formData.set("pdf", pdfFile);
  result = await uploadAndCreateTemplate(formData);
} else {
  formData.set("body_text", bodyText.trim());
  result = await createWrittenTemplate(formData);
}
```

Replace with:
```typescript
let result;
if (docMode === "upload" && pdfFile) {
  formData.set("pdf", pdfFile);
  result = await uploadAndCreateTemplate(formData);
} else if (docMode === "write") {
  formData.set("body_text", bodyText.trim());
  result = await createWrittenTemplate(formData);
} else {
  // "html" mode: create the DB record only; editor opens on the detail page.
  result = await createHtmlTemplateRecord(formData);
}
```

- [ ] **Step 7: Update button label for "html" mode**

Find the "Build template" button in the footer:
```tsx
{submitting ? (
  <>
    <SpinnerGap size={14} weight="bold" className={styles.spin} /> Building…
  </>
) : (
  "Build template"
)}
```

Replace with:
```tsx
{submitting ? (
  <>
    <SpinnerGap size={14} weight="bold" className={styles.spin} />
    {docMode === "html" ? "Creating…" : "Building…"}
  </>
) : docMode === "html" ? (
  "Create document"
) : (
  "Build template"
)}
```

- [ ] **Step 8: Update `PaperworkShell.handleTemplateCreated` to navigate to Write tab**

In `PaperworkShell.tsx`, find `handleTemplateCreated`:
```typescript
function handleTemplateCreated(template: DocumentTemplate) {
  setTemplateModalOpen(false);
  router.push(`/admin/paperwork/templates/${template.id}`);
}
```

Replace with:
```typescript
function handleTemplateCreated(template: DocumentTemplate) {
  setTemplateModalOpen(false);
  const suffix = template.source_html !== null ? "?tab=write" : "";
  router.push(`/admin/paperwork/templates/${template.id}${suffix}`);
}
```

- [ ] **Step 9: Reset `docMode` in `resetAndClose`**

In `resetAndClose`, find the line `setDocMode("upload");` — it already exists. Verify it is there (no change needed if it is).

- [ ] **Step 10: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/(admin)/admin/paperwork/templates/CreateTemplateModal.tsx \
        apps/web/src/app/(admin)/admin/paperwork/PaperworkShell.tsx
git commit -m "feat: add HTML document mode to CreateTemplateModal, navigate to Write tab on create"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 2: Lint**

```bash
cd apps/web && pnpm lint 2>&1 | head -30
```

Expected: no new lint errors.

- [ ] **Step 3: Confirm migration column**

```sql
select column_name from information_schema.columns
where table_name = 'document_templates' and column_name = 'source_html';
```

Expected: one row.

- [ ] **Step 4: Smoke test the create flow (manual)**

1. Start dev server: `cd apps/web && doppler run -- next dev -p 4000`
2. Log in at `http://localhost:4000/api/dev/auth`
3. Navigate to `http://localhost:4000/admin/paperwork/templates`
4. Click "New template"
5. Fill in Step 1 (name, key, signer)
6. In Step 2, click "HTML document" tab
7. Click "Create document"
8. Verify: lands on `/admin/paperwork/templates/[id]?tab=write` with Write tab active
9. Type some text in the editor
10. Click "Save Document"
11. Verify: success, no error, Fields tab becomes accessible

- [ ] **Step 5: Final commit**

```bash
git commit --allow-empty -m "feat: Plate.js HTML document editor — complete"
```

(Only run the empty commit if all prior tasks already committed their own changes.)

---

## Self-Review Checklist

**Spec coverage:**
- [x] Write tab shown when `source_html !== null` — Task 6
- [x] Fields tab gated until `docuseal_template_id` is set — Task 6 Step 3
- [x] Save creates DocuSeal template + stores HTML — Task 4
- [x] Re-save creates new DocuSeal template (resets fields) — Task 4
- [x] Warning banner shown when re-saving over existing DocuSeal ID — Task 5 Step 2
- [x] "HTML document" mode in CreateTemplateModal — Task 7
- [x] Navigate to `?tab=write` after creating HTML template — Task 7 Step 8
- [x] Page.tsx recognizes `?tab=write` — Task 6 Step 4
- [x] `source_html` column in DB — Task 1
- [x] Type updates — Task 2
- [x] Package install — Task 3
- [x] Fields tab shows correct empty state for HTML vs PDF — Task 6 Step 3

**Type consistency:**
- `saveTemplateHtmlAction` returns `{ ok: true; newDocusealId: number } | { ok: false; error: string }` — matches usage in `TemplateEditor.tsx`
- `createHtmlTemplateRecord` returns `HtmlTemplateResult` — matches usage in modal
- `source_html: string | null` in `DocumentTemplate` — used consistently throughout
- `TabKey = "write" | "fields" | "settings"` — used consistently in `SignatureTemplateDetail` and `page.tsx`
