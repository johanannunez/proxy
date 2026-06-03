-- Cross-section assignment: null = default from DISPLAY_GROUPS, set = admin override
alter table documents
  add column if not exists display_group text;

-- Six new per-document admin controls
alter table documents
  add column if not exists waived                    boolean      not null default false,
  add column if not exists is_urgent                 boolean      not null default false,
  add column if not exists admin_note                text,
  add column if not exists owner_note                text,
  add column if not exists custom_due_date           timestamptz,
  add column if not exists manually_completed_at     timestamptz,
  add column if not exists manually_completed_note   text;

-- Per-owner group ordering
create table if not exists document_group_settings (
  profile_id  uuid not null references profiles(id) on delete cascade,
  group_key   text not null,
  sort_order  int  not null default 0,
  primary key (profile_id, group_key)
);

alter table document_group_settings enable row level security;

create policy "service role only" on document_group_settings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
