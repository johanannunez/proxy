# Database Backups and Disaster Recovery

How we back up Supabase Postgres for `pwoxwpryummqeqsxdgyc` (production), how to restore, and the runbook for the worst case.

## Backup layers

We rely on three independent layers so a single failure in any one does not wipe out our ability to recover.

| Layer | Frequency | Retention | Source of truth | Restore time | Cost |
|---|---|---|---|---|---|
| Supabase PITR (Point-in-Time Recovery) | Continuous WAL streaming | 7 days | Supabase managed storage | 5 to 15 min for a fresh branch | Included in Pro tier |
| Daily logical dump via Vercel Cron | 1x per day at 09:00 UTC | 30 days rolling | Supabase Storage `backups/` bucket (private, encrypted at rest) | 10 to 30 min once downloaded | Effectively free for our row count |
| Cross-region weekly archive | 1x per week, Sunday 09:00 UTC | 12 weeks rolling | A second region (Backblaze B2 or S3) | Hours, used only if the primary backups bucket is also gone | Pennies per month |

PITR is the primary recovery tool. The dumps exist so we can recover even if Supabase the company has a problem with our project's storage. The cross-region archive exists so we can recover even if our primary backups bucket is destroyed.

## PITR (Point-in-Time Recovery)

PITR is a Supabase Pro feature. As of writing the project is on the Free tier; PITR has to be enabled before this section is fully active.

**To enable:**

1. Open https://supabase.com/dashboard/project/pwoxwpryummqeqsxdgyc/settings/general
2. Upgrade to Pro (~$25/month base + small usage costs).
3. Open https://supabase.com/dashboard/project/pwoxwpryummqeqsxdgyc/database/backups
4. Toggle Point-in-Time Recovery on. Set retention to 7 days minimum (max 30).
5. Wait 24 hours for the first PITR window to fill, then proceed to the test restore below.

**To restore via PITR:**

1. Open https://supabase.com/dashboard/project/pwoxwpryummqeqsxdgyc/database/backups
2. Click "Create a new branch" with a "Point-in-time" recovery source. Pick the timestamp you want to recover to (down to the second within the retention window).
3. Supabase provisions a new branch with that exact state. The branch has its own database URL.
4. Spot-check the data on the branch.
5. To promote: take production into read-only mode (set a feature flag the app reads), `pg_dump` the affected tables from the recovery branch, `psql` them back into production, lift read-only. Or, for catastrophic loss, point the production app at the recovery branch's connection string and rename the branch to production.

**Test restore drill:**

Run a test restore every quarter. Document the date and outcome in this file under "History".

## Daily logical dump

A Vercel Cron job hits `/api/cron/db-backup` at 09:00 UTC daily. The handler shells out to `pg_dump` against the Supabase Postgres direct connection string, gzips the output, and uploads it to the `backups/` bucket in Supabase Storage.

The handler is implemented in `apps/web/src/app/api/cron/db-backup/route.ts` (to be added; not yet shipped).

**Required env vars** (set in Vercel Production + the Doppler `prd` config):

- `SUPABASE_DB_CONNECTION_STRING` — direct connection (not pooled) for `pg_dump`. Get from the Supabase dashboard under Project Settings > Database > Connection string > "Direct".
- `CRON_SECRET` — already set; the cron route validates this against the `Authorization` header Vercel Cron sends.

**Restore from dump:**

```bash
# Download the dump (private bucket; uses the signed-URL helper)
pnpm tsx scripts/download-backup.ts <YYYY-MM-DD>

# Apply against a fresh DB (or a Supabase branch)
gunzip -c <YYYY-MM-DD>.sql.gz | psql "$RESTORE_TARGET_URL"
```

**Retention:** the cron deletes dumps older than 30 days at the end of each run.

## Cross-region weekly archive

On Sunday at 09:00 UTC the cron uploads a copy of that day's dump to a second region (planned: Backblaze B2 in EU). Retention: 12 weekly dumps rolling. Restore steps are identical to the Supabase-bucket case, only the source location changes.

This layer is the "Supabase the company has a bad day" insurance. It has never been needed in practice; treat it as required hygiene rather than active operations.

## What to do in an outage

### Scenario A: someone ran a destructive query, lost a few rows or a single table

1. Note the approximate UTC timestamp of the bad change.
2. Open the PITR dashboard. Create a recovery branch 30 seconds before the bad timestamp.
3. From the recovery branch, `pg_dump` the affected rows or table.
4. Apply to production.
5. Total time: 10 to 20 minutes. No downtime.

### Scenario B: full database corruption or rollback needed

1. Take production into read-only mode (feature flag).
2. Create a PITR recovery branch at the last known good time.
3. Promote: rename the recovery branch to be production, retire the old DB.
4. Lift read-only.
5. Total time: 30 to 60 minutes. Read-only downtime for the duration.

### Scenario C: Supabase itself is down or our project's storage is corrupted

1. Spin up a new Supabase project in a different region.
2. Restore from the most recent daily dump in the `backups/` bucket. If that bucket is also affected, use the cross-region weekly archive.
3. Update `NEXT_PUBLIC_SUPABASE_URL` in Vercel to point at the new project.
4. Re-issue publishable + secret API keys; update `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in Vercel.
5. Total time: a few hours. Active downtime until DNS/env vars propagate.

### Scenario D: someone deletes our Supabase project

Mostly identical to Scenario C, except start from the cross-region archive because the `backups/` bucket dies with the project.

## Contacts

- Supabase support (Pro tier): https://supabase.com/dashboard/support/new (response time hours, not days; faster on enterprise)
- Postgres consultant on retainer: not yet engaged; the team is small enough that this is overkill for now. Revisit when we cross 50 active owners.
- Owner notification: in any Scenario B/C/D event, post a status update to https://www.theparcelco.com/status (route to be added) and DM each active owner directly. Use the language template in `docs/incident-comms.md` (to be added).

## History

- 2026-05-12: This runbook written. PITR not yet enabled (project still on Free tier). Daily dump cron not yet wired (depends on cron route + storage destination decision). `/api/health` shipped for external uptime monitoring.
