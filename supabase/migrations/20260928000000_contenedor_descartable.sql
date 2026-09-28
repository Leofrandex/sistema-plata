-- 2026-09-28 — Contenedor descartable para citotóxico, anatomopatológico y morgue.
-- Esos residuos no van en tachos: se pesan en un contenedor propio que se
-- desecha. El pesaje guarda el número escrito (container_ref), sin tacho ni tara.
-- Ver docs/superpowers/specs/2026-09-28-contenedor-descartable-design.md.

alter table public.container_receptions alter column container_id drop not null;
alter table public.container_receptions add column container_ref text;

comment on column public.container_receptions.container_ref is
  'Número del contenedor descartable (cito/anato/morgue), escrito por el operador. Con container_id null: neto = bruto.';

-- Históricos: se cargaron contra un tacho cualquiera porque el formulario lo exigía.
update public.container_receptions
   set container_id = null, container_ref = 'S/N (histórico)'
 where waste_type in ('cytotoxic', 'anatomopathological', 'morgue')
   and container_id is not null;
