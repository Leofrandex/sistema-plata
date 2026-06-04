# Contenedores Yaris de recorrido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar 26 contenedores físicos de la flota Yaris (`Y1`…`Y26`) que circulan en recorrido, sin tara, excluidos de la cola de pesaje y del dashboard de circulación.

**Architecture:** Flag booleano nuevo `is_yaris_container` en `containers`, espejando el patrón ya probado de `is_metallic_dedicated`. Los eventos siguen siendo la fuente de verdad (modelo derivado); el flag solo marca una flota sin ciclo de planta y se usa para filtrarla de la cola de pesaje (cliente + vista Postgres) y del breakdown de circulación.

**Tech Stack:** Next.js + TypeScript, Zustand store, Supabase (Postgres + migraciones SQL), Jest.

**Spec:** `docs/superpowers/specs/2026-06-03-contenedores-yaris-recorrido-design.md`

---

## Notas para quien implementa

- **Convención de IDs Supabase:** los tachos en la DB del piloto usan IDs literales sin prefijo de empresa. `Y1`…`Y26` son literales (como `M1`…`M15`). No agregar padding ni guion.
- **`is_yaris_container` ≠ `is_yaris_dedicated`:** el segundo (ya existe) marca los tachos *con los que se pesa* una carga Yaris. El nuevo marca los *contenedores físicos* de la flota Yaris. No tocar la lógica de `is_yaris_dedicated`.
- **Migraciones aplicadas con MCP Supabase** (`apply_migration`) contra el proyecto piloto `xqqnthyipkdkwyknbtnw`. El archivo `.sql` en `supabase/migrations/` es la fuente versionada; el `apply_migration` lo ejecuta en remoto.
- **Test runner:** `npx jest <ruta>`. Build de verificación: `npm run build`.
- Commits frecuentes, uno por tarea.

---

## Task 1: Migración — columna `is_yaris_container`

**Files:**
- Create: `supabase/migrations/20260603010000_containers_is_yaris_container_flag.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- Flag de "contenedor de la flota Yaris": tacho físico que circula en recorrido,
-- sin tara y sin ciclo de planta (se pesa con los tachos alternativos
-- is_yaris_dedicated). Distinto de is_yaris_dedicated.
alter table public.containers
  add column if not exists is_yaris_container boolean not null default false;

comment on column public.containers.is_yaris_container is
  'Si true, el tacho es un contenedor físico de la flota Yaris: siempre disponible en recorrido, sin tara, y EXCLUIDO de la cola de pesaje y del dashboard de circulación (no atraviesa el ciclo de planta). Distinto de is_yaris_dedicated, que marca el tacho con el que se pesan las cargas Yaris.';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260603010000_containers_is_yaris_container_flag.sql
git commit -m "feat(db): columna is_yaris_container en containers"
```

---

## Task 2: Migración — seed `Y1`…`Y26`

**Files:**
- Create: `supabase/migrations/20260603010100_seed_yaris_route_containers.sql`

- [ ] **Step 1: Escribir el seed**

```sql
-- Inserta los 26 contenedores de la flota Yaris (Y1..Y26): 1100 L, sin empresa,
-- sin tara (se pesan con los tachos alternativos is_yaris_dedicated).
insert into public.containers (id, company_id, size_liters, tare_weight_kg, status, is_yaris_container)
select
  'Y' || n,
  null,
  '1100',
  0,
  'active',
  true
from generate_series(1, 26) as n
on conflict (id) do nothing;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260603010100_seed_yaris_route_containers.sql
git commit -m "feat(db): seed Y1..Y26 contenedores Yaris"
```

---

## Task 3: Migración — excluir Yaris de la vista de pesaje

**Files:**
- Create: `supabase/migrations/20260603010200_pending_weighing_exclude_yaris.sql`

- [ ] **Step 1: Escribir la migración**

La vista `v_containers_pending_weighing` (definida en `20260603000000`) es la réplica
server-side de `getPendingWeighingContainerIds`. Agregamos la exclusión de Yaris.

```sql
-- Los contenedores Yaris nunca se pesan directamente (se usan los tachos
-- alternativos), así que se excluyen de la cola de pesaje.
create or replace view public.v_containers_pending_weighing
with (security_invoker = true)
as
select c.*
from public.containers c
where c.status = 'active'
  and c.is_yaris_container = false
  and exists (
    select 1 from public.route_event_containers_dirty d where d.container_id = c.id
  )
  and not exists (
    select 1 from public.container_receptions r
    where r.container_id = c.id and r.voided_at is null
  );

grant select on public.v_containers_pending_weighing to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260603010200_pending_weighing_exclude_yaris.sql
git commit -m "feat(db): excluir Yaris de v_containers_pending_weighing"
```

---

## Task 4: Tipos TypeScript

**Files:**
- Modify: `src/lib/types.ts` (interface `Container`, tras `is_metallic_dedicated`)
- Modify: `src/lib/supabase/database.types.ts` (containers Row/Insert/Update + view Row)

- [ ] **Step 1: Agregar el campo a `Container` en `src/lib/types.ts`**

Tras la propiedad `is_metallic_dedicated?: boolean` (línea ~84), agregar:

```ts
  /** true: contenedor físico de la flota Yaris. Siempre disponible en recorrido,
   *  sin tara (se pesa con los tachos alternativos is_yaris_dedicated). Excluido
   *  de la cola de pesaje y del dashboard de circulación. Distinto de
   *  is_yaris_dedicated. Opcional para compat con data histórica/mocks. */
  is_yaris_container?: boolean
```

- [ ] **Step 2: Agregar a `database.types.ts` — tabla `containers`**

En `containers.Row` (tras `is_metallic_dedicated: boolean`):

```ts
          is_yaris_container: boolean
```

En `containers.Insert` (tras `is_metallic_dedicated?: boolean`):

```ts
          is_yaris_container?: boolean
```

En `containers.Update` (tras `is_metallic_dedicated?: boolean`):

```ts
          is_yaris_container?: boolean
```

- [ ] **Step 3: Agregar a `database.types.ts` — vista `v_containers_pending_weighing`**

En `v_containers_pending_weighing.Row` (tras `is_metallic_dedicated: boolean | null`):

```ts
          is_yaris_container: boolean | null
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/supabase/database.types.ts
git commit -m "feat(types): is_yaris_container en Container y database.types"
```

---

## Task 5: Mapeo en el hydrator

**Files:**
- Modify: `src/components/supabase-hydrator.tsx:172-173`

- [ ] **Step 1: Agregar el mapeo**

Tras la línea `is_metallic_dedicated: r.is_metallic_dedicated,`:

```ts
    is_yaris_container: r.is_yaris_container,
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/supabase-hydrator.tsx
git commit -m "feat(hydrator): mapear is_yaris_container"
```

---

## Task 6: Excluir Yaris de la cola de pesaje (cliente) — TDD

**Files:**
- Modify: `src/__tests__/lib/containers.test.ts` (describe `getPendingWeighingContainerIds`)
- Modify: `src/lib/data/containers.ts:108-123` (`getPendingWeighingContainerIds`)

- [ ] **Step 1: Escribir el test que falla**

Dentro del `describe('getPendingWeighingContainerIds', ...)` (tras el último `it`, antes del cierre `})`), agregar:

```ts
  it('excluye contenedores Yaris recogidos sucios (no se pesan directamente)', () => {
    const containers = [c('001'), c('Y1', { is_yaris_container: true, tare_weight_kg: 0 })]
    const result = getPendingWeighingContainerIds(containers, [routeWith('001', 'Y1')], [])
    expect(result).toEqual(['001'])
  })
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest src/__tests__/lib/containers.test.ts -t "excluye contenedores Yaris"`
Expected: FAIL — el resultado es `['001','Y1']` en vez de `['001']`.

- [ ] **Step 3: Implementar la exclusión**

En `getPendingWeighingContainerIds`, dentro del `.filter`, tras `if (pesadosIds.has(c.id)) return false`:

```ts
      if (c.is_yaris_container) return false
```

El bloque queda:

```ts
  return containers
    .filter((c) => {
      if (c.status !== 'active') return false
      if (pesadosIds.has(c.id)) return false
      if (c.is_yaris_container) return false
      return getRouteEventIdsForContainer(routeEvents, c.id).length > 0
    })
    .map((c) => c.id)
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest src/__tests__/lib/containers.test.ts`
Expected: PASS (todos los tests del archivo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/containers.ts src/__tests__/lib/containers.test.ts
git commit -m "feat(pesaje): excluir contenedores Yaris de la cola"
```

---

## Task 7: Excluir Yaris del dashboard de circulación — TDD

**Files:**
- Modify: `src/__tests__/lib/dashboard-metrics.test.ts` (describe `computeCirculationBreakdown`)
- Modify: `src/lib/data/dashboard-metrics.ts:57` (`computeCirculationBreakdown`)

- [ ] **Step 1: Escribir el test que falla**

Dentro de `describe('computeCirculationBreakdown', ...)`, agregar un nuevo `it`:

```ts
  it('excluye los contenedores Yaris del pool activo', () => {
    const withYaris = [
      ...MOCK_CONTAINERS,
      { id: 'Y1', company_id: '', size_liters: 1100 as const, tare_weight_kg: 0,
        status: 'active' as const, registered_at: '2026-06-03T00:00:00Z', is_yaris_container: true },
    ]
    const result = computeCirculationBreakdown({
      containers: withYaris,
      routeEvents: MOCK_ROUTE_EVENTS,
      receptions: MOCK_RECEPTIONS,
      storageEvents: MOCK_STORAGE_EVENTS,
      treatmentRuns: MOCK_TREATMENT_RUNS,
      externalTransfers: MOCK_EXTERNAL_TRANSFERS,
      locations: MOCK_LOCATIONS,
    })
    // El Yaris extra NO cuenta: el total sigue siendo el pool de planta.
    expect(result.total).toBe(204)
  })
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest src/__tests__/lib/dashboard-metrics.test.ts -t "excluye los contenedores Yaris"`
Expected: FAIL — `result.total` es 205.

- [ ] **Step 3: Implementar la exclusión**

En `computeCirculationBreakdown` (`src/lib/data/dashboard-metrics.ts:57`), cambiar:

```ts
  const activeContainers = store.containers.filter((c) => c.status === 'active')
```

por:

```ts
  const activeContainers = store.containers.filter(
    (c) => c.status === 'active' && !c.is_yaris_container,
  )
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest src/__tests__/lib/dashboard-metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/dashboard-metrics.ts src/__tests__/lib/dashboard-metrics.test.ts
git commit -m "feat(dashboard): excluir contenedores Yaris del pool activo"
```

---

## Task 8: Contenedores Yaris en mock offline — TDD

**Files:**
- Modify: `src/__tests__/lib/mock-containers.test.ts`
- Modify: `src/lib/mock-data.ts` (tras `METALLIC_CONTAINERS`, e incluir en `MOCK_CONTAINERS`)

- [ ] **Step 1: Escribir el test que falla**

En `src/__tests__/lib/mock-containers.test.ts`, agregar dentro del `describe`:

```ts
  it('incluye 26 contenedores Yaris Y1..Y26 de 1100 L, sin empresa, sin tara', () => {
    const yaris = MOCK_CONTAINERS.filter((c) => c.is_yaris_container)
    expect(yaris).toHaveLength(26)
    expect(yaris.every((c) => c.size_liters === 1100)).toBe(true)
    expect(yaris.every((c) => !c.company_id)).toBe(true)
    expect(yaris.every((c) => c.tare_weight_kg === 0)).toBe(true)
    expect(yaris.map((c) => c.id)).toContain('Y1')
    expect(yaris.map((c) => c.id)).toContain('Y26')
  })
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest src/__tests__/lib/mock-containers.test.ts -t "26 contenedores Yaris"`
Expected: FAIL — `yaris` tiene length 0.

- [ ] **Step 3: Agregar los mocks en `src/lib/mock-data.ts`**

Tras la definición de `METALLIC_CONTAINERS` (línea ~76), agregar:

```ts
// Flota Yaris Y1..Y26 (1100 L, sin empresa, sin tara: se pesan con los tachos
// alternativos is_yaris_dedicated). Siempre disponibles en recorrido.
const YARIS_ROUTE_CONTAINERS: Container[] = Array.from({ length: 26 }, (_, i) => ({
  id: `Y${i + 1}`,
  company_id: '',
  size_liters: 1100,
  tare_weight_kg: 0,
  status: 'active',
  registered_at: '2026-06-03T00:00:00Z',
  is_yaris_container: true,
}))
```

Luego, en `MOCK_CONTAINERS`, agregar el spread al final del array:

```ts
export const MOCK_CONTAINERS: Container[] = [
  ...HISTORICAL_CONTAINERS.map((c) =>
    YARIS_IDS.has(c.id) ? { ...c, is_yaris_dedicated: true } : c,
  ),
  ...METALLIC_CONTAINERS,
  ...YARIS_ROUTE_CONTAINERS,
]
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest src/__tests__/lib/mock-containers.test.ts`
Expected: PASS (los 3 tests: 15 metálicos, 17 yaris_dedicated, 26 yaris_container).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock-data.ts src/__tests__/lib/mock-containers.test.ts
git commit -m "feat(mock): 26 contenedores Yaris Y1..Y26"
```

---

## Task 9: Admin — columna y checkbox "Yaris recorrido"

**Files:**
- Modify: `src/components/admin/container-form.tsx` (estado, submit, checkbox)
- Modify: `src/app/admin/containers/page.tsx` (handleAdd, columna, toggle)

- [ ] **Step 1: `container-form.tsx` — estado y exclusividad mutua**

Tras `const [isMetallic, setIsMetallic] = useState(false)` agregar:

```ts
  const [isYarisContainer, setIsYarisContainer] = useState(false)
```

Cambiar el `onChange` del checkbox `isYaris` y el de `isMetallic` para que también apaguen `isYarisContainer`:

```ts
          onChange={(e) => { setIsYaris(e.target.checked); if (e.target.checked) { setIsMetallic(false); setIsYarisContainer(false) } }}
```

```ts
          onChange={(e) => { setIsMetallic(e.target.checked); if (e.target.checked) { setIsYaris(false); setIsYarisContainer(false) } }}
```

- [ ] **Step 2: `container-form.tsx` — id/empresa libres para Yaris recorrido**

Los Yaris recorrido, igual que los metálicos, llevan id libre (`Y1`) y sin empresa.
Cambiar `computedId` para tratar Yaris recorrido como id libre:

```ts
  const freeId = isMetallic || isYarisContainer
  const computedId = freeId
    ? containerNumber.trim()
    : selectedCompany && containerNumber
      ? `${selectedCompany.code_letter}-${containerNumber.padStart(3, '0')}`
      : ''
```

En `handleSubmit`, cambiar la guarda y el payload:

```ts
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!computedId || !size || !tare) return
    if (!freeId && (!clientId || !companyId)) return
    onSubmit({
      id: computedId,
      company_id: freeId ? '' : companyId,
      size_liters: size as ContainerSize,
      tare_weight_kg: parseFloat(tare),
      is_yaris_dedicated: isYaris,
      is_metallic_dedicated: isMetallic,
      is_yaris_container: isYarisContainer,
    })
  }
```

Y `canSubmit`:

```ts
  const canSubmit = computedId && size && tare && (freeId || (clientId && companyId))
```

Actualizar también el `type` y placeholder del input de número y el prefijo de empresa,
que hoy dependen de `isMetallic`; usar `freeId`:

```ts
          {selectedCompany && !freeId && (
            <span className="font-mono font-semibold text-slate-600">{selectedCompany.code_letter}-</span>
          )}
          <Input
            type={freeId ? 'text' : 'number'}
            placeholder={freeId ? (isYarisContainer ? 'Y1' : 'M1') : '001'}
```

- [ ] **Step 3: `container-form.tsx` — checkbox del formulario**

Tras el `<label>` del checkbox metálico (antes del bloque de botones `<div className="flex gap-3">`), agregar:

```tsx
      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-muted/30">
        <input
          type="checkbox"
          checked={isYarisContainer}
          onChange={(e) => { setIsYarisContainer(e.target.checked); if (e.target.checked) { setIsYaris(false); setIsMetallic(false) } }}
          className="mt-0.5 h-4 w-4"
        />
        <div className="flex-1">
          <p className="text-sm font-medium">Contenedor de flota Yaris</p>
          <p className="text-xs text-muted-foreground">
            Marcalo si es un contenedor físico de la flota Yaris (Y1…). Se crea sin empresa y sin tara, siempre disponible en recorrido y fuera de la cola de pesaje.
          </p>
        </div>
      </label>
```

- [ ] **Step 4: `admin/containers/page.tsx` — persistir el flag al crear**

En `handleAdd`, dentro de `q.createContainer`, agregar al objeto:

```ts
        is_yaris_container: data.is_yaris_container ?? false,
```

- [ ] **Step 5: `admin/containers/page.tsx` — toggle y columna**

Agregar la función toggle (tras `toggleMetallic`):

```ts
  async function toggleYarisContainer(c: Container) {
    const next = !c.is_yaris_container
    try {
      const supabase = createClient()
      await q.updateContainer(supabase, c.id, { is_yaris_container: next })
    } catch (err) {
      console.error('[admin/containers] toggle Yaris recorrido falló:', err)
      return
    }
    updateContainer(c.id, { is_yaris_container: next })
  }
```

En el `<thead>`, tras `<th ...>Metálico</th>`:

```tsx
              <th className="px-4 py-3 font-medium">Yaris flota</th>
```

En el `<tbody>`, tras la celda del toggle metálico (`</td>` que cierra la columna Metálico):

```tsx
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleYarisContainer(c)}
                      disabled={c.status !== 'active'}
                      className={c.is_yaris_container
                        ? 'gap-1 bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                        : 'gap-1 text-muted-foreground hover:text-foreground'}
                    >
                      <Car className="h-3.5 w-3.5" />
                      {c.is_yaris_container ? 'Sí' : 'No'}
                    </Button>
                  </td>
```

(`Car` ya está importado en este archivo.)

- [ ] **Step 6: Verificar build**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/container-form.tsx src/app/admin/containers/page.tsx
git commit -m "feat(admin): columna y alta de contenedor Yaris de flota"
```

---

## Task 10: Aplicar migraciones a Supabase (piloto)

**Files:** ninguno (acción sobre la DB remota vía MCP).

- [ ] **Step 1: Aplicar la columna**

Usar la herramienta MCP `apply_migration` con name `containers_is_yaris_container_flag` y el SQL de Task 1.

- [ ] **Step 2: Aplicar el seed**

`apply_migration` con name `seed_yaris_route_containers` y el SQL de Task 2.

- [ ] **Step 3: Aplicar la vista**

`apply_migration` con name `pending_weighing_exclude_yaris` y el SQL de Task 3.

- [ ] **Step 4: Verificar en la DB**

Ejecutar vía `execute_sql`:

```sql
select id, size_liters, tare_weight_kg, company_id, is_yaris_container
from public.containers where id like 'Y%' order by id;
```

Expected: 26 filas `Y1`…`Y26`, `size_liters = 1100`, `tare_weight_kg = 0`,
`company_id = null`, `is_yaris_container = true`.

- [ ] **Step 5: Verificar que la vista los excluye**

```sql
select count(*) from public.v_containers_pending_weighing where is_yaris_container = true;
```

Expected: `0`.

---

## Task 11: Verificación final (suite + build)

**Files:** ninguno.

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npx jest`
Expected: PASS (61 previos + los 3 nuevos = 64 tests, todos verdes).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos.

---

## Task 12: Documentación del vault

**Files:**
- Create: `vault/logs/2026-06-03-contenedores-yaris-recorrido.md`
- Modify: `vault/project/DataModel.md` (flag `is_yaris_container`)
- Modify: `vault/decisions/2026-06-01-ids-tachos-supabase-vs-mock.md` (Y1…Y26 literales)
- Modify: `vault/decisions/2026-05-21-estado-envase-derivado.md` (nota: current_phase como próximo proyecto)
- Modify: `vault/project/Roadmap.md` (item current_phase por trigger)
- Modify: `vault/_index.md` (estado + nuevo log)

- [ ] **Step 1: Crear el log**

Crear `vault/logs/2026-06-03-contenedores-yaris-recorrido.md` con frontmatter (title, tags `[log, containers, yaris, recorrido]`, `updated: 2026-06-03`) documentando: qué se agregó (26 `Y1…Y26`), el flag `is_yaris_container` vs `is_yaris_dedicated`, las decisiones (sin empresa, 1100 L, tara 0, excluidos de pesaje y dashboard), y la separación explícita del refactor `current_phase`.

- [ ] **Step 2: Actualizar `DataModel.md`**

En la tabla de campos de `Container`, agregar fila `is_yaris_container | boolean | flota Yaris, sin tara, excluido de pesaje/dashboard`.

- [ ] **Step 3: Actualizar el ADR de IDs**

En `2026-06-01-ids-tachos-supabase-vs-mock.md`, anotar que `Y1`…`Y26` son IDs literales en Supabase (como `M1`…`M15`), sin prefijo de empresa.

- [ ] **Step 4: Anotar el próximo proyecto `current_phase`**

En `2026-05-21-estado-envase-derivado.md` (sección Plan de evolución, item P2) y en `Roadmap.md`, registrar que la columna `current_phase` como caché mantenida por triggers (eventos = fuente de verdad, + job de auditoría) queda como próximo proyecto, decidido el 2026-06-03 al no acoplarla a los Yaris.

- [ ] **Step 5: Actualizar `_index.md`**

Agregar fila a la tabla de estado y el log a la lista de logs. Actualizar "Última actualización del vault" a 2026-06-03.

- [ ] **Step 6: Commit**

```bash
git add vault/
git commit -m "docs(vault): log + ADRs contenedores Yaris de recorrido"
```

---

## Resumen de archivos

| Archivo | Acción |
|---------|--------|
| `supabase/migrations/20260603010000_*.sql` | Crear (columna) |
| `supabase/migrations/20260603010100_*.sql` | Crear (seed) |
| `supabase/migrations/20260603010200_*.sql` | Crear (vista) |
| `src/lib/types.ts` | Modificar (campo) |
| `src/lib/supabase/database.types.ts` | Modificar (Row/Insert/Update + view) |
| `src/components/supabase-hydrator.tsx` | Modificar (mapeo) |
| `src/lib/data/containers.ts` | Modificar (exclusión cola) |
| `src/lib/data/dashboard-metrics.ts` | Modificar (exclusión pool) |
| `src/lib/mock-data.ts` | Modificar (26 Yaris) |
| `src/components/admin/container-form.tsx` | Modificar (checkbox) |
| `src/app/admin/containers/page.tsx` | Modificar (toggle + columna) |
| `src/__tests__/lib/containers.test.ts` | Modificar (test) |
| `src/__tests__/lib/dashboard-metrics.test.ts` | Modificar (test) |
| `src/__tests__/lib/mock-containers.test.ts` | Modificar (test) |
| `vault/**` | Crear/modificar (docs) |
