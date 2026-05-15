# Agent B Kickoff: Parcel Frontend & UX

You are Agent B. Your queue is the **Parcel: Agent B Frontend** Todoist project: 16 UI/UX tasks across portal, admin, and marketing.

**Todoist project:** https://app.todoist.com/app/project/parcel-agent-b-frontend-6gchfPFcVP5JM8FV

## Setup (do these first, in order)

1. Working directory: `/Users/johanannunez/workspace/parcel/`
2. Read `/Users/johanannunez/workspace/.claude/CLAUDE.md` (workspace rules, the Premium Quality Standard section is non-negotiable)
3. Read `/Users/johanannunez/workspace/parcel/CLAUDE.md` (project rules) and `/Users/johanannunez/workspace/parcel/AGENTS.md`
4. Read `/Users/johanannunez/.claude/projects/-Users-johanannunez/memory/MEMORY.md`
5. Doppler check: `doppler secrets --project parcel --config dev --only-names | head -5`
6. Start the dev server: `pnpm --filter web dev` (port 4000 is hardcoded)
7. Sign the gstack browse daemon into admin: `pnpm dev-login` (idempotent, ~3s if cached)
8. Confirm admin is reachable: `~/.claude/skills/gstack/browse/dist/browse goto http://localhost:4000/admin` should land on `/admin`, not `/login`
9. Get Todoist API token: `doppler secrets get TODOIST_API_KEY --project parcel --config prd --plain`

## Required reading before any code

- `apps/web/src/components/admin/CustomSelect.tsx` (you will use this everywhere instead of native `<select>`)
- `apps/web/src/components/admin/DatePickerInput.tsx` (you will use this everywhere instead of `type="date"`)
- `apps/web/src/components/admin/ConfirmModal.tsx` (use this, never `confirm()` / `alert()` / `prompt()`)
- `apps/web/src/components/messages/RichTextEditor.tsx` (you will rebuild parts of this in Task 2.3)
- An existing portal page like `apps/web/src/app/(portal)/portal/dashboard/page.tsx` to study layout, color tokens, spacing

## Task order (some have dependencies, follow this)

1. **2.3 Productionize message rich text editor** builds `LinkInsertModal`. **Must be first** because Task 2.4 reuses it.
2. **2.4 Help article editor** reuses `LinkInsertModal` from 2.3
3. **2.1 Unblock setup hub** real completion state per step
4. **2.2 Replace fake document modal** delete placeholder fns, wire real audit log or empty state
5. **2.6 Host agreement signing fallback** three explicit states
6. **3.1 Prev/Next setup nav** affects every setup step page
7. **3.2 Replace 7 native type=date inputs** use `DatePickerInput` everywhere
8. **3.3 Real photo upload in PropertySettingsModal**
9. **3.4 Workspace tab placeholders** Documents, Settings tabs
10. **3.5 Project activity tab** build or remove
11. **3.6 Property defaults save**
12. **3.7 Admin payment W-9 actions**
13. **3.8 Block request errors vs empty states**
14. **3.9 Inline save errors on help article forms**
15. **3.10 Replace fake marketing testimonials** default decision: REMOVE
16. **3.11 Marketing calculator native selects** use `CustomSelect`

Open each Todoist task, read description (File(s), Acceptance, Verification, Steps), execute.

## Workflow per task

1. Read the Todoist task description in full
2. Read every file path it mentions before writing code
3. Branch: `git checkout -b agent-b/<task-slug>` from `main`
4. **Invoke `frontend-design` skill before writing UI code.** Never skip.
5. Implement
6. **Visual verification (mandatory):** capture before + after with gstack browse:
   ```bash
   B=~/.claude/skills/gstack/browse/dist/browse
   $B goto http://localhost:4000/<route>
   $B responsive /tmp/agent-b-<task>-before  # before changes
   # ... make changes, dev server hot-reloads ...
   $B responsive /tmp/agent-b-<task>-after
   ```
   Read both screenshot sets. Compare. Fix until premium.
7. **Run `/review` skill before opening PR** (mandatory)
8. Open a PR, title matching the Todoist task content. Attach desktop + mobile screenshots in the PR body.
9. Mark Todoist task complete via API:
   ```bash
   TOKEN=$(doppler secrets get TODOIST_API_KEY --project parcel --config prd --plain)
   curl -X POST "https://api.todoist.com/api/v1/tasks/<task_id>/close" -H "Authorization: Bearer $TOKEN"
   ```
10. Add a Todoist comment with the PR URL on the closed task

## Conventions you MUST follow (all hard rules from workspace CLAUDE.md)

- **No em dashes, en dashes, or double hyphens as punctuation.** Periods, commas, colons, semicolons, parens only.
- **NEVER use `<select>` or `<input type="date">` directly.** Always `CustomSelect` and `DatePickerInput`.
- **NEVER use `confirm()`, `alert()`, or `prompt()`.** Use `ConfirmModal` or inline state machines.
- **No `transition-all`.** Only `transform` and `opacity`. Spring or ease timing.
- **No default Tailwind colors** (indigo-500, blue-600). Parcel brand only: blue `#02AAEB` / `#1B77BE`, Poppins.
- **No "Coming soon" copy.** Either ship it or remove the surface.
- **No fake names, fake numbers, fake testimonials.** Empty state instead.
- **Premium aesthetic.** Pixel-perfect spacing, layered shadows, intentional typography. "Would a senior designer be proud of this?"
- **Mobile + desktop both verified** with gstack browse responsive captures.
- **No `any`, no `@ts-ignore`.**

## Out of scope

- Database schema or migrations (Agent A owns those)
- RLS policies, Supabase service role usage (Agent A)
- Anything in `Parcel: Jo External Setup` (Stripe / Resend / Supabase / monitoring)
- Anything in `Parcel: Polish and SEO` or `Parcel: Final QA and Launch`

## When to escalate

- Task references a backend table or function that doesn't exist (likely Agent A hasn't shipped it yet check Agent A's PRs first)
- A UI decision has multiple valid paths and the task description doesn't specify
- A flow requires a new Server Action that touches data not yet modeled
- A component pattern doesn't exist and you'd need to invent one

Drop a Todoist comment on the task and wait for Johan to respond. Do not guess.
