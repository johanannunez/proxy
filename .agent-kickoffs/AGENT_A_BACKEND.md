# Agent A Kickoff: Parcel Backend & Data

You are Agent A. Your queue is the **Parcel: Agent A Backend** Todoist project: 7 backend / SQL / data tasks. Pure code and migrations, no UI.

**Todoist project:** https://app.todoist.com/app/project/parcel-agent-a-backend-6gchfMQP5W93ghgX

## Setup (do these first, in order)

1. Working directory: `/Users/johanannunez/workspace/parcel/`
2. Read `/Users/johanannunez/workspace/.claude/CLAUDE.md` (workspace rules)
3. Read `/Users/johanannunez/workspace/parcel/CLAUDE.md` (project rules) and `/Users/johanannunez/workspace/parcel/AGENTS.md`
4. Read `/Users/johanannunez/.claude/projects/-Users-johanannunez/memory/MEMORY.md`
5. Check Doppler is wired: `doppler secrets --project parcel --config dev --only-names | head -5`
6. Confirm Supabase MCP works: list_tables for project ref `pwoxwpryummqeqsxdgyc`
7. Get Todoist API token: `doppler secrets get TODOIST_API_KEY --project parcel --config prd --plain`

## Required reading before any code

- The project's Supabase schema and existing RLS patterns
- `apps/web/src/lib/treasury/encryption.ts` (you will refactor this)
- `apps/web/src/lib/admin/` and `apps/web/src/lib/portal/` (Supabase client patterns)
- Existing migrations in `supabase/migrations/`

## Task order (DO NOT skip ahead, dependencies are real)

1. **1.7 RLS hardening** independent, do first to surface any data model surprises
2. **Encryption refactor** must ship before Tax data foundation, exposes `encryptWith` / `decryptWith` and adds `TAX_ENCRYPTION_KEY`
3. **Tax data foundation** depends on Encryption refactor for `TAX_ENCRYPTION_KEY`
4. **1.8 help_articles migration** independent, can be sequenced anywhere
5. **1.9 W-9 encryption + audit log** depends on Tax data foundation (uses `w9_access_log` table)
6. **2.5 Owner W-9 flow** depends on 1.9 (storage bucket + audit log must exist)
7. **2.7 Owner financial invoices surface** independent, do last

Open each Todoist task, read the description (File(s), Acceptance, Verification, Steps), then execute.

## Workflow per task

1. Read the Todoist task description in full
2. Read every file path it mentions before writing code
3. Branch: `git checkout -b agent-a/<task-slug>` from `main`
4. Implement
5. **Run `/review` skill before opening PR** (this is mandatory per workspace CLAUDE.md)
6. Open a PR, title matching the Todoist task content
7. Mark Todoist task complete via API:
   ```bash
   TOKEN=$(doppler secrets get TODOIST_API_KEY --project parcel --config prd --plain)
   curl -X POST "https://api.todoist.com/api/v1/tasks/<task_id>/close" -H "Authorization: Bearer $TOKEN"
   ```
8. Add a Todoist comment with the PR URL on the closed task

## Conventions you MUST follow

- **No em dashes, en dashes, or double hyphens as punctuation.** Use periods, commas, colons, semicolons, parens. Single hyphens only in compound words and CSS properties.
- **No `any`, no `@ts-ignore`.** Strict TypeScript.
- **No new SUPABASE_SECRET_KEY usage** without an explicit owner-id filter and a one-line comment explaining why the bypass is safe. (Note: env vars were renamed from `SUPABASE_SERVICE_ROLE_KEY` -> `SUPABASE_SECRET_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` after the project migrated off legacy JWT-based API keys. Use the new names in any new code.)
- **Schema changes batched.** If a task needs SQL, ask Johan before sending him to Supabase. Combine all SQL for the feature into one numbered SQL block. Never send him to Supabase more than once per feature.
- **No silent fallbacks.** Every error path either surfaces to the caller or writes to Sentry.
- **Commit messages describe WHY, not what.**

## Out of scope

- Any UI / React component work (Agent B owns that)
- Anything in `Parcel: Jo External Setup` (Stripe live mode, Resend DNS, Supabase PITR, Auth URL, uptime monitoring) Johan does those manually in dashboards
- Anything in `Parcel: Polish and SEO` or `Parcel: Final QA and Launch`

## When to escalate

- Task description references a file or table that doesn't exist
- A migration would touch production data without a clear rollback path
- An RLS change would break an existing portal flow
- Anything ambiguous about acceptance criteria

Drop a Todoist comment on the task and wait for Johan to respond. Do not guess.
