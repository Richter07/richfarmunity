create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  actor_type text := coalesce(user_metadata ->> 'type_acteur', '');
begin
  insert into public.profiles (
    id,
    email,
    prenom,
    nom,
    telephone,
    type_acteur,
    domaine,
    compte_approuve,
    compte_rejete,
    is_admin
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(user_metadata ->> 'prenom', ''),
    coalesce(user_metadata ->> 'nom', ''),
    coalesce(user_metadata ->> 'telephone', ''),
    actor_type,
    coalesce(user_metadata ->> 'domaine', ''),
    actor_type <> 'Membre d''institution',
    false,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.enforce_profile_actor_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean := false;
begin
  if auth.uid() is null then
    caller_is_admin := current_setting('role', true) in ('service_role', 'postgres', 'supabase_admin');
  else
    select coalesce(profile.is_admin, false)
      into caller_is_admin
      from public.profiles as profile
      where profile.id = auth.uid();
  end if;

  if not caller_is_admin then
    new.compte_rejete := old.compte_rejete;
    if new.type_acteur = 'Membre d''institution' then
      if new.type_acteur is distinct from old.type_acteur then
        new.compte_approuve := false;
      else
        new.compte_approuve := old.compte_approuve;
      end if;
    else
      new.compte_approuve := true;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_profile_actor_approval on public.profiles;
create trigger enforce_profile_actor_approval
  before update of type_acteur, compte_approuve, compte_rejete on public.profiles
  for each row execute function public.enforce_profile_actor_approval();

update public.profiles
set compte_approuve = true
where type_acteur <> 'Membre d''institution'
  and coalesce(compte_rejete, false) = false
  and compte_approuve is distinct from true;
