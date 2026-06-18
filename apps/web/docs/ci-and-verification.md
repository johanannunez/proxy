# CI, verification, and "don't let PRs land red"

This repo had a PR (#45) sit with a red status that was hard to read: some
checks were failing for **pre-existing** reasons (dependency vulnerabilities,
a CodeQL alert backlog) while the actual feature was green, and a Vercel
preview deploy was failing for an **account/integration** reason rather than a
code defect. This guide is how to keep the signal trustworthy so "done" means
"verified."

## 1. Verify locally before every push

These three commands are the real gates. They need **no secrets** (only
`dev`/`start` use Doppler), so they run anywhere:

```bash
pnpm install --frozen-lockfile
pnpm --filter web build            # next build
pnpm --filter web exec tsc --noEmit
pnpm --filter web lint             # eslint
pnpm audit --audit-level=high      # security gate (see §4)
```

There is no unit-test suite today (only Playwright e2e, which needs a running
app). If/when one is added, wire it in here and as a required check.

## 2. Make CI checks *required* (branch protection)

The most important change: a PR should not be mergeable while red. In GitHub →
**Settings → Branches → Add branch ruleset** for `main`:

- **Require a pull request before merging** ✔
- **Require status checks to pass** ✔ — add these as required:
  - `Analyze (javascript-typescript)` (CodeQL analysis)
  - `Dependency Audit`
  - `Vercel` (preview deployment) — see §5
  - any future `build` / `typecheck` / `lint` / `test` jobs
- **Require branches to be up to date before merging** ✔
- **Do not allow bypassing the above settings** (optional, stricter)

> Tip: the CI workflows run `build`/`tsc`/`lint` inside the `Analyze` and audit
> jobs today. Consider adding a dedicated `verify` workflow that runs the §1
> commands so each gate is its own clearly-named required check.

## 3. SessionStart hook (Claude Code on the web)

`.claude/hooks/session-start.sh` (+ `.claude/settings.json`) installs workspace
dependencies at session start so `build`/`tsc`/`lint` are ready immediately and
breakage is caught before a push. Once merged to the default branch, all future
web sessions use it.

```bash
#!/bin/bash
set -euo pipefail
cd "$CLAUDE_PROJECT_DIR"
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile || pnpm install
```

## 4. Dependency audit (`pnpm audit --audit-level=high`)

This gate fails the build on **high/critical** advisories. Transitive ones are
pinned to patched versions via `pnpm.overrides` in the root `package.json`:

```jsonc
"overrides": {
  "protobufjs": ">=8.0.2",
  "follow-redirects": ">=1.16.0",
  "dompurify": ">=3.4.0",
  "axios": ">=1.16.0",
  "fast-uri": ">=3.1.2",
  "next": ">=16.2.6"
}
```

When a new high advisory appears: run `pnpm audit --audit-level=high --json`,
find the package + patched version, add/raise an override (same major where
possible), `pnpm install`, then re-run the audit and `build` to confirm.

## 5. Vercel deploys — keep them robust

On PR #45 the feature's first commits deployed to `READY`; later commits failed
**instantly with no build logs**, which points to an account/integration-level
condition (usage/quota or the Git integration), not the code. To avoid this
masking real status:

- Turn on **Spend Management / usage notifications** in the Vercel dashboard so
  a quota-related failure is visible, not silent.
- Keep the **Vercel preview deploy as a required check** (§2) so a genuinely
  broken deploy blocks merge instead of being ignored.
- Avoid coupling product features to Vercel-plan-specific behavior — see §6.

## 6. Move scheduled work off Vercel cron → Supabase `pg_cron`

`apps/web/vercel.json` schedules `flush-scheduled-messages` every 5 minutes
(`*/5 * * * *`) — 288 runs/day and plan-frequency-dependent, unlike the other
four daily crons. Decouple it from Vercel by scheduling it in Postgres with
`pg_cron` + `pg_net`, which calls the existing endpoint. Apply in Supabase
(SQL editor or a migration) — **store the secret/URL, don't hardcode them**:

```sql
-- one-time: enable extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- every 5 minutes, POST the existing cron endpoint with the CRON_SECRET.
-- Set these once via:  alter database postgres set "app.cron_secret" = '...';
--                      alter database postgres set "app.app_url"     = 'https://www.theparcelco.com';
select cron.schedule(
  'flush-scheduled-messages',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := current_setting('app.app_url') || '/api/cron/flush-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret')
    )
  );
  $$
);
```

Then remove the `flush-scheduled-messages` entry from `vercel.json`. Now the
schedule lives in the database and survives Vercel deploy/plan issues entirely.
(The endpoint already authorizes via `CRON_SECRET` and fails closed when it is
unset.)

## 7. Automated PR review (Greptile / CodeRabbit / Copilot) — optional

These bots *review* diffs for bugs and post inline comments. They do **not**
build, test, or deploy — so they complement, but never replace, the CI gates in
§1–§5. The repo already has CodeQL + the dependency audit + on-demand Claude
Code review (`/code-review`). Add a standing review bot if you want hands-off
review on every PR (useful for AI-authored changes); prioritize the required
checks above first, since those are what actually *verify* a PR.
