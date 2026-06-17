insert into storage.buckets (id, name, public)
values ('form-covers', 'form-covers', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read form covers" on storage.objects;
create policy "Public read form covers"
  on storage.objects
  for select
  using (bucket_id = 'form-covers');
