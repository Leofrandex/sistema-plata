-- 2026-09-28 — Regla: cito/anato/morgue llevan número y no tacho; el resto, tacho.
-- APLICAR SOLO cuando todos los teléfonos tengan APK v1.12: un APK viejo manda
-- tacho para estos tipos y esta regla rechazaría esos pesajes.
-- Antes de aplicar, corregir los que hayan entrado con tacho:
--   update public.container_receptions set container_id = null, container_ref = 'S/N (histórico)'
--    where waste_type in ('cytotoxic','anatomopathological','morgue') and container_id is not null;

alter table public.container_receptions add constraint container_receptions_container_by_type check (
  case when waste_type in ('cytotoxic', 'anatomopathological', 'morgue')
       then container_id is null and coalesce(btrim(container_ref), '') <> ''
       else container_id is not null and container_ref is null end
);
