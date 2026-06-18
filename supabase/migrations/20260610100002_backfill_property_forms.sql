-- Workstream A1: backfill each property_forms row into the documents spine as a
-- raw form row (source = 'property_form', form_key set, payload in form_data).
--
-- Raw form rows are the storage layer that replaces property_forms 1:1. They are
-- marked visibility = 'internal' so they never appear in the client-facing
-- checklist; the catalog spine rows (form_key is null) remain the rows the owner
-- portal renders. The documents spine sync derives catalog status from these
-- raw rows instead of property_forms.

insert into documents (
  owner_id,
  workspace_id,
  property_id,
  document_key,
  title,
  status,
  source,
  scope_kind,
  visibility,
  form_key,
  form_data,
  completed_at,
  created_at,
  updated_at
)
select
  p.owner_id,
  null as workspace_id,
  pf.property_id,
  pf.form_key as document_key,
  initcap(replace(pf.form_key, '_', ' ')) as title,
  case when pf.completed_at is not null then 'on_file' else 'needed' end as status,
  'property_form' as source,
  'property' as scope_kind,
  'internal' as visibility,
  pf.form_key,
  pf.data as form_data,
  pf.completed_at,
  now() as created_at,
  now() as updated_at
from property_forms pf
join properties p on p.id = pf.property_id
where p.owner_id is not null
  -- Skip if a raw form row already exists for this property + form_key
  and not exists (
    select 1 from documents d
    where d.property_id = pf.property_id
      and d.form_key = pf.form_key
      and d.source = 'property_form'
  )
on conflict do nothing;
