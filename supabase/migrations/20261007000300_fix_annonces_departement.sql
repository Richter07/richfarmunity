alter table public.publications
  add column if not exists departement text;

update public.publications
set departement = case
  when localisation ilike '%Alibori%' then 'Alibori'
  when localisation ilike '%Atacora%' then 'Atacora'
  when localisation ilike '%Atlantique%' then 'Atlantique'
  when localisation ilike '%Borgou%' then 'Borgou'
  when localisation ilike '%Collines%' then 'Collines'
  when localisation ilike '%Couffo%' then 'Couffo'
  when localisation ilike '%Donga%' then 'Donga'
  when localisation ilike '%Littoral%' then 'Littoral'
  when localisation ilike '%Mono%' then 'Mono'
  when localisation ilike '%Ouémé%' or localisation ilike '%Oueme%' then 'Ouémé'
  when localisation ilike '%Plateau%' then 'Plateau'
  when localisation ilike '%Zou%' then 'Zou'
  else null
end
where departement is null
  and localisation is not null;

create index if not exists publications_departement_idx
  on public.publications (departement)
  where departement is not null;
