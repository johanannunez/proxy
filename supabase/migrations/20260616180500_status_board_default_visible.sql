alter table public.forms
  alter column tracked set default true;

alter table public.document_templates
  alter column tracked set default true;
