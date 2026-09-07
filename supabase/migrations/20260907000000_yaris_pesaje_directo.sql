-- 2026-09-07 — La flota Yaris estrena pesa dedicada.
--
-- Hasta hoy los contenedores Y1..Y26 no se pesaban directamente: su carga se
-- volcaba en un tacho marcado `is_yaris_dedicated` y ése era el que subía a la
-- balanza. Con pesa propia, los Yaris se pesan tal cual y los tachos
-- alternativos vuelven a la operación normal.
--
-- Revierte 20260603010200 (exclusión de la cola de pesaje) y deja
-- `is_yaris_dedicated` en false para toda la flota. La columna NO se dropea:
-- sigue documentando el histórico y la lee `database.types.ts`.

-- 1. Taras reales de la flota Yaris (provistas por operaciones, 2026-09-07).
--    Estaban en 0 porque nunca se pesaban directamente.
update public.containers c
set tare_weight_kg = t.tare
from (values
  ('Y1', 51.4), ('Y2', 52.6), ('Y3', 51.7), ('Y4', 51.7), ('Y5', 51.3),
  ('Y6', 51.7), ('Y7', 51.7), ('Y8', 51.7), ('Y9', 51.7), ('Y10', 51.4),
  ('Y11', 50.9), ('Y12', 51.4), ('Y13', 51.6), ('Y14', 51.3), ('Y15', 52.4),
  ('Y16', 51.9), ('Y17', 52.1), ('Y18', 51.4), ('Y19', 52.0), ('Y20', 51.1),
  ('Y21', 51.2), ('Y22', 51.2), ('Y23', 51.8), ('Y24', 51.7), ('Y25', 51.4),
  ('Y26', 51.8)
) as t(id, tare)
where c.id = t.id;

-- 2. Ya no existe el concepto de "tacho dedicado a pesar Yaris".
update public.containers
set is_yaris_dedicated = false
where is_yaris_dedicated = true;

-- 3. Los Yaris entran a la cola de pesaje como cualquier tacho.
create or replace view public.v_containers_pending_weighing
with (security_invoker = true)
as
select c.*
from public.containers c
where c.status = 'active'
  and exists (
    select 1 from public.route_event_containers_dirty d where d.container_id = c.id
  )
  and not exists (
    select 1 from public.container_receptions r
    where r.container_id = c.id and r.voided_at is null
  );

grant select on public.v_containers_pending_weighing to authenticated;
