-- Per-form custom appearance: an admin can give each form its own icon and
-- accent color so the Forms library reads at a glance. Both nullable; the UI
-- falls back to a deterministic tint + default glyph when unset.

alter table public.forms
  add column if not exists icon text;

alter table public.forms
  add column if not exists icon_color text;
