# Security posture

This document is the source of truth for how sensitive owner data is
stored, accessed, and audited inside Parcel. Update it whenever a
migration changes a security boundary or a new sensitive-data flow
ships.

Companion: [rls-audit.md](./rls-audit.md) covers row-level security
on every public table.

## Sensitive data inventory

| Data | At rest | In transit | Access path |
| --- | --- | --- | --- |
| W-9 PDF | Supabase Storage, private bucket `documents`, object key `<owner_uuid>/w9-*.pdf` | HTTPS, signed URL with 10-minute default expiry, 1-hour hard cap | `lib/tax/w9-storage.ts → generateW9SignedUrl` |
| SSN | `public.tax_profiles.ssn_encrypted` (bytea), AES-256-GCM with `TAX_ENCRYPTION_KEY` | Encrypted at rest, decrypted only inside server-component / server-action code | `lib/tax/w9-storage.ts → getTaxProfile` |
| EIN | `public.tax_profiles.ein_encrypted` (bytea), AES-256-GCM with `TAX_ENCRYPTION_KEY` | Same as SSN | Same as SSN |
| BoldSign-signed W-9 | `public.signed_documents` row + (when stored in bucket) `documents://<owner_uuid>/...` | Signed URL; BoldSign also exposes a hosted view via the webhook payload | Same `generateW9SignedUrl`, target by `signedDocumentId` |
| Plaid access tokens | `public.treasury_connections.access_token_encrypted` (bytea), AES-256-GCM with `TREASURY_ENCRYPTION_KEY` | Encrypted at rest, decrypted only inside server code | `lib/treasury/encryption.ts` |
| API tokens (CalDAV / quick-add) | `public.api_tokens.token_hash` (SHA-256, hex) | Never stored in plaintext; returned to user once at issuance | `lib/api-tokens.ts → verifyApiToken` |

## Encryption keys

Two independent keys live in Doppler, synced to Vercel:

- `TREASURY_ENCRYPTION_KEY`: protects Plaid / Stripe credentials.
- `TAX_ENCRYPTION_KEY`: protects SSN / EIN in `tax_profiles`.

Independent keys mean:

- A leak of one key does not expose data encrypted with the other.
- Rotation runs on its own cadence per data class.
- The same plaintext encrypted under each key produces unrelated
  ciphertext, so a comparison across modules cannot link a Plaid
  token to a tax record.

Both keys accept either a 64-character hex string (32 raw bytes) or
any string, which is SHA-256-hashed to 32 bytes. Use the hex form
for new keys (`openssl rand -hex 32`).

The encryption primitives are AES-256-GCM with a 16-byte random IV
per encryption and a 16-byte auth tag. Output layout:
`IV(16) || authTag(16) || ciphertext`. See
`apps/web/src/lib/treasury/encryption.ts` for the shared helpers
`encryptWith(plaintext, key)` and `decryptWith(buffer, key)`, and
`apps/web/src/lib/tax/encryption.ts` for the tax-key wrapper.

## W-9 storage flow

```
        owner upload                  admin / compliance review
              |                                |
              v                                v
   uploadW9Pdf()                  generateW9SignedUrl()
              |                                |
              v                                v
 storage.objects (documents)       w9_access_log row
   <owner_uuid>/w9-*.pdf            (one per signed URL)
```

### Bucket configuration

- Bucket: `documents`
- `public`: **false**. Direct URLs return HTTP 400 with no path
  disclosure.
- `file_size_limit`: 20 MB.
- `allowed_mime_types`: `application/pdf, image/png, image/jpeg,
  image/webp`.

### RLS on `storage.objects`

Object names are namespaced as `<owner_uuid>/<filename>`. The first
path segment is the owner.

- `documents bucket: owner read own` — `SELECT` when
  `split_part(name, '/', 1) = auth.uid()::text`.
- `documents bucket: owner write own` — `INSERT` with same predicate.
- `documents bucket: owner update own` — `UPDATE` with same predicate.
- `documents bucket: owner delete own` — `DELETE` with same predicate.
- `documents bucket: compliance or admin all` — `ALL` when
  `public.is_compliance_or_admin()` returns true.

The service role bypasses RLS but every code path that uses the
service role to upload or read passes the owner UUID explicitly.

### Signed URLs

Every signed-URL generation against a W-9 object MUST go through
`lib/tax/w9-storage.ts → generateW9SignedUrl`. Calling
`supabase.storage.from("documents").createSignedUrl(...)` directly
is forbidden because it skips the audit log.

- Default expiry: **10 minutes**.
- Hard cap: **1 hour**.
- Lower bound: **1 minute**.
- Caller specifies the `accessorProfileId` (who is requesting), an
  optional reason string, and optionally captures the user-agent and
  IP from the inbound request.
- One row is written to `public.w9_access_log` per signed URL. If
  the audit-log write fails, the helper returns `{ok: false, error}`
  even though the signed URL was already generated. The URL is not
  surfaced to the caller, so a leak through the helper alone is
  impossible without the matching audit row.

## Audit log: `public.w9_access_log`

| Column | Notes |
| --- | --- |
| `id` | PK, `gen_random_uuid()` |
| `document_id` | nullable FK to `signed_documents.id` (BoldSign-signed W-9) |
| `storage_path` | nullable text, the path in the `documents` bucket |
| `profile_id` | not null, FK to `profiles.id` (the accessor, not the owner) |
| `accessed_at` | not null, defaults to `now()` |
| `signed_url_expires_at` | not null, lets reviewers see how long the URL was live |
| `reason` | nullable, freeform text |
| `user_agent` | nullable text, captured from `request.headers.get("user-agent")` |
| `ip_address` | nullable inet, captured from the first hop of `X-Forwarded-For` |

A `CHECK` constraint requires at least one of `document_id` or
`storage_path`.

RLS:

- `w9_access_log: compliance or admin read` — `SELECT` for the
  compliance + admin roles only.
- `w9_access_log: compliance admin or self insert` — `INSERT` when
  the caller is compliance / admin OR when the caller is recording
  their own access (owners reading their own W-9).

There is no `UPDATE` or `DELETE` policy. The log is append-only.

## Roles

The `public.user_role` enum has three values:

| Role | Use |
| --- | --- |
| `owner` | Default for property owners using the portal. |
| `admin` | Full platform access. Granted manually via SQL. |
| `compliance` | Reads `tax_profiles`, `w9_access_log`, and `documents` bucket objects; cannot manage properties, billing, or other admin surfaces. Added in `tax_data_foundation` migration. |

`public.is_admin()` checks for `admin` only.
`public.is_compliance_or_admin()` checks for `admin` or `compliance`.
Both are `SECURITY DEFINER` with EXECUTE revoked from anon, granted
to authenticated for inline use in RLS policies.

## Backwards-compatibility notes

- Existing W-9 records collected pre-2026-05-11 live as
  `signed_documents` rows with `template_name = 'w9'` and a
  BoldSign-hosted PDF URL stored in `signed_pdf_url`. They do not
  have entries in `tax_profiles` or `w9_access_log` until they are
  re-issued through the new flow.
- The `documents` bucket is new. Migrating legacy W-9 PDFs into it
  requires re-downloading from BoldSign and uploading under
  `<owner_uuid>/`. That migration is out of scope for this task.

## What to do when something changes

1. New sensitive column: add it to the inventory table above, choose
   the right key (treasury vs tax), and write its encrypt / decrypt
   wrapper in the same style as `lib/tax/encryption.ts`.
2. New storage object class: add a new bucket. Do not reuse
   `documents` for non-tax data; the audit boundary is per-bucket.
3. Rotating a key: generate a fresh key in Doppler under the same
   variable name, then run a one-shot script that decrypts existing
   ciphertext with the old key and re-encrypts under the new. The
   `encryptWith` / `decryptWith` helpers accept the key as a
   parameter precisely to make rotation tractable.
