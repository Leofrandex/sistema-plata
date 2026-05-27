-- Limpieza automática de recorridos que quedaron "in_progress" y fueron
-- abandonados (operador cerró la app sin finalizar, o falló el cierre por
-- mala señal). Sin esto, el índice único parcial (date, slot) WHERE kind='anden'
-- bloquearía reiniciar ese slot.

create extension if not exists pg_cron;

create or replace function public.cleanup_stale_route_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  -- Borra recorridos in_progress iniciados hace más de 12 horas.
  -- Las join tables route_event_containers_* se borran por cascade.
  with del as (
    delete from public.route_events
    where status = 'in_progress'
      and started_at < now() - interval '12 hours'
    returning id
  )
  select count(*) into deleted_count from del;
  return deleted_count;
end;
$$;

comment on function public.cleanup_stale_route_events is
  'Borra route_events in_progress de más de 12h (recorridos abandonados/fallidos). Ejecutado por pg_cron cada hora.';

-- Programar cada hora en el minuto 0.
select cron.schedule(
  'cleanup-stale-route-events',
  '0 * * * *',
  $$select public.cleanup_stale_route_events();$$
);
