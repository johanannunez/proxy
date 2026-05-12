# AGENTS.md: Parcel Repo Rules

These are agent-facing rules. The workspace-wide standards in `/Users/johanannunez/workspace/.claude/CLAUDE.md` still apply.

---

## Headless login (run this first, every session)

Admin and portal routes are session-gated. Without a valid Supabase auth cookie, every request 307s to `/login` and `gstack browse` cannot reach `/admin/*` or `/portal/*`.

To unblock the persistent browse daemon, sign in once per session as the dedicated headless agent user.

```bash
pnpm dev-login
```

What it does:
- Probes `http://localhost:4000/admin`.
- If the daemon already has a valid session, exits with "Session already valid."
- Otherwise navigates to `/login?redirect=/admin`, fills the email/password form using `DEV_AGENT_EMAIL` and `DEV_AGENT_PASSWORD` from Doppler `parcel/dev`, and clicks Sign in.
- Asserts the final URL starts with `/admin`. Exits non-zero otherwise.

After it succeeds, every subsequent `$B goto http://localhost:4000/admin/...` runs as the agent admin user. Cookies live in the persistent Chromium daemon until you call `$B stop` or close the daemon.

If the dev server is not running yet:
```bash
pnpm dev
```

If port 9400 is held by a stale browse daemon:
```bash
kill $(lsof -t -i :9400)
```

### Re-bootstrapping the user

If the password rotates or the user is somehow deleted, recreate it idempotently:
```bash
pnpm dev-agent-bootstrap
```

This uses the Supabase service role key from `apps/web/.env.local` to create or update `auth.users` for `DEV_AGENT_EMAIL`, upserts a `public.profiles` row with `role = 'admin'`, and confirms the email.

### Who is the agent user

- Email: `agent@theparcelco.com` (not a real human)
- Role: `admin`
- Workspace: none assigned

Login fires a real `logTimelineEvent({ eventType: "login" })`. These show up in timeline as logins from "Dev Agent". Filter them out when reviewing real activity.

### Out-of-scope: production

`dev-login` only signs into `localhost:4000`. It cannot reach production. The dev agent user exists in the live Supabase project (we only have one), but its sessions only ever land in your local dev environment because that is the only place the browse daemon points to.

---

## Other rules

For project structure, gotchas, the property_forms pattern, UI interaction standards, anti-generic design rules, browse commands, code quality, verification, and Trigger.dev v4 rules, see your kickoff doc at `.agent-kickoffs/AGENT_<X>_<ROLE>.md` and the workspace CLAUDE.md.
