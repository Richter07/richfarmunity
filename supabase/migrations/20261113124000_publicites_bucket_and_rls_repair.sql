insert into storage.buckets (id, name, public)
values ('publicites', 'publicites', true)
on conflict (id) do update
set name = excluded.name,
    public = true;

alter table public.publicites enable row level security;

drop policy if exists "Admin peut tout faire sur publicites" on public.publicites;
drop policy if exists "Admins can insert publicites" on public.publicites;
drop policy if exists "Admins can update publicites" on public.publicites;
drop policy if exists "Admins can delete publicites" on public.publicites;
drop policy if exists "Lecture publique des publicités actives" on public.publicites;
drop policy if exists "Public can view publicites" on public.publicites;
drop policy if exists publicites_public_select on public.publicites;
drop policy if exists publicites_admin_insert on public.publicites;
drop policy if exists publicites_admin_update on public.publicites;
drop policy if exists publicites_admin_delete on public.publicites;

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

drop policy if exists "Admins upload publicites" on storage.objects;
drop policy if exists "Admins delete publicites" on storage.objects;
drop policy if exists "Admins update publicites" on storage.objects;
drop policy if exists "Public view publicites" on storage.objects;
drop policy if exists publicites_objects_public_select on storage.objects;
drop policy if exists publicites_objects_admin_insert on storage.objects;
drop policy if exists publicites_objects_admin_update on storage.objects;
drop policy if exists publicites_objects_admin_delete on storage.objects;

create policy publicites_objects_public_select
  on storage.objects
  for select
  to public
  using (bucket_id = 'publicites');

create policy publicites_objects_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'publicites'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin is true
    )
  );

create policy publicites_objects_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'publicites'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin is true
    )
  )
  with check (
    bucket_id = 'publicites'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin is true
    )
  );

create policy publicites_objects_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'publicites'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin is true
    )
  );
