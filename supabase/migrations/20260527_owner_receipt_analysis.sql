alter table public.owner_receipts
  add column if not exists analysis_kind text,
  add column if not exists analysis_confidence text,
  add column if not exists analysis_summary text,
  add column if not exists analysis_reasons text[] not null default '{}',
  add column if not exists analysis_source text;

alter table public.owner_receipts
  drop constraint if exists owner_receipts_analysis_kind_check,
  add constraint owner_receipts_analysis_kind_check
    check (analysis_kind is null or analysis_kind in ('receipt', 'invoice', 'recurring', 'to_pay'));

alter table public.owner_receipts
  drop constraint if exists owner_receipts_analysis_confidence_check,
  add constraint owner_receipts_analysis_confidence_check
    check (analysis_confidence is null or analysis_confidence in ('high', 'medium', 'low'));

alter table public.owner_receipts
  drop constraint if exists owner_receipts_analysis_source_check,
  add constraint owner_receipts_analysis_source_check
    check (analysis_source is null or analysis_source in ('document', 'ai', 'rules', 'manual'));

create index if not exists owner_receipts_analysis_kind_idx
  on public.owner_receipts (analysis_kind);
