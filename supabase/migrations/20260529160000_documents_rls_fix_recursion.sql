-- Break RLS recursion on documents. The legacy "Owners can view own documents"
-- policy reached documents -> document_properties -> documents (latent until the
-- spine made documents the first table read via RLS). Replace workspace/co-owner
-- access with a SECURITY DEFINER helper that reads profiles without re-entering RLS.
-- Applied to remote via Supabase MCP as `documents_rls_fix_recursion`.

create or replace function public.auth_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.profiles where id = auth.uid()
$$;

drop policy if exists "Owners can view own documents" on public.documents;

drop policy if exists "Owners can read their documents" on public.documents;
create policy "Owners can read their documents" on public.documents
  for select to authenticated
  using (auth.uid() = owner_id);

drop policy if exists documents_workspace_member_read on public.documents;
create policy documents_workspace_member_read on public.documents
  for select to authenticated
  using (workspace_id is not null and workspace_id = public.auth_workspace_id());

drop policy if exists document_signers_self_read on public.document_signers;
create policy document_signers_self_read on public.document_signers
  for select to authenticated
  using (
    signer_profile_id = auth.uid()
    or exists (
      select 1 from public.documents d
      where d.id = document_signers.document_id
        and (d.owner_id = auth.uid()
             or (d.workspace_id is not null and d.workspace_id = public.auth_workspace_id()))
    )
  );
