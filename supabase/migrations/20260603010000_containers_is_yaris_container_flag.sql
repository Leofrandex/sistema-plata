-- Flag de "contenedor de la flota Yaris": tacho físico que circula en recorrido,
-- sin tara y sin ciclo de planta (se pesa con los tachos alternativos
-- is_yaris_dedicated). Distinto de is_yaris_dedicated.
alter table public.containers
  add column if not exists is_yaris_container boolean not null default false;

comment on column public.containers.is_yaris_container is
  'Si true, el tacho es un contenedor físico de la flota Yaris: siempre disponible en recorrido, sin tara, y EXCLUIDO de la cola de pesaje y del dashboard de circulación (no atraviesa el ciclo de planta). Distinto de is_yaris_dedicated, que marca el tacho con el que se pesan las cargas Yaris.';
