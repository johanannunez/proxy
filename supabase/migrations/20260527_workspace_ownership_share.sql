-- Track shared ownership percentages at the contact level for Workspace galleries and quick settings.

alter table public.contacts
  add column if not exists ownership_percentage numeric(5,2);

-- Keep values normalized to a meaningful operating range.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contacts'::regclass
      and conname = 'contacts_ownership_percentage_check'
  ) then
    alter table public.contacts
      add constraint contacts_ownership_percentage_check
      check (ownership_percentage is null or (ownership_percentage >= 0 and ownership_percentage <= 100));
  end if;
end $$;
