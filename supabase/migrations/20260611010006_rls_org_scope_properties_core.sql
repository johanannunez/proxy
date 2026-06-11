-- B2.4 batch 3: org-scope core property/profile RLS.
-- is_admin() -> is_org_admin(org_id); owner-scoped conditions preserved
-- verbatim (owner_id = auth.uid(), property_owners membership).
-- profiles policies are safe from recursion: is_org_admin() is SECURITY
-- DEFINER over organization_members, it never reads profiles.

-- properties
drop policy if exists "Owners view own properties" on public.properties;
create policy "Owners view own properties" on public.properties
  for select
  using (
    owner_id = auth.uid()
    or is_org_admin(org_id)
    or exists (
      select 1 from public.property_owners
      where property_owners.property_id = properties.id
        and property_owners.owner_id = auth.uid()
    )
  );
drop policy if exists "Owners insert own properties" on public.properties;
create policy "Owners insert own properties" on public.properties
  for insert to authenticated
  with check (owner_id = auth.uid() or is_org_admin(org_id));
drop policy if exists "Owners update own properties" on public.properties;
create policy "Owners update own properties" on public.properties
  for update
  using (
    owner_id = auth.uid()
    or is_org_admin(org_id)
    or exists (
      select 1 from public.property_owners
      where property_owners.property_id = properties.id
        and property_owners.owner_id = auth.uid()
    )
  );
drop policy if exists "Owners delete own properties" on public.properties;
create policy "Owners delete own properties" on public.properties
  for delete
  using (
    owner_id = auth.uid()
    or is_org_admin(org_id)
    or exists (
      select 1 from public.property_owners
      where property_owners.property_id = properties.id
        and property_owners.owner_id = auth.uid()
    )
  );

-- bookings
drop policy if exists "Owners view bookings for their properties" on public.bookings;
create policy "Owners view bookings for their properties" on public.bookings
  for select to authenticated
  using (user_owns_property(property_id) or is_org_admin(org_id));
drop policy if exists "Owners insert bookings for their properties" on public.bookings;
create policy "Owners insert bookings for their properties" on public.bookings
  for insert to authenticated
  with check (user_owns_property(property_id) or is_org_admin(org_id));
drop policy if exists "Owners update bookings for their properties" on public.bookings;
create policy "Owners update bookings for their properties" on public.bookings
  for update to authenticated
  using (user_owns_property(property_id) or is_org_admin(org_id))
  with check (user_owns_property(property_id) or is_org_admin(org_id));
drop policy if exists "Owners delete bookings for their properties" on public.bookings;
create policy "Owners delete bookings for their properties" on public.bookings
  for delete to authenticated
  using (user_owns_property(property_id) or is_org_admin(org_id));
drop policy if exists "Owners view own bookings" on public.bookings;
create policy "Owners view own bookings" on public.bookings
  for select
  using (
    is_org_admin(org_id)
    or exists (
      select 1 from public.properties
      where properties.id = bookings.property_id
        and (
          properties.owner_id = auth.uid()
          or exists (
            select 1 from public.property_owners po
            where po.property_id = properties.id and po.owner_id = auth.uid()
          )
        )
    )
  );

-- connections
drop policy if exists "Owners view own connections" on public.connections;
create policy "Owners view own connections" on public.connections
  for select to authenticated
  using (owner_id = auth.uid() or is_org_admin(org_id));
drop policy if exists "Owners insert own connections" on public.connections;
create policy "Owners insert own connections" on public.connections
  for insert to authenticated
  with check (owner_id = auth.uid() or is_org_admin(org_id));
drop policy if exists "Owners update own connections" on public.connections;
create policy "Owners update own connections" on public.connections
  for update to authenticated
  using (owner_id = auth.uid() or is_org_admin(org_id))
  with check (owner_id = auth.uid() or is_org_admin(org_id));
drop policy if exists "Owners delete own connections" on public.connections;
create policy "Owners delete own connections" on public.connections
  for delete to authenticated
  using (owner_id = auth.uid() or is_org_admin(org_id));

-- profiles
drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or is_org_admin(org_id));
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid() or is_org_admin(org_id))
  with check (id = auth.uid() or is_org_admin(org_id));

-- workspaces
drop policy if exists "Admins full access entities" on public.workspaces;
create policy "Admins full access entities" on public.workspaces
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
