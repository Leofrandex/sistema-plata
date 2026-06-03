# Diseño: Contenedores Yaris de recorrido

**Fecha:** 2026-06-03
**Estado:** Aprobado (diseño) — pendiente de plan de implementación
**Autor:** Sebastián + Claude

## Problema

Operaciones necesita registrar **26 contenedores físicos nuevos** (la flota "Yaris")
que circulan en el recorrido. Características operativas:

- Llevan el prefijo `Y` (`Y1`…`Y26`).
- Están **siempre disponibles en recorrido** (se recogen/entregan como cualquier tacho).
- **No tienen tara**: no se pesan directamente. Las cargas que transportan se pesan con
  los **tachos alternativos** ya existentes (los marcados `is_yaris_dedicated`).

Hoy esos contenedores no existen en el sistema, así que no aparecen en el picker de
recorrido. Simplemente insertarlos como tachos normales con tara 0 no alcanza: al
recogerse sucios quedarían atascados para siempre en la cola "pendiente por pesar" y en
el dashboard de circulación, porque nunca se les registra una recepción.

## Concepto

Los Yaris son una **flota aparte sin ciclo de planta**. No pertenecen a ninguna empresa,
no tienen tara y no atraviesan pesaje → cámara fría → tratamiento. Se distinguen con un
flag nuevo `is_yaris_container`.

> [!important] `is_yaris_container` ≠ `is_yaris_dedicated`
> - `is_yaris_dedicated` (ya existe): marca los **tachos con los que se pesa** una carga
>   Yaris/Picanto. Aparecen en Pesaje cuando el operador activa el modo Yaris.
> - `is_yaris_container` (nuevo): marca los **contenedores físicos de la flota Yaris** que
>   circulan en recorrido. Nunca se pesan directamente.

## Decisiones tomadas

| Decisión | Valor | Razón |
|----------|-------|-------|
| Formato de ID | `Y1`…`Y26` literal, mayúscula, sin padding | Consistente con los metálicos `M1`…`M15` |
| Empresa (`company_id`) | `null` | Flota compartida; no pertenecen a ION/Airkem |
| Tamaño (`size_liters`) | `1100` | Contenedor grande rodante de recorrido |
| Tara (`tare_weight_kg`) | `0` | No se pesan directamente |
| `status` | `active` | En circulación |
| En cola de pesaje | **Excluidos** | No se pesan (se usan los tachos alternativos) |
| En dashboard de circulación | **Excluidos** | Sin ciclo de planta; evita que queden atascados |

## Modelo de datos

Nueva columna en `containers`:

```sql
alter table public.containers
  add column if not exists is_yaris_container boolean not null default false;
```

Inserción de los 26 registros (`company_id = null`, `size_liters = '1100'`,
`tare_weight_kg = 0`, `status = 'active'`, `is_yaris_container = true`), con
`on conflict (id) do nothing`.

`formatTachoNumber('Y1')` → `'Y1'` (no tiene guion, se devuelve igual). En el picker de
recorrido se muestran como "— · 1100 L" (sin empresa, igual que los metálicos).

## Comportamiento por módulo

### Recorrido
Sin cambios de UI. El picker (`ContainerPickerSheet`) ya lista cualquier tacho con
`status === 'active'`, así que los Yaris aparecen automáticamente, tanto en "sucios
recogidos" como en "limpios entregados".

### Pesaje — excluidos de la cola
Los Yaris nunca deben aparecer en "pendiente por pesar". Se filtran en **dos** lugares
que replican la misma lógica:

1. **Cliente:** `getPendingWeighingContainerIds` (`src/lib/data/containers.ts`) agrega
   `&& !c.is_yaris_container` a su filtro.
2. **Postgres:** la vista `v_containers_pending_weighing` agrega
   `and c.is_yaris_container = false` (migración con `create or replace view`).

> [!note] Mantener ambas fuentes en sincronía
> La vista es la réplica server-side del helper de cliente (ver
> `20260603000000_reception_soft_delete_and_pending_view.sql`). Cualquier cambio al filtro
> debe aplicarse a las dos.

El selector "Envase Yaris" de Pesaje filtra por `is_yaris_dedicated`, así que los nuevos
`is_yaris_container` no se cuelan ahí.

### Dashboard — excluidos de circulación
`computeCirculationBreakdown` (`src/lib/data/dashboard-metrics.ts`) filtra los Yaris del
pool activo:

```ts
const activeContainers = store.containers.filter(
  (c) => c.status === 'active' && !c.is_yaris_container,
)
```

Así no inflan `total` ni ningún bucket.

## Cableado del flag (espejo de `is_metallic_dedicated`)

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/20260603010000_containers_is_yaris_container_flag.sql` | `add column` |
| `supabase/migrations/20260603010100_seed_yaris_route_containers.sql` | insert `Y1`…`Y26` |
| `supabase/migrations/20260603010200_pending_weighing_exclude_yaris.sql` | `create or replace view v_containers_pending_weighing` con exclusión |
| `src/lib/types.ts` | `is_yaris_container?: boolean` en `Container` |
| `src/lib/supabase/database.types.ts` | Row/Insert/Update de `containers` + la vista |
| `src/components/supabase-hydrator.tsx` | mapeo `is_yaris_container: r.is_yaris_container` |
| `src/lib/data/containers.ts` | exclusión en `getPendingWeighingContainerIds` |
| `src/lib/data/dashboard-metrics.ts` | exclusión en `computeCirculationBreakdown` |
| `src/lib/mock-data.ts` | 26 contenedores Yaris para modo offline |
| `src/app/admin/containers/page.tsx` | columna "Yaris recorrido" + toggle |
| `src/components/admin/container-form.tsx` | checkbox "Yaris recorrido" al alta |

> [!note] Separación de migraciones
> Se separan las migraciones por la convención del repo: el `add column` va en su propia
> migración, separado del seed que usa esa columna. La actualización de la vista va aparte
> para mantener cada migración con un solo propósito.

## Tests

- `getPendingWeighingContainerIds` **excluye** un Yaris recogido sucio sin recepción.
- `computeCirculationBreakdown` **no cuenta** Yaris en `total` ni en buckets.
- `mock-data` contiene exactamente **26** contenedores con `is_yaris_container === true`,
  con IDs `Y1`…`Y26`, `company_id` nulo, 1100 L y tara 0.

## Documentación (vault)

- `logs/2026-06-03-contenedores-yaris-recorrido.md` — log del cambio.
- `project/DataModel.md` — documentar el flag `is_yaris_container` en `Container`.
- `decisions/2026-06-01-ids-tachos-supabase-vs-mock.md` — anotar que `Y1`…`Y26` son IDs
  literales en Supabase (como `M1`…`M15`).
- `decisions/2026-05-21-estado-envase-derivado.md` y `project/Roadmap.md` — registrar que la
  columna `current_phase` como **caché mantenida por triggers** queda como próximo proyecto
  (decisión de hoy: no acoplarla a los Yaris).
- `_index.md` — actualizar estado.

## Fuera de alcance (decidido explícitamente)

- **Columna `current_phase` materializada.** Se discutió hoy. Es un cambio transversal
  (triggers en todas las tablas de eventos, backfill, job de auditoría, reescritura de
  lectores) y se diseñará como **proyecto aparte**. Los Yaris funcionan igual con el modelo
  derivado actual; el flag no depende de ese refactor.
- **Cambios de UI en recorrido.** No hacen falta: el picker ya los muestra.
