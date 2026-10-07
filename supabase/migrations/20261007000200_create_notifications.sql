create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  alerte_id uuid not null references public.alertes_recherche (id) on delete cascade,
  annonce_id uuid not null references public.publications (id) on delete cascade,
  lu boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_user_alerte_annonce_key unique (user_id, alerte_id, annonce_id)
);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can mark their notifications as read" on public.notifications;
create policy "Users can mark their notifications as read"
  on public.notifications
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (lu) on public.notifications to authenticated;
grant all on public.notifications to service_role;
