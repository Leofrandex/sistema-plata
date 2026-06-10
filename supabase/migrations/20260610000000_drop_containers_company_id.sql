-- 2026-06-10: La empresa es propiedad del REGISTRO (route_events / container_receptions),
-- nunca del tacho. El tacho es un identificador físico independiente que pasa por
-- distintas empresas a lo largo de su vida. Ningún tacho tenía empresa asignada
-- (0/230), así que la columna era código muerto. Se elimina.
--
-- La vista v_containers_pending_weighing exponía company_id; se recrea sin él
-- (la columna no se consume en ningún lado del cliente).
-- Ver: logs/2026-06-10-empresa-por-registro-tacho-independiente.md

drop view if exists public.v_containers_pending_weighing;

alter table public.containers drop column if exists company_id;

create view public.v_containers_pending_weighing as
  select
    id,
    size_liters,
    tare_weight_kg,
    status,
    registered_at,
    is_yaris_dedicated,
    is_metallic_dedicated,
    is_yaris_container
  from public.containers c
  where status = 'active'::container_status
    and is_yaris_container = false
    and exists (
      select 1 from public.route_event_containers_dirty d where d.container_id = c.id
    )
    and not exists (
      select 1 from public.container_receptions r
      where r.container_id = c.id and r.voided_at is null
    );
