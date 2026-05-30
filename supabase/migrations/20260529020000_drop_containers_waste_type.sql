-- 2026-05-29: el tipo de desecho ya vive en container_receptions (input de pesaje).
-- El backfill a receptions se hizo en 20260529000000. Se elimina del tacho.
alter table public.containers drop column waste_type;
