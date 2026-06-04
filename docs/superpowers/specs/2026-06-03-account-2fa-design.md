# Account 2FA (TOTP) — Design Spec

Date: 2026-06-03
Status: Approved, ready for implementation
Author: Jo (with Claude)

## Goal

Let users protect their Proxy account with two-factor authentication using an
authenticator app (TOTP). Optional for owners, required for admins. The second
factor is challenged at login and elevates the whole session.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Method | Authenticator app (TOTP) only. No SMS, no passkeys (passkeys are a possible fast-follow). |
| Scope | Optional for owners (workspace users). Required for admins. |
| Challenge point | At login. Session elevates to Supabase AAL2. Middleware trusts the session everywhere. |
| Recovery | 8 one-time backup codes generated at enrollment, plus a service-role admin reset. |

## Core principle: Supabase AAL is the single source of truth

Supabase tracks whether a session is `aal1` (password only) or `aal2`
(password + verified TOTP) via `auth.mfa.getAuthenticatorAssuranceLevel()`.
We gate on that value and never invent a parallel "2fa_passed" flag.

Consequence: a backup code **cannot** elevate a Supabase session to `aal2`
(Supabase only grants `aal2` through a real TOTP verify). Therefore a backup
code is **not** a login shortcut. It is a recovery action: using one proves
identity, wipes the lost authenticator factor, and walks the user through
enrolling a fresh authenticator (which then legitimately reaches `aal2`).
This matches GitHub/Google recovery-code behavior and keeps one source of truth.

## Reuse

A working TOTP implementation already exists for the Treasury module and is the
reference architecture:
- `src/app/(admin)/admin/treasury/mfa-setup/` — enroll + QR + verify
- `src/app/(admin)/admin/treasury/verify/` — challenge + verify + rate limit
- `src/lib/treasury/auth.ts` — verified-state cookie helpers

Treasury code stays untouched in this build. We extract a shared library and
generalize the QR enrollment component; folding Treasury onto the shared lib is
a later, optional cleanup.

## Data model

One new table, service-role access only (no client RLS read of hashes):

```sql
create table public.mfa_backup_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  code_hash  text not null,            -- sha-256 of (code + per-row salt)
  salt       text not null,
  used_at    timestamptz null,
  created_at timestamptz not null default now()
);
create index on public.mfa_backup_codes (user_id);
-- RLS: service_role only (for all using/with check service_role).
```

- 8 codes generated at enrollment, plaintext shown exactly once.
- One-time use: stamp `used_at` on consume.
- No `mfa_enabled` column on `profiles`. Enrollment status is read live from
  `auth.mfa.listFactors()` so it can never drift.
- Audit via existing timeline-event pattern: `2fa_enrolled`, `2fa_disabled`,
  `2fa_recovery_used`, `2fa_admin_reset`.

## Shared library: `src/lib/auth/mfa.ts`

One module so login, settings, and recovery call the same code:

- `enrollTotp()` — start enrollment, return `{ factorId, qrCode, secret }`
- `challengeAndVerify(factorId, code)` — challenge then verify a TOTP code
- `listVerifiedFactors()` — verified TOTP factors for the current user
- `getAssurance()` — `{ current, next }` from `getAuthenticatorAssuranceLevel()`
- `generateBackupCodes(userId)` — 8 plaintext (shown once) + store hashes
- `consumeBackupCode(userId, code)` — verify + one-time-mark, rate-limited
- `resetUserMfa(userId)` — service-role: delete factors + backup codes (admin reset)
- Cleanup of stale unverified factors on re-enroll.

Rate limiting reuses the Treasury pattern (5 attempts, 10-minute lockout).

## Flows

### Enrollment
Reuse the generalized QR component. Show QR + manual secret, user enters a code,
verify, then show 8 backup codes once behind an "I saved these" confirm.
Entry points: owner self-service in account settings; forced wizard for admins.

### Login
`src/app/(marketing)/login/actions.ts` + new `/verify-2fa` page.
Password succeeds, then check `getAssurance()`. If `next === 'aal2'`, redirect to
`/verify-2fa` (session is still `aal1`). User enters TOTP, verify, session becomes
`aal2`, then normal role-based redirect. A "Lost your device?" link goes to
`/recover-2fa`.

### Middleware gate (`src/proxy.ts`)
On protected routes, read assurance:
- `next === 'aal2' && current === 'aal1'` → enrolled but unverified this session
  → redirect to `/verify-2fa`.
- Route is `/admin/*`, user is admin, no verified factor → redirect to forced
  `/enroll-2fa` (cannot skip). This enforces "required for admins."
- Owners with no factor → untouched (optional).

### Recovery + admin reset
`/recover-2fa` (reachable at `aal1`): enter backup code → `consumeBackupCode` →
delete the lost factor → force-enroll a new authenticator → issue new backup
codes. Admin reset is the same `resetUserMfa()` exposed via the "Reset 2FA"
button in `AccountSecuritySection.tsx` and a small service-role script.

## Settings UI

- Owner (`(workspace)/workspace/account/.../SecuritySection.tsx`): new 2FA
  subsection. Live status pill, Enable → enrollment, Disable → `ConfirmModal`
  (owners only), Regenerate backup codes, remaining-codes count with low warning.
- Admin stub (`(admin)/admin/workspaces/[workspaceId]/settings/AccountSecuritySection.tsx`):
  replace hardcoded `twoFactorEnabled={false}` with real status; wire "Reset 2FA"
  to `resetUserMfa`. Disable hidden/blocked for admin accounts.

## Edge cases

- Stale unverified factors cleaned on re-enroll.
- Admin cannot disable (button hidden + server guard).
- Dev magic-link login (`/api/dev/auth`) forces the admin account into the enroll
  wizard on first run — this is how Jo bootstraps his own 2FA.
- Low/exhausted backup codes prompt regeneration.
- Wrong codes rate-limited (5 tries / 10-min lockout).

## Testing

- Unit: backup code hash + one-time-use.
- Integration: enrolled login requires code; wrong code locks out; admin without
  factor forced to enroll; owner enable/disable; backup-code recovery wipes and
  re-enrolls.
- Manual: real authenticator app end to end, plus an admin reset.

## Out of scope

- SMS / email second factor.
- Passkeys / WebAuthn (possible fast-follow).
- Refactoring Treasury onto the shared lib (later cleanup).
