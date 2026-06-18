-- Adds source_html to document_templates.
-- null   = PDF-based template (existing behavior, untouched).
-- ''     = HTML template created but not yet authored.
-- '<..>' = HTML fragment authored in the Plate editor and pushed to DocuSeal.

alter table public.document_templates
  add column if not exists source_html text null;
