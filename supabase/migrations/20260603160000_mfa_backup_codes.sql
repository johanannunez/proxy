-- Account-level 2FA (TOTP) recovery codes.
-- Stores one-time backup codes for users who enroll an authenticator factor.
-- Hashes only: plaintext codes are shown to the user exactly once at generation.
-- Access is restricted to the service role so hashes never reach the browser.

create table if not exists public.mfa_backup_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  code_hash  text not null,            -- sha-256 of (code + per-row salt)
  salt       text not null,
  used_at    timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists mfa_backup_codes_user_id_idx
  on public.mfa_backup_codes (user_id);

alter table public.mfa_backup_codes enable row level security;

-- Service-role only. A `for all` policy MUST declare both using and with check,
-- otherwise inserts and updates are silently blocked at runtime.
create policy "service_role_only_mfa_backup_codes"
  on public.mfa_backup_codes for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
