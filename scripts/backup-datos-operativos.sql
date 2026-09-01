-- Respaldo previo al reset de datos operativos.
-- Uso: ejecutar en el SQL editor de Supabase y exportar cada resultado a JSON
-- en backups/YYYY-MM-DD-reset/ ANTES de correr reset-datos-operativos.sql.
-- Ver logs/2026-07-28-reset-datos-operativos.md para el precedente.

-- 1) Conteos de control. Guardar esta salida: valida el respaldo 1:1.
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
union all select 'containers (SE CONSERVA)', count(*) from containers
union all select 'equipment (SE CONSERVA)', count(*) from equipment
union all select 'profiles (SE CONSERVA)', count(*) from profiles
union all select 'clients (SE CONSERVA)', count(*) from clients
union all select 'companies (SE CONSERVA)', count(*) from companies;

-- 2) Volcado. Cada select se exporta a un archivo JSON del directorio de backup.
select * from route_events;
select * from route_event_containers_dirty;
select * from route_event_containers_clean;
select * from weighing_sessions;
select * from container_receptions;
select * from storage_events;
select * from treatment_runs;
select * from container_locations;
select * from external_transfers;
select * from photos;
select * from containers;  -- snapshot de master data, por seguridad
