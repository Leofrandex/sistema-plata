-- Marca de envase dedicado a pesaje de vehículos Yaris/Picanto.
-- Cuando true, solo aparece como opción en /register/weighing cuando el
-- operador activa explícitamente el modo "pesaje de Yaris".
alter table public.containers
  add column if not exists is_yaris_dedicated boolean not null default false;

comment on column public.containers.is_yaris_dedicated is
  'Si true, el envase está dedicado exclusivamente a pesaje de carga proveniente de vehículos Yaris/Picanto (sin tara propia). Solo aparece como opción en el formulario de pesaje cuando el operador marca explícitamente "pesaje de Yaris".';
