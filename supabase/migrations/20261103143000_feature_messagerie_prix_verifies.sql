alter table public.profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists rating_avg numeric(3,2) not null default 0,
  add column if not exists rating_count integer not null default 0;

create table if not exists public.prix_history (
  id uuid primary key default gen_random_uuid(),
  produit text not null,
  marche text,
  prix numeric not null,
  source_user uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(from_user, to_user)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.prix_history enable row level security;
alter table public.ratings enable row level security;
alter table public.messages enable row level security;

drop policy if exists "allow all prix_history" on public.prix_history;
drop policy if exists "allow all ratings" on public.ratings;
drop policy if exists "allow all messages" on public.messages;
create policy "allow all prix_history" on public.prix_history for all using (true) with check (true);
create policy "allow all ratings" on public.ratings for all using (true) with check (true);
create policy "allow all messages" on public.messages for all using (true) with check (true);

create index if not exists prix_history_produit_created_idx on public.prix_history(produit, created_at desc);
create index if not exists ratings_to_user_idx on public.ratings(to_user);
create index if not exists messages_from_to_created_idx on public.messages(from_user, to_user, created_at desc);

create or replace function public.refresh_profile_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cible uuid;
begin
  cible := coalesce(new.to_user, old.to_user);
  update public.profiles p set
    rating_avg = coalesce((select avg(stars)::numeric(3,2) from public.ratings where to_user = cible), 0),
    rating_count = coalesce((select count(*) from public.ratings where to_user = cible), 0)
  where p.id = cible;
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_profile_rating on public.ratings;
create trigger refresh_profile_rating after insert or update or delete on public.ratings
for each row execute function public.refresh_profile_rating();
