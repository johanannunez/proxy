-- Backfill to match the shown-by-default behavior introduced by
-- 20260616180500_status_board_default_visible, which flipped the column default
-- but left existing rows at their original `false`. `tracked` drives the
-- Paperwork Status Board "Shown/Hidden" state; this aligns pre-existing forms
-- and templates with the new default and the "shown by default" UI copy.
-- Idempotent: only touches rows still at false.
update public.forms set tracked = true where tracked = false;
update public.document_templates set tracked = true where tracked = false;
