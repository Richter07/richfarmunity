alter table public.profiles
  add column if not exists badge_verifie boolean not null default false,
  add column if not exists badge_paye_le timestamptz;
