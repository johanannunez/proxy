do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_request_assignment_scope') then
    create type public.workspace_request_assignment_scope as enum (
      'workspace',
      'person',
      'multiple_people'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'workspace_request_completion_rule') then
    create type public.workspace_request_completion_rule as enum (
      'any_assignee',
      'each_assignee'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'workspace_request_status') then
    create type public.workspace_request_status as enum (
      'draft',
      'sent',
      'viewed',
      'partially_completed',
      'completed',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'workspace_request_recipient_role') then
    create type public.workspace_request_recipient_role as enum (
      'to',
      'cc',
      'notify_only'
    );
  end if;
end $$;

create table if not exists public.workspace_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assignment_scope public.workspace_request_assignment_scope not null default 'workspace',
  completion_rule public.workspace_request_completion_rule not null default 'any_assignee',
  status public.workspace_request_status not null default 'draft',
  subject text not null,
  message_html text not null,
  message_text text not null,
  cta_label text not null,
  trust_note text not null,
  created_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workspace_requests(id) on delete cascade,
  document_key text not null,
  label text not null,
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open',
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_request_recipients (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workspace_requests(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  role public.workspace_request_recipient_role not null,
  delivery_channels text[] not null default array['email']::text[],
  email text,
  phone text,
  last_email_sent_at timestamptz,
  last_sms_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workspace_requests(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists workspace_requests_workspace_idx
  on public.workspace_requests (workspace_id, status, created_at desc);

create index if not exists workspace_request_items_request_idx
  on public.workspace_request_items (request_id, status);

create index if not exists workspace_request_recipients_request_idx
  on public.workspace_request_recipients (request_id, role);

create index if not exists workspace_request_attachments_request_idx
  on public.workspace_request_attachments (request_id);

alter table public.workspace_requests enable row level security;
alter table public.workspace_request_items enable row level security;
alter table public.workspace_request_recipients enable row level security;
alter table public.workspace_request_attachments enable row level security;

drop policy if exists workspace_requests_admin_all on public.workspace_requests;
create policy workspace_requests_admin_all
  on public.workspace_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists workspace_request_items_admin_all on public.workspace_request_items;
create policy workspace_request_items_admin_all
  on public.workspace_request_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists workspace_request_recipients_admin_all on public.workspace_request_recipients;
create policy workspace_request_recipients_admin_all
  on public.workspace_request_recipients for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists workspace_request_attachments_admin_all on public.workspace_request_attachments;
create policy workspace_request_attachments_admin_all
  on public.workspace_request_attachments for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists workspace_requests_member_read on public.workspace_requests;
create policy workspace_requests_member_read
  on public.workspace_requests for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.workspace_id = workspace_requests.workspace_id
    )
  );

drop policy if exists workspace_request_items_member_read on public.workspace_request_items;
create policy workspace_request_items_member_read
  on public.workspace_request_items for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_requests wr
      join public.profiles p on p.workspace_id = wr.workspace_id
      where wr.id = workspace_request_items.request_id
        and p.id = auth.uid()
    )
  );

drop policy if exists workspace_request_recipients_member_read on public.workspace_request_recipients;
create policy workspace_request_recipients_member_read
  on public.workspace_request_recipients for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_requests wr
      join public.profiles p on p.workspace_id = wr.workspace_id
      where wr.id = workspace_request_recipients.request_id
        and p.id = auth.uid()
    )
  );

drop policy if exists workspace_request_attachments_member_read on public.workspace_request_attachments;
create policy workspace_request_attachments_member_read
  on public.workspace_request_attachments for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_requests wr
      join public.profiles p on p.workspace_id = wr.workspace_id
      where wr.id = workspace_request_attachments.request_id
        and p.id = auth.uid()
    )
  );
