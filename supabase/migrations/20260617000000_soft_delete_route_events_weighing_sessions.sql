-- Historial editable (spec 2026-06-17): anulación lógica de recorridos y sesiones
-- de pesaje, espejando container_receptions. Nunca se borra físicamente.

alter table public.route_events
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid references public.profiles(id),
  add column if not exists void_reason text;

comment on column public.route_events.voided_at is
  'Si no es null, el recorrido fue anulado desde el historial. Deja de contar en derivación de estado y reportes. Nunca se borra físicamente (trazabilidad).';

alter table public.weighing_sessions
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid references public.profiles(id),
  add column if not exists void_reason text;

comment on column public.weighing_sessions.voided_at is
  'Si no es null, la sesión de pesaje fue anulada desde el historial (anula en cascada sus recepciones). Nunca se borra físicamente (trazabilidad).';

-- La vista de cola de pesaje debe ignorar recorridos anulados.
create or replace view public.v_containers_pending_weighing
with (security_invoker = true)
as
select c.*
from public.containers c
where c.status = 'active'
  and exists (
    select 1
    from public.route_event_containers_dirty d
    join public.route_events re on re.id = d.route_event_id
    where d.container_id = c.id and re.voided_at is null
  )
  and not exists (
    select 1 from public.container_receptions r
    where r.container_id = c.id and r.voided_at is null
  );

grant select on public.v_containers_pending_weighing to authenticated;
