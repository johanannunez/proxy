# Auth Configuration

Supabase Auth config for the Parcel production project (ref `pwoxwpryummqeqsxdgyc`). Source of truth for what we ship.

## Site and redirect URLs

- Site URL: `https://www.theparcelco.com`
- Redirect allowlist:
  - `https://www.theparcelco.com/**`
  - `https://parcel-*-johanannunez.vercel.app/**`
  - `http://localhost:4000/**`

No stale `localhost:3001` or other dev entries.

## OTP

- Email OTP expiry: 600 seconds (10 min)
- Email OTP length: 8 digits
- SMS OTP expiry: 60 seconds (SMS auth is disabled, see below)
- SMS OTP length: 6 digits

## Email (SMTP via Resend)

- Host: `smtp.resend.com`
- Port: 465 (TLS)
- Username: `resend`
- Password: Doppler `RESEND_API_KEY_SUPABASE_SMTP`
- Sender address: `hello@theparcelco.com`
- Sender name: `The Parcel Company`
- Max frequency: 60 seconds between sends to same address

## Email templates

Six branded HTML templates live in Supabase Auth config:

- `mailer_templates_confirmation_content` (signup confirm)
- `mailer_templates_email_change_content`
- `mailer_templates_invite_content`
- `mailer_templates_magic_link_content`
- `mailer_templates_reauthentication_content` (verification code via `{{ .Token }}`)
- `mailer_templates_recovery_content`

Layout: warm cream background `#F9F7F4`, white card, button `#3D6B61` (teal), Georgia serif headings, system font body. Logo at `https://www.theparcelco.com/brand/logo-full-color.png`. Subject lines use middle dot (`·`) not em dash.

Notification templates (`password_changed`, `email_changed`, `phone_changed`, MFA enroll/unenroll, identity link/unlink) exist but `mailer_notifications_*_enabled` flags are all `false`. Enable via PATCH when notification flows are desired.

**Brand color reconciliation pending:** workspace CLAUDE.md says brand is blue `#02AAEB`, live templates use teal `#3D6B61`. See Todoist 6gcm7885r4W4q7xH.
**Multi-client testing pending:** see Todoist 6gcm5MHxx29qVMwX.

## Deliverability (DNS on Cloudflare, mail through Google Workspace + Resend)

| Record | Name | Value | Status |
|---|---|---|---|
| SPF (apex) | `theparcelco.com` | `v=spf1 include:_spf.google.com ~all` | verified |
| SPF (send subdomain) | `send.theparcelco.com` | `v=spf1 include:amazonses.com ~all` | verified |
| MX (send subdomain) | `send.theparcelco.com` | `feedback-smtp.us-east-1.amazonses.com` priority 10 | verified |
| DKIM | `resend._domainkey.theparcelco.com` | RSA public key (Resend) | verified 2026-04-04 |
| DMARC | `_dmarc.theparcelco.com` | `v=DMARC1; p=none; rua=mailto:dmarc@theparcelco.com; ruf=mailto:dmarc@theparcelco.com; fo=1; adkim=s; aspf=r` | published 2026-05-11, monitoring |

DMARC reports route to `dmarc@theparcelco.com`, a Google Workspace alias on the `hello@` account.

**DMARC flip schedule:** `p=none` until 2026-05-25, then `p=quarantine` after 14 days of clean reports. Tracked in Todoist 6gcm8FmHJJMVcJJW.

### Deliverability scores (2026-05-11)

- mail-tester.com: **9.5/10** (the -0.5 was a 404 on the placeholder test URL we used; real Supabase verify URLs resolve)
- SpamAssassin: 0.2 (below -5 is spam threshold)
- DKIM: SIGNED + VALID + VALID_AU + VALID_EF (full author-domain alignment)
- SPF: PASS
- DMARC: PASS
- Not blocklisted on any of 23 common IPv4 blocklists (Hostkarma's yellow flag is the new-sender default and self-resolves)

## Rate limits

Supabase rate limits are project-wide per hour, not per-IP.

| Field | Value | Notes |
|---|---|---|
| `rate_limit_email_sent` | 30/hr | Total auth emails sent project-wide |
| `rate_limit_anonymous_users` | 30/hr | Anonymous signups |
| `rate_limit_otp` | 30/hr | OTP send |
| `rate_limit_verify` | 30/hr | OTP verify attempts |
| `rate_limit_token_refresh` | 150/hr | Token refresh |
| `rate_limit_sms_sent` | 30/hr | SMS auth disabled, irrelevant |
| `rate_limit_web3` | 30/hr | Web3 auth disabled, irrelevant |

**Per-IP signup throttling pending:** Task 1.12 spec called for "max 3 signups per IP per hour" which Supabase cannot enforce alone. Recommended approach is hCaptcha via `security_captcha_enabled: true` + `security_captcha_provider: hcaptcha` + `security_captcha_secret`. Tracked in Todoist 6gcm8Fvm5CW8vqhX.

## Password

- Minimum length: 8 characters
- HIBP check: disabled
- Require current password on change: true
- Require reauthentication on change: true

## MFA

- TOTP: enrollment + verify enabled
- Phone: disabled
- WebAuthn / Passkey: disabled
- Max enrolled factors per user: 10
- Factor enroll/unenroll notification emails: templates exist, flags currently disabled

## OAuth providers

None enabled. Email-only auth.

## Sessions

- JWT expiry: 3600 seconds (1 hour)
- Refresh token rotation: enabled
- Refresh token reuse interval: 10 seconds
- Single session per user: disabled
- Inactivity timeout: none

## Managing config

The Supabase Auth config is managed via the Management API:

```
GET   https://api.supabase.com/v1/projects/pwoxwpryummqeqsxdgyc/config/auth
PATCH https://api.supabase.com/v1/projects/pwoxwpryummqeqsxdgyc/config/auth
```

Token: Doppler `SUPABASE_ACCESS_TOKEN` (parcel/prd). Personal access token belonging to jo@johanannunez.com, label `parcel-claude-mgmt`, created 2026-05-11.

The dashboard UI exposes the same fields under **Authentication > Configuration** but the Management API is faster for batch changes and lets us version-control intent here.

## History

- 2026-04-04: Resend verified `theparcelco.com`, DKIM published, SMTP wired into Supabase
- 2026-05-11: DMARC published (`p=none`), `dmarc@` alias created on hello@, OTP expiry tightened from 3600s to 600s, four em-dash subject lines replaced with middle dot, this doc written
