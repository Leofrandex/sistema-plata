-- ============================================================================
-- 2026-05-29: empresa y tipo de desecho dinámicos en la recepción de pesaje
--   - container_receptions.company_id  (snapshot de la empresa del recorrido)
--   - container_receptions.waste_type  (input del operador en pesaje; backfill
--     desde el waste_type histórico del tacho)
--   - container_receptions.treat_immediately (tratar al finalizar la sesión)
-- Ver: docs/superpowers/specs/2026-05-29-pesaje-tratamiento-rename-tacho-design.md
-- ============================================================================

alter table public.container_receptions
  add column company_id text null references public.companies(id);

alter table public.container_receptions
  add column waste_type public.waste_type not null default 'infectious';

-- Backfill: copiar el tipo real del tacho a sus recepciones existentes
update public.container_receptions r
  set waste_type = c.waste_type
  from public.containers c
  where r.container_id = c.id;

alter table public.container_receptions
  add column treat_immediately boolean not null default false;
