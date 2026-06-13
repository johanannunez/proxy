-- Help center schema, retro-fitted into source control.
--
-- The help center went live in 2026-04-12 but its tables were never
-- captured in supabase/migrations/. This migration is a faithful dump
-- of the current live schema so a fresh Supabase project (or a
-- preview branch) can reach the same state with one `supabase db push`.
--
-- Scope: help_categories, help_articles, their indexes, trigger
-- functions, triggers, RLS policies, and the search_help_articles
-- RPC that powers the marketing-site help search.
--
-- Sibling tables help_feedback and help_search_logs are deferred to a
-- follow-up migration; they are out of scope for this task.
--
-- The CREATE statements are idempotent so the migration is safe to
-- apply against the production project (where the objects already
-- exist) and against a fresh project (where they do not).

begin;

-- ---------------------------------------------------------------------
-- 1. Enum: help_article_status.
-- ---------------------------------------------------------------------

do $$
begin
  create type public.help_article_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 2. Trigger functions.
-- ---------------------------------------------------------------------

create or replace function public.help_articles_search_vector()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.content, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'B');
  return new;
end;
$function$;

create or replace function public.help_articles_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.help_update_category_count()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    update public.help_categories
    set article_count = (
      select count(*) from public.help_articles
      where category_id = new.category_id and status = 'published'
    )
    where id = new.category_id;
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.category_id != new.category_id) then
    update public.help_categories
    set article_count = (
      select count(*) from public.help_articles
      where category_id = old.category_id and status = 'published'
    )
    where id = old.category_id;
  end if;
  return coalesce(new, old);
end;
$function$;

-- ---------------------------------------------------------------------
-- 3. help_categories.
-- ---------------------------------------------------------------------

create table if not exists public.help_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text not null default 'Question',
  sort_order integer not null default 0,
  article_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.help_categories is
  'Help center article categories. icon stores a Phosphor icon component name.';

alter table public.help_categories enable row level security;

drop policy if exists "help_categories_select" on public.help_categories;
create policy "help_categories_select" on public.help_categories
  for select to public
  using (true);

-- ---------------------------------------------------------------------
-- 4. help_articles.
-- ---------------------------------------------------------------------

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.help_categories(id) on delete cascade,
  title text not null,
  slug text not null,
  summary text not null,
  content text not null,
  read_time_minutes integer not null default 1,
  tags text[] not null default '{}',
  status public.help_article_status not null default 'draft',
  sort_order integer not null default 0,
  view_count integer not null default 0,
  helpful_count integer not null default 0,
  not_helpful_count integer not null default 0,
  related_portal_path text,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  content_type text not null default 'help'
    check (content_type in ('help', 'policy', 'blog', 'flagship')),
  unique (category_id, slug)
);

comment on table public.help_articles is
  'Help center articles with full-text search. related_portal_path maps articles to portal pages for context-aware help.';

create index if not exists help_articles_category_idx
  on public.help_articles (category_id);
create index if not exists help_articles_status_idx
  on public.help_articles (status);
create index if not exists help_articles_search_idx
  on public.help_articles using gin (search_vector);
create index if not exists help_articles_portal_path_idx
  on public.help_articles (related_portal_path) where related_portal_path is not null;

drop trigger if exists help_articles_search_vector_trigger on public.help_articles;
create trigger help_articles_search_vector_trigger
  before insert or update of title, summary, content, tags on public.help_articles
  for each row execute function public.help_articles_search_vector();

drop trigger if exists help_articles_set_updated_at on public.help_articles;
create trigger help_articles_set_updated_at
  before update on public.help_articles
  for each row execute function public.help_articles_updated_at();

drop trigger if exists help_articles_update_category_count on public.help_articles;
create trigger help_articles_update_category_count
  after insert or delete or update on public.help_articles
  for each row execute function public.help_update_category_count();

alter table public.help_articles enable row level security;

-- Public read: anyone can SELECT published articles. The marketing
-- site relies on this for the unauthenticated help pages.
drop policy if exists "help_articles_select_published" on public.help_articles;
create policy "help_articles_select_published" on public.help_articles
  for select to public
  using (status = 'published');

-- Admin write: only admins manage articles. The admin role is checked
-- against the user_role enum in public.profiles.
drop policy if exists "help_articles_admin_write" on public.help_articles;
create policy "help_articles_admin_write" on public.help_articles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "help_categories_admin_write" on public.help_categories;
create policy "help_categories_admin_write" on public.help_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. search_help_articles RPC.
-- ---------------------------------------------------------------------
-- Powers the public marketing-site help search. Kept anon-callable on
-- purpose; the underlying help_articles policy already restricts rows
-- to published-only.

create or replace function public.search_help_articles(
  search_query text,
  max_results integer default 10
)
returns table (
  id uuid,
  title text,
  slug text,
  summary text,
  read_time_minutes integer,
  category_slug text,
  category_name text,
  tags text[],
  rank real
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return query
  select
    a.id,
    a.title,
    a.slug,
    a.summary,
    a.read_time_minutes,
    c.slug as category_slug,
    c.name as category_name,
    a.tags,
    ts_rank_cd(a.search_vector, websearch_to_tsquery('english', search_query)) as rank
  from public.help_articles a
  join public.help_categories c on c.id = a.category_id
  where a.status = 'published'
    and a.search_vector @@ websearch_to_tsquery('english', search_query)
  order by rank desc
  limit max_results;
end;
$function$;

commit;
