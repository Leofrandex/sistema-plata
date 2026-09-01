-- Reset de datos operativos. Conserva master data.
--
-- REQUISITOS ANTES DE EJECUTAR:
--   1. backup-datos-operativos.sql ejecutado y exportado, con conteos validados 1:1.
--   2. El APK del modo interino YA desplegado en todos los teléfonos de planta.
--      Si queda un teléfono con la versión anterior, su outbox drena encima de
--      la base vaciada y reaparecen recorridos fantasma.
--
-- Se conservan: containers, equipment, profiles, clients, companies,
-- equipment_maintenance.
--
-- `photos` es una tabla compartida (columna discriminadora `event_type`,
-- enum `photo_event_type`: 'route' | 'weighing' | 'storage' | 'treatment' |
-- 'other' | 'maintenance' — ver supabase/migrations/20260521000000_initial_schema.sql
-- y .../20260716000000_equipment_maintenance.sql). Las fotos con
-- event_type = 'maintenance' son la evidencia de equipment_maintenance, que
-- este script conserva explícitamente; truncar `photos` entera las dejaría
-- huérfanas. Por eso NO se trunca: se borran selectivamente solo las fotos
-- de eventos operativos (route/weighing/storage/treatment/other) y las de
-- mantenimiento sobreviven.
--
-- NOTA: el bucket de Storage con los archivos de esas fotos operativas NO se
-- toca. Los objetos quedan huérfanos (decisión consciente, ver el spec).
-- Vaciarlo antes del próximo reset.

begin;

truncate table
  route_event_containers_dirty,
  route_event_containers_clean,
  container_receptions,
  weighing_sessions,
  route_events,
  storage_events,
  treatment_runs,
  container_locations,
  external_transfers
restart identity cascade;

-- Borrado selectivo de `photos`: se conservan las de mantenimiento de equipos.
delete from photos where event_type <> 'maintenance';

commit;

-- Verificación: las 9 tablas truncadas en 0, `photos` solo con mantenimiento,
-- la master data intacta.
select 'route_events' as tabla, count(*) from route_events
union all select 'route_event_containers_dirty', count(*) from route_event_containers_dirty
union all select 'route_event_containers_clean', count(*) from route_event_containers_clean
union all select 'weighing_sessions', count(*) from weighing_sessions
union all select 'container_receptions', count(*) from container_receptions
union all select 'storage_events', count(*) from storage_events
union all select 'treatment_runs', count(*) from treatment_runs
union all select 'container_locations', count(*) from container_locations
union all select 'external_transfers', count(*) from external_transfers
union all select 'containers (debe seguir en 246)', count(*) from containers
union all select 'equipment (debe seguir en 60)', count(*) from equipment
union all select 'profiles (debe seguir en 13)', count(*) from profiles;

-- Desglose de `photos` por tipo de evento: confirmar de un vistazo que solo
-- queda 'maintenance' (todo lo demás debe estar en 0).
select event_type, count(*)
from photos
group by event_type
order by event_type;
