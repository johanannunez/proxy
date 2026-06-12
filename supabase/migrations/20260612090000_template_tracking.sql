-- Paperwork IA amendment (Round 4.6): coverage tracking on masters.
--
-- The owner-by-template matrix becomes the "Coverage" view under Documents.
-- Its columns stop being hardcoded Proxy catalog keys: any template (signature
-- or form) an admin marks as tracked becomes a matrix column, grouped by the
-- template's category. Forms also gain archive support for the new Forms tab.

-- ── document_templates: tracked + category ───────────────────────────────────

alter table public.document_templates
  add column if not exists tracked boolean not null default false;

alter table public.document_templates
  add column if not exists category text;

-- ── forms: tracked + category + archive ──────────────────────────────────────

alter table public.forms
  add column if not exists tracked boolean not null default false;

alter table public.forms
  add column if not exists category text;

alter table public.forms
  add column if not exists archived_at timestamptz;

-- ── Backfill: keep Proxy's current matrix unchanged after the migration ──────
--
-- Today's matrix renders two column groups in DocumentsHub:
--   "SecureDocs"  -> secureKeys: host_rental_agreement, card_authorization,
--                    ach_authorization, w9, identity
--   "Setup"       -> matrixFormKeys: property_setup, wifi_info, guidebook
-- Mark the matching Proxy/system templates as tracked with those categories.

update public.document_templates
set tracked = true,
    category = 'securedocs'
where document_key in (
  'host_rental_agreement',
  'card_authorization',
  'ach_authorization',
  'w9',
  'identity'
)
and (org_id is null or org_id = '00000000-0000-0000-0000-000000000001');

update public.document_templates
set tracked = true,
    category = 'setup'
where document_key in (
  'property_setup',
  'wifi_info',
  'guidebook'
)
and (org_id is null or org_id = '00000000-0000-0000-0000-000000000001');
