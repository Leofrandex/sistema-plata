-- ─────────────────────────────────────────────────────────────────────────────
-- Roles de acceso: coordinador (acceso total) y operador (solo Dashboard,
-- Recorrido, Pesaje y Tratamiento).
--
-- Capas de control: (1) navegación en el cliente, (2) middleware de rutas,
-- (3) RLS en la base (esta migración).
-- ─────────────────────────────────────────────────────────────────────────────

-- Enum de rol
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('coordinator', 'operator');
  end if;
end $$;

alter table public.profiles
  add column if not exists role public.user_role not null default 'operator';

-- El trigger de alta toma name y role desde la metadata del usuario
-- (raw_user_meta_data). Fallback: 'operator'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'role', '')::public.user_role, 'operator')
  );
  return new;
end;
$$;

-- Helper para RLS: ¿el usuario actual es coordinador? Lee su propia fila.
-- SECURITY DEFINER para evitar recursión de policies sobre profiles; solo
-- devuelve un booleano sobre el propio auth.uid(), no expone datos.
create or replace function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'coordinator'
  );
$$;
revoke execute on function public.is_coordinator() from public, anon;
grant execute on function public.is_coordinator() to authenticated;

-- Evitar auto-ascenso: ningún cliente (authenticated/anon) puede modificar la
-- columna role. Los cambios de rol se hacen vía service_role / SQL admin.
revoke update (role) on public.profiles from authenticated, anon;

-- ── RLS: escritura solo para coordinadores en tablas de administración ────────
-- La lectura (SELECT) permanece abierta a authenticated porque recorrido y
-- pesaje necesitan leer tachos y empresas.

-- containers
drop policy if exists "containers insert authenticated" on public.containers;
drop policy if exists "containers update authenticated" on public.containers;
drop policy if exists "containers delete authenticated" on public.containers;
create policy "containers insert coordinator" on public.containers
  for insert to authenticated with check (public.is_coordinator());
create policy "containers update coordinator" on public.containers
  for update to authenticated using (public.is_coordinator()) with check (public.is_coordinator());
create policy "containers delete coordinator" on public.containers
  for delete to authenticated using (public.is_coordinator());

-- clients
drop policy if exists "clients insert authenticated" on public.clients;
drop policy if exists "clients update authenticated" on public.clients;
drop policy if exists "clients delete authenticated" on public.clients;
create policy "clients insert coordinator" on public.clients
  for insert to authenticated with check (public.is_coordinator());
create policy "clients update coordinator" on public.clients
  for update to authenticated using (public.is_coordinator()) with check (public.is_coordinator());
create policy "clients delete coordinator" on public.clients
  for delete to authenticated using (public.is_coordinator());

-- client_locations
drop policy if exists "client_locations insert authenticated" on public.client_locations;
drop policy if exists "client_locations update authenticated" on public.client_locations;
drop policy if exists "client_locations delete authenticated" on public.client_locations;
create policy "client_locations insert coordinator" on public.client_locations
  for insert to authenticated with check (public.is_coordinator());
create policy "client_locations update coordinator" on public.client_locations
  for update to authenticated using (public.is_coordinator()) with check (public.is_coordinator());
create policy "client_locations delete coordinator" on public.client_locations
  for delete to authenticated using (public.is_coordinator());

-- companies
drop policy if exists "companies insert authenticated" on public.companies;
drop policy if exists "companies update authenticated" on public.companies;
drop policy if exists "companies delete authenticated" on public.companies;
create policy "companies insert coordinator" on public.companies
  for insert to authenticated with check (public.is_coordinator());
create policy "companies update coordinator" on public.companies
  for update to authenticated using (public.is_coordinator()) with check (public.is_coordinator());
create policy "companies delete coordinator" on public.companies
  for delete to authenticated using (public.is_coordinator());

-- external_transfers (traslado externo: solo coordinador)
drop policy if exists "external_transfers insert authenticated" on public.external_transfers;
drop policy if exists "external_transfers update authenticated" on public.external_transfers;
drop policy if exists "external_transfers delete authenticated" on public.external_transfers;
create policy "external_transfers insert coordinator" on public.external_transfers
  for insert to authenticated with check (public.is_coordinator());
create policy "external_transfers update coordinator" on public.external_transfers
  for update to authenticated using (public.is_coordinator()) with check (public.is_coordinator());
create policy "external_transfers delete coordinator" on public.external_transfers
  for delete to authenticated using (public.is_coordinator());
