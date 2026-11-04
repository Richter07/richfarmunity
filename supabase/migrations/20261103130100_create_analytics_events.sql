create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  page text,
  user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table public.analytics_events enable row level security;

drop policy if exists "allow all" on public.analytics_events;
create policy "allow all" on public.analytics_events for all using (true) with check (true);

create index if not exists analytics_created_idx on public.analytics_events (created_at desc);
