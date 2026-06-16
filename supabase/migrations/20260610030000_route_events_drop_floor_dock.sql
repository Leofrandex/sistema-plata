-- Columnas muertas: nunca se escriben desde la UI (la ubicación usa `area`).
alter table public.route_events drop column if exists floor;
alter table public.route_events drop column if exists dock;
