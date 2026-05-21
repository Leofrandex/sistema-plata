-- ============================================================================
-- Hospiwaste — schema inicial
-- Generado: 2026-05-21
-- Modelo de datos: vault/project/DataModel.md (revision 2026-05-17)
-- ============================================================================

-- ─── Enums ─────────────────────────────────────────────────────────────────
create type waste_type as enum (
  'infectious',
  'anatomopathological',
  'cytotoxic',
  'liquid',
  'morgue'
);

create type container_size as enum ('240', '750', '1100');
create type container_status as enum ('active', 'decommissioned');
create type container_phase as enum (
  'route', 'weighing', 'cold_storage', 'treatment', 'transfer', 'clean'
);
create type location_type as enum (
  'client_site', 'plant_storage', 'cold_storage', 'treatment'
);
create type photo_event_type as enum (
  'route', 'weighing', 'storage', 'treatment', 'other'
);
create type route_slot as enum (
  '06:30', '10:30', '13:20', '14:30', '18:30', '21:00'
);
create type route_event_status as enum ('in_progress', 'completed');
create type weighing_session_status as enum ('in_progress', 'completed');

-- ─── profiles (extiende auth.users) ────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── clients ───────────────────────────────────────────────────────────────
create table public.clients (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.client_locations (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  floor text not null,
  area text not null,
  unique (client_id, floor, area)
);

-- ─── companies ─────────────────────────────────────────────────────────────
create table public.companies (
  id text primary key,
  client_id text not null references public.clients(id) on delete restrict,
  name text not null,
  code_letter text not null check (char_length(code_letter) between 1 and 3),
  created_at timestamptz not null default now(),
  unique (client_id, code_letter)
);

-- ─── containers ────────────────────────────────────────────────────────────
create table public.containers (
  id text primary key,
  company_id text not null references public.companies(id) on delete restrict,
  size_liters container_size not null,
  tare_weight_kg numeric(8,3) not null check (tare_weight_kg >= 0),
  waste_type waste_type not null,
  status container_status not null default 'active',
  registered_at timestamptz not null default now()
);

create index containers_company_idx on public.containers(company_id);
create index containers_status_idx on public.containers(status);

-- ─── photos ────────────────────────────────────────────────────────────────
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text,
  url text,
  event_type photo_event_type not null,
  event_id text not null,
  taken_at timestamptz not null default now(),
  label text not null default '',
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index photos_event_idx on public.photos(event_type, event_id);

-- ─── route_events ──────────────────────────────────────────────────────────
create table public.route_events (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete restrict,
  slot route_slot not null,
  date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  operator_id uuid not null references public.profiles(id),
  status route_event_status not null default 'in_progress',
  floor text not null default '',
  area text not null default '',
  dock text not null default '',
  created_at timestamptz not null default now(),
  unique (date, slot)
);

create index route_events_date_idx on public.route_events(date desc);
create index route_events_client_idx on public.route_events(client_id);

create table public.route_event_containers_dirty (
  route_event_id uuid not null references public.route_events(id) on delete cascade,
  container_id text not null references public.containers(id) on delete restrict,
  primary key (route_event_id, container_id)
);

create table public.route_event_containers_clean (
  route_event_id uuid not null references public.route_events(id) on delete cascade,
  container_id text not null references public.containers(id) on delete restrict,
  primary key (route_event_id, container_id)
);

-- ─── weighing_sessions ─────────────────────────────────────────────────────
create table public.weighing_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete restrict,
  date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  operator_id uuid not null references public.profiles(id),
  status weighing_session_status not null default 'in_progress',
  created_at timestamptz not null default now()
);

create index weighing_sessions_date_idx on public.weighing_sessions(date desc);

-- ─── container_receptions ─────────────────────────────────────────────────
create table public.container_receptions (
  id uuid primary key default gen_random_uuid(),
  container_id text not null references public.containers(id) on delete restrict,
  weighing_session_id uuid references public.weighing_sessions(id) on delete set null,
  arrived_at timestamptz not null default now(),
  gross_weight_kg numeric(8,3) not null check (gross_weight_kg >= 0),
  operator_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index receptions_container_idx on public.container_receptions(container_id);
create index receptions_session_idx on public.container_receptions(weighing_session_id);
create index receptions_arrived_idx on public.container_receptions(arrived_at desc);

create view public.container_receptions_with_net
with (security_invoker = true)
as
select
  r.*,
  (r.gross_weight_kg - c.tare_weight_kg)::numeric(8,3) as net_weight_kg
from public.container_receptions r
join public.containers c on c.id = r.container_id;

-- ─── storage_events ───────────────────────────────────────────────────────
create table public.storage_events (
  id uuid primary key default gen_random_uuid(),
  container_id text not null references public.containers(id) on delete restrict,
  entry_at timestamptz not null default now(),
  exit_at timestamptz,
  operator_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index storage_container_idx on public.storage_events(container_id);

-- ─── treatment_runs ───────────────────────────────────────────────────────
create table public.treatment_runs (
  id uuid primary key default gen_random_uuid(),
  container_id text not null references public.containers(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  operator_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index treatment_container_idx on public.treatment_runs(container_id);

-- ─── external_transfers ───────────────────────────────────────────────────
create table public.external_transfers (
  id uuid primary key default gen_random_uuid(),
  container_id text not null references public.containers(id) on delete restrict,
  storage_started_at timestamptz not null default now(),
  transferred_at timestamptz,
  destination text not null default '',
  operator_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index transfers_container_idx on public.external_transfers(container_id);

-- ─── container_locations ──────────────────────────────────────────────────
create table public.container_locations (
  id uuid primary key default gen_random_uuid(),
  container_id text not null references public.containers(id) on delete restrict,
  reported_at timestamptz not null default now(),
  operator_id uuid not null references public.profiles(id),
  location_type location_type not null,
  client_id text references public.clients(id) on delete set null,
  floor text,
  area text,
  notes text
);

create index container_locations_container_idx
  on public.container_locations(container_id, reported_at desc);

-- ============================================================================
-- RLS + Policies
-- Estrategia piloto: app interna; cualquier usuario autenticado tiene acceso
-- full a las tablas operativas. Cuando salgamos de piloto, restringir por rol.
-- ============================================================================

alter table public.profiles                       enable row level security;
alter table public.clients                        enable row level security;
alter table public.client_locations               enable row level security;
alter table public.companies                      enable row level security;
alter table public.containers                     enable row level security;
alter table public.photos                         enable row level security;
alter table public.route_events                   enable row level security;
alter table public.route_event_containers_dirty   enable row level security;
alter table public.route_event_containers_clean   enable row level security;
alter table public.weighing_sessions              enable row level security;
alter table public.container_receptions           enable row level security;
alter table public.storage_events                 enable row level security;
alter table public.treatment_runs                 enable row level security;
alter table public.external_transfers             enable row level security;
alter table public.container_locations            enable row level security;

create policy "profiles read by authenticated"
  on public.profiles for select to authenticated using (true);

create policy "profiles update own row"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

do $$
declare
  t text;
  tables text[] := array[
    'clients', 'client_locations', 'companies', 'containers',
    'photos', 'route_events', 'route_event_containers_dirty',
    'route_event_containers_clean', 'weighing_sessions',
    'container_receptions', 'storage_events', 'treatment_runs',
    'external_transfers', 'container_locations'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create policy "%I select authenticated" on public.%I
         for select to authenticated using (true);',
      t, t);
    execute format(
      'create policy "%I insert authenticated" on public.%I
         for insert to authenticated with check (true);',
      t, t);
    execute format(
      'create policy "%I update authenticated" on public.%I
         for update to authenticated using (true) with check (true);',
      t, t);
    execute format(
      'create policy "%I delete authenticated" on public.%I
         for delete to authenticated using (true);',
      t, t);
  end loop;
end $$;

-- ============================================================================
-- Storage: bucket 'photos' privado
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "photos bucket: authenticated read"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos');

create policy "photos bucket: authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');

create policy "photos bucket: authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

create policy "photos bucket: authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos');
