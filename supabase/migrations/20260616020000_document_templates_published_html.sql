-- published_html: snapshot of source_html last pushed to DocuSeal.
-- needsPublish = source_html is distinct from published_html (and a docuseal
-- template exists). null = never published.
alter table public.document_templates
  add column if not exists published_html text null;
