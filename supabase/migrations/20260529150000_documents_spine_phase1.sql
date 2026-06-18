-- ============================================================
-- Phase 1: Documents spine — evolve the existing `documents`
-- table into the single source of truth for document lifecycle.
-- Applied to remote via Supabase MCP as `documents_spine_phase1`.
-- ============================================================

-- 1. Spine columns on documents (additive, all nullable / defaulted)
alter table public.documents
  add column if not exists document_key text,
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null,
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists scope_kind text not null default 'owner',
  add column if not exists source text not null default 'manual',
  add column if not exists source_ref text,
  add column if not exists gate_group text,
  add column if not exists sequence integer not null default 0,
  add column if not exists visibility text not null default 'client',
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists expires_at date,
  add column if not exists renewal_due_at date,
  add column if not exists request_id uuid references public.workspace_requests(id) on delete set null,
  add column if not exists assigned_recipient_ids jsonb not null default '[]'::jsonb;

alter table public.documents alter column status set default 'needed';

do $$ begin
  alter table public.documents
    add constraint documents_scope_kind_chk check (scope_kind in ('owner','property','shared'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents
    add constraint documents_visibility_chk check (visibility in ('client','internal'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents
    add constraint documents_source_chk check (source in ('signed_document','property_form','owner_kyc','upload','manual'));
exception when duplicate_object then null; end $$;

create unique index if not exists documents_owner_key_property_uidx
  on public.documents (owner_id, document_key, coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where document_key is not null;

create index if not exists documents_workspace_idx on public.documents (workspace_id);
create index if not exists documents_document_key_idx on public.documents (document_key);
create index if not exists documents_property_idx on public.documents (property_id);
create index if not exists documents_request_idx on public.documents (request_id);
create index if not exists documents_status_idx on public.documents (status);

drop policy if exists documents_workspace_member_read on public.documents;
create policy documents_workspace_member_read on public.documents
  for select to authenticated
  using (
    workspace_id is not null and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.workspace_id = documents.workspace_id
    )
  );

-- 2. document_signers — per-party signing state for signature documents.
create table if not exists public.document_signers (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  signer_profile_id uuid references public.profiles(id) on delete set null,
  signer_contact_id uuid references public.contacts(id) on delete set null,
  signer_email text,
  signer_name text,
  role text not null default 'signer',
  role_index integer not null default 1,
  order_index integer not null default 0,
  required boolean not null default true,
  status text not null default 'pending',
  boldsign_document_id text,
  embedded_link text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.document_signers
    add constraint document_signers_role_chk check (role in ('signer','countersigner'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.document_signers
    add constraint document_signers_status_chk check (status in ('pending','signed','declined'));
exception when duplicate_object then null; end $$;

create index if not exists document_signers_document_idx on public.document_signers (document_id);
create index if not exists document_signers_signer_profile_idx on public.document_signers (signer_profile_id);

alter table public.document_signers enable row level security;

drop policy if exists document_signers_admin_all on public.document_signers;
create policy document_signers_admin_all on public.document_signers
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists document_signers_self_read on public.document_signers;
create policy document_signers_self_read on public.document_signers
  for select to authenticated
  using (
    signer_profile_id = auth.uid()
    or exists (
      select 1 from public.documents d
      where d.id = document_signers.document_id
        and (
          d.owner_id = auth.uid()
          or (d.workspace_id is not null and exists (
                select 1 from public.profiles p
                where p.id = auth.uid() and p.workspace_id = d.workspace_id))
        )
    )
  );

-- 3. signed_documents countersignature tracking.
alter table public.signed_documents
  add column if not exists countersigner_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists countersigned_at timestamptz,
  add column if not exists fully_executed_at timestamptz;

-- 4. Link request items to the spine row they request.
alter table public.workspace_request_items
  add column if not exists document_id uuid references public.documents(id) on delete set null;

create index if not exists workspace_request_items_document_idx on public.workspace_request_items (document_id);

do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists document_signers_set_updated_at on public.document_signers;
    create trigger document_signers_set_updated_at
      before update on public.document_signers
      for each row execute function public.set_updated_at();
  end if;
end $$;
