# CLAUDE.md: Proxy

Workspace-wide rules in the parent CLAUDE.md apply as the base. This file adds project-specific details.

---

## Always Do First

- **Invoke `frontend-design` skill** before writing any frontend code. Never skip.
- **Invoke `ui-ux-pro-max` skill** before writing any frontend code. Run both together, not one instead of the other.

---

## Project Overview

**Proxy** (formerly Parcel) is a full-stack co-hosting and short-term rental management platform. Owners list properties; Proxy handles operations, documents, financials, and guest communication.

Production: https://www.myproxyhost.com (live). `theparcelco.com` is the legacy Parcel domain, now dropped and not attached to the live project (returns Vercel `DEPLOYMENT_NOT_FOUND`). Do not use it.
Vercel project: `proxy`
GitHub: `johanannunez/proxy`

---

## Commands

```bash
# From apps/web/ — always use Doppler for env
doppler run -- next dev -p 4000    # Dev server at localhost:4000
doppler run -- next build           # Production build
pnpm exec tsc --noEmit              # Type check (no pnpm typecheck script)
pnpm lint                           # ESLint
```

Run all commands from `apps/web/`. Doppler config (`.doppler.yaml`) lives there.
If Turbopack panics: `rm -rf .next`.

---

## Monorepo Structure

```
proxy/
  apps/web/         Next.js app (App Router)
  supabase/         Migrations (NOT apps/web/supabase/)
  scripts/          Utility scripts
  docs/plans/       Feature design docs and plans
```

---

## Stack

- **Next.js 16.2.4** with App Router, React 19.2.3, Server Components
- **TypeScript 5.9.3** strict mode, `@/*` path alias for `./src/*`
- **Tailwind v4** via `@import "tailwindcss"` in `globals.css`. Use CSS custom properties for tokens.
- **Supabase** for Postgres, auth, RLS. Project ref: `pwoxwpryummqeqsxdgyc`
- **`@supabase/ssr`** for server-side auth via cookies
- **shadcn/ui** for base UI primitives
- **motion/react** (NOT framer-motion) for animations
- **Phosphor Icons** (`@phosphor-icons/react`). Weights: `duotone` (feature), `regular` (inactive nav), `bold` (small UI).

---

## Route Groups

```
src/app/
  (admin)/          Admin panel — property management, financials, documents
  (marketing)/      Public marketing site, blog, landing pages
  (workspace)/      Owner portal
  api/              API routes
  auth/             Auth callbacks
```

---

## Architecture

### Data Fetching

- Pages are server components querying Supabase via `createClient()` from `@/lib/supabase/server`
- Mutations: server actions (`"use server"`) with `useActionState` on client, then `revalidatePath()`
- Admin uses service role client for queries that bypass RLS

### Supabase Clients

| File | Use |
|---|---|
| `@/lib/supabase/server` | Server Components, Server Actions, Route Handlers (respects RLS) |
| `@/lib/supabase/client` | Client Components (browser, respects RLS) |
| `@/lib/supabase/service` | Webhooks, cron, admin back-office (bypasses RLS) |
| `@/lib/supabase/untyped` | Raw queries where generated types are stale |

### Middleware

The middleware file is `src/proxy.ts` (NOT `middleware.ts`). It handles:
- CalDAV requests for Fantastical integration (`/caldav/*`, `/.well-known/caldav`)
- Supabase session refresh on every request
- Route protection: `/workspace/*` and `/admin/*` require auth
- Admin gate: `profiles.role === "admin"` required for `/admin/*`
- Post-login redirect: admins go to `/admin`, owners go to `/workspace/home`

### Auth Roles

Admin access is gated on `profiles.role = 'admin'` (checked in `src/proxy.ts`). Dev login shortcut: `http://localhost:4000/api/dev/auth`.

### CSS Modules

134 `.module.css` files exist throughout the codebase. Admin and workspace components use CSS Modules alongside Tailwind. When adding to existing components, match the pattern already in the file. Do not mix inline Tailwind classes into a component that uses a `.module.css` file.

### Key Lib Paths

```
src/lib/
  admin/            Admin DB helpers and types
  billing/          Stripe billing
  documents/        Signing orchestration, status model
  signing/          DocuSeal adapter + signature config
  supabase/         Supabase clients (server, client, service, untyped)
  treasury/         Financial helpers
  workspace/        Owner portal helpers
```

### Key Component Paths

```
src/components/
  admin/            Admin panel components
  admin/chrome/     Admin shell: TopBar, CommandPalette, CreateModal, SidebarDrawer, QuickCapture
  workspace/        Owner portal components
  (root)            Marketing site components (FrostedNav, PropertyCard, etc.)
```

---

## Database

Supabase project: `pwoxwpryummqeqsxdgyc`
Migrations: `supabase/migrations/` at monorepo root (NOT `apps/web/supabase/`).
Apply via: Supabase MCP `apply_migration` tool.

### Critical RLS Rules

- `for all` policy REQUIRES both `using (...)` AND `with check (...)`. A `for all` without `with check` silently blocks INSERT/UPDATE at runtime.
- Pattern: `using (auth.role() = 'service_role') with check (auth.role() = 'service_role')`

### Triggers

`public.set_updated_at()` is a shared function (defined in the initial schema migration). Use it for all `updated_at` triggers. Never create per-table trigger functions.

```sql
drop trigger if exists set_updated_at on <table>;
create trigger set_updated_at
  before update on <table>
  for each row execute function public.set_updated_at();
```

### Supabase-Generated Types

Auto-generated types don't include new columns. Cast through `any` when needed.

---

## Design System

All tokens in `src/app/globals.css`.

| Token | Value |
|---|---|
| `--color-brand` | #1b77be |
| `--color-brand-light` | #02aaeb |
| `--color-brand-gradient` | linear-gradient(135deg, #02aaeb, #1b77be) |
| `--color-text-primary` | #1a1a1a |
| `--color-text-secondary` | #6b7280 |
| `--color-warm-gray-50` | #f8f7f6 |
| `--color-navy` | #0f172a |
| `--color-charcoal` | #1e293b |
| `--color-success` | #16a34a |
| `--color-error` | #dc2626 |

Shadows: `--shadow-sm/md/lg/xl/card`
Radii: `--radius-sm(6px) / md(12px) / lg(16px) / xl(24px)`
Easing: `--ease-spring: cubic-bezier(0.16, 1, 0.3, 1)`

### Fonts

- **Geist** — primary body/UI font (`--font-sans`, loaded by default on `<html>`)
- **Sora** — headings (`--font-sora`)
- **Plus Jakarta Sans** — secondary body (`--font-plus-jakarta`)
- **General Sans** — local font (`--font-general-sans`)
- **IBM Plex Mono** — monospace/code (`--font-ibm-plex-mono`)

---

## Brand Guardrails

- Use ONLY the token palette from `globals.css`. Never default Tailwind colors (no indigo-500, blue-600).
- Shadows: `var(--shadow-*)` tokens only. Never flat `shadow-md`.
- Typography: Sora headings, Geist body. Tight tracking on headings, generous line-height on body.
- Animations: `transform` and `opacity` only. Never `transition-all`. Use `--ease-spring`.
- Every clickable element: hover, focus-visible, and active states.
- Surfaces: layered (base, elevated, floating). Not all at the same z-plane.

---

## DocuSeal Integration

- **Adapter:** `src/lib/signing/docuseal.ts` — submission + template creation functions
- **Template catalog:** `document_templates` Supabase table. `org_id=null` = system template.
- **Config:** `src/lib/signing/signature-config.ts` — `SIGNER_ROLE` + `COUNTERSIGNER_ROLE` constants only
- **Orchestration:** `src/lib/documents/signing.ts` — queries DB for template IDs
- **Status model:** `src/lib/documents/status.ts` — 9 states
- **Webhook:** `src/app/api/webhooks/docuseal/route.ts`
- **Gotcha:** `document_signers.boldsign_document_id` stores DocuSeal submission ID (legacy column name, do not rename)

Env vars: `DOCUSEAL_API_TOKEN`, `DOCUSEAL_WEBHOOK_SECRET`, `DOCUSEAL_COUNTERSIGNER_EMAIL`, `DOCUSEAL_COUNTERSIGNER_NAME`

---

## Env Vars

Managed via Doppler. Never use `.env` files directly. Always prefix commands with `doppler run --`.

Key var names:
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (not the usual Supabase naming)
- `OPENROUTER_API_PROXY` (was `OPENROUTER_API_PARCEL` — renamed)

---

## Gotchas

- **`import "server-only"`** on any module touching `createClient`. Client components need types from sibling `*-types.ts`.
- **`motion/react` not `framer-motion`.**
- **`transition-all` is banned.** Specific property transitions only.
- **No `pnpm typecheck` script.** Use `pnpm exec tsc --noEmit`.
- **Next.js `<Image>` cache** sets `immutable` headers. Replacing a file in `public/` does NOT bust cache. Rename the file to change the URL.
- **Trigger.dev is NOT in this repo.** Only in `mission-control/`. Use API routes + Vercel cron here.
- **Doppler CLI** must be run from `apps/web/` (where `.doppler.yaml` lives).
- **Never use `<select>` or `<input type="date">` directly.** Use `CustomSelect` and `DatePickerInput` from `@/components/admin/`.
- **Never use `confirm()`, `alert()`, or `prompt()`.** Use `ConfirmModal` (`src/components/admin/ConfirmModal.tsx`) for destructive confirmations.
- **Screenshot tool:** `node screenshot.mjs <url>` from the project root. Output to `temporary screenshots/`.

---

## Integrations

- **Hospitable** — property/reservation sync. Adapter: `src/lib/hospitable.ts`. Reconcile: `src/lib/hospitable-reconcile.ts`. Sync: `src/lib/hospitable-sync.ts`.
- **Stripe** — billing. Adapter: `src/lib/stripe.ts`. Billing helpers: `src/lib/billing/`.
- **PostHog** — analytics. Wrapped in `src/components/PostHogProvider.tsx`.
- **DocuSeal** — e-signatures. See DocuSeal Integration section above.
- **CalDAV** — Fantastical task sync. Handled entirely in `src/proxy.ts`.

---

## Model Routing and Delegation

Keep usage low without losing quality. (Also defined in the workspace base CLAUDE.md, repeated here for visibility.)

### Roles
- **Main session (executor):** Sonnet by default. Plans, routes, synthesizes. Does not do bulk mechanical work itself.
- **Advisor (verifier):** Fable 5, set with `/advisor`. Consulted before committing to an approach and before declaring a task complete. It reads the full transcript and returns guidance only. It cannot touch files or run commands. This is the quality gate, so do not add separate "remember to test" reminders.
- **Workers (subagents):** do the actual work on the cheapest model that fits the subtask.

### When to delegate
Spawn a worker for mechanical or bulk edits, scoped research, codebase search, and anything parallelizable. Each worker gets its own clean context. Do not spawn when the parent needs to hold the reasoning, when synthesis must stay in one head, or when spawn overhead dominates.

### Model per worker (cheapest that does the job well)
- `worker-haiku`: bulk mechanical work with no judgment (renames, find-and-replace, formatting, boilerplate).
- `worker-sonnet`: scoped research, code exploration, bounded edits, focused debugging.
- `heavy-context`: jobs too large for a normal worker (whole-repo reads, large-document analysis, long migrations). Runs on Opus, which is auto-upgraded to 1M context on Max, Team, and Enterprise plans. There is no automatic handoff when a smaller worker fills its context, so route here deliberately by size.

These three are defined in `.claude/agents/`. If they are missing, ask me to create them.

### Context hygiene
`/compact` after each completed task. `/clear` between unrelated tasks. Never carry a finished task's files and diffs into the next one. Sessions above 150k context are the main cost driver.

### Do not
- Do not set `CLAUDE_CODE_SUBAGENT_MODEL`. It overrides every worker's model and cancels the routing above.
- Do not skip the advisor consult on non-trivial tasks.
