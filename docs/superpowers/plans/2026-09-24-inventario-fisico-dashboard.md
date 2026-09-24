# Inventario físico en la tarjeta "Flota y planta" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La tarjeta "Flota y planta" del dashboard del hub muestra tachos de 240 L por llantas (con/sin) y Yaris de 1100 L por color (rojo/verde), cada fila con sus limpios y en proceso calculados en vivo.

**Architecture:**
- **Datos:** dos columnas nuevas en `public.containers`, `has_wheels` y `color`. Las carga un script Python que lee el Excel de planta y genera SQL, y ese SQL se corre por MCP `execute_sql`.
- **Cálculo:** una función pura nueva, `computePhysicalInventory`, reutiliza `computeCirculationStatus` para decidir limpio o en proceso. Se integra en `computeFleetBreakdown`, así que la página del dashboard no cambia.
- **Pantalla:** `FleetSection` renderiza un bloque nuevo.

**Tech Stack:** Next.js (hub) · React · TypeScript · Jest (`shared`) · Supabase Postgres · Python 3 + openpyxl + pytest (script).

**Spec:** `docs/superpowers/specs/2026-09-24-inventario-fisico-dashboard-design.md`

## Global Constraints

- Proyecto Supabase del piloto: `xqqnthyipkdkwyknbtnw`.
- Columnas: `has_wheels boolean` (null = sin dato) y `color text check (color in ('rojo', 'verde'))` (null = sin dato). Ninguna tiene valor por defecto.
- El script **solo** escribe `has_wheels` y `color`. Nunca toca `status`, `tare_weight_kg` ni otras columnas.
- Por defecto el script genera una corrida en seco (SELECT de vista previa). El UPDATE solo con `--apply`.
- La columna "limpio / en proceso" del Excel se **ignora**.
- Limpio = `en_planta`, `en_cliente`, `sin_actividad`. En proceso = `pendiente_pesar`, `pendiente_tratar`.
- Solo cuentan contenedores `status === 'active'`. Tachos = `size_liters === 240`. Yaris = `is_yaris_container === true`. Los metálicos y los de 750 L no entran.
- La fila "Verdes" se muestra siempre, aunque tenga cero. Las filas "Sin dato" solo si tienen algún contenedor.
- Dentro de `shared/` se importa siempre `@hospiwaste/shared/...`, nunca `@/`.
- Comandos: `npm test` (jest de los 3 workspaces), `npm run build:hub`.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Texto de ubicación desconocido en el Excel** (p. ej. "Con Llantas Limpio", sin la s): el script debe **fallar con el número de fila**, no dejar `null` en silencio. → Test en Task 4.
2. **Número con texto pegado** ("192 ION"): se cruza con `192`. → Test en Task 4.
3. **Fila sin número** (los Yaris verdes de hoy): se informa como no cargada y no rompe la corrida. → Test en Task 4.
4. **Contenedor de baja** (el tacho `200`) **o metálico** (`M1`): no aparece en ninguna fila. → Test en Task 2.
5. **Contenedor sin dato de llantas o color** (dado de alta después del último Excel): cae en "Sin dato", no en "Sin llantas". → Test en Task 2.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260924000000_containers_inventario_fisico.sql` | Crear | Agrega las dos columnas |
| `shared/src/lib/supabase/database.types.ts` | Modificar | Tipos generados de Supabase |
| `shared/src/lib/types.ts` | Modificar | `Container.has_wheels`, `Container.color` |
| `shared/src/components/supabase-hydrator.tsx` | Modificar | `rowToContainer` propaga las columnas |
| `shared/src/lib/data/dashboard-analytics.ts` | Modificar | `computePhysicalInventory` y el campo `FleetBreakdown.physicalInventory` |
| `shared/src/__tests__/lib/dashboard-analytics.test.ts` | Modificar | Tests del desglose |
| `hub/src/components/dashboard/physical-inventory-block.tsx` | Crear | Tabla del bloque "Inventario físico" |
| `hub/src/components/dashboard/fleet-section.tsx` | Modificar | Monta el bloque |
| `scripts/sync_inventario_fisico.py` | Crear | Excel → SQL de vista previa o de UPDATE |
| `scripts/test_sync_inventario_fisico.py` | Crear | pytest del parseo |
| `vault/logs/2026-09-24-inventario-fisico-dashboard.md`, `vault/project/DataModel.md` | Crear/Modificar | Documentación |

El script lleva guion bajo en el nombre (y no guion como en el spec) para que pytest lo pueda importar.

---

### Task 1: Columnas `has_wheels` y `color` de punta a punta

**Files:**
- Create: `supabase/migrations/20260924000000_containers_inventario_fisico.sql`
- Modify: `shared/src/lib/supabase/database.types.ts` (tabla `containers`, Row/Insert/Update, cerca de las líneas 276-310)
- Modify: `shared/src/lib/types.ts:72-92` (interface `Container`)
- Modify: `shared/src/components/supabase-hydrator.tsx:387-399` (`rowToContainer`)

**Interfaces:**
- Produces: `Container.has_wheels?: boolean | null` y `Container.color?: ContainerColor | null`, con `export type ContainerColor = 'rojo' | 'verde'` en `shared/src/lib/types.ts`.

- [ ] **Step 1: Escribir la migración**

```sql
-- 2026-09-24 — Inventario físico de planta en el dashboard.
--
-- Dos atributos físicos del contenedor que vienen del Excel de inventario de
-- planta ("Inventario de Contenedores en Proceso"). Se cargan con
-- scripts/sync_inventario_fisico.py; no hay pantalla de edición.
-- null = sin dato (el contenedor nunca apareció en el Excel). Sin default a
-- propósito: no se inventa un valor.

alter table public.containers
  add column has_wheels boolean,
  add column color text check (color in ('rojo', 'verde'));

comment on column public.containers.has_wheels is
  'Tacho con llantas (true) o sin llantas (false). null = sin dato. Fuente: Excel de inventario de planta.';
comment on column public.containers.color is
  'Color del contenedor (Yaris: rojo o verde). null = sin dato. Fuente: Excel de inventario de planta.';
```

- [ ] **Step 2: Aplicar la migración en el piloto**

MCP `apply_migration` con `project_id: xqqnthyipkdkwyknbtnw`, `name: containers_inventario_fisico` y el SQL de arriba.

Verificar con `execute_sql`:
```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'containers' and column_name in ('has_wheels', 'color');
```
Expected: 2 filas, `is_nullable = YES`, `column_default = null`.

- [ ] **Step 3: Regenerar los tipos de Supabase**

MCP `generate_typescript_types` con `project_id: xqqnthyipkdkwyknbtnw`. Escribir el resultado en `shared/src/lib/supabase/database.types.ts`.

Revisar el diff con `git diff shared/src/lib/supabase/database.types.ts`: solo deben aparecer `has_wheels` y `color` en `containers` (y en las vistas que expongan columnas de `containers`). Si el diff trae otros cambios no relacionados, descartar el archivo generado y editar a mano solo `containers`:
- En `Row`: `color: string | null` y `has_wheels: boolean | null`.
- En `Insert` y `Update`: `color?: string | null` y `has_wheels?: boolean | null`.

Mantener el orden alfabético del archivo.

- [ ] **Step 4: Tipo de dominio**

En `shared/src/lib/types.ts`, justo antes de `export interface Container`:

```ts
/** Color físico del contenedor según el inventario de planta. */
export type ContainerColor = 'rojo' | 'verde'
```

Dentro de `Container`, después de `is_yaris_container?: boolean`:

```ts
  /** Tacho con llantas (true) o sin llantas (false), según el último Excel de
   *  inventario de planta. null/undefined = sin dato. */
  has_wheels?: boolean | null
  /** Color físico (Yaris: rojo/verde), según el mismo Excel. null/undefined = sin dato. */
  color?: ContainerColor | null
```

- [ ] **Step 5: Propagar en el hydrator**

En `rowToContainer` (`shared/src/components/supabase-hydrator.tsx`), después de `is_yaris_container: r.is_yaris_container,`:

```ts
    has_wheels: r.has_wheels ?? null,
    color: (r.color as ContainerColor | null) ?? null,
```

Sumar `ContainerColor` al import de tipos existente de `@hospiwaste/shared/lib/types` en ese archivo.

- [ ] **Step 6: Verificar que compila y que los tests siguen verdes**

Run: `npm test`
Expected: todos los tests pasan. Las columnas nuevas son opcionales, así que ningún fixture se rompe.

Run: `npm run build:hub`
Expected: build OK.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260924000000_containers_inventario_fisico.sql shared/src/lib/supabase/database.types.ts shared/src/lib/types.ts shared/src/components/supabase-hydrator.tsx
git commit -m "feat(tachos): columnas has_wheels y color del inventario físico

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `computePhysicalInventory` dentro de `computeFleetBreakdown`

**Files:**
- Modify: `shared/src/lib/data/dashboard-analytics.ts` (sección "7. Flota y operaciones de planta", cerca de las líneas 447-520)
- Test: `shared/src/__tests__/lib/dashboard-analytics.test.ts`

**Interfaces:**
- Consumes: `Container.has_wheels`, `Container.color` (Task 1). También `computeCirculationStatus(container, slice)`, ya importado en `dashboard-analytics.ts` desde `./dashboard-metrics`. Recibe `{ routeEvents, receptions, treatmentRuns, externalTransfers }` y devuelve `{ bucket, sinceMs }`.
- Produces:
  ```ts
  export interface PhysicalInventoryRow { label: string; clean: number; inProcess: number }
  export interface PhysicalInventory { tachos: PhysicalInventoryRow[]; yaris: PhysicalInventoryRow[] }
  export function computePhysicalInventory(slice: FleetSlice): PhysicalInventory
  // y FleetBreakdown suma: physicalInventory: PhysicalInventory
  ```
  La firma usa `FleetSlice` en lugar de `CirculationStoreSlice` (el spec decía esta última). `FleetSlice` ya trae todo lo que pide `computeCirculationStatus`, así que la página del dashboard no cambia.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar `computePhysicalInventory` al import de `@hospiwaste/shared/lib/data/dashboard-analytics` y este bloque después de `describe('computeFleetBreakdown', ...)`:

```ts
describe('computePhysicalInventory', () => {
  const empty = { companies: [], routeEvents: [], receptions: [], treatmentRuns: [], externalTransfers: [] }

  it('cruza llantas con limpio / en proceso para tachos de 240 L', () => {
    const containers = [
      makeContainer('001', { has_wheels: true }),   // sin eventos → limpio
      makeContainer('002', { has_wheels: true }),   // pesado → en proceso
      makeContainer('003', { has_wheels: false }),  // recogido sucio → en proceso
      makeContainer('004', { has_wheels: false }),  // sin eventos → limpio
    ]
    const receptions = [
      makeReception({ id: 'r1', container_id: '002', arrived_at: '2026-09-20T10:00:00Z', gross_weight_kg: 30 }),
    ]
    const routeEvents = [
      makeRoute({ id: 'e1', date: '2026-09-20', containers_dirty_received: ['003'] }),
    ]
    const inv = computePhysicalInventory({ ...empty, containers, receptions, routeEvents })
    expect(inv.tachos).toEqual([
      { label: 'Con llantas', clean: 1, inProcess: 1 },
      { label: 'Sin llantas', clean: 1, inProcess: 1 },
    ])
  })

  it('un tacho tratado después de pesarse vuelve a limpio', () => {
    const containers = [makeContainer('001', { has_wheels: true })]
    const receptions = [
      makeReception({ id: 'r1', container_id: '001', arrived_at: '2026-09-20T10:00:00Z', gross_weight_kg: 30 }),
    ]
    const treatmentRuns: TreatmentRun[] = [
      { id: 't1', container_id: '001', started_at: '2026-09-20T11:00:00Z', completed_at: '2026-09-20T12:00:00Z', operator_id: 'op-1' },
    ]
    const inv = computePhysicalInventory({ ...empty, containers, receptions, treatmentRuns })
    expect(inv.tachos).toEqual([
      { label: 'Con llantas', clean: 1, inProcess: 0 },
      { label: 'Sin llantas', clean: 0, inProcess: 0 },
    ])
  })

  it('agrupa Yaris por color y muestra Verdes aunque sea cero', () => {
    const containers = [
      makeContainer('Y1', { size_liters: 1100, is_yaris_container: true, color: 'rojo' }),
      makeContainer('Y2', { size_liters: 1100, is_yaris_container: true, color: 'rojo' }),
    ]
    const inv = computePhysicalInventory({ ...empty, containers })
    expect(inv.yaris).toEqual([
      { label: 'Rojos', clean: 2, inProcess: 0 },
      { label: 'Verdes', clean: 0, inProcess: 0 },
    ])
  })

  it('manda a "Sin dato" lo que no tiene llantas ni color cargados, y solo entonces muestra la fila', () => {
    const containers = [
      makeContainer('001', { has_wheels: true }),
      makeContainer('005'),                                        // has_wheels undefined
      makeContainer('006', { has_wheels: null }),
      makeContainer('Y3', { size_liters: 1100, is_yaris_container: true }), // color undefined
    ]
    const inv = computePhysicalInventory({ ...empty, containers })
    expect(inv.tachos).toEqual([
      { label: 'Con llantas', clean: 1, inProcess: 0 },
      { label: 'Sin llantas', clean: 0, inProcess: 0 },
      { label: 'Sin dato', clean: 2, inProcess: 0 },
    ])
    expect(inv.yaris).toEqual([
      { label: 'Rojos', clean: 0, inProcess: 0 },
      { label: 'Verdes', clean: 0, inProcess: 0 },
      { label: 'Sin dato', clean: 1, inProcess: 0 },
    ])
  })

  it('excluye contenedores de baja, metálicos y de 750 L', () => {
    const containers = [
      makeContainer('200', { has_wheels: true, status: 'decommissioned' }),
      makeContainer('M1', { size_liters: 120, is_metallic_dedicated: true }),
      makeContainer('X1', { size_liters: 750 }),
      makeContainer('Y26', { size_liters: 1100, is_yaris_container: true, color: 'rojo', status: 'decommissioned' }),
    ]
    const inv = computePhysicalInventory({ ...empty, containers })
    expect(inv.tachos).toEqual([
      { label: 'Con llantas', clean: 0, inProcess: 0 },
      { label: 'Sin llantas', clean: 0, inProcess: 0 },
    ])
    expect(inv.yaris).toEqual([
      { label: 'Rojos', clean: 0, inProcess: 0 },
      { label: 'Verdes', clean: 0, inProcess: 0 },
    ])
  })

  it('computeFleetBreakdown expone el desglose en physicalInventory', () => {
    const f = computeFleetBreakdown(
      { ...empty, containers: [makeContainer('001', { has_wheels: false })] },
      '2026-09-24',
    )
    expect(f.physicalInventory.tachos[1]).toEqual({ label: 'Sin llantas', clean: 1, inProcess: 0 })
  })
})
```

Si `makeRoute` o `makeReception` necesitan `company_id` u otro campo obligatorio para que el tacho entre en circulación, copiar los campos del test existente de `computeFleetBreakdown`, que ya usa `makeRoute({ id, date, company_id, containers_dirty_received })`.

- [ ] **Step 2: Verificar que fallan**

Run: `npx jest --config shared/jest.config.js shared/src/__tests__/lib/dashboard-analytics.test.ts -t computePhysicalInventory` desde el root. Si ese path de config no existe: `npm test --workspace shared -- dashboard-analytics -t computePhysicalInventory`.
Expected: FAIL, "computePhysicalInventory is not a function" o error de tipos.

- [ ] **Step 3: Implementar**

En `shared/src/lib/data/dashboard-analytics.ts`, sección 7, antes de `export interface FleetBreakdown`:

```ts
export interface PhysicalInventoryRow {
  label: string
  clean: number
  inProcess: number
}

/** Desglose del inventario físico de planta: tachos 240 L por llantas y Yaris
 *  por color, cada fila partida en limpio / en proceso según la circulación
 *  en vivo (no según el Excel). */
export interface PhysicalInventory {
  tachos: PhysicalInventoryRow[]
  yaris: PhysicalInventoryRow[]
}

const IN_PROCESS_BUCKETS: ReadonlySet<CirculationBucket> = new Set(['pendiente_pesar', 'pendiente_tratar'])

function tally(
  rows: Map<string, PhysicalInventoryRow>,
  label: string,
  inProcess: boolean,
): void {
  const row = rows.get(label)
  if (!row) return
  if (inProcess) row.inProcess += 1
  else row.clean += 1
}

function rowsFor(fixed: string[]): Map<string, PhysicalInventoryRow> {
  return new Map([...fixed, 'Sin dato'].map((label) => [label, { label, clean: 0, inProcess: 0 }]))
}

/** "Sin dato" solo se muestra si tiene al menos un contenedor. */
function visibleRows(rows: Map<string, PhysicalInventoryRow>): PhysicalInventoryRow[] {
  return [...rows.values()].filter((r) => r.label !== 'Sin dato' || r.clean + r.inProcess > 0)
}

export function computePhysicalInventory(slice: FleetSlice): PhysicalInventory {
  const tachos = rowsFor(['Con llantas', 'Sin llantas'])
  const yaris = rowsFor(['Rojos', 'Verdes'])

  for (const c of slice.containers) {
    if (c.status !== 'active') continue
    const inProcess = IN_PROCESS_BUCKETS.has(computeCirculationStatus(c, slice).bucket)
    if (c.is_yaris_container) {
      const label = c.color === 'rojo' ? 'Rojos' : c.color === 'verde' ? 'Verdes' : 'Sin dato'
      tally(yaris, label, inProcess)
    } else if (c.size_liters === 240 && !c.is_metallic_dedicated) {
      const label = c.has_wheels === true ? 'Con llantas' : c.has_wheels === false ? 'Sin llantas' : 'Sin dato'
      tally(tachos, label, inProcess)
    }
  }

  return { tachos: visibleRows(tachos), yaris: visibleRows(yaris) }
}
```

Si `CirculationBucket` hoy se importa solo como tipo, dejarlo así: `IN_PROCESS_BUCKETS` lo usa solo como tipo.

En `export interface FleetBreakdown`, agregar al final:

```ts
  physicalInventory: PhysicalInventory
```

En el `return` de `computeFleetBreakdown`, agregar al final:

```ts
    physicalInventory: computePhysicalInventory(slice),
```

- [ ] **Step 4: Verificar que pasan**

Run: el mismo comando del Step 2.
Expected: PASS, 6 tests.

Run: `npm test`
Expected: todo verde, incluido el test existente de `computeFleetBreakdown`.

- [ ] **Step 5: Commit**

```bash
git add shared/src/lib/data/dashboard-analytics.ts shared/src/__tests__/lib/dashboard-analytics.test.ts
git commit -m "feat(dashboard): desglose de inventario físico por llantas y color

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Bloque "Inventario físico" en la tarjeta

**Files:**
- Create: `hub/src/components/dashboard/physical-inventory-block.tsx`
- Modify: `hub/src/components/dashboard/fleet-section.tsx` (entre el `</div>` de la grilla "Por tamaño / Por empresa" y el `<dl>` de tratamientos, cerca de la línea 60)

**Interfaces:**
- Consumes: `PhysicalInventory`, `PhysicalInventoryRow` de `@hospiwaste/shared/lib/data/dashboard-analytics` (Task 2), y `fleet.physicalInventory`.
- Produces: `export function PhysicalInventoryBlock({ inventory }: { inventory: PhysicalInventory })`.

- [ ] **Step 1: Crear el componente**

```tsx
import type { PhysicalInventory, PhysicalInventoryRow } from '@hospiwaste/shared/lib/data/dashboard-analytics'

function Group({ title, rows }: { title: string; rows: PhysicalInventoryRow[] }) {
  return (
    <>
      <tr>
        <th scope="rowgroup" colSpan={3} className="pt-2 text-left text-xs font-medium text-muted-foreground">
          {title}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={`${title}-${r.label}`}>
          <th scope="row" className="py-0.5 pl-3 text-left font-normal text-foreground/80">{r.label}</th>
          <td className="py-0.5 text-right font-semibold tabular-nums text-foreground">{r.clean}</td>
          <td className="py-0.5 text-right font-semibold tabular-nums text-foreground">{r.inProcess}</td>
        </tr>
      ))}
    </>
  )
}

/** Inventario físico de planta: llantas (240 L) y color (Yaris) × limpio / en proceso en vivo. */
export function PhysicalInventoryBlock({ inventory }: { inventory: PhysicalInventory }) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Inventario físico
            </th>
            <th scope="col" className="w-20 text-right text-xs font-medium text-muted-foreground">Limpios</th>
            <th scope="col" className="w-24 text-right text-xs font-medium text-muted-foreground">En proceso</th>
          </tr>
        </thead>
        <tbody>
          <Group title="240 L" rows={inventory.tachos} />
          <Group title="1100 L (Yaris)" rows={inventory.yaris} />
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Montarlo en la tarjeta**

En `fleet-section.tsx`, agregar el import:

```tsx
import { PhysicalInventoryBlock } from './physical-inventory-block'
```

Insertarlo inmediatamente después del `</div>` que cierra `<div className="grid grid-cols-2 gap-x-6 gap-y-4">` y antes de `<dl className="mt-4 grid grid-cols-2 ...">`:

```tsx
      <PhysicalInventoryBlock inventory={fleet.physicalInventory} />
```

Subir el skeleton de `rows={4}` a `rows={6}` en `<CardSkeleton rows={4} className={className} />` para que el esqueleto de carga tenga una altura parecida a la de la tarjeta ya cargada.

- [ ] **Step 3: Verificar el build**

Run: `npm run build:hub`
Expected: build OK, sin errores de tipos.

- [ ] **Step 4: Verificar en el navegador**

Run: `npm run dev:hub` y abrir `http://localhost:3000/dashboard` con sesión de coordinador.
Expected:
- La tarjeta "Flota y planta" muestra el bloque con "240 L" y "1100 L (Yaris)".
- Como las columnas todavía están vacías hasta la Task 4, se ve "Con llantas 0 0 / Sin llantas 0 0 / Sin dato N M" y "Rojos 0 0 / Verdes 0 0 / Sin dato 26 …".
- A 375 px de ancho, los números no se cortan ni aparece scroll horizontal.

- [ ] **Step 5: Commit**

```bash
git add hub/src/components/dashboard/physical-inventory-block.tsx hub/src/components/dashboard/fleet-section.tsx
git commit -m "feat(dashboard): bloque de inventario físico en Flota y planta

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Script de carga desde el Excel y carga inicial

**Files:**
- Create: `scripts/sync_inventario_fisico.py`
- Test: `scripts/test_sync_inventario_fisico.py`

**Interfaces:**
- Consumes: columnas `has_wheels` y `color` (Task 1).
- Produces:
  - CLI: `python scripts/sync_inventario_fisico.py <excel> [--apply]`. Imprime SQL por stdout y el reporte por stderr.
  - Funciones:
    - `parse_rows(rows) -> tuple[list[Item], list[str]]`
    - `Item = (container_id: str, has_wheels: bool | None, color: str | None)`
    - `build_preview_sql(items) -> str`
    - `build_apply_sql(items) -> str`

- [ ] **Step 1: Escribir los tests que fallan**

`scripts/test_sync_inventario_fisico.py`:

```python
import pytest
from sync_inventario_fisico import parse_rows, build_apply_sql, build_preview_sql

# Cada fila imita la hoja "Data": (n_240, ubic_240, n_1100, ubic_1100), None = celda vacía.

def test_tacho_con_y_sin_llantas():
    items, skipped = parse_rows([
        (1, 'Con llantas limpios', None, None),
        (2, 'Sin llantas y en proceso', None, None),
    ])
    assert items == [('001', True, None), ('002', False, None)]
    assert skipped == []

def test_numero_con_texto_pegado():
    items, _ = parse_rows([('192 ION', 'Con llantas limpios', None, None)])
    assert items == [('192', True, None)]

def test_yaris_por_color():
    items, _ = parse_rows([
        (None, None, 1, 'Limpios rojos'),
        (None, None, 6, 'En Proceso rojos'),
    ])
    assert items == [('Y1', None, 'rojo'), ('Y6', None, 'rojo')]

def test_fila_sin_numero_se_informa_y_no_se_carga():
    items, skipped = parse_rows([(None, None, None, 'Limpios Verde')])
    assert items == []
    assert skipped == ['1100 L sin número: "Limpios Verde"']

def test_ubicacion_desconocida_falla_con_la_fila():
    with pytest.raises(ValueError, match='fila 1.*Con Llantas Limpio'):
        parse_rows([(3, 'Con Llantas Limpio', None, None)])

def test_apply_solo_toca_has_wheels_y_color():
    sql = build_apply_sql([('001', True, None), ('Y1', None, 'rojo')])
    assert 'has_wheels' in sql and 'color' in sql
    assert 'status' not in sql and 'tare_weight_kg' not in sql
    assert "('001', true, null)" in sql
    assert "('Y1', null, 'rojo')" in sql

def test_preview_no_modifica():
    sql = build_preview_sql([('001', True, None)]).lower()
    assert sql.lstrip().startswith('with') or sql.lstrip().startswith('select')
    assert 'update' not in sql
```

- [ ] **Step 2: Verificar que fallan**

Run: `python -m pytest scripts/test_sync_inventario_fisico.py -v` (desde el root; pytest agrega `scripts/` al path por el rootdir del test).
Expected: FAIL con `ModuleNotFoundError: No module named 'sync_inventario_fisico'`.

- [ ] **Step 3: Implementar**

`scripts/sync_inventario_fisico.py`:

```python
#!/usr/bin/env python3
"""
Sincroniza has_wheels y color de public.containers con el Excel de inventario
de planta ("Inventario de Contenedores en Proceso", hoja "Data").

Uso:
    python scripts/sync_inventario_fisico.py "<excel>"            > preview.sql
    python scripts/sync_inventario_fisico.py "<excel>" --apply    > apply.sql
    # Correr el SQL con MCP execute_sql sobre el piloto (xqqnthyipkdkwyknbtnw).

- Por defecto genera un SELECT de vista previa: qué cambiaría y qué
  contenedores activos no están en el Excel. No modifica nada.
- --apply genera el UPDATE. Solo escribe has_wheels y color; nunca status ni tara.
- La columna "limpio / en proceso" del Excel se ignora: ese estado se deriva
  en vivo de los eventos (ver docs/superpowers/specs/2026-09-24-inventario-fisico-dashboard-design.md).
- Filas sin número (p. ej. Yaris verdes sin numerar) se informan por stderr y no se cargan.
"""
from __future__ import annotations
import re
import sys
from typing import Iterable, Optional

Item = tuple[str, Optional[bool], Optional[str]]

WHEELS = {
    'con llantas limpios': True,
    'con llantas y en proceso': True,
    'sin llantas limpios': False,
    'sin llantas y en proceso': False,
}
COLORS = {
    'limpios rojos': 'rojo',
    'en proceso rojos': 'rojo',
    'limpios verde': 'verde',
    'en proceso verde': 'verde',
}


def _number(cell) -> Optional[int]:
    if cell is None:
        return None
    m = re.match(r'\s*(\d+)', str(cell))
    return int(m.group(1)) if m else None


def _lookup(table: dict, text: str, fila: int):
    key = ' '.join(str(text).split()).lower()
    if key not in table:
        raise ValueError(f'fila {fila}: ubicación desconocida "{text}"')
    return table[key]


def parse_rows(rows: Iterable[tuple]) -> tuple[list[Item], list[str]]:
    """rows: (n_240, ubic_240, n_1100, ubic_1100) por fila de datos, 1-indexadas."""
    items: list[Item] = []
    skipped: list[str] = []
    for fila, (n240, u240, n1100, u1100) in enumerate(rows, start=1):
        if u240 is not None:
            wheels = _lookup(WHEELS, u240, fila)
            n = _number(n240)
            if n is None:
                skipped.append(f'240 L sin número: "{u240}"')
            else:
                items.append((str(n).zfill(3), wheels, None))
        if u1100 is not None:
            color = _lookup(COLORS, u1100, fila)
            n = _number(n1100)
            if n is None:
                skipped.append(f'1100 L sin número: "{u1100}"')
            else:
                items.append((f'Y{n}', None, color))
    return items, skipped


def _sql_bool(v: Optional[bool]) -> str:
    return 'null' if v is None else ('true' if v else 'false')


def _sql_text(v: Optional[str]) -> str:
    return 'null' if v is None else f"'{v}'"


def _values(items: list[Item]) -> str:
    return ',\n  '.join(f"('{cid}', {_sql_bool(w)}, {_sql_text(c)})" for cid, w, c in items)


def build_preview_sql(items: list[Item]) -> str:
    return f"""with t(id, has_wheels, color) as (values
  {_values(items)}
)
select 'cambia' as tipo, c.id, c.has_wheels as antes_llantas, t.has_wheels as despues_llantas,
       c.color as antes_color, t.color as despues_color
from public.containers c join t on t.id = c.id
where (t.has_wheels is not null and c.has_wheels is distinct from t.has_wheels)
   or (t.color is not null and c.color is distinct from t.color)
union all
select 'no existe en sistema', t.id, null, t.has_wheels, null, t.color
from t left join public.containers c on c.id = t.id where c.id is null
union all
select 'activo sin fila en excel', c.id, c.has_wheels, null, c.color, null
from public.containers c
where c.status = 'active' and (c.size_liters = '240' or c.is_yaris_container)
  and not c.is_metallic_dedicated and c.id not in (select id from t)
order by 1, 2;"""


def build_apply_sql(items: list[Item]) -> str:
    return f"""with t(id, has_wheels, color) as (values
  {_values(items)}
)
update public.containers c
set has_wheels = coalesce(t.has_wheels, c.has_wheels),
    color      = coalesce(t.color, c.color)
from t
where c.id = t.id
  and ((t.has_wheels is not null and c.has_wheels is distinct from t.has_wheels)
    or (t.color is not null and c.color is distinct from t.color))
returning c.id, c.has_wheels, c.color;"""


def read_excel(path: str) -> list[tuple]:
    import openpyxl
    ws = openpyxl.load_workbook(path, data_only=True)['Data']
    out = []
    for r in ws.iter_rows(min_row=5, values_only=True):
        n240, u240, n1100, u1100 = r[2], r[3], r[6], r[7]
        if u240 is None and u1100 is None:
            continue
        out.append((n240, u240, n1100, u1100))
    return out


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    items, skipped = parse_rows(read_excel(argv[1]))
    print(f'{len(items)} contenedores leídos; {len(skipped)} filas sin número:', file=sys.stderr)
    for s in skipped:
        print(f'  - {s}', file=sys.stderr)
    print(build_apply_sql(items) if '--apply' in argv else build_preview_sql(items))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
```

`typing.Optional` y `tuple[...]` funcionan en Python 3.9+. `from __future__ import annotations` deja la anotación del alias como string.

Nota sobre el tipo de columna: `size_liters` es un enum de Postgres (`container_size`) con valores de texto, de ahí la comparación `c.size_liters = '240'`.

- [ ] **Step 4: Verificar que pasan**

Run: `python -m pytest scripts/test_sync_inventario_fisico.py -v`
Expected: PASS, 7 tests.

- [ ] **Step 5: Corrida en seco contra el Excel real**

Run:
```bash
python scripts/sync_inventario_fisico.py "docs/fuentes/Inventario de Contenedores en Proceso (1).xlsx" > "$TMP/preview.sql"
```
Expected en stderr: `224 contenedores leídos; 8 filas sin número:` (los 8 Yaris verdes).

Correr el contenido de `$TMP/preview.sql` con MCP `execute_sql` sobre `xqqnthyipkdkwyknbtnw`.
Expected:
- 224 filas `cambia` (todas las columnas están en null).
- 0 filas `no existe en sistema`.
- Filas `activo sin fila en excel` solo para `Y26` (el `200` está de baja).

Si aparece algo distinto, **detenerse y reportar** antes de aplicar.

- [ ] **Step 6: Aplicar**

Run:
```bash
python scripts/sync_inventario_fisico.py "docs/fuentes/Inventario de Contenedores en Proceso (1).xlsx" --apply > "$TMP/apply.sql"
```
Correr con MCP `execute_sql`. Expected: 224 filas en el `returning`.

Verificar:
```sql
select
  count(*) filter (where size_liters = '240' and has_wheels)      as con_llantas,
  count(*) filter (where size_liters = '240' and not has_wheels)  as sin_llantas,
  count(*) filter (where is_yaris_container and color = 'rojo')   as yaris_rojos
from public.containers where status = 'active';
```
Expected: `con_llantas = 155`, `sin_llantas = 44`, `yaris_rojos = 25`. Salen del Excel: 135+20 con llantas y 13+31 sin llantas, todos activos. `Y26` queda sin color.

Volver a correr la vista previa. Expected: 0 filas `cambia`, lo que prueba que la carga es idempotente.

- [ ] **Step 7: Commit**

```bash
git add scripts/sync_inventario_fisico.py scripts/test_sync_inventario_fisico.py
git commit -m "feat(scripts): sincronizar llantas y color desde el Excel de inventario

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verificación final y vault

**Files:**
- Create: `vault/logs/2026-09-24-inventario-fisico-dashboard.md`
- Modify: `vault/project/DataModel.md` (sección de contenedores)
- Modify: `vault/_index.md` (lista de logs vigentes)

- [ ] **Step 1: Verificar en el navegador con datos reales**

Run: `npm run dev:hub` y abrir `/dashboard` como coordinador.
Expected:
- 240 L: Con llantas suma 155 (limpios + en proceso) y Sin llantas suma 44. No aparece la fila "Sin dato".
- 1100 L: Rojos suma 25, Verdes 0 0, y aparece "Sin dato" con 1 (Y26).

- [ ] **Step 2: Documentar en DataModel**

En `vault/project/DataModel.md`, en la sección de contenedores, agregar:

```markdown
- **Atributos físicos (desde 2026-09-24):** `has_wheels` (con/sin llantas) y `color` (Yaris rojo/verde).
  Vienen del Excel de inventario de planta y se cargan con `scripts/sync_inventario_fisico.py`;
  no hay pantalla de edición. `null` = sin dato. El estado limpio / en proceso **no** se guarda:
  se deriva en vivo de la circulación. Ver [[2026-09-24-inventario-fisico-dashboard]].
```

Actualizar el `updated:` del frontmatter a `2026-09-24`.

- [ ] **Step 3: Crear el log**

`vault/logs/2026-09-24-inventario-fisico-dashboard.md`:

```markdown
---
title: Inventario físico en la tarjeta Flota y planta
tags:
  - log
  - dashboard
  - tachos
  - inventario
date: 2026-09-24
updated: 2026-09-24
---

# 2026-09-24 — Inventario físico en "Flota y planta"

La tarjeta del dashboard muestra el mismo desglose que el Excel de inventario de planta:
tachos 240 L por llantas y Yaris por color, cada fila con limpios / en proceso.

## Decisiones del usuario
- **Limpio / en proceso sale del sistema en vivo**, no del Excel: el Excel envejece al día siguiente.
  Limpio = en planta, en cliente o sin actividad; en proceso = pendiente de pesar o de tratar.
- **Llantas y color se actualizan recargando el Excel** con `scripts/sync_inventario_fisico.py`
  (el usuario deja el Excel en el inbox; se corre la vista previa y luego `--apply`). No hay pantalla de edición.
- Dos columnas en `containers`, sin historial de cargas.

## Límites conocidos
- Mientras planta no registre tratamientos (teléfonos en v1.5), "En proceso" sale inflado.
- Los 8 Yaris verdes no tienen número y no están en el sistema; la fila Verdes muestra 0.
- `Y26` no está en el Excel: queda sin color, en "Sin dato".

Spec: `docs/superpowers/specs/2026-09-24-inventario-fisico-dashboard-design.md`.
```

- [ ] **Step 4: Enlazar en el índice**

En `vault/_index.md`, bajo `### Vigentes — leer antes de tocar el APK`, agregar como primera línea:

```markdown
- [[2026-09-24-inventario-fisico-dashboard]] — la tarjeta Flota y planta muestra llantas (240 L) y color (Yaris) × limpio / en proceso en vivo; llantas y color se recargan desde el Excel con un script
```

- [ ] **Step 5: Tests y build completos**

Run: `npm test` → Expected: todo verde.
Run: `npm run build:hub` → Expected: OK.
Run: `python -m pytest scripts/test_sync_inventario_fisico.py` → Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
git add vault/logs/2026-09-24-inventario-fisico-dashboard.md vault/project/DataModel.md vault/_index.md
git commit -m "docs(vault): log del inventario físico en el dashboard

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
