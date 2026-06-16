-- Traza de quién registró cada tacho. Nullable: los 230 históricos quedan null.
alter table public.containers
  add column created_by uuid references public.profiles(id);

comment on column public.containers.created_by is
  'Perfil que registró el tacho. Null para históricos importados.';
