-- ============================================================================
-- Sincronización con cambios sesión 1 (2026-05-21):
--   - Recorridos: RouteKind (anden|morgue), slot nullable, morgue ad-hoc
--   - Pesaje: campo observations en container_receptions
-- Ver: docs/superpowers/plans/2026-05-21-sesion1-pesaje-recorridos-dashboard.md
-- ============================================================================

-- ─── route_kind enum + ajustes route_events ────────────────────────────────
create type route_kind as enum ('anden', 'morgue');

alter table public.route_events drop constraint route_events_date_slot_key;
alter table public.route_events alter column slot drop not null;

alter table public.route_events
  add column kind route_kind not null default 'anden';
alter table public.route_events alter column kind drop default;

alter table public.route_events
  add constraint route_events_slot_matches_kind check (
    (kind = 'anden'  and slot is not null) or
    (kind = 'morgue' and slot is null)
  );

create unique index route_events_anden_unique_date_slot
  on public.route_events (date, slot)
  where kind = 'anden';

-- ─── container_receptions.observations ─────────────────────────────────────
alter table public.container_receptions
  add column observations text not null default '';
