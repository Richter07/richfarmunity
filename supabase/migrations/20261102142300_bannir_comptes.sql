-- Ajoute le bannissement définitif aux comptes existants.
alter table public.profiles add column if not exists compte_banni boolean not null default false;

create index if not exists profiles_compte_banni_idx on public.profiles (compte_banni);
