alter table public.publicites
  add column if not exists images jsonb not null default '[]'::jsonb;

update public.publicites
set images = jsonb_build_array(image_url)
where images = '[]'::jsonb
  and image_url is not null;
