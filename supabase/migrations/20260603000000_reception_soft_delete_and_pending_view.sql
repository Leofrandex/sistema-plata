-- P1 (bloqueantes pre-lanzamiento, ADR 2026-05-21-estado-envase-derivado):
--   a) Soft-delete de recepciones para "Deshacer pesaje" sin perder trazabilidad.
--   b) Cola de pesaje como vista de Postgres (deriva la misma lógica del cliente).

-- ── a) Anulación lógica de recepciones ──────────────────────────────────────
alter table public.container_receptions
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid references public.profiles(id),
  add column if not exists void_reason text;

comment on column public.container_receptions.voided_at is
  'Si no es null, la recepción fue anulada (deshacer pesaje). Nunca se borra físicamente: la trazabilidad regulatoria exige conservar el hecho. Todas las queries/vistas filtran voided_at is null.';

-- La vista de peso neto solo expone recepciones vigentes (no anuladas).
-- Drop + create: r.* gana columnas nuevas y cambia el orden, lo que CREATE OR
-- REPLACE VIEW no permite.
drop view if exists public.container_receptions_with_net;
create view public.container_receptions_with_net
with (security_invoker = true)
as
select
  r.*,
  (r.gross_weight_kg - c.tare_weight_kg)::numeric(8,3) as net_weight_kg
from public.container_receptions r
join public.containers c on c.id = r.container_id
where r.voided_at is null;

grant select on public.container_receptions_with_net to authenticated;

-- ── b) Cola de pesaje como vista ────────────────────────────────────────────
-- Réplica de getPendingWeighingContainerIds (src/lib/data/containers.ts):
-- tacho activo + recogido sucio en algún recorrido + sin recepción vigente.
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
