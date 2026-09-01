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
-- NOTA: el bucket de Storage `photos` NO se toca. Los objetos quedan huérfanos
-- (decisión consciente, ver el spec). Vaciarlo antes del próximo reset.

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
  external_transfers,
  photos
restart identity cascade;

commit;

-- Verificación: las 10 tablas en 0, la master data intacta.
select 'route_events' as tabla, count(*) from route_events
union all select 'route_event_containers_dirty', count(*) from route_event_containers_dirty
union all select 'route_event_containers_clean', count(*) from route_event_containers_clean
union all select 'weighing_sessions', count(*) from weighing_sessions
union all select 'container_receptions', count(*) from container_receptions
union all select 'storage_events', count(*) from storage_events
union all select 'treatment_runs', count(*) from treatment_runs
union all select 'container_locations', count(*) from container_locations
union all select 'external_transfers', count(*) from external_transfers
union all select 'photos', count(*) from photos
union all select 'containers (debe seguir en 246)', count(*) from containers
union all select 'equipment (debe seguir en 60)', count(*) from equipment
union all select 'profiles (debe seguir en 13)', count(*) from profiles;
