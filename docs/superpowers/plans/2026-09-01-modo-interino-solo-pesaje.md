# Modo interino solo-pesaje — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar la app de campo operativa solo para Pesaje —con la cola abierta a todos los tachos, empresa elegida a mano y recorridos deshabilitados— mientras se rediseña la arquitectura offline de recorridos.

**Architecture:** Un flag único (`INTERIM_MODE` en `shared`) gobierna cuatro puntos: la cola de pesaje, el Home del APK, el guard del subárbol de recorridos y el banner del hub. No se modifica ninguna función existente de derivación de estado (`getPendingWeighingContainerIds`, `computeCirculationStatus`, analítica del dashboard): se agregan funciones hermanas y la UI elige según el flag. Revertir cuando llegue el proyecto B es apagar el flag y borrar sus usos.

**Tech Stack:** Monorepo npm workspaces (`hub/`, `app/`, `shared/`), Next.js 16 (App Router, `--webpack`), React 19, Zustand, Supabase, Capacitor 8 (Android), Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-modo-interino-solo-pesaje-design.md`

## Global Constraints

- Código de `shared/` se importa siempre como `@hospiwaste/shared/...`, nunca con `@/`. `@/*` es local de cada app.
- **No modificar** `getPendingWeighingContainerIds` (`shared/src/lib/data/containers.ts:112`) ni sus tests (`shared/src/__tests__/lib/containers.test.ts:234`). Deben quedar verdes sin tocarse: es la señal de que el proyecto B puede volver sin arqueología.
- Sin migraciones de base de datos. `container_receptions.company_id` ya existe.
- No editar a mano los gradle de `app/android/` (los regenera `npx cap sync android`).
- Textos de UI en español rioplatense/panameño, como el resto de la app.
- El reset de datos (Task 9) se ejecuta **después** de desplegar el APK a los teléfonos, nunca antes.
- Tests: `npm test` en el root corre jest de los 3 workspaces. Por workspace: `npm test -w shared`, `npm test -w app`, `npm test -w hub`.

---

### Task 1: Flag `INTERIM_MODE` y cola de pesaje abierta

**Files:**
- Create: `shared/src/lib/config/interim-mode.ts`
- Modify: `shared/src/lib/data/containers.ts` (agregar función después de `getPendingWeighingContainerIds`, línea 139)
- Test: `shared/src/__tests__/lib/containers.test.ts` (agregar describe al final)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `INTERIM_MODE: boolean` desde `@hospiwaste/shared/lib/config/interim-mode`
  - `getWeighableContainerIds(containers: Container[]): string[]` desde `@hospiwaste/shared/lib/data/containers`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `shared/src/__tests__/lib/containers.test.ts`. Importar `getWeighableContainerIds` en el bloque de imports de arriba (línea 1-10), junto a `getPendingWeighingContainerIds`.

```ts
describe('getWeighableContainerIds', () => {
  const c = (id: string, over: Partial<Container> = {}): Container => ({
    id, size_liters: 240, tare_weight_kg: 14,
    status: 'active', registered_at: '2026-01-01T00:00:00Z', ...over,
  })

  it('incluye todos los tachos activos sin exigir recorrido previo', () => {
    expect(getWeighableContainerIds([c('001'), c('002')])).toEqual(['001', '002'])
  })

  it('excluye tachos que no están activos', () => {
    expect(getWeighableContainerIds([c('001'), c('002', { status: 'retired' })])).toEqual(['001'])
  })

  it('excluye contenedores de la flota Yaris (no se pesan directamente)', () => {
    const containers = [c('001'), c('Y1', { is_yaris_container: true, tare_weight_kg: 0 })]
    expect(getWeighableContainerIds(containers)).toEqual(['001'])
  })

  it('incluye dedicados Yaris y metálicos (la pantalla los separa en su propio selector)', () => {
    const containers = [
      c('001'),
      c('YD1', { is_yaris_dedicated: true }),
      c('M1', { is_metallic_dedicated: true }),
    ]
    expect(getWeighableContainerIds(containers)).toEqual(['001', 'YD1', 'M1'])
  })

  it('lista vacía → []', () => {
    expect(getWeighableContainerIds([])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -w shared -- containers.test.ts`
Expected: FAIL — `getWeighableContainerIds is not a function` / error de import de TypeScript.

- [ ] **Step 3: Crear el flag**

Crear `shared/src/lib/config/interim-mode.ts`:

```ts
/**
 * Modo interino (2026-09-01): el registro de recorridos está deshabilitado
 * mientras se rediseña su arquitectura offline. Ver
 * `docs/superpowers/specs/2026-09-01-modo-interino-solo-pesaje-design.md`.
 *
 * Mientras está en true:
 * - la cola de pesaje se abre a todos los tachos activos,
 * - el Home del APK muestra Recorrido gris ("En mantenimiento"),
 * - el subárbol /register/route no deja registrar,
 * - el dashboard del hub muestra un banner de aviso.
 *
 * Para revertir: poner en false y borrar los cuatro usos.
 */
export const INTERIM_MODE = true
```

- [ ] **Step 4: Implementar la función**

En `shared/src/lib/data/containers.ts`, inmediatamente después de `getPendingWeighingContainerIds` (que **no se toca**):

```ts
/**
 * Cola de pesaje del modo interino: todos los tachos activos, sin exigir que
 * un recorrido los haya recogido sucios. Hermana de
 * `getPendingWeighingContainerIds`, que sigue siendo la cola real y vuelve
 * cuando el registro de recorridos se reactive.
 *
 * Excluye `is_yaris_container` por el mismo motivo que la función original:
 * los contenedores de la flota Yaris no se pesan directamente, se vuelcan en
 * un tacho `is_yaris_dedicated`.
 */
export function getWeighableContainerIds(containers: Container[]): string[] {
  return containers
    .filter((c) => c.status === 'active' && !c.is_yaris_container)
    .map((c) => c.id)
}
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `npm test -w shared -- containers.test.ts`
Expected: PASS — incluidos los tests preexistentes de `getPendingWeighingContainerIds`, sin modificarlos.

- [ ] **Step 6: Commit**

```bash
git add shared/src/lib/config/interim-mode.ts shared/src/lib/data/containers.ts shared/src/__tests__/lib/containers.test.ts
git commit -m "feat(shared): flag INTERIM_MODE y cola de pesaje abierta"
```

---

### Task 2: Helper de aviso de duplicado del día

**Files:**
- Modify: `shared/src/lib/data/containers.ts` (agregar después de `getWeighableContainerIds`)
- Test: `shared/src/__tests__/lib/containers.test.ts` (agregar describe al final)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `findTodayReceptionForContainer(receptions: ContainerReception[], containerId: string, nowISO: string): ContainerReception | null` desde `@hospiwaste/shared/lib/data/containers`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `shared/src/__tests__/lib/containers.test.ts`. Importar `findTodayReceptionForContainer` arriba.

```ts
describe('findTodayReceptionForContainer', () => {
  const rec = (over: Partial<ContainerReception> = {}): ContainerReception => ({
    id: 'rec-1', container_id: '001', weighing_session_id: 's',
    arrived_at: '2026-09-01T14:00:00Z', gross_weight_kg: 40, operator_id: 'op',
    photo_ids: [], observations: '', ...over,
  })
  const now = '2026-09-01T18:00:00Z'

  it('devuelve la recepción del mismo día para ese tacho', () => {
    const found = findTodayReceptionForContainer([rec()], '001', now)
    expect(found?.id).toBe('rec-1')
  })

  it('ignora recepciones de otro tacho', () => {
    expect(findTodayReceptionForContainer([rec()], '002', now)).toBeNull()
  })

  it('ignora recepciones de días anteriores', () => {
    const ayer = rec({ id: 'rec-ayer', arrived_at: '2026-08-31T14:00:00Z' })
    expect(findTodayReceptionForContainer([ayer], '001', now)).toBeNull()
  })

  it('ignora recepciones anuladas', () => {
    const anulada = rec({ voided_at: '2026-09-01T15:00:00Z' })
    expect(findTodayReceptionForContainer([anulada], '001', now)).toBeNull()
  })

  it('con varias del día devuelve la más reciente', () => {
    const temprano = rec({ id: 'rec-am', arrived_at: '2026-09-01T09:00:00Z' })
    const tarde = rec({ id: 'rec-pm', arrived_at: '2026-09-01T16:00:00Z' })
    const found = findTodayReceptionForContainer([temprano, tarde], '001', now)
    expect(found?.id).toBe('rec-pm')
  })

  it('sin recepciones devuelve null', () => {
    expect(findTodayReceptionForContainer([], '001', now)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -w shared -- containers.test.ts`
Expected: FAIL — `findTodayReceptionForContainer is not a function`.

- [ ] **Step 3: Implementar**

En `shared/src/lib/data/containers.ts`, después de `getWeighableContainerIds`:

```ts
/**
 * Última recepción vigente del tacho dentro del día local de `nowISO`.
 * Alimenta el aviso suave de duplicado en pesaje: con la cola abierta
 * (modo interino) nada impide pesar dos veces el mismo tacho por error.
 * Devuelve null si no hay ninguna: el aviso no bloquea el guardado.
 */
export function findTodayReceptionForContainer(
  receptions: ContainerReception[],
  containerId: string,
  nowISO: string,
): ContainerReception | null {
  const localDay = (iso: string): string => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const today = localDay(nowISO)

  const delDia = receptions.filter(
    (r) => r.container_id === containerId && !r.voided_at && localDay(r.arrived_at) === today,
  )
  if (delDia.length === 0) return null

  return delDia.reduce((masReciente, r) =>
    new Date(r.arrived_at).getTime() > new Date(masReciente.arrived_at).getTime() ? r : masReciente,
  )
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -w shared -- containers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/lib/data/containers.ts shared/src/__tests__/lib/containers.test.ts
git commit -m "feat(shared): helper de recepción duplicada del día"
```

---

### Task 3: Empresa obligatoria en el formulario de pesaje

**Files:**
- Modify: `app/src/components/register/weighing-form.tsx`
- Modify: `app/src/app/register/weighing/page.tsx:97-103` (empresa heredada), `:170-208` (`handleCreateReception`), `:217-268` (`handleSaveEdit`), `:288-300` (`handleSelectForEdit`), `:477-487` (render de `WeighingForm`)
- Test: `app/src/__tests__/components/weighing-form.test.tsx` (crear)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `WeighingFormState` gana el campo `company_id: string` (string vacío = sin elegir).
  - `WeighingForm` cambia su prop `inheritedCompanyName?: string | null` por `companies: Company[]`.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/__tests__/components/weighing-form.test.tsx`. Seguir el patrón de `app/src/__tests__/components/container-selector.test.tsx` para el setup de Testing Library.

```tsx
import { render, screen } from '@testing-library/react'
import { WeighingForm, EMPTY_WEIGHING_FORM } from '@/components/register/weighing-form'
import type { Container, Company } from '@hospiwaste/shared/lib/types'

const containers: Container[] = [
  { id: '001', size_liters: 240, tare_weight_kg: 14, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
]
const companies: Company[] = [
  { id: 'company-ion', client_id: 'cli', name: 'ION', code_letter: 'I' },
  { id: 'company-airkem', client_id: 'cli', name: 'Airkem', code_letter: 'A' },
]

function renderForm(state = EMPTY_WEIGHING_FORM) {
  return render(
    <WeighingForm
      state={state}
      onChange={() => {}}
      availableContainers={containers}
      yarisContainers={[]}
      metallicContainers={[]}
      allContainers={containers}
      companies={companies}
      locked={false}
      mode="create"
      onSubmit={() => {}}
    />,
  )
}

describe('WeighingForm — empresa', () => {
  it('muestra el selector de empresa', () => {
    renderForm()
    expect(screen.getByText('Empresa')).toBeInTheDocument()
  })

  it('no permite guardar sin empresa aunque el resto esté completo', () => {
    renderForm({
      ...EMPTY_WEIGHING_FORM,
      container_id: '001',
      company_id: '',
      photo_container: 'data:image/png;base64,x',
      photo_scale: 'data:image/png;base64,y',
      gross_weight: '40',
    })
    expect(screen.getByRole('button', { name: /guardar y agregar otro/i })).toBeDisabled()
  })

  it('permite guardar cuando la empresa está elegida', () => {
    renderForm({
      ...EMPTY_WEIGHING_FORM,
      container_id: '001',
      company_id: 'company-ion',
      photo_container: 'data:image/png;base64,x',
      photo_scale: 'data:image/png;base64,y',
      gross_weight: '40',
    })
    expect(screen.getByRole('button', { name: /guardar y agregar otro/i })).toBeEnabled()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -w app -- weighing-form.test.tsx`
Expected: FAIL — la prop `companies` no existe y no se encuentra el texto "Empresa".

- [ ] **Step 3: Implementar en el formulario**

En `app/src/components/register/weighing-form.tsx`:

1. Agregar `company_id` a la interfaz de estado y al valor vacío:

```ts
export interface WeighingFormState {
  container_id: string
  /** Empresa a la que se atribuye este pesaje. En modo interino la elige el
   *  operador; con recorridos activos se precarga con la empresa heredada. */
  company_id: string
  photo_container: string | null
  // …resto igual
}

export const EMPTY_WEIGHING_FORM: WeighingFormState = {
  container_id: '',
  company_id: '',
  photo_container: null,
  // …resto igual
}
```

2. En `interface Props`, reemplazar `inheritedCompanyName?: string | null` por:

```ts
  /** Empresas disponibles para atribuir el pesaje. */
  companies: Company[]
```

Actualizar el import de tipos a `import type { Container, Company, WasteType } from '@hospiwaste/shared/lib/types'` y el destructuring del componente (`inheritedCompanyName` → `companies`).

3. Sumar la empresa a `canSubmit`:

```ts
  const canSubmit =
    !!state.container_id &&
    !!state.company_id &&
    !!state.photo_container &&
    !!state.photo_scale &&
    hasValidWeight
```

4. Reemplazar el párrafo `{inheritedCompanyName && …}` que cuelga del bloque de tipo de desecho por un bloque propio, insertado inmediatamente después del `</div>` que cierra el bloque de "Tipo de desecho":

```tsx
      {/* Empresa — en modo interino la elige el operador (no hay recorrido del
          que heredarla). Con recorridos activos llega precargada. */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Empresa <span className="text-red-500">*</span>
        </label>
        <Select
          value={state.company_id}
          onValueChange={(v) => onChange({ company_id: v ?? '' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar empresa" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((co) => (
              <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
```

- [ ] **Step 4: Cablear la página de pesaje**

En `app/src/app/register/weighing/page.tsx`:

1. Borrar `inheritedCompanyName` (líneas 100-103) y dejar solo el cálculo de la empresa heredada, que ahora sirve para precargar:

```ts
  const inheritedCompanyId = formState.container_id
    ? getContainerCurrentCompanyId(formState.container_id, routeEvents, treatmentRuns, externalTransfers)
    : null
```

2. En `updateForm`, precargar la empresa al elegir tacho (no pisa una elección explícita del operador):

```ts
  function updateForm(updates: Partial<WeighingFormState>) {
    setFormState((prev) => {
      const next = { ...prev, ...updates }
      if (updates.container_id && updates.container_id !== prev.container_id) {
        const heredada = getContainerCurrentCompanyId(
          updates.container_id, routeEvents, treatmentRuns, externalTransfers,
        )
        if (heredada) next.company_id = heredada
      }
      return next
    })
  }
```

3. En `handleCreateReception`, usar la empresa del formulario en `submitReception` y en `addReception`: reemplazar las dos ocurrencias de `company_id: inheritedCompanyId` por `company_id: formState.company_id || inheritedCompanyId`.

4. En `handleSaveEdit`, permitir corregir la empresa: en el objeto de `applyFieldEdit` reemplazar `company_id: existing.company_id` por `company_id: formState.company_id || existing.company_id`; agregar `company_id: formState.company_id || existing.company_id` al objeto de `q.updateReception` y al de `updateReception`.

5. En `handleSelectForEdit`, cargar la empresa existente: agregar `company_id: r.company_id ?? ''` al `setFormState`.

6. En el render de `<WeighingForm>`, reemplazar `inheritedCompanyName={inheritedCompanyName}` por `companies={companies}` (`companies` ya sale del `useStore` en la línea 39).

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `npm test -w app`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/register/weighing-form.tsx app/src/app/register/weighing/page.tsx app/src/__tests__/components/weighing-form.test.tsx
git commit -m "feat(pesaje): empresa obligatoria elegida en el formulario"
```

---

### Task 4: Cola abierta y buscador de tacho en la pantalla de pesaje

**Files:**
- Modify: `app/src/app/register/weighing/page.tsx:91-113` (cola), `:124-138` (`markAbsent`), `:412-425` (tira de pendientes), `:500-508` y `:540-545` y `:588-625` (`pendingCount`)
- Modify: `app/src/components/register/weighing-form.tsx` (selector "Número de tacho" → buscador)
- Test: `app/src/__tests__/components/weighing-form.test.tsx` (agregar describe)

**Interfaces:**
- Consumes:
  - `getWeighableContainerIds(containers)` y `INTERIM_MODE` (Task 1)
  - `WeighingFormState.company_id` y la prop `companies` (Task 3)
- Produces: nada nuevo hacia otras tareas.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `app/src/__tests__/components/weighing-form.test.tsx`. Reusa los helpers `renderForm`/`containers`/`companies` del archivo; ampliar `containers` a tres tachos:

```tsx
import userEvent from '@testing-library/user-event'

describe('WeighingForm — buscador de tacho', () => {
  const muchos: Container[] = [
    { id: '001', size_liters: 240, tare_weight_kg: 14, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
    { id: '002', size_liters: 240, tare_weight_kg: 14, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
    { id: '145', size_liters: 240, tare_weight_kg: 14, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  ]

  function renderConCatalogo(onChange = () => {}) {
    return render(
      <WeighingForm
        state={EMPTY_WEIGHING_FORM}
        onChange={onChange}
        availableContainers={muchos}
        yarisContainers={[]}
        metallicContainers={[]}
        allContainers={muchos}
        companies={companies}
        locked={false}
        mode="create"
        onSubmit={() => {}}
      />,
    )
  }

  it('filtra los tachos por número al escribir', async () => {
    const user = userEvent.setup()
    renderConCatalogo()
    await user.type(screen.getByPlaceholderText(/número de tacho/i), '145')
    expect(screen.getByRole('button', { name: /145/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^001/ })).not.toBeInTheDocument()
  })

  it('al elegir un resultado emite container_id', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    renderConCatalogo(onChange)
    await user.type(screen.getByPlaceholderText(/número de tacho/i), '002')
    await user.click(screen.getByRole('button', { name: /002/ }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ container_id: '002' }))
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -w app -- weighing-form.test.tsx`
Expected: FAIL — no existe ningún input con placeholder "Número de tacho" (hoy es un `Select`).

- [ ] **Step 3: Implementar el buscador**

En `app/src/components/register/weighing-form.tsx`, reemplazar el `<Select>` del campo "Número de tacho" (el primero del grid, con `value={!isYaris ? state.container_id : ''}`) por un buscador que reusa el helper ya existente `filterContainers` de `@/components/register/container-selector`:

```tsx
import { useState } from 'react'
import { Input } from '@hospiwaste/shared/components/ui/input'
import { filterContainers } from '@/components/register/container-selector'
```

Dentro del componente, junto al resto de los cálculos:

```ts
  const [tachoSearch, setTachoSearch] = useState('')
  const tachoResults = filterContainers(
    dropdownContainers.filter((c) => !c.is_yaris_dedicated),
    tachoSearch,
  ).slice(0, 8)
```

Y el bloque del campo:

```tsx
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            {isMetallic ? 'Tacho metálico' : 'Número de tacho'} <span className="text-red-500">*</span>
          </label>
          {state.container_id && !isYaris ? (
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 h-10">
              <span className="font-mono font-semibold text-foreground">
                {formatTachoNumber(state.container_id)}
              </span>
              <button
                type="button"
                onClick={() => { setTachoSearch(''); onChange({ container_id: '' }) }}
                className="ml-auto text-xs underline text-muted-foreground"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <Input
                value={tachoSearch}
                onChange={(e) => setTachoSearch(e.target.value)}
                placeholder="Número de tacho (ej: 145)"
                disabled={isYaris}
                inputMode="numeric"
                className="h-10"
              />
              {tachoSearch.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {tachoResults.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">
                      No se encontró ningún tacho con ese número.
                    </p>
                  )}
                  {tachoResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setTachoSearch(''); onChange({ container_id: c.id }) }}
                      className="w-full text-left rounded-md border border-border px-3 py-2 text-sm hover:border-accent/40 hover:bg-accent/5"
                    >
                      <span className="font-mono font-semibold">{formatTachoNumber(c.id)}</span>
                      <span className="text-muted-foreground"> · {c.size_liters} L</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
```

Actualizar además el texto del aviso de catálogo vacío (bloque `{dropdownContainers.length === 0 && mode === 'create' && …}`): la rama normal decía "No hay tachos sucios recogidos pendientes de pesar. Registrá un recorrido primero." → cambiar a "No hay tachos activos disponibles.".

- [ ] **Step 4: Abrir la cola en la página**

En `app/src/app/register/weighing/page.tsx`:

1. Importar `INTERIM_MODE` y `getWeighableContainerIds`:

```ts
import { INTERIM_MODE } from '@hospiwaste/shared/lib/config/interim-mode'
import { getPendingWeighingContainerIds, getWeighableContainerIds, getContainerCurrentCompanyId, formatTachoNumber, getMetallicContainers } from '@hospiwaste/shared/lib/data/containers'
```

2. Reemplazar el cálculo de `pendingIds` (línea 91):

```ts
  // Modo interino: todos los tachos activos son pesables (no hay recorridos que
  // llenen la cola). Con recorridos activos vuelve la cola real.
  const pendingIds = new Set(
    INTERIM_MODE
      ? getWeighableContainerIds(containers)
      : getPendingWeighingContainerIds(containers, routeEvents, receptions),
  )
```

3. Borrar `skipped`, `skippedIds`, `pendingList`, `pendingNotSkipped` (líneas 106-113) y la función `markAbsent` (líneas 124-138).

4. Borrar el bloque `{pendingList.length > 0 && ( … )}` del banner de sesión (líneas 412-425).

5. Borrar la prop `pendingCount={pendingNotSkipped.length}` del `<ConfirmFinishDialog>`, el campo `pendingCount: number` de `DialogProps`, el parámetro `pendingCount` de `ConfirmFinishDialog` y el bloque `{pendingCount > 0 && ( … )}` de su cuerpo.

6. Quitar los imports que queden sin uso (`cn` si ya no se usa; `formatTachoNumber` solo si no queda ninguna referencia — verificar con el linter).

- [ ] **Step 5: Correr tests y lint**

Run: `npm test -w app && npm run lint -w app`
Expected: PASS, sin warnings de variables o imports sin usar.

- [ ] **Step 6: Commit**

```bash
git add app/src/app/register/weighing/page.tsx app/src/components/register/weighing-form.tsx app/src/__tests__/components/weighing-form.test.tsx
git commit -m "feat(pesaje): cola abierta a todos los tachos y buscador por número"
```

---

### Task 5: Aviso suave de tacho ya pesado hoy

**Files:**
- Modify: `app/src/components/register/weighing-form.tsx` (nueva prop + aviso)
- Modify: `app/src/app/register/weighing/page.tsx` (cálculo y paso de la prop)
- Test: `app/src/__tests__/components/weighing-form.test.tsx` (agregar describe)

**Interfaces:**
- Consumes: `findTodayReceptionForContainer` (Task 2), la prop `companies` y el buscador (Tasks 3 y 4).
- Produces: `WeighingForm` gana la prop `duplicateWarning?: string | null`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `app/src/__tests__/components/weighing-form.test.tsx`:

```tsx
describe('WeighingForm — aviso de duplicado', () => {
  it('muestra el aviso cuando se pasa duplicateWarning', () => {
    render(
      <WeighingForm
        state={{ ...EMPTY_WEIGHING_FORM, container_id: '001', company_id: 'company-ion' }}
        onChange={() => {}}
        availableContainers={containers}
        yarisContainers={[]}
        metallicContainers={[]}
        allContainers={containers}
        companies={companies}
        duplicateWarning="Este tacho ya se pesó hoy a las 09:15."
        locked={false}
        mode="create"
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByText(/ya se pesó hoy a las 09:15/i)).toBeInTheDocument()
  })

  it('no bloquea el guardado cuando hay aviso', () => {
    render(
      <WeighingForm
        state={{
          ...EMPTY_WEIGHING_FORM,
          container_id: '001', company_id: 'company-ion',
          photo_container: 'data:image/png;base64,x',
          photo_scale: 'data:image/png;base64,y',
          gross_weight: '40',
        }}
        onChange={() => {}}
        availableContainers={containers}
        yarisContainers={[]}
        metallicContainers={[]}
        allContainers={containers}
        companies={companies}
        duplicateWarning="Este tacho ya se pesó hoy a las 09:15."
        locked={false}
        mode="create"
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /guardar y agregar otro/i })).toBeEnabled()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -w app -- weighing-form.test.tsx`
Expected: FAIL — la prop `duplicateWarning` no existe y el texto no aparece.

- [ ] **Step 3: Implementar en el formulario**

En `interface Props` de `weighing-form.tsx`:

```ts
  /** Aviso no bloqueante: el tacho elegido ya tiene un pesaje vigente de hoy. */
  duplicateWarning?: string | null
```

Agregarlo al destructuring y renderizarlo justo debajo del bloque de badges de tara/tamaño (`{selectedContainer && ( … )}`):

```tsx
      {duplicateWarning && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {duplicateWarning}
        </p>
      )}
```

No se toca `canSubmit`: el aviso informa, no bloquea.

- [ ] **Step 4: Calcularlo en la página**

En `app/src/app/register/weighing/page.tsx`, importar el helper y calcular el aviso solo en modo creación (al editar, la recepción propia siempre coincidiría):

```ts
import { findTodayReceptionForContainer } from '@hospiwaste/shared/lib/data/containers'
```

```ts
  const duplicateWarning = (() => {
    if (isEditing || !formState.container_id) return null
    const previa = findTodayReceptionForContainer(
      receptions, formState.container_id, new Date().toISOString(),
    )
    if (!previa) return null
    const hora = new Date(previa.arrived_at).toLocaleTimeString('es-PA', {
      hour: '2-digit', minute: '2-digit',
    })
    return `Este tacho ya se pesó hoy a las ${hora}. Podés continuar si es un segundo pesaje real.`
  })()
```

Pasar `duplicateWarning={duplicateWarning}` al `<WeighingForm>`.

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `npm test -w app`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/register/weighing-form.tsx app/src/app/register/weighing/page.tsx app/src/__tests__/components/weighing-form.test.tsx
git commit -m "feat(pesaje): aviso no bloqueante de tacho ya pesado hoy"
```

---

### Task 6: Home del APK — Recorrido deshabilitado

**Files:**
- Modify: `app/src/app/page.tsx:13-18` (`ACTIONS`), `:70-84` (render de accesos), `:86-118` (sección "Recorridos de hoy")
- Test: `app/src/__tests__/components/home-actions.test.tsx` (crear)

**Interfaces:**
- Consumes: `INTERIM_MODE` (Task 1).
- Produces: nada.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/__tests__/components/home-actions.test.tsx`. El Home usa `useStore` y `getActiveSession`, así que se mockean:

```tsx
import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'

jest.mock('@hospiwaste/shared/lib/store', () => ({
  useStore: () => ({ users: [], currentProfileId: 'op-1', routeEvents: [] }),
}))
jest.mock('@/lib/active-session', () => ({
  getActiveSession: jest.fn().mockResolvedValue(null),
  routeAndenSessionKey: (d: string, s: string) => `${d}:${s}`,
  todayLocal: () => '2026-09-01',
}))

describe('HomePage en modo interino', () => {
  it('muestra Recorrido como "En mantenimiento" y sin enlace', () => {
    render(<HomePage />)
    expect(screen.getByText('En mantenimiento')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /recorrido/i })).not.toBeInTheDocument()
  })

  it('mantiene Pesaje, Tratamiento y Traslado navegables', () => {
    render(<HomePage />)
    expect(screen.getByRole('link', { name: /pesaje/i })).toHaveAttribute('href', '/register/weighing')
    expect(screen.getByRole('link', { name: /tratamiento/i })).toHaveAttribute('href', '/register/treatment')
    expect(screen.getByRole('link', { name: /traslado externo/i })).toHaveAttribute('href', '/register/transfer')
  })

  it('oculta la sección de recorridos del día', () => {
    render(<HomePage />)
    expect(screen.queryByText('Recorridos de hoy')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -w app -- home-actions.test.tsx`
Expected: FAIL — "En mantenimiento" no existe y "Recorridos de hoy" sí.

- [ ] **Step 3: Implementar**

En `app/src/app/page.tsx`:

1. Importar el flag: `import { INTERIM_MODE } from '@hospiwaste/shared/lib/config/interim-mode'`.

2. Marcar la acción deshabilitada en `ACTIONS`:

```ts
const ACTIONS = [
  { href: '/register/route',     label: 'Recorrido',        icon: RouteIcon, style: 'bg-accent/10 text-accent', disabled: INTERIM_MODE },
  { href: '/register/weighing',  label: 'Pesaje',           icon: Scale,     style: 'bg-amber-100 text-amber-700', disabled: false },
  { href: '/register/treatment', label: 'Tratamiento',      icon: Flame,     style: 'bg-violet-100 text-violet-700', disabled: false },
  { href: '/register/transfer',  label: 'Traslado externo', icon: Truck,     style: 'bg-emerald-100 text-emerald-700', disabled: false },
]
```

3. Renderizar las deshabilitadas como `div` gris, no como `Link`:

```tsx
        {ACTIONS.map(({ href, label, icon: Icon, style, disabled }) => {
          const inner = (
            <>
              <span className={cn(
                'flex size-14 items-center justify-center rounded-2xl',
                disabled ? 'bg-muted text-muted-foreground' : style,
              )}>
                <Icon className="size-7" />
              </span>
              <span className={cn(
                'text-sm font-semibold',
                disabled ? 'text-muted-foreground' : 'text-foreground',
              )}>{label}</span>
              {disabled && (
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  En mantenimiento
                </span>
              )}
            </>
          )
          const base = 'flex flex-col items-center justify-center gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10 transition-all'
          return disabled ? (
            <div key={href} aria-disabled className={cn(base, 'opacity-60')}>{inner}</div>
          ) : (
            <Link key={href} href={href} className={cn(base, 'active:scale-[0.98] hover:shadow-md')}>{inner}</Link>
          )
        })}
```

4. Envolver la sección "Recorridos de hoy" completa en `{!INTERIM_MODE && ( … )}`.

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -w app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/page.tsx app/src/__tests__/components/home-actions.test.tsx
git commit -m "feat(app): Recorrido en mantenimiento en el Home del APK"
```

---

### Task 7: Guard del subárbol de recorridos

**Files:**
- Create: `app/src/app/register/route/layout.tsx`
- Test: `app/src/__tests__/components/route-layout.test.tsx` (crear)

**Interfaces:**
- Consumes: `INTERIM_MODE` (Task 1).
- Produces: nada.

Se usa un layout —no un redirect ni un early-return en cada página— porque cubre `page`, `anden/[slot]`, `morgue` e `history` en un solo punto y evita romper el orden de hooks de las páginas cliente.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/src/__tests__/components/route-layout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import RouteLayout from '@/app/register/route/layout'

describe('Layout de recorridos en modo interino', () => {
  it('no renderiza el contenido y explica por qué', () => {
    render(<RouteLayout><p>formulario de recorrido</p></RouteLayout>)
    expect(screen.queryByText('formulario de recorrido')).not.toBeInTheDocument()
    expect(screen.getByText(/en mantenimiento/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toHaveAttribute('href', '/')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -w app -- route-layout.test.tsx`
Expected: FAIL — el módulo `@/app/register/route/layout` no existe.

- [ ] **Step 3: Implementar**

Crear `app/src/app/register/route/layout.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { INTERIM_MODE } from '@hospiwaste/shared/lib/config/interim-mode'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  if (!INTERIM_MODE) return <>{children}</>

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Wrench aria-hidden className="size-7" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Registro de recorridos en mantenimiento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Estamos rehaciendo cómo se guardan y se suben los recorridos para que funcionen
              sin señal. Mientras tanto, registrá los recorridos en papel y usá la app para el
              pesaje.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-accent/40"
          >
            Volver al inicio
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -w app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/register/route/layout.tsx app/src/__tests__/components/route-layout.test.tsx
git commit -m "feat(app): bloquear el subárbol de recorridos en modo interino"
```

---

### Task 8: Banner de modo interino en el hub

**Files:**
- Create: `hub/src/components/dashboard/interim-mode-banner.tsx`
- Modify: `hub/src/app/dashboard/page.tsx` (import + render debajo de `<DashboardHero>`)
- Test: `hub/src/__tests__/components/interim-mode-banner.test.tsx` (crear)

**Interfaces:**
- Consumes: `INTERIM_MODE` (Task 1).
- Produces: `InterimModeBanner` (sin props).

- [ ] **Step 1: Escribir el test que falla**

Crear `hub/src/__tests__/components/interim-mode-banner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { InterimModeBanner } from '@/components/dashboard/interim-mode-banner'

describe('InterimModeBanner', () => {
  it('avisa que los estados de circulación no son representativos', () => {
    render(<InterimModeBanner />)
    expect(screen.getByText(/modo interino/i)).toBeInTheDocument()
    expect(screen.getByText(/no son representativos/i)).toBeInTheDocument()
  })
})
```

`hub/src/__tests__/components/` ya existe y `hub/jest.config.ts` está configurado; no hace falta setup extra.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -w hub -- interim-mode-banner.test.tsx`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar el banner**

Crear `hub/src/components/dashboard/interim-mode-banner.tsx`:

```tsx
import { AlertTriangle } from 'lucide-react'
import { INTERIM_MODE } from '@hospiwaste/shared/lib/config/interim-mode'

export function InterimModeBanner() {
  if (!INTERIM_MODE) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle aria-hidden className="size-5 shrink-0 text-amber-600 mt-0.5" />
      <p className="text-sm text-amber-900">
        <strong className="font-semibold">Modo interino:</strong> el registro de recorridos está
        deshabilitado mientras se rehace su arquitectura offline. Los estados de circulación y el
        historial de recorridos <strong>no son representativos</strong>; los pesajes sí.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Montarlo en el dashboard**

En `hub/src/app/dashboard/page.tsx`, importar `InterimModeBanner` y renderizarlo inmediatamente después de `<DashboardHero …/>` en el JSX de retorno.

- [ ] **Step 5: Correr los tests y el build**

Run: `npm test -w hub && npm run build:hub`
Expected: PASS y build OK.

- [ ] **Step 6: Commit**

```bash
git add hub/src/components/dashboard/interim-mode-banner.tsx hub/src/app/dashboard/page.tsx hub/src/__tests__/components/interim-mode-banner.test.tsx
git commit -m "feat(hub): banner de modo interino en el dashboard"
```

---

### Task 9: SQL y procedimiento del reset de datos operativos

**Files:**
- Create: `scripts/reset-datos-operativos.sql`
- Create: `scripts/backup-datos-operativos.sql`

**Interfaces:**
- Consumes: nada.
- Produces: dos scripts SQL para ejecutar a mano en el SQL editor de Supabase.

Este task **no ejecuta nada** contra producción: entrega los scripts y el procedimiento. La ejecución la decide el usuario, después de desplegar el APK (Task 10).

- [ ] **Step 1: Escribir el script de respaldo**

Crear `scripts/backup-datos-operativos.sql`:

```sql
-- Respaldo previo al reset de datos operativos.
-- Uso: ejecutar en el SQL editor de Supabase y exportar cada resultado a JSON
-- en backups/YYYY-MM-DD-reset/ ANTES de correr reset-datos-operativos.sql.
-- Ver logs/2026-07-28-reset-datos-operativos.md para el precedente.

-- 1) Conteos de control. Guardar esta salida: valida el respaldo 1:1.
select 'route_events' as tabla, count(*) from route_events
union all select 'route_event_containers_dirty', count(*) from route_event_containers_dirty
union all select 'route_event_containers_clean', count(*) from route_event_containers_clean
union all select 'weighing_sessions', count(*) from weighing_sessions
union all select 'container_receptions', count(*) from container_receptions
union all select 'storage_events', count(*) from storage_events
union all select 'treatment_runs', count(*) from treatment_runs
union all select 'container_locations', count(*) from container_locations
union all select 'external_transfers', count(*) from external_transfers
union all select 'photos', count(*) from photos
union all select 'containers (SE CONSERVA)', count(*) from containers
union all select 'equipment (SE CONSERVA)', count(*) from equipment
union all select 'profiles (SE CONSERVA)', count(*) from profiles
union all select 'clients (SE CONSERVA)', count(*) from clients
union all select 'companies (SE CONSERVA)', count(*) from companies;

-- 2) Volcado. Cada select se exporta a un archivo JSON del directorio de backup.
select * from route_events;
select * from route_event_containers_dirty;
select * from route_event_containers_clean;
select * from weighing_sessions;
select * from container_receptions;
select * from storage_events;
select * from treatment_runs;
select * from container_locations;
select * from external_transfers;
select * from photos;
select * from containers;  -- snapshot de master data, por seguridad
```

- [ ] **Step 2: Escribir el script de reset**

Crear `scripts/reset-datos-operativos.sql`:

```sql
-- Reset de datos operativos. Conserva master data.
--
-- REQUISITOS ANTES DE EJECUTAR:
--   1. backup-datos-operativos.sql ejecutado y exportado, con conteos validados 1:1.
--   2. El APK del modo interino YA desplegado en todos los teléfonos de planta.
--      Si queda un teléfono con la versión anterior, su outbox drena encima de
--      la base vaciada y reaparecen recorridos fantasma.
--
-- Se conservan: containers, equipment, profiles, clients, companies,
-- equipment_maintenance.
--
-- NOTA: el bucket de Storage `photos` NO se toca. Los objetos quedan huérfanos
-- (decisión consciente, ver el spec). Vaciarlo antes del próximo reset.

begin;

truncate table
  route_event_containers_dirty,
  route_event_containers_clean,
  container_receptions,
  weighing_sessions,
  route_events,
  storage_events,
  treatment_runs,
  container_locations,
  external_transfers,
  photos
restart identity cascade;

commit;

-- Verificación: las 10 tablas en 0, la master data intacta.
select 'route_events' as tabla, count(*) from route_events
union all select 'route_event_containers_dirty', count(*) from route_event_containers_dirty
union all select 'route_event_containers_clean', count(*) from route_event_containers_clean
union all select 'weighing_sessions', count(*) from weighing_sessions
union all select 'container_receptions', count(*) from container_receptions
union all select 'storage_events', count(*) from storage_events
union all select 'treatment_runs', count(*) from treatment_runs
union all select 'container_locations', count(*) from container_locations
union all select 'external_transfers', count(*) from external_transfers
union all select 'photos', count(*) from photos
union all select 'containers (debe seguir en 246)', count(*) from containers
union all select 'equipment (debe seguir en 60)', count(*) from equipment
union all select 'profiles (debe seguir en 13)', count(*) from profiles;
```

- [ ] **Step 3: Commit**

```bash
git add scripts/backup-datos-operativos.sql scripts/reset-datos-operativos.sql
git commit -m "chore(scripts): SQL de respaldo y reset de datos operativos"
```

---

### Task 10: Cierre — build, APK y documentación del vault

**Files:**
- Create: `vault/decisions/2026-09-01-modo-interino-solo-pesaje.md`
- Create: `vault/logs/2026-09-01-modo-interino-solo-pesaje.md`
- Modify: `vault/_index.md` (fila en la tabla de estado, entrada en logs, nota de procesamiento)
- Modify: `app/android/app/build.gradle` — **solo vía `npx cap sync android`**, nunca a mano

**Interfaces:**
- Consumes: todas las tareas anteriores.
- Produces: el entregable desplegable.

- [ ] **Step 1: Correr la suite completa**

Run: `npm test && npm run test:ui && npm run build:hub && npm run build:app`
Expected: todo verde. Los tests preexistentes de `getPendingWeighingContainerIds` siguen pasando sin haber sido modificados.

- [ ] **Step 2: Subir versión y sincronizar Android**

En `app/android/app/build.gradle` los valores los regenera Capacitor; la versión se sube donde el proyecto ya la declara (`versionCode` 4, `versionName` "1.3", siguiendo a la v1.2 del 2026-08-25). Luego:

Run: `cd app && npx cap sync android`
Expected: sync OK, sin editar gradle a mano.

- [ ] **Step 3: Escribir el ADR**

Crear `vault/decisions/2026-09-01-modo-interino-solo-pesaje.md`:

```markdown
---
title: Modo interino solo-pesaje mientras se rehace el offline de recorridos
tags:
  - decision
  - pesaje
  - recorridos
  - offline
updated: 2026-09-01
---

# ADR — Modo interino solo-pesaje

**Fecha:** 2026-09-01
**Estado:** Aceptada — temporal, se revierte al cerrar el rediseño de recorridos

## Contexto

Los recorridos se registran fuera de planta, sin WiFi y con cobertura móvil pobre. La
capa offline actual no aguanta ese escenario y la operación pierde tiempo. Se decide
congelar el registro de recorridos y rediseñarlo, manteniendo la app viva para el pesaje,
que ocurre dentro de planta con conectividad.

## Decisión

Un flag único (`INTERIM_MODE`, `shared/src/lib/config/interim-mode.ts`) gobierna cuatro
puntos: cola de pesaje abierta a todos los tachos activos, Home del APK con Recorrido
gris, subárbol `/register/route` bloqueado y banner en el dashboard del hub. La empresa
del pesaje pasa a elegirse a mano, porque hoy se hereda del recorrido.

No se modifica `getPendingWeighingContainerIds` ni el ADR
[[2026-07-28-cola-pesaje-por-fecha]]: se agrega `getWeighableContainerIds` al lado y la
UI elige según el flag. Revertir es apagar el flag.

## Alternativas descartadas

- **Cambiar `getPendingWeighingContainerIds` para que devuelva todo** — borra la cola real
  y obliga a reconstruirla desde cero cuando vuelvan los recorridos.
- **Apagar la app entera hasta tener la arquitectura nueva** — deja a la planta sin
  registro de pesos, que es la data que alimenta la facturación y los reportes.

## Consecuencias

- Nada impide pesar dos veces el mismo tacho: queda un aviso suave, no un bloqueo.
- Los estados de circulación del dashboard dejan de ser representativos mientras dure.
- Los pesajes del interino quedan **sin recorrido asociado para siempre**; la trazabilidad
  regulatoria de esos días depende del respaldo en papel.

Ver log: `logs/2026-09-01-modo-interino-solo-pesaje.md`
Spec: `docs/superpowers/specs/2026-09-01-modo-interino-solo-pesaje-design.md`
```

- [ ] **Step 4: Escribir el log**

Crear `vault/logs/2026-09-01-modo-interino-solo-pesaje.md` documentando: el flag y sus cuatro puntos de uso, la cola abierta, el selector de empresa, el buscador de tacho, el aviso de duplicado, el Home y el layout de recorridos, el banner del hub, los scripts de reset y el estado de ejecución del reset. Incluir el aviso del bucket:

```markdown
> [!warning] Bucket de fotos sin limpiar
> **Fecha:** 2026-09-01
> **Problema:** cuarto reset consecutivo sin vaciar el bucket `photos`; ronda los ~1.200
> objetos huérfanos y se acerca al límite de 1 GB del plan Free.
> **Acción requerida:** vaciarlo vía Storage API o dashboard antes del próximo reset.
```

- [ ] **Step 5: Actualizar el índice del vault**

En `vault/_index.md`: agregar la fila `| Modo interino solo-pesaje (recorridos deshabilitados) | 🟢 Completado (reset y rollout de APK pendientes) | logs/2026-09-01-modo-interino-solo-pesaje.md |` a la tabla de estado, la entrada del log a la lista de logs, la entrada del ADR a la lista de decisiones, y una nota de procesamiento fechada 2026-09-01 arriba de todo. Actualizar `updated:` del frontmatter a `2026-09-01`.

- [ ] **Step 6: Commit**

```bash
git add vault/ app/android/
git commit -m "docs(vault): modo interino solo-pesaje — ADR, log e índice"
```

- [ ] **Step 7: Handoff al usuario (no automatizable)**

Reportar que quedan tres pasos manuales, en este orden estricto:
1. Compilar y firmar el APK release v1.3 con la misma llave que la v1.2.
2. Instalar en todos los teléfonos de planta (no requiere desinstalar).
3. Recién entonces: `scripts/backup-datos-operativos.sql` → exportar a `backups/2026-09-01-reset/` → `scripts/reset-datos-operativos.sql`.

Y el E2E en dispositivo: pesar un tacho cualquiera sin recorrido previo, con empresa elegida, y verificar que llega a Supabase con `company_id` y aparece en el historial del hub.

---

## Self-Review

**Cobertura del spec:**

| Sección del spec | Task |
|---|---|
| §2 El interruptor | Task 1 |
| §3 Cola de pesaje abierta | Tasks 1 y 4 |
| §4 Empresa en el pesaje | Task 3 |
| §5 Selección de tacho | Task 4 |
| §6 Aviso de duplicado | Tasks 2 y 5 |
| §7 APK (Home + guard) | Tasks 6 y 7 |
| §8 Hub | Task 8 |
| §9 Reset | Tasks 9 y 10 (paso 7) |
| §10 Verificación | Tests de cada task + Task 10 pasos 1-2 |
| §11 Nota permanente | Task 10 (ADR y log) |

**Consistencia de tipos:** `getWeighableContainerIds(Container[]): string[]` y `findTodayReceptionForContainer(ContainerReception[], string, string): ContainerReception | null` se definen en Tasks 1-2 y se consumen con esas firmas exactas en Tasks 4-5. `WeighingFormState.company_id: string` se define en Task 3 y se usa en Tasks 4-5. La prop `companies: Company[]` reemplaza a `inheritedCompanyName` en Task 3 y aparece así en todos los renders de tests posteriores.
