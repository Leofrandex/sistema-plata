-- 2026-09-24 — Inventario físico de planta en el dashboard.
--
-- Dos atributos físicos del contenedor que vienen del Excel de inventario de
-- planta ("Inventario de Contenedores en Proceso"). Se cargan con
-- scripts/sync_inventario_fisico.py; no hay pantalla de edición.
-- null = sin dato (el contenedor nunca apareció en el Excel). Sin default a
-- propósito: no se inventa un valor.

alter table public.containers
  add column has_wheels boolean,
  add column color text check (color in ('rojo', 'verde'));

comment on column public.containers.has_wheels is
  'Tacho con llantas (true) o sin llantas (false). null = sin dato. Fuente: Excel de inventario de planta.';
comment on column public.containers.color is
  'Color del contenedor (Yaris: rojo o verde). null = sin dato. Fuente: Excel de inventario de planta.';
