-- Status board default: new forms and document templates are shown on the
-- Paperwork Status Board by default (the column previously defaulted to false).
-- Pairs with the normalizeForm / normalizeTemplate `tracked ?? true` fallbacks
-- so rows created before this migration read as shown too. Existing literal
-- `false` rows are intentionally left untouched (no backfill).
alter table public.forms
  alter column tracked set default true;

alter table public.document_templates
  alter column tracked set default true;
