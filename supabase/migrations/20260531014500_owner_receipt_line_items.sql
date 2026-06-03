alter table public.owner_receipts
  add column if not exists line_items jsonb not null default '[]'::jsonb;

alter table public.owner_receipts
  drop constraint if exists owner_receipts_line_items_array_check,
  add constraint owner_receipts_line_items_array_check
    check (jsonb_typeof(line_items) = 'array');

create index if not exists owner_receipts_line_items_gin_idx
  on public.owner_receipts using gin (line_items);
