-- Equipos de la base instalada PTDP + historial de mantenimiento preventivo.
-- Módulo solo-coordinador; ver spec 2026-07-16-equipos-mantenimiento-preventivo.

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  model text,
  serial text,
  identification text,
  owner text,      -- CSS / HOSPIMED / HOSPIWASTE (columna "COMENTARIOS" del Excel)
  provider text,
  maintenance_frequency_days int,  -- null = sin configurar (semáforo gris)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.equipment_maintenance (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id),
  performed_at date not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  -- Anulación lógica, espejo de route_events / weighing_sessions
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  voided_reason text
);

create index equipment_maintenance_equipment_idx
  on public.equipment_maintenance (equipment_id, performed_at desc);

-- Fotos de evidencia de mantenimiento reutilizan public.photos
alter type photo_event_type add value if not exists 'maintenance';

-- RLS: policy piloto "authenticated full access" (mismo criterio que el resto)
alter table public.equipment enable row level security;
alter table public.equipment_maintenance enable row level security;

do $$
declare
  t text;
  tables text[] := array['equipment', 'equipment_maintenance'];
begin
  foreach t in array tables loop
    execute format(
      'create policy "%I select authenticated" on public.%I
         for select to authenticated using (true);', t, t);
    execute format(
      'create policy "%I insert authenticated" on public.%I
         for insert to authenticated with check (true);', t, t);
    execute format(
      'create policy "%I update authenticated" on public.%I
         for update to authenticated using (true) with check (true);', t, t);
    execute format(
      'create policy "%I delete authenticated" on public.%I
         for delete to authenticated using (true);', t, t);
  end loop;
end $$;
