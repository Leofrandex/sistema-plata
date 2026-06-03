-- Los contenedores Yaris nunca se pesan directamente (se usan los tachos
-- alternativos), así que se excluyen de la cola de pesaje.
create or replace view public.v_containers_pending_weighing
with (security_invoker = true)
as
select c.*
from public.containers c
where c.status = 'active'
  and c.is_yaris_container = false
  and exists (
    select 1 from public.route_event_containers_dirty d where d.container_id = c.id
  )
  and not exists (
    select 1 from public.container_receptions r
    where r.container_id = c.id and r.voided_at is null
  );

grant select on public.v_containers_pending_weighing to authenticated;
