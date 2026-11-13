alter table public.publicites enable row level security;

drop policy if exists "Admin peut tout faire sur publicites" on public.publicites;
drop policy if exists "Admins can insert publicites" on public.publicites;
drop policy if exists "Admins can update publicites" on public.publicites;
drop policy if exists "Admins can delete publicites" on public.publicites;
drop policy if exists "Lecture publique des publicités actives" on public.publicites;
drop policy if exists "Public can view publicites" on public.publicites;

do $$
declare
  policy_name text;
begin
  foreach policy_name in array array[
    'publicites_public_select',
    'publicites_admin_insert',
    'publicites_admin_update',
    'publicites_admin_delete'
  ] loop
    execute format('drop policy if exists %I on public.publicites', policy_name);
  end loop;
end
$$;

create policy publicites_public_select
  on public.publicites
  for select
  to public
  using (true);

create policy publicites_admin_insert
  on public.publicites
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin is true
    )
  );

create policy publicites_admin_update
  on public.publicites
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin is true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin is true
    )
  );

create policy publicites_admin_delete
  on public.publicites
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin is true
    )
  );
