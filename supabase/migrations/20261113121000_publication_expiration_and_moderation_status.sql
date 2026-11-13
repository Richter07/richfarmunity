alter table public.publications
  add column if not exists statut_moderation text,
  add column if not exists expire_at timestamptz;

update public.publications
set statut_moderation = case
  when expire_at is not null and expire_at <= now() and approuve is true then 'expiree'
  when rejete is true then 'refusee'
  when approuve is true then 'publiee'
  else 'en_attente'
end
where statut_moderation is null;

alter table public.publications
  alter column statut_moderation set default 'en_attente',
  alter column statut_moderation set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'publications_statut_moderation_check'
      and conrelid = 'public.publications'::regclass
  ) then
    alter table public.publications
      add constraint publications_statut_moderation_check
      check (statut_moderation in ('en_attente', 'publiee', 'refusee', 'expiree'));
  end if;
end
$$;

create index if not exists publications_moderation_status_idx
  on public.publications (statut_moderation, created_at desc);

create index if not exists publications_expire_at_idx
  on public.publications (expire_at)
  where expire_at is not null;

alter table public.publicites
  add column if not exists expire_at timestamptz;

update public.publicites
set expire_at = ((date_expiration::date + 1)::timestamp at time zone 'Africa/Porto-Novo')
where expire_at is null
  and date_expiration is not null;

update public.publications
set statut_moderation = 'expiree'
where statut_moderation = 'publiee'
  and expire_at is not null
  and expire_at <= now();

update public.publicites
set actif = false
where actif is true
  and expire_at is not null
  and expire_at <= now();

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname = 'richfarmunity-expire-listings';

select cron.schedule(
  'richfarmunity-expire-listings',
  '* * * * *',
  $job$
    update public.publications
    set statut_moderation = 'expiree'
    where statut_moderation = 'publiee'
      and expire_at is not null
      and expire_at <= now();

    update public.publicites
    set actif = false
    where actif is true
      and expire_at is not null
      and expire_at <= now();
  $job$
);