# Contenedor descartable (Cito / Anato / Morgue) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el pesaje, Citotóxico, Anatomopatológico y Morgue se registran con un número de contenedor escrito a mano, sin tacho y sin tara (neto = bruto), y los 11 históricos se corrigen.

**Architecture:**
- **Datos:** `container_receptions.container_id` pasa a ser nullable y se suma `container_ref text`.
- **Cálculo:** todo el peso neto sale de una sola función, `receptionNetWeight`, que devuelve el bruto cuando no hay tacho. Todo el código que indexa por `container_id` tolera `null`.
- **APK:** el formulario de pesaje cambia el selector de tacho por un campo de texto para esos 3 tipos.
- **Hub:** el historial muestra y edita el número.

**Tech Stack:** Next.js (hub, app) · Capacitor · TypeScript · Jest · Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-09-28-contenedor-descartable-design.md`

## Global Constraints

- Tipos alcanzados: `'cytotoxic' | 'anatomopathological' | 'morgue'`, constante `DISPOSABLE_CONTAINER_WASTE_TYPES`. **No** Líquidos.
- `container_ref`: texto obligatorio para esos tipos; se guarda sin espacios al inicio ni al final; máximo 30 caracteres.
- Históricos: `container_id = null`, `container_ref = 'S/N (histórico)'`.
- Neto sin tacho = bruto. Con tacho, `computeNetWeight(bruto, tara)` como hoy.
- Fotos: siguen las dos obligatorias; la del tacho se titula "Foto del contenedor" para esos tipos.
- La migración 2 (regla CHECK) se escribe pero **no se aplica** en este plan: se aplica después del rollout de v1.12.
- Proyecto Supabase del piloto: `xqqnthyipkdkwyknbtnw`.
- Dentro de `shared/` los imports usan siempre `@hospiwaste/shared/...`, nunca `@/`.
- Comandos: `npm test` (3 workspaces), `npm run build:hub`, `npm run build:app`.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

**Ruling:** si una recepción apunta a un tacho que no existe en el store, se **excluye** de los kg, como hoy. El spec decía "tacho inexistente → bruto". Se prefirió no cambiar el comportamiento vigente para los datos con tacho; si está mal, lo único que cambia son kg de datos inconsistentes.

## Review Focus

1. **Finalizar una sesión con pesajes descartables:** `handleFinish` crea un `StorageEvent` y una `ContainerLocation` por recepción usando `r.container_id`. Con `null`, la fila local rompe la sincronización por la FK. Estas recepciones **no** deben generar esas filas. → Test en Task 3.
2. **El informe fotográfico con pesajes sin tacho:** no puede descartar ni mezclar sus fotos. → Test en Task 1.
3. **Cruzar de tipo en el formulario** (Anatomopatológico → Infeccioso y viceversa): limpia el tacho o el número; nunca se envía un pesaje con los dos ni con ninguno. → Test en Task 3.
4. **Número con solo espacios:** "   " no cuenta como número y no se puede enviar. → Test en Task 3.
5. **Circulación y cola de pesaje con recepciones sin tacho:** ningún tacho cambia de estado y no hay errores. → Test en Task 1.

---

## File Structure

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20260928000000_contenedor_descartable.sql` | Crear: nullable + `container_ref` + corrección de históricos |
| `supabase/migrations/20260928000100_contenedor_descartable_check.sql` | Crear: regla CHECK (no se aplica) |
| `shared/src/lib/supabase/database.types.ts` | `container_receptions`: `container_id` nullable, `container_ref` |
| `shared/src/lib/types.ts` | `ContainerReception.container_id: string \| null`, `container_ref`; constante e `isDisposableWaste` |
| `shared/src/components/supabase-hydrator.tsx` | `rowToReception` propaga `container_ref` |
| `shared/src/lib/data/containers.ts` | `receptionNetWeight`; tolerar `null` en `getPendingWeighingContainerIds` |
| `shared/src/lib/data/dashboard-analytics.ts`, `dashboard-metrics.ts`, `historical-kg.ts` | Usar `receptionNetWeight` |
| `hub/src/lib/data/reports.ts` | Tolerar `container_id` null |
| `shared/src/components/history/weighing-history.tsx` | Etiqueta y edición de `container_ref` |
| `app/src/components/register/weighing-form.tsx` | Campo "N° de contenedor", neto sin tara |
| `app/src/app/register/weighing/page.tsx` | Envío, edición y finalización con `container_ref` |
| `app/src/components/register/weighing-session-drawer.tsx` | Etiqueta y neto |
| Tests en `shared/src/__tests__/lib/`, `hub/src/__tests__/lib/`, `app/src/__tests__/` | Nuevos casos |

---

### Task 1: Modelo compartido — recepciones sin tacho

**Files:**
- Modify: `shared/src/lib/types.ts:162-190` (`ContainerReception`) y cerca de `WasteType` (arriba del archivo)
- Modify: `shared/src/lib/data/containers.ts`
- Modify: `shared/src/lib/data/dashboard-analytics.ts:74-84, 110-120, 130-139, 192-202`
- Modify: `shared/src/lib/data/dashboard-metrics.ts:160-185, 228-256`
- Modify: `shared/src/lib/data/historical-kg.ts:~80-96`
- Modify: `hub/src/lib/data/reports.ts:157-163, 196-205, 238-246`
- Test: `shared/src/__tests__/lib/containers.test.ts` (crear si no existe), `shared/src/__tests__/lib/dashboard-analytics.test.ts`, `hub/src/__tests__/lib/reports.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const DISPOSABLE_CONTAINER_WASTE_TYPES: readonly WasteType[] // ['cytotoxic','anatomopathological','morgue']
  export function isDisposableWaste(t: WasteType | undefined | null): boolean
  // ContainerReception: container_id: string | null; container_ref?: string | null
  export function receptionNetWeight(
    r: Pick<ContainerReception, 'gross_weight_kg' | 'container_id'>,
    containerById: Map<string, Pick<Container, 'tare_weight_kg'>>,
  ): number | null // null = tacho referenciado pero inexistente (se excluye)
  ```

- [ ] **Step 1: Tests que fallan**

Crear `shared/src/__tests__/lib/containers.test.ts`. Si ya existe, sumar solo el `describe`.

```ts
import { receptionNetWeight, getPendingWeighingContainerIds } from '@hospiwaste/shared/lib/data/containers'
import { isDisposableWaste } from '@hospiwaste/shared/lib/types'

const byId = new Map([['001', { tare_weight_kg: 9.5 }]])

describe('receptionNetWeight', () => {
  it('con tacho resta la tara', () => {
    expect(receptionNetWeight({ gross_weight_kg: 30, container_id: '001' }, byId)).toBe(20.5)
  })
  it('sin tacho (contenedor descartable) devuelve el bruto', () => {
    expect(receptionNetWeight({ gross_weight_kg: 12.3, container_id: null }, byId)).toBe(12.3)
  })
  it('tacho referenciado que no existe → null (se excluye, como hoy)', () => {
    expect(receptionNetWeight({ gross_weight_kg: 30, container_id: '999' }, byId)).toBeNull()
  })
})

describe('isDisposableWaste', () => {
  it('solo cito, anato y morgue', () => {
    expect(isDisposableWaste('cytotoxic')).toBe(true)
    expect(isDisposableWaste('anatomopathological')).toBe(true)
    expect(isDisposableWaste('morgue')).toBe(true)
    expect(isDisposableWaste('liquid')).toBe(false)
    expect(isDisposableWaste('infectious')).toBe(false)
    expect(isDisposableWaste(undefined)).toBe(false)
  })
})

describe('getPendingWeighingContainerIds con recepciones sin tacho', () => {
  it('no cambia la cola ni falla', () => {
    const containers = [{ id: '001', size_liters: 240, tare_weight_kg: 9.5, status: 'active', registered_at: '2026-01-01T00:00:00Z' }] as never
    const routeEvents = [{ id: 'e1', client_id: 'c', kind: 'anden', slot: '06:30', date: '2026-09-20', started_at: '2026-09-20T06:30:00Z', ended_at: null, operator_id: 'op', status: 'completed', containers_dirty_received: ['001'], containers_clean_delivered: [], area: '', photo_ids: [], voided_at: null }] as never
    const receptions = [{ id: 'r1', container_id: null, container_ref: '1234', weighing_session_id: null, arrived_at: '2026-09-20T08:00:00Z', gross_weight_kg: 5, operator_id: 'op', photo_ids: [], observations: '', waste_type: 'morgue' }] as never
    expect(getPendingWeighingContainerIds(containers, routeEvents, receptions)).toEqual(['001'])
  })
})
```

En `shared/src/__tests__/lib/dashboard-analytics.test.ts`, agregar a la suite existente de `computeKgByWasteType`, con los fixtures `makeContainer` y `makeReception` del archivo. Si el helper no acepta `container_id: null`, pasar `container_id: null as unknown as string` en el override.

```ts
it('cuenta los kg de un contenedor descartable como bruto (sin tara)', () => {
  const containers = [makeContainer('001', { tare_weight_kg: 10 })]
  const receptions = [
    makeReception({ id: 'r1', container_id: '001', arrived_at: '2026-07-22T10:00:00Z', gross_weight_kg: 30, waste_type: 'infectious' }),
    makeReception({ id: 'r2', container_id: null as unknown as string, arrived_at: '2026-07-22T11:00:00Z', gross_weight_kg: 7.5, waste_type: 'morgue' }),
  ]
  const out = computeKgByWasteType({ receptions, containers }, '2026-07-22', '2026-07-22')
  expect(out.find((x) => x.wasteType === 'infectious')?.kg).toBe(20)
  expect(out.find((x) => x.wasteType === 'morgue')?.kg).toBe(7.5)
})
```

Antes de escribirlo, leer la firma real de `computeKgByWasteType` y los nombres de los campos del resultado en `dashboard-analytics.ts`, y ajustar la llamada a esa firma. La afirmación que importa es: el morgue suma 7,5 kg brutos y el infeccioso resta la tara.

En `hub/src/__tests__/lib/reports.test.ts`, dentro del `describe` que define `ionStore` y `range`:

```ts
it('incluye en pares de pesaje las recepciones sin tacho (contenedor descartable)', () => {
  const rec = ionStore.receptions[0]
  const store = {
    ...ionStore,
    receptions: [...ionStore.receptions, { ...rec, id: 'rec-descartable', container_id: null, container_ref: '5501', waste_type: 'morgue' as const, photo_ids: ['ph-d-t', 'ph-d-s'] }],
    photos: [
      ...ionStore.photos,
      { id: 'ph-d-t', url: 'u-t', event_type: 'weighing' as const, event_id: 'rec-descartable', taken_at: rec.arrived_at, label: '' },
      { id: 'ph-d-s', url: 'u-s', event_type: 'weighing' as const, event_id: 'rec-descartable', taken_at: rec.arrived_at, label: '' },
    ],
  }
  const data = buildPhotographicReportData('company-ion', store, range)!
  const urls = data.days.flatMap((d) => d.groups).flatMap((g) => g.pairs ?? []).flatMap((p) => [p.tacho?.url, p.scale?.url])
  expect(urls).toEqual(expect.arrayContaining(['u-t', 'u-s']))
})
```

Si la recepción clonada no pertenece a ION según `recBelongs`, copiar `company_id` de `rec`, que ya es de ION.

- [ ] **Step 2: Verificar que fallan**

Run: `npm test --workspace shared -- containers dashboard-analytics` y `npm test --workspace hub -- reports`.
Expected: FAIL. `receptionNetWeight` e `isDisposableWaste` no existen, y el morgue no suma o el par no aparece.

- [ ] **Step 3: Implementar**

`shared/src/lib/types.ts`, después de la definición de `WasteType`:

```ts
/** Tipos que se pesan en un contenedor propio que se desecha con el residuo:
 *  no hay tacho ni tara; el operador escribe el número del contenedor. */
export const DISPOSABLE_CONTAINER_WASTE_TYPES: readonly WasteType[] = ['cytotoxic', 'anatomopathological', 'morgue']

export function isDisposableWaste(t: WasteType | undefined | null): boolean {
  return !!t && DISPOSABLE_CONTAINER_WASTE_TYPES.includes(t)
}
```

En `ContainerReception`:

```ts
  /** Tacho pesado. null en contenedores descartables (cito/anato/morgue): no hay tara. */
  container_id: string | null
  /** Número del contenedor descartable escrito por el operador. Solo con container_id null. */
  container_ref?: string | null
```

`shared/src/lib/data/containers.ts`, después de `computeNetWeight`:

```ts
/**
 * Peso neto de una recepción. Sin tacho (contenedor descartable de
 * cito/anato/morgue) no hay tara: neto = bruto. Con un tacho que no está en el
 * catálogo devuelve null y quien llama excluye la recepción (comportamiento previo).
 */
export function receptionNetWeight(
  r: Pick<ContainerReception, 'gross_weight_kg' | 'container_id'>,
  containerById: Map<string, Pick<Container, 'tare_weight_kg'>>,
): number | null {
  if (r.container_id == null) return Math.round(r.gross_weight_kg * 100) / 100
  const c = containerById.get(r.container_id)
  return c ? computeNetWeight(r.gross_weight_kg, c.tare_weight_kg) : null
}
```

En `getPendingWeighingContainerIds`, dentro del loop de receptions, después de `if (r.voided_at) continue`:

```ts
    if (r.container_id == null) continue
```

En `buildContainerWithPhase` no hay cambio: siempre recibe el tacho.

`dashboard-analytics.ts`: en los cuatro loops (74-84, 110-120, 130-139, 192-202) se reemplaza

```ts
    const container = containerMap.get(r.container_id)
    if (!container) continue
    ... computeNetWeight(r.gross_weight_kg, container.tare_weight_kg)
```

por

```ts
    const kg = receptionNetWeight(r, containerMap)
    if (kg == null) continue
    ... kg
```

Se conserva el resto de cada loop tal cual (`key`, `day`, `count += 1`). El import pasa a `import { receptionNetWeight, deriveContainerCompanyId } from './containers'`; también se mantiene `computeNetWeight` si todavía se usa en el archivo.

`dashboard-metrics.ts`:
- Loops de *recibidos* (160-169 y 228-238): mismo reemplazo con `receptionNetWeight(r, containerMap)`.
- Loops de *procesados* (171-185 y 240-256): parten del tacho del tratamiento, no cambian.
- Import: `receptionNetWeight`.

`historical-kg.ts` (~84-96):

```ts
    const kg = receptionNetWeight(r, containerById)
    if (kg == null) continue
```

Eso reemplaza el `container` + `computeNetWeight`. Hay que borrar el `if (!container) continue` previo si queda sin uso, y ajustar el import.

`hub/src/lib/data/reports.ts`:
- Línea 159: `...receptions.map((r) => r.container_id).filter((id): id is string => id != null),`
- Línea 198: `const ruta = rec.container_id ? rutaOfContainer.get(rec.container_id) : undefined`
- Línea 240: `const container = rec.container_id ? containerMap.get(rec.container_id) ?? null : null`
- Líneas 244-246: `WeighingPair.container_id` y `ReportPhotoEntry.container_id` pasan a `string | null`, cambiando esos tipos al inicio del archivo (`container_id: string | null`), y se usa `rec.container_id`.

- [ ] **Step 4: Compilar y tests**

Run: `npm test` y `npm run build:hub`.
Expected: todo verde.

Si TypeScript marca otros usos de `r.container_id` como `string | null` (p. ej. `computeQualityIndicators.containerId`, `findTodayReceptionForContainer`, `treatment.ts`), se ajusta el tipo destino a `string | null` o se agrega `r.container_id != null &&` en la comparación. Nunca con `!` ni `as string`.

- [ ] **Step 5: Commit**

```bash
git add shared/src/lib/types.ts shared/src/lib/data hub/src/lib/data/reports.ts shared/src/__tests__ hub/src/__tests__/lib/reports.test.ts
git commit -m "feat(pesaje): recepciones sin tacho — neto = bruto en un solo lugar

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Base de datos, tipos generados e hidratación

**Files:**
- Create: `supabase/migrations/20260928000000_contenedor_descartable.sql`
- Create: `supabase/migrations/20260928000100_contenedor_descartable_check.sql`
- Modify: `shared/src/lib/supabase/database.types.ts` (`container_receptions` Row/Insert/Update)
- Modify: `shared/src/components/supabase-hydrator.tsx:404-421` (`rowToReception`)

**Interfaces:**
- Consumes: `ContainerReception.container_ref` (Task 1).
- Produces: columna `container_receptions.container_ref text`; `container_id` nullable; `Tables<'container_receptions'>['container_ref']`.

- [ ] **Step 1: Migración 1**

```sql
-- 2026-09-28 — Contenedor descartable para citotóxico, anatomopatológico y morgue.
-- Esos residuos no van en tachos: se pesan en un contenedor propio que se
-- desecha. El pesaje guarda el número escrito (container_ref), sin tacho ni tara.
-- Ver docs/superpowers/specs/2026-09-28-contenedor-descartable-design.md.

alter table public.container_receptions alter column container_id drop not null;
alter table public.container_receptions add column container_ref text;

comment on column public.container_receptions.container_ref is
  'Número del contenedor descartable (cito/anato/morgue), escrito por el operador. Con container_id null: neto = bruto.';

-- Históricos: se cargaron contra un tacho cualquiera porque el formulario lo exigía.
update public.container_receptions
   set container_id = null, container_ref = 'S/N (histórico)'
 where waste_type in ('cytotoxic', 'anatomopathological', 'morgue')
   and container_id is not null;
```

- [ ] **Step 2: Migración 2 (solo el archivo, NO aplicar)**

```sql
-- 2026-09-28 — Regla: cito/anato/morgue llevan número y no tacho; el resto, tacho.
-- APLICAR SOLO cuando todos los teléfonos tengan APK v1.12: un APK viejo manda
-- tacho para estos tipos y esta regla rechazaría esos pesajes.
-- Antes de aplicar, corregir los que hayan entrado con tacho:
--   update public.container_receptions set container_id = null, container_ref = 'S/N (histórico)'
--    where waste_type in ('cytotoxic','anatomopathological','morgue') and container_id is not null;

alter table public.container_receptions add constraint container_receptions_container_by_type check (
  case when waste_type in ('cytotoxic', 'anatomopathological', 'morgue')
       then container_id is null and coalesce(btrim(container_ref), '') <> ''
       else container_id is not null and container_ref is null end
);
```

- [ ] **Step 3: Aplicar la migración 1 en el piloto y verificar**

Antes:
```sql
select count(*) from container_receptions where waste_type in ('cytotoxic','anatomopathological','morgue') and container_id is not null;
```
Expected: 11.

Aplicar la migración 1 con MCP `apply_migration` (`project_id: xqqnthyipkdkwyknbtnw`, `name: contenedor_descartable`).

Después:
```sql
select waste_type, count(*), count(*) filter (where container_id is null and container_ref = 'S/N (histórico)') corregidos
from container_receptions where waste_type in ('cytotoxic','anatomopathological','morgue') group by 1;
select count(*) from container_receptions where waste_type = 'infectious' and container_id is null;
```
Expected: anatomopatológico con 11 corregidos, y 0 infecciosos sin tacho.

- [ ] **Step 4: Tipos generados**

En `database.types.ts`, tabla `container_receptions`:
- `Row`: `container_id: string | null` y `container_ref: string | null`.
- `Insert` / `Update`: `container_id?: string | null` y `container_ref?: string | null`.

Se mantiene el orden alfabético. Se puede regenerar con MCP `generate_typescript_types` y quedarse solo con el diff de esa tabla.

- [ ] **Step 5: Hidratación**

En `rowToReception`, después de `container_id: r.container_id,`:

```ts
    container_ref: r.container_ref ?? null,
```

- [ ] **Step 6: Compilar y tests**

Run: `npm test`, `npm run build:hub`, `npm run build:app`.
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260928000000_contenedor_descartable.sql supabase/migrations/20260928000100_contenedor_descartable_check.sql shared/src/lib/supabase/database.types.ts shared/src/components/supabase-hydrator.tsx
git commit -m "feat(db): container_ref y tacho opcional en pesajes; corrige 11 históricos

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: APK — formulario y pantalla de pesaje

**Files:**
- Modify: `app/src/components/register/weighing-form.tsx`:
  - `WeighingFormState` / `EMPTY_WEIGHING_FORM` (~23-45);
  - validación (100-126);
  - bloque del tacho (139-241);
  - peso (279-322);
  - fotos (~338-356).
- Modify: `app/src/app/register/weighing/page.tsx`:
  - `duplicateWarning`, `inheritedCompanyId`;
  - `handleCreateReception`, `handleSaveEdit`, `handleSelectForEdit`, `handleFinish`.
- Modify: `app/src/components/register/weighing-session-drawer.tsx:~105-120`.
- Create: `app/src/lib/weighing-finish.ts` (derivados de la finalización, testeable).
- Test: `app/src/__tests__/components/weighing-form.test.tsx`, `app/src/__tests__/lib/weighing-finish.test.ts`.

**Interfaces:**
- Consumes: `isDisposableWaste`, `receptionNetWeight`, `ContainerReception.container_ref` (Tasks 1-2).
- Produces:
  ```ts
  // WeighingFormState suma:
  container_ref: string
  // app/src/lib/weighing-finish.ts
  export function receptionsNeedingStorage(receptions: ContainerReception[]): ContainerReception[]
  ```

- [ ] **Step 1: Tests que fallan**

`app/src/__tests__/lib/weighing-finish.test.ts`:

```ts
import { receptionsNeedingStorage } from '@/lib/weighing-finish'
import type { ContainerReception } from '@hospiwaste/shared/lib/types'

const base = { weighing_session_id: 's', arrived_at: '2026-09-28T10:00:00Z', gross_weight_kg: 10, operator_id: 'op', photo_ids: [], observations: '' }

it('los pesajes sin tacho no generan cámara fría ni ubicación', () => {
  const recs = [
    { ...base, id: 'a', container_id: '001', waste_type: 'infectious' },
    { ...base, id: 'b', container_id: null, container_ref: '5501', waste_type: 'morgue' },
  ] as ContainerReception[]
  expect(receptionsNeedingStorage(recs).map((r) => r.id)).toEqual(['a'])
})
```

En `app/src/__tests__/components/weighing-form.test.tsx`, siguiendo el `render` y los props que ya usa el archivo:

```tsx
describe('contenedor descartable', () => {
  it('con Morgue muestra "N° de contenedor" y no el buscador de tacho', () => {
    renderForm({ state: { ...EMPTY_WEIGHING_FORM, waste_type: 'morgue' } })
    expect(screen.getByLabelText(/n° de contenedor/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/número de tacho/i)).not.toBeInTheDocument()
  })

  it('no deja enviar sin número o con solo espacios; neto = bruto', () => {
    const state = {
      ...EMPTY_WEIGHING_FORM, waste_type: 'cytotoxic' as const, company_id: 'company-airkem',
      gross_weight: '7.5', photo_container: 'data:c', photo_scale: 'data:s', container_ref: '   ',
    }
    renderForm({ state })
    expect(screen.getByRole('button', { name: /registrar|guardar/i })).toBeDisabled()
    renderForm({ state: { ...state, container_ref: 'C-12' } })
    expect(screen.getAllByRole('button', { name: /registrar|guardar/i }).at(-1)).toBeEnabled()
    expect(screen.getAllByText(/7\.5/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/sin tara/i).length).toBeGreaterThan(0)
  })

})
```

En `shared/src/__tests__/lib/containers.test.ts` (creado en Task 1):

```ts
import { wasteTypeChange } from '@hospiwaste/shared/lib/data/containers'

describe('wasteTypeChange', () => {
  it('limpia el número al salir de un tipo descartable', () => {
    expect(wasteTypeChange('anatomopathological', 'infectious')).toEqual({ waste_type: 'infectious', container_ref: '' })
  })
  it('limpia el tacho al entrar a un tipo descartable o cruzar metálicos', () => {
    expect(wasteTypeChange('infectious', 'morgue')).toEqual({ waste_type: 'morgue', container_id: '' })
    expect(wasteTypeChange('infectious', 'metallic')).toEqual({ waste_type: 'metallic', container_id: '' })
  })
  it('entre tipos con tacho no limpia nada', () => {
    expect(wasteTypeChange('infectious', 'liquid')).toEqual({ waste_type: 'liquid' })
  })
  it('entre dos tipos descartables conserva el número', () => {
    expect(wasteTypeChange('morgue', 'cytotoxic')).toEqual({ waste_type: 'cytotoxic' })
  })
})
```

`renderForm` es el helper del archivo; si no existe, se crea con los props mínimos de `Props` (listas vacías, `locked: false`, `mode: 'create'`, `onSubmit: jest.fn()`, `onChange: jest.fn()`).


- [ ] **Step 2: Verificar que fallan**

Run: `npm test --workspace app -- weighing-form weighing-finish` y `npm test --workspace shared -- containers`.
Expected: FAIL.

- [ ] **Step 3: Implementar el formulario**

`WeighingFormState` suma `container_ref: string` y `EMPTY_WEIGHING_FORM` suma `container_ref: ''`.

Importar `isDisposableWaste` desde `@hospiwaste/shared/lib/types`.

En `shared/src/lib/data/containers.ts` (lo usan el APK y el historial del hub):

```ts
/** Qué se limpia al cambiar el tipo de desecho en un formulario de pesaje. */
export function wasteTypeChange(
  prev: WasteType,
  next: WasteType,
): { waste_type: WasteType; container_id?: ''; container_ref?: '' } {
  const crossingMetallic = (prev === 'metallic') !== (next === 'metallic')
  const toDisposable = !isDisposableWaste(prev) && isDisposableWaste(next)
  const fromDisposable = isDisposableWaste(prev) && !isDisposableWaste(next)
  return {
    waste_type: next,
    ...(crossingMetallic || toDisposable ? { container_id: '' as const } : {}),
    ...(fromDisposable ? { container_ref: '' as const } : {}),
  }
}
```

Importar `WasteType` e `isDisposableWaste` en `containers.ts`. En `weighing-form.tsx`, importar `wasteTypeChange` desde `@hospiwaste/shared/lib/data/containers`.

`changeWasteType` pasa a:

```ts
  function changeWasteType(v: string | null) {
    const next = (v ?? 'infectious') as WasteType
    const patch = wasteTypeChange(state.waste_type, next)
    if ('container_id' in patch) setTachoSearch('')
    onChange(patch)
  }
```

Validación, con `const isDisposable = isDisposableWaste(state.waste_type)` y `const ref = state.container_ref.trim()`:

```ts
  const hasValidWeight = !!state.gross_weight && !Number.isNaN(grossWeight) && (
    isDisposable ? grossWeight > 0 : selectedContainer != null && grossWeight > selectedContainer.tare_weight_kg
  )
  const netWeight = !hasValidWeight ? null
    : isDisposable ? Math.round(grossWeight * 100) / 100
    : computeNetWeight(grossWeight, selectedContainer!.tare_weight_kg)
  const canSubmit =
    (isDisposable ? ref.length > 0 && ref.length <= 30 : !!state.container_id) &&
    !!state.company_id && !!state.photo_container && !!state.photo_scale && hasValidWeight
```

Bloque del tacho (139-241): si `isDisposable`, se renderiza **en su lugar**:

```tsx
      <div className="space-y-1.5">
        <label htmlFor="container-ref" className="text-sm font-medium text-foreground">
          N° de contenedor <span className="text-red-500">*</span>
        </label>
        <Input
          id="container-ref"
          value={state.container_ref}
          onChange={(e) => onChange({ container_ref: e.target.value })}
          maxLength={30}
          placeholder="Número escrito en el contenedor"
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">Contenedor descartable: no lleva tara.</p>
      </div>
```

Si no es `isDisposable`, queda el bloque actual sin cambios: el buscador, el aviso de "no hay tachos", los badges y el `duplicateWarning`.

Peso: cuando `isDisposable && netWeight != null`, se muestra debajo del número del neto `<span className="text-[10px] text-muted-foreground">sin tara</span>`. El mensaje "El peso bruto debe ser mayor que la tara" se muestra solo si `!isDisposable`.

Fotos: el `label` de la segunda foto pasa a `isDisposable ? 'Foto del contenedor' : 'Foto del tacho'`.

- [ ] **Step 4: Implementar la página y los derivados**

`app/src/lib/weighing-finish.ts`:

```ts
import type { ContainerReception } from '@hospiwaste/shared/lib/types'

/** Solo los pesajes con tacho pasan a cámara fría / tratamiento al finalizar.
 *  Los contenedores descartables (cito/anato/morgue) no tienen tacho: no hay
 *  StorageEvent ni ContainerLocation que registrar (container_id es FK NOT NULL ahí). */
export function receptionsNeedingStorage(receptions: ContainerReception[]): ContainerReception[] {
  return receptions.filter((r) => r.container_id != null)
}
```

En `page.tsx`:
- **`handleFinish`:** `for (const r of sessionReceptions)` → `for (const r of receptionsNeedingStorage(sessionReceptions))`. Dentro, `r.container_id` ya es `string`; si TypeScript no lo estrecha, se usa `const cid = r.container_id as string` **solo** en ese loop, con un comentario que cite el filtro.
- **`duplicateWarning`:** `if (isEditing || !formState.container_id || isDisposableWaste(formState.waste_type)) return null`.
- **`inheritedCompanyId`:** `formState.container_id && !isDisposableWaste(formState.waste_type) ? getContainerCurrentCompanyId(...) : null`.
- **`handleCreateReception`**, en `submitReception` y en `addReception`:
  ```ts
  const disposable = isDisposableWaste(formState.waste_type)
  const container_id = disposable ? null : formState.container_id
  const container_ref = disposable ? formState.container_ref.trim() : null
  ```
  Se usan `container_id` y `container_ref` en lugar de `formState.container_id`.
- **`handleSaveEdit`:** igual en el payload de `applyFieldEdit`, en `q.updateReception` y en `updateReception`.
- **`handleSelectForEdit`:** `container_id: r.container_id ?? ''` y `container_ref: r.container_ref ?? ''`.
- **Banner de edición:** `Editando {formState.container_id ? `tacho ${formState.container_id}` : `contenedor ${formState.container_ref}`}`.

`weighing-session-drawer.tsx` (~105-120), con `const containerById = new Map(containers.map((c) => [c.id, c]))`:
- Etiqueta: `r.container_id ? formatTachoNumber(r.container_id) : `Cont. ${r.container_ref ?? 'S/N'}``.
- Neto: `receptionNetWeight(r, containerById) ?? r.gross_weight_kg`.

- [ ] **Step 5: Tests, build y commit**

Run: `npm test`, `npm run build:app`.
Expected: verde.

```bash
git add app/src/components/register/weighing-form.tsx app/src/app/register/weighing/page.tsx app/src/components/register/weighing-session-drawer.tsx app/src/lib/weighing-finish.ts app/src/__tests__ shared/src/lib/data/containers.ts shared/src/__tests__/lib/containers.test.ts
git commit -m "feat(pesaje): N° de contenedor para cito, anato y morgue (sin tara)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Hub — historial de pesajes

**Files:**
- Modify: `shared/src/components/history/weighing-history.tsx`:
  - `RecDraft` (22-26), `startEdit`, `persist` (~46-62);
  - render de la fila (104-150);
  - diálogo de anulación (~190).
- Test: `hub/src/__tests__/components/` (si hay tests del historial) o `shared/src/components/history/__tests__/`, según la convención del repo.

**Interfaces:**
- Consumes: `isDisposableWaste`, `receptionNetWeight`, `container_ref`.

- [ ] **Step 1: Test que falla**

Con Testing Library y el store sembrado como en los tests existentes del historial. Si no hay tests del historial, se crea `shared/src/__tests__/components/weighing-history.test.tsx` con `useStore.setState({...})`:

```tsx
it('muestra "Contenedor 5501" y el neto igual al bruto para un pesaje descartable', async () => {
  useStore.setState({
    weighingSessions: [{ id: 's1', client_id: 'c', date: '2026-09-28', started_at: '2026-09-28T10:00:00Z', ended_at: null, operator_id: 'op', status: 'completed', reception_ids: ['r1'] }],
    receptions: [{ id: 'r1', container_id: null, container_ref: '5501', weighing_session_id: 's1', arrived_at: '2026-09-28T10:00:00Z', gross_weight_kg: 7.5, operator_id: 'op', photo_ids: [], observations: '', waste_type: 'morgue' }],
    containers: [], currentRole: 'coordinator', currentProfileId: 'op',
  } as never)
  render(<WeighingHistory />)
  await userEvent.click(screen.getByText(/2026-09-28/))
  expect(screen.getByText('Contenedor 5501')).toBeInTheDocument()
  expect(screen.getByText(/7\.5 kg bruto · 7\.5 kg neto/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test --workspace shared -- weighing-history` (o el workspace donde quedó el test).
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `RecDraft` suma `container_ref: string` y `container_id` queda `string` (`''` si null).
- `startEdit`: `container_id: r.container_id ?? ''` y `container_ref: r.container_ref ?? ''`.
- `persist`:
  ```ts
  const disposable = isDisposableWaste(draft.waste_type)
  const ref = draft.container_ref.trim()
  if (disposable && (!ref || ref.length > 30)) { console.error('[historial pesaje] número de contenedor inválido'); return }
  if (!disposable && !draft.container_id) { console.error('[historial pesaje] falta tacho'); return }
  const patch = {
    gross_weight_kg: gross, waste_type: draft.waste_type,
    container_id: disposable ? null : draft.container_id,
    container_ref: disposable ? ref : null,
  }
  ```
  `q.updateReception` acepta estos campos por los tipos generados de Task 2. Si su firma tipa el patch a mano, se le suma `container_ref`.
- Render:
  - `const containerById = new Map(containers.map((c) => [c.id, c]))`, fuera del `map`.
  - `const net = receptionNetWeight(r, containerById)`.
  - La etiqueta pasa a `r.container_id ? formatTachoNumber(r.container_id) : `Contenedor ${r.container_ref ?? 'S/N'}``.
  - `takenContainerIds` filtra los null: `.map((x) => x.container_id).filter((id): id is string => !!id)`.
- Edición: si `isDisposableWaste(draft.waste_type)`, en lugar del `<select aria-label="Tacho">` va un `<input aria-label="N° de contenedor" maxLength={30} value={draft.container_ref} …>`. Al cambiar el tipo en el select, se aplica `setDraft({ ...draft, ...wasteTypeChange(draft.waste_type, next) })`, con `wasteTypeChange` importada de `@hospiwaste/shared/lib/data/containers` (Task 3).
- Diálogo de anulación: `El tacho …` pasa a `r.container_id ? <>El tacho <strong>…</strong> volverá a quedar pendiente por pesar.</> : <>El contenedor <strong>{r.container_ref}</strong> se anulará.</>`, conservando el resto del texto.

- [ ] **Step 4: Tests, build y commit**

Run: `npm test`, `npm run build:hub`, `npm run build:app`.
Expected: verde.

```bash
git add shared/src/components/history/weighing-history.tsx shared/src/__tests__ hub/src/__tests__
git commit -m "feat(historial): editar y mostrar el N° de contenedor descartable

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: APK v1.12, vault y verificación final

**Files:**
- Modify: `app/android/app/build.gradle` (`versionCode 12` → `13`, `versionName "1.11"` → `"1.12"`)
- Modify: `vault/processes/WasteTypes.md`, `vault/project/DataModel.md`, `vault/_index.md`
- Create: `vault/logs/2026-09-28-contenedor-descartable.md`

- [ ] **Step 1: Verificación funcional con datos reales**

MCP `execute_sql` (solo lectura):
```sql
select count(*) filter (where container_id is null) sin_tacho, round(sum(gross_weight_kg),1) kg
from container_receptions where waste_type = 'anatomopathological' and voided_at is null;
```
Expected: `sin_tacho = 11`.

- [ ] **Step 2: Vault**

`WasteTypes.md`, en "Asignación contenedor–tipo de desecho", agregar:

```markdown
> [!warning] INCOHERENCIA DETECTADA
> **Fecha:** 2026-09-28
> **Problema:** esta nota decía que todos los tipos se casan a un contenedor. El usuario aclaró que
> citotóxico, anatomopatológico y morgue van en contenedores propios que se desechan con el residuo.
> **Resolución:** en el pesaje esos tres tipos no usan tacho ni tara; se escribe el número del
> contenedor (`container_ref`) y neto = bruto. Ver [[2026-09-28-contenedor-descartable]].
```

Actualizar `updated:` a 2026-09-28.

`DataModel.md`, en ContainerReception:

```markdown
- `container_id` es **opcional** desde 2026-09-28: null en citotóxico/anatomopatológico/morgue, que
  guardan `container_ref` (número escrito del contenedor descartable). Sin tacho: neto = bruto.
```

Log `vault/logs/2026-09-28-contenedor-descartable.md`, con frontmatter (title, tags `log/pesaje/datos`, date y updated 2026-09-28):
- **Qué cambió:** los 3 tipos se pesan sin tacho, con número escrito y neto = bruto.
- **Por qué:** los operadores elegían un tacho cualquiera (11 casos), el neto quedaba mal y había circulación falsa.
- **Históricos:** corregidos con `S/N (histórico)`.
- **Pendiente:** aplicar `20260928000100_contenedor_descartable_check.sql` cuando todos los teléfonos tengan v1.12; antes, correr el `update` que trae en el comentario.
- Spec: `docs/superpowers/specs/2026-09-28-contenedor-descartable-design.md`.

`_index.md`:
- Línea de APK: `**APK:** v1.12 (build 13) compilado: N° de contenedor para cito/anato/morgue (sin tara); "Cancelar" no borra pesajes (v1.11)`.
- En "Vigentes" agregar `- [[2026-09-28-contenedor-descartable]] — cito/anato/morgue sin tacho ni tara; aplicar la regla CHECK después del rollout de v1.12`.
- En "Pendientes abiertos" agregar la fila: `| Aplicar la regla CHECK de container_ref cuando todos los teléfonos tengan v1.12 | [[2026-09-28-contenedor-descartable]] |`.

- [ ] **Step 3: Versión y APK**

- Subir la versión en `build.gradle`.
- `npm run build:app`, luego `npx cap sync android` desde `app/`.
- `.\gradlew assembleRelease` desde `app\android`, con `JAVA_HOME` apuntando al JDK de la extensión Java de Antigravity (ver memoria `jdk-antigravity-embebido`).

Expected: `output-metadata.json` con `versionCode 13` y `versionName "1.12"`.

- [ ] **Step 4: Suite completa y commit**

Run: `npm test`, `npm run build:hub`.
Expected: verde.

```bash
git add app/android/app/build.gradle vault/processes/WasteTypes.md vault/project/DataModel.md vault/_index.md vault/logs/2026-09-28-contenedor-descartable.md
git commit -m "chore(release): APK v1.12 (build 13) — contenedor descartable

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
