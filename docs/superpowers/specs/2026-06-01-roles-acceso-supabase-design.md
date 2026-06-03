# Diseño — Roles y control de acceso (coordinador / operador)

**Fecha:** 2026-06-01
**Estado:** Propuesto
**Autor:** Sebastián + Claude

## Objetivo

Introducir dos roles en Hospiwaste y restringir el acceso según el rol:

- **Coordinador:** acceso a todas las funciones (igual que hoy).
- **Operador:** solo Inicio (Dashboard), Recorrido, Pesaje y Tratamiento.

Quedan fuera del alcance del operador: Reportes, Tachos (inventario `/containers`), Traslado externo y todo `/admin/*`.

## Decisiones tomadas

1. **Cuentas individuales** por operador (trazabilidad por persona en reportes).
2. **Marelys Marín = coordinador** (personal de oficina).
3. **Enforcement en 3 capas:** UI + middleware (rutas) + RLS (base de datos).
4. **Creación de cuentas vía MCP de Supabase.**

## Modelo de datos

```sql
create type public.user_role as enum ('coordinator', 'operator');

alter table public.profiles
  add column role public.user_role not null default 'operator';

-- El trigger de alta lee el rol desde metadata (fallback 'operator')
create or replace function public.handle_new_user() ...
  insert into public.profiles (id, name, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'operator'));

-- Helper para RLS (lee el rol del usuario actual sin recursión de policies)
create or replace function public.is_coordinator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coordinator'
  );
$$;
```

## Cuentas a crear / asignar

| Persona | Correo | Rol |
|---|---|---|
| Karolyne Murray | kmurray@hospiwaste.com | coordinator |
| Marelys Marín | plantaptdp@hospiwaste.com | coordinator |
| Nodier Pinilla | nodier.pinilla@hospiwaste.com | operator |
| Gregory Tenorio | gregory.tenorio@hospiwaste.com | operator |
| Elias Rodriguez | elias.rodriguez@hospiwaste.com | operator |
| Aldair Díaz | aldair.diaz@hospiwaste.com | operator |
| Elias Castillo | elias.castillo@hospiwaste.com | operator |
| Miguel Rangel | miguel.rangel@hospiwaste.com | operator |
| Aaron Vasquez | aaron.vasquez@hospiwaste.com | operator |

- `demo@hospiwaste.com` → coordinator (pruebas).
- Contraseña temporal generada por cuenta; se entrega tabla de credenciales. (La app no tiene aún pantalla de cambio de contraseña.)
- Cuentas existentes: se verifica vía MCP antes de crear; si Karolyne/Marelys ya existen, solo se actualiza su rol.

## Enforcement

### Capa 1 — Navegación (UI)
- `currentRole` se agrega al store (lo carga el hydrator desde `getCurrentProfile`).
- Sidebar (escritorio) y barra inferior móvil filtran ítems coordinador-only cuando `role === 'operator'`.
- Ítems visibles para operador: Inicio, Recorrido, Pesaje, Tratamiento. Se ocultan: Reportes, Tachos, Traslado externo, Admin (y "Cerrar sesión" se mantiene).

### Capa 2 — Rutas (middleware)
- Conjunto de prefijos permitidos para operador: `/dashboard`, `/register/route`, `/register/weighing`, `/register/treatment`, más `/login`, `/auth`.
- Optimización: si la ruta solicitada es operador-permitida, no se consulta el rol (cero costo extra). Solo cuando la ruta es coordinador-only se consulta `profiles.role`; si es `operator`, redirige a `/dashboard`.
- Coordinador: sin restricción.

### Capa 3 — RLS (base de datos)
Tablas con `INSERT/UPDATE/DELETE` restringido a `is_coordinator()` (lectura sigue abierta a `authenticated` porque recorrido/pesaje necesitan leer tachos y empresas):

- `containers`
- `clients`
- `client_locations`
- `companies`
- `external_transfers`

Tablas operativas que el operador sigue escribiendo sin cambios: `route_events`, `route_event_containers_dirty`, `route_event_containers_clean`, `weighing_sessions`, `receptions`, `container_storage_events`, `treatment_runs`, `container_locations`, `photos`.

`profiles`: la policy de update propio se mantiene; un usuario no puede cambiar su propio `role` (se añade `with check` que impide modificar la columna role salvo coordinador, o se restringe la actualización de role a service_role).

## Cliente (Next.js)

- `q.getCurrentProfile` selecciona también `role`.
- `SupabaseHydrator` guarda `currentRole` en el store (`setCurrentRole`).
- Navegación lee `currentRole` para filtrar.
- (Opcional) componente guard que, si un operador llega a una vista coordinador-only por render directo, muestra "Sin acceso" — el middleware ya cubre la navegación normal.

## Pruebas

- Unit: `is_coordinator()` y el filtrado de ítems de navegación por rol (función pura).
- Manual / E2E: login como operador (demo o cuenta real) → no ve Reportes/Tachos/Traslado/Admin; intento directo a `/admin/containers` redirige a `/dashboard`; intento de `INSERT` en `containers` vía API con sesión operador es rechazado por RLS. Login coordinador → acceso completo.

## Fuera de alcance

- Pantalla de cambio de contraseña en la app.
- Roles adicionales (p. ej. "solo lectura").
- Custom access token hook / claim de rol en el JWT (se evalúa si la consulta de rol en middleware resulta costosa).
