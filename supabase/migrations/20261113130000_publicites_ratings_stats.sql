create table if not exists public.publicite_notes (
  id uuid primary key default gen_random_uuid(),
  publicite_id uuid not null references public.publicites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note smallint not null check (note between 1 and 5),
  created_at timestamptz not null default now(),
  constraint publicite_notes_one_vote_per_user unique (publicite_id, user_id)
);

create index if not exists publicite_notes_publicite_id_idx
  on public.publicite_notes (publicite_id);

alter table public.publicite_notes enable row level security;

drop policy if exists publicite_notes_public_select on public.publicite_notes;
drop policy if exists publicite_notes_authenticated_insert on public.publicite_notes;

create policy publicite_notes_public_select
  on public.publicite_notes
  for select
  to anon, authenticated
  using (true);

create policy publicite_notes_authenticated_insert
  on public.publicite_notes
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

grant select on public.publicite_notes to anon, authenticated;
grant insert on public.publicite_notes to authenticated;
revoke update, delete on public.publicite_notes from anon, authenticated;

create table if not exists public.publicite_stats (
  id uuid primary key default gen_random_uuid(),
  publicite_id uuid not null references public.publicites(id) on delete cascade,
  event_type text not null check (event_type in ('vue', 'clic', 'partage')),
  created_at timestamptz not null default now()
);

create index if not exists publicite_stats_publicite_event_idx
  on public.publicite_stats (publicite_id, event_type);

alter table public.publicite_stats enable row level security;

drop policy if exists publicite_stats_public_insert on public.publicite_stats;
drop policy if exists publicite_stats_admin_select on public.publicite_stats;

create policy publicite_stats_public_insert
  on public.publicite_stats
  for insert
  to anon, authenticated
  with check (event_type in ('vue', 'clic', 'partage'));

create policy publicite_stats_admin_select
  on public.publicite_stats
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.is_admin is true
    )
  );

grant insert on public.publicite_stats to anon, authenticated;
grant select on public.publicite_stats to authenticated;
revoke update, delete on public.publicite_stats from anon, authenticated;
