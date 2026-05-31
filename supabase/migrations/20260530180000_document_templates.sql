-- Document template catalog. Replaces DOCUSEAL_TEMPLATE_IDS in signature-config.ts.
-- org_id nullable: NULL = system template (Parcel-provided, all tenants).
--                  set  = tenant-owned (future; no orgs table yet, FK added later).

create table if not exists public.document_templates (
  id                        uuid         primary key default gen_random_uuid(),
  org_id                    uuid,
  document_key              text         not null,
  display_name              text         not null,
  description               text,
  docuseal_template_id      bigint,
  signer_roles              text[]       not null default '{"Owner"}',
  requires_countersignature boolean      not null default true,
  gate_step                 int,
  is_system                 boolean      not null default false,
  is_active                 boolean      not null default true,
  created_at                timestamptz  not null default now(),
  updated_at                timestamptz  not null default now()
);

-- System templates: one per document_key globally (org_id IS NULL).
create unique index document_templates_system_key_unique
  on public.document_templates (document_key)
  where org_id is null;

-- Tenant templates: one per (org_id, document_key).
create unique index document_templates_tenant_key_unique
  on public.document_templates (org_id, document_key)
  where org_id is not null;

alter table public.document_templates enable row level security;

create policy "Authenticated users can read document templates"
  on public.document_templates for select
  using (auth.uid() is not null);

create policy "Service role can mutate document templates"
  on public.document_templates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop trigger if exists document_templates_updated_at on public.document_templates;
create trigger document_templates_updated_at
  before update on public.document_templates
  for each row execute function public.set_updated_at();

-- gate_step values match GATE_STEP in lifecycle.ts: 1=agreement, 2=payment, 3=banking, 4=rest.
insert into public.document_templates
  (document_key, display_name, description, signer_roles, requires_countersignature, gate_step, is_system, is_active)
values
  ('host_rental_agreement',
   'Host Rental Agreement',
   'Property management agreement between the owner and Parcel.',
   '{"Owner","Parcel"}', true, 1, true, true),
  ('ach_authorization',
   'ACH Authorization',
   'Bank account direct debit authorization for disbursements.',
   '{"Owner","Parcel"}', true, 3, true, true),
  ('card_authorization',
   'Card Authorization',
   'Credit card on file authorization for maintenance and incidentals.',
   '{"Owner","Parcel"}', true, 3, true, true)
on conflict do nothing;
