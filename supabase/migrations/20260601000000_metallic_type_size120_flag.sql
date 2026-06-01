-- Tipo de desecho metálico (6º) + tamaño 120 L + flag de tacho dedicado a metálico.
-- ADD VALUE va en su propia migración: el nuevo valor de enum no puede usarse en la
-- misma transacción donde se crea (los INSERT/seed van en 20260601000100).

alter type public.waste_type add value if not exists 'metallic';

alter type public.container_size add value if not exists '120';

alter table public.containers
  add column if not exists is_metallic_dedicated boolean not null default false;

comment on column public.containers.is_metallic_dedicated is
  'Si true, el tacho está dedicado exclusivamente al pesaje de "Metálicos No reutilizables". Siempre disponible en pesaje (sin recorrido previo); solo aparece como opción cuando el operador elige el tipo de desecho metálico.';
