# Tachos metálicos M1-M15 + tipo "Metálicos No reutilizables" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un 6º tipo de desecho "Metálicos No reutilizables" y 15 tachos dedicados (M1-M15, 120 L) que solo aparecen en pesaje al elegir ese tipo, análogos a los tachos Yaris pero disparados por el tipo de desecho en vez de un toggle.

**Architecture:** El tipo de desecho va desvinculado del tacho (input del operador en pesaje). Se agrega el enum `metallic`, el tamaño `120`, y la columna `is_metallic_dedicated` (espejo de `is_yaris_dedicated`). Los M no pertenecen a empresa (`company_id = null`/`''`) ni pasan por recorrido: están siempre disponibles. En el formulario, elegir "Metálicos No reutilizables" cambia la fuente del selector de tacho a los M; metálico y Yaris son mutuamente excluyentes.

**Tech Stack:** Next.js (App Router) + TypeScript + Zustand + Supabase (Postgres) + Jest.

**Spec:** `docs/superpowers/specs/2026-06-01-tachos-metalicos-piezas-metalicas-design.md`

---

## Estructura de archivos

- `supabase/migrations/20260601000000_metallic_type_size120_flag.sql` (nuevo) — enums + columna
- `supabase/migrations/20260601000100_seed_yaris_metallic_containers.sql` (nuevo) — seed (usa los enums; archivo aparte por límite de Postgres `ADD VALUE`)
- `src/lib/types.ts` (modificar) — `WasteType`, `ContainerSize`, `Container.is_metallic_dedicated`
- `src/lib/supabase/database.types.ts` (modificar) — enums + containers Row/Insert/Update
- `src/components/supabase-hydrator.tsx` (modificar) — map `is_metallic_dedicated`, cast 120
- `src/lib/data/containers.ts` (modificar) — helper `getMetallicContainers`
- `src/__tests__/lib/containers.test.ts` (modificar) — test del helper
- `src/components/register/weighing-form.tsx` (modificar) — label, catálogo, badge, exclusión
- `src/app/register/weighing/page.tsx` (modificar) — `metallicContainers`, exclusión en cola
- `src/components/admin/container-form.tsx` (modificar) — 120 L, checkbox metálico, empresa opcional
- `src/app/admin/containers/page.tsx` (modificar) — columna + toggle Metálico
- `src/lib/mock-data.ts` (modificar) — 15 M + marcar 17 Yaris
- `src/__tests__/lib/mock-containers.test.ts` (nuevo) — counts del mock
- Vault: `processes/WasteTypes.md`, `logs/2026-06-01-tachos-metalicos.md`, `_index.md`

> **Nota sobre el runner de tests:** el repo tiene Vitest y Jest. Los tests unitarios de
> `src/__tests__/**` corren con Jest. Usar `npx jest <archivo>` en este plan.

---

## Task 1: Migración — enums (metallic, 120) + columna is_metallic_dedicated

**Files:**
- Create: `supabase/migrations/20260601000000_metallic_type_size120_flag.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- Tipo de desecho metálico (6º) + tamaño 120 L + flag de tacho dedicado a metálico.
-- ADD VALUE va en su propia migración: el nuevo valor de enum no puede usarse en la
-- misma transacción donde se crea (los INSERT/seed van en 20260601000100).

alter type public.waste_type add value if not exists 'metallic';

alter type public.container_size add value if not exists '120';

alter table public.containers
  add column if not exists is_metallic_dedicated boolean not null default false;

comment on column public.containers.is_metallic_dedicated is
  'Si true, el tacho está dedicado exclusivamente al pesaje de "Metálicos No reutilizables". Siempre disponible en pesaje (sin recorrido previo); solo aparece como opción cuando el operador elige el tipo de desecho metálico.';
```

- [ ] **Step 2: Aplicar la migración al proyecto Supabase**

Run: `npx supabase db push`
Expected: aplica `20260601000000` sin error. Si el entorno no tiene CLI conectado, ejecutar el SQL en el editor SQL del proyecto `hospiwaste` (ref `xqqnthyipkdkwyknbtnw`).

- [ ] **Step 3: Verificar enums y columna**

Run (SQL editor):
```sql
select enum_range(null::public.waste_type);
select enum_range(null::public.container_size);
select column_name from information_schema.columns
where table_name='containers' and column_name='is_metallic_dedicated';
```
Expected: `waste_type` incluye `metallic`; `container_size` incluye `120`; la columna existe.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260601000000_metallic_type_size120_flag.sql
git commit -m "feat(db): tipo metallic + tamaño 120 + columna is_metallic_dedicated"
```

---

## Task 2: Migración — seed Yaris (17) + tachos metálicos (15)

**Files:**
- Create: `supabase/migrations/20260601000100_seed_yaris_metallic_containers.sql`

- [ ] **Step 1: Escribir el seed**

```sql
-- Marca los 17 tachos Airkem dedicados a Yaris (provistos por operaciones).
update public.containers set is_yaris_dedicated = true
where id in (
  'A-020','A-042','A-044','A-046','A-048','A-051','A-064','A-065',
  'A-068','A-069','A-072','A-076','A-078','A-105','A-154','A-175','A-187'
);

-- Inserta los 15 tachos metálicos M1..M15 (120 L, sin empresa, taras reales).
insert into public.containers (id, company_id, size_liters, tare_weight_kg, status, is_metallic_dedicated)
values
  ('M1',  null, '120', 8.7, 'active', true),
  ('M2',  null, '120', 8.7, 'active', true),
  ('M3',  null, '120', 8.9, 'active', true),
  ('M4',  null, '120', 8.9, 'active', true),
  ('M5',  null, '120', 9.1, 'active', true),
  ('M6',  null, '120', 9.0, 'active', true),
  ('M7',  null, '120', 9.0, 'active', true),
  ('M8',  null, '120', 8.8, 'active', true),
  ('M9',  null, '120', 9.2, 'active', true),
  ('M10', null, '120', 9.2, 'active', true),
  ('M11', null, '120', 9.1, 'active', true),
  ('M12', null, '120', 8.7, 'active', true),
  ('M13', null, '120', 8.9, 'active', true),
  ('M14', null, '120', 8.7, 'active', true),
  ('M15', null, '120', 9.1, 'active', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase db push` (o ejecutar el SQL en el editor del proyecto).
Expected: 17 filas actualizadas, 15 insertadas.

- [ ] **Step 3: Verificar**

Run (SQL editor):
```sql
select count(*) from public.containers where is_yaris_dedicated;      -- >= 17
select count(*) from public.containers where is_metallic_dedicated;   -- 15
select id, size_liters, tare_weight_kg, company_id from public.containers
where is_metallic_dedicated order by id;
```
Expected: 15 metálicos `M1..M15`, `company_id` null, 120 L, taras correctas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260601000100_seed_yaris_metallic_containers.sql
git commit -m "feat(db): seed tachos Yaris (17) + metálicos M1-M15"
```

---

## Task 3: Tipos TypeScript (types.ts + database.types.ts)

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: `WasteType` — agregar `metallic`**

En `src/lib/types.ts`, reemplazar la unión `WasteType`:

```ts
export type WasteType =
  | 'infectious'          // 1 — Peligroso infeccioso (treated on-site)
  | 'anatomopathological' // 2 — Anatomopatológico (external transfer)
  | 'cytotoxic'           // 3 — Citotóxico (external transfer)
  | 'liquid'              // 4 — Líquidos (external transfer)
  | 'morgue'              // 5 — Morgue (external transfer)
  | 'metallic'            // 6 — Metálicos No reutilizables (tachos M dedicados)
```

> Mantener las líneas existentes 3-5 de cytotoxic/liquid/morgue tal cual estén; solo agregar la línea `metallic`. Verificar los comentarios reales antes de pegar.

- [ ] **Step 2: `ContainerSize` — agregar 120**

En `src/lib/types.ts`:

```ts
export type ContainerSize = 120 | 240 | 750 | 1100
```

- [ ] **Step 3: `Container` — agregar flag metálico**

En `src/lib/types.ts`, dentro de `interface Container`, debajo de `is_yaris_dedicated?`:

```ts
  /** true: tacho dedicado a "Metálicos No reutilizables". Siempre disponible en
   *  pesaje (sin recorrido) y solo visible cuando el tipo elegido es 'metallic'. */
  is_metallic_dedicated?: boolean
```

- [ ] **Step 4: `database.types.ts` — enums**

En `src/lib/supabase/database.types.ts`, en `Enums`:

```ts
      container_size: "120" | "240" | "750" | "1100"
```

y en `waste_type` agregar `"metallic"` al final de la unión:

```ts
      waste_type:
        | "infectious"
        | "anatomopathological"
        | "cytotoxic"
        | "liquid"
        | "morgue"
        | "metallic"
```

En `Constants.public.Enums`, agregar `"120"` a `container_size` y `"metallic"` a `waste_type`:

```ts
      container_size: ["120", "240", "750", "1100"],
```
```ts
      waste_type: [
        "infectious",
        "anatomopathological",
        "cytotoxic",
        "liquid",
        "morgue",
        "metallic",
      ],
```

- [ ] **Step 5: `database.types.ts` — columna en containers**

En la tabla `containers`, agregar `is_metallic_dedicated` en Row, Insert y Update (junto a `is_yaris_dedicated`):

Row:
```ts
          is_metallic_dedicated: boolean
```
Insert:
```ts
          is_metallic_dedicated?: boolean
```
Update:
```ts
          is_metallic_dedicated?: boolean
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a estos tipos (puede haber errores preexistentes ajenos; comparar con baseline si aplica).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/supabase/database.types.ts
git commit -m "feat(types): waste_type metallic, size 120, is_metallic_dedicated"
```

---

## Task 4: Hydrator — mapear is_metallic_dedicated y aceptar 120

**Files:**
- Modify: `src/components/supabase-hydrator.tsx` (función `rowToContainer`, ~líneas 163-173)

- [ ] **Step 1: Actualizar `rowToContainer`**

Reemplazar la función por:

```ts
function rowToContainer(r: q.ContainerRow): Container {
  return {
    id: r.id,
    company_id: r.company_id ?? '', // store espera string; '' = sin empresa
    size_liters: Number(r.size_liters) as 120 | 240 | 750 | 1100,
    tare_weight_kg: Number(r.tare_weight_kg),
    status: r.status,
    registered_at: r.registered_at,
    is_yaris_dedicated: r.is_yaris_dedicated,
    is_metallic_dedicated: r.is_metallic_dedicated,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/supabase-hydrator.tsx
git commit -m "feat(hydrator): mapear is_metallic_dedicated + size 120"
```

---

## Task 5: Helper getMetallicContainers (TDD)

**Files:**
- Modify: `src/lib/data/containers.ts`
- Test: `src/__tests__/lib/containers.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `src/__tests__/lib/containers.test.ts`:

```ts
import { getMetallicContainers } from '@/lib/data/containers'

describe('getMetallicContainers', () => {
  const mk = (id: string, over: Partial<Container> = {}): Container => ({
    id,
    company_id: '',
    size_liters: 120,
    tare_weight_kg: 8.7,
    status: 'active',
    registered_at: '2026-06-01T00:00:00Z',
    ...over,
  })

  it('devuelve solo los dedicados a metálico y activos', () => {
    const list = [
      mk('M1', { is_metallic_dedicated: true }),
      mk('M2', { is_metallic_dedicated: true, status: 'decommissioned' }),
      mk('A-020', { size_liters: 240, is_yaris_dedicated: true }),
      mk('A-001', { size_liters: 240 }),
    ]
    expect(getMetallicContainers(list).map((c) => c.id)).toEqual(['M1'])
  })

  it('lista vacía → []', () => {
    expect(getMetallicContainers([])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest src/__tests__/lib/containers.test.ts -t getMetallicContainers`
Expected: FAIL — `getMetallicContainers is not a function`.

- [ ] **Step 3: Implementar el helper**

Agregar en `src/lib/data/containers.ts` (debajo de `getPendingWeighingContainerIds`):

```ts
/**
 * Tachos dedicados a "Metálicos No reutilizables" disponibles para pesar.
 * Siempre disponibles (no requieren recorrido), igual que los Yaris. Solo se
 * ofrecen en el formulario cuando el tipo de desecho elegido es 'metallic'.
 */
export function getMetallicContainers(containers: Container[]): Container[] {
  return containers.filter((c) => c.is_metallic_dedicated && c.status === 'active')
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest src/__tests__/lib/containers.test.ts -t getMetallicContainers`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/containers.ts src/__tests__/lib/containers.test.ts
git commit -m "feat(containers): helper getMetallicContainers + tests"
```

---

## Task 6: Pesaje page.tsx — cola y prop metálica

**Files:**
- Modify: `src/app/register/weighing/page.tsx` (~líneas 25, 84-91, 511-523)

- [ ] **Step 1: Importar el helper**

En el import de `@/lib/data/containers` (línea ~25) agregar `getMetallicContainers`:

```ts
import { getPendingWeighingContainerIds, getContainerCurrentCompanyId, formatTachoNumber, getMetallicContainers } from '@/lib/data/containers'
```

- [ ] **Step 2: Excluir metálicos de la cola normal + computar metallicContainers**

Reemplazar el bloque de `availableContainers`/`yarisContainers` (líneas ~85-91):

```ts
  const pendingIds = new Set(getPendingWeighingContainerIds(containers, routeEvents, receptions))
  const availableContainers = containers.filter(
    (c) => pendingIds.has(c.id) && !c.is_yaris_dedicated && !c.is_metallic_dedicated,
  )
  const yarisContainers = containers.filter(
    (c) => c.is_yaris_dedicated && c.status === 'active',
  )
  const metallicContainers = getMetallicContainers(containers)
```

- [ ] **Step 3: Pasar el prop al formulario**

En el render de `<WeighingForm ... />` (línea ~515, junto a `yarisContainers={yarisContainers}`), agregar:

```tsx
        metallicContainers={metallicContainers}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: error esperado en `WeighingForm` por prop desconocida hasta completar Task 7 (se resuelve allí). Si se ejecuta Task 7 primero, sin error. Continuar con Task 7.

- [ ] **Step 5: Commit (junto con Task 7)** — ver Task 7 Step final.

---

## Task 7: weighing-form.tsx — tipo metálico, catálogo, exclusión Yaris

**Files:**
- Modify: `src/components/register/weighing-form.tsx`

- [ ] **Step 1: Label del tipo metálico**

En `WASTE_LABELS` (líneas 13-19) agregar:

```ts
  metallic: 'Metálicos No reutilizables',
```

- [ ] **Step 2: Nuevo prop `metallicContainers`**

En `interface Props`, debajo de `yarisContainers: Container[]`:

```ts
  /** Tachos dedicados a metálico (siempre disponibles; solo se ofrecen con tipo 'metallic'). */
  metallicContainers: Container[]
```

Y en la desestructuración de `WeighingForm({ ... })` agregar `metallicContainers,` junto a `yarisContainers,`.

- [ ] **Step 3: Derivar isMetallic y cambiar la fuente del catálogo**

Debajo de `const isYaris = state.is_yaris_weighing` (línea ~77):

```ts
  const isMetallic = state.waste_type === 'metallic'
```

Reemplazar `const normalCatalog = isYaris ? [] : availableContainers` (línea ~82):

```ts
  const normalCatalog = isYaris ? [] : isMetallic ? metallicContainers : availableContainers
```

- [ ] **Step 4: Handler de cambio de tipo (limpia tacho al cruzar metálico, saca Yaris)**

Agregar la función debajo de `toggleYaris` (después de línea ~117):

```ts
  function changeWasteType(v: string | null) {
    const next = (v ?? 'infectious') as WasteType
    const crossingMetallic = (state.waste_type === 'metallic') !== (next === 'metallic')
    onChange({
      waste_type: next,
      ...(crossingMetallic ? { container_id: '' } : {}),
      ...(next === 'metallic' ? { is_yaris_weighing: false } : {}),
    })
  }
```

Y reemplazar `toggleYaris` para resetear el tipo si estaba en metálico:

```ts
  function toggleYaris() {
    const turningOn = !isYaris
    onChange({
      is_yaris_weighing: turningOn,
      container_id: '',
      ...(turningOn && state.waste_type === 'metallic'
        ? { waste_type: 'infectious' as WasteType }
        : {}),
    })
  }
```

- [ ] **Step 5: Conectar el selector de tipo al nuevo handler**

En el `<Select>` del tipo de desecho (línea ~214), reemplazar `onValueChange`:

```tsx
        <Select value={state.waste_type} onValueChange={changeWasteType}>
```

- [ ] **Step 6: Placeholder y label del selector principal según metálico**

En el selector "Número de tacho" (líneas ~130-145), hacer el label y placeholder sensibles a `isMetallic`. Reemplazar el `<label>` (línea ~130-132):

```tsx
          <label className="text-sm font-medium text-foreground">
            {isMetallic ? 'Tacho metálico' : 'Número de tacho'} <span className="text-red-500">*</span>
          </label>
```

Y el `placeholder` del `SelectValue` (líneas ~139-145):

```tsx
              <SelectValue placeholder={
                isYaris
                  ? 'Modo Yaris activo'
                  : isMetallic
                    ? (metallicContainers.length === 0 ? 'No hay tachos metálicos' : 'Seleccionar tacho metálico')
                    : normalCatalog.length === 0
                      ? 'No hay tachos pendientes'
                      : 'Seleccionar tacho'
              } />
```

- [ ] **Step 7: Mensaje cuando no hay tachos (incluir caso metálico)**

Reemplazar el bloque `{dropdownContainers.length === 0 && mode === 'create' && (...)}` (líneas ~186-192):

```tsx
      {dropdownContainers.length === 0 && mode === 'create' && (
        <p className="text-xs text-amber-700">
          {isYaris
            ? 'No hay tachos Yaris configurados. Marcá un tacho como dedicado a Yaris desde Admin → Tachos.'
            : isMetallic
              ? 'No hay tachos metálicos configurados. Marcá un tacho como dedicado a metálico desde Admin → Tachos.'
              : 'No hay tachos sucios recogidos pendientes de pesar. Registrá un recorrido primero.'}
        </p>
      )}
```

- [ ] **Step 8: Badge "Tacho metálico"**

Debajo del badge `is_yaris_dedicated` (líneas ~201-205) agregar:

```tsx
          {selectedContainer.is_metallic_dedicated && (
            <Badge variant="outline" className="font-normal bg-slate-100 border-slate-300 text-slate-700">
              Tacho metálico
            </Badge>
          )}
```

- [ ] **Step 9: Ocultar el toggle Yaris cuando el tipo es metálico**

Envolver el bloque del botón toggle Yaris (líneas ~272-299) en `{!isMetallic && ( ... )}`:

```tsx
      {!isMetallic && (
        <button
          type="button"
          onClick={toggleYaris}
          aria-pressed={isYaris}
          /* ...resto del botón sin cambios... */
        >
          {/* ...contenido sin cambios... */}
        </button>
      )}
```

- [ ] **Step 10: Type-check + build**

Run: `npx tsc --noEmit`
Expected: sin errores (incluye el prop de Task 6).

- [ ] **Step 11: Commit (Task 6 + 7 juntas)**

```bash
git add src/app/register/weighing/page.tsx src/components/register/weighing-form.tsx
git commit -m "feat(pesaje): tipo metálico dispara tachos M1-M15 (excl. Yaris)"
```

---

## Task 8: Admin — alta y toggle de tacho metálico

**Files:**
- Modify: `src/components/admin/container-form.tsx`
- Modify: `src/app/admin/containers/page.tsx`

- [ ] **Step 1: container-form — tamaño 120 L**

En `SIZE_OPTIONS` (líneas 9-13) agregar al inicio:

```ts
const SIZE_OPTIONS: { value: ContainerSize; label: string }[] = [
  { value: 120, label: '120 L' },
  { value: 240, label: '240 L' },
  { value: 750, label: '750 L' },
  { value: 1100, label: '1100 L' },
]
```

- [ ] **Step 2: container-form — estado del checkbox metálico + exclusión con Yaris**

Debajo de `const [isYaris, setIsYaris] = useState(false)` (línea ~28):

```ts
  const [isMetallic, setIsMetallic] = useState(false)
```

- [ ] **Step 3: container-form — id y empresa opcionales para metálico**

Reemplazar el cálculo de `computedId` (líneas ~36-38) y `handleSubmit`/`canSubmit`:

```ts
  const selectedCompany = companies.find((c) => c.id === companyId)
  // Metálico: id libre (M1…) sin empresa. Normal: {letra}-NNN.
  const computedId = isMetallic
    ? containerNumber.trim()
    : selectedCompany && containerNumber
      ? `${selectedCompany.code_letter}-${containerNumber.padStart(3, '0')}`
      : ''
```

`handleSubmit`:

```ts
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!computedId || !size || !tare) return
    if (!isMetallic && (!clientId || !companyId)) return
    onSubmit({
      id: computedId,
      company_id: isMetallic ? '' : companyId,
      size_liters: size as ContainerSize,
      tare_weight_kg: parseFloat(tare),
      is_yaris_dedicated: isYaris,
      is_metallic_dedicated: isMetallic,
    })
  }
```

`canSubmit`:

```ts
  const canSubmit = computedId && size && tare && (isMetallic || (clientId && companyId))
```

- [ ] **Step 4: container-form — input de número/id tolera texto cuando es metálico**

En el `<Input>` del número de tacho (líneas ~99-105), cambiar `type` y placeholder según metálico:

```tsx
          <Input
            type={isMetallic ? 'text' : 'number'}
            placeholder={isMetallic ? 'M1' : '001'}
            value={containerNumber}
            onChange={(e) => setContainerNumber(e.target.value)}
            className="flex-1"
          />
```

(El prefijo de empresa `{selectedCompany.code_letter}-` se muestra solo si hay `selectedCompany`; con metálico no habrá empresa seleccionada, así que no aparece.)

- [ ] **Step 5: container-form — checkbox metálico (mutuamente excluyente con Yaris)**

Hacer que marcar uno desmarque el otro. Reemplazar el `onChange` del checkbox Yaris (línea ~140):

```tsx
          onChange={(e) => { setIsYaris(e.target.checked); if (e.target.checked) setIsMetallic(false) }}
```

Y agregar, debajo del `<label>` del checkbox Yaris (después de línea ~149), un nuevo checkbox:

```tsx
      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-muted/30">
        <input
          type="checkbox"
          checked={isMetallic}
          onChange={(e) => { setIsMetallic(e.target.checked); if (e.target.checked) setIsYaris(false) }}
          className="mt-0.5 h-4 w-4"
        />
        <div className="flex-1">
          <p className="text-sm font-medium">Tacho dedicado a metálico</p>
          <p className="text-xs text-muted-foreground">
            Marcalo si este tacho se usa solo para "Metálicos No reutilizables". Se crea sin empresa y aparece solo al pesar ese tipo.
          </p>
        </div>
      </label>
```

- [ ] **Step 6: admin/containers — handleAdd acepta 120 e is_metallic_dedicated**

En `handleAdd` (líneas ~26-33) ampliar el cast de tamaño y pasar el flag:

```ts
      await q.createContainer(supabase, {
        id: data.id,
        company_id: data.company_id || null,
        size_liters: String(data.size_liters) as '120' | '240' | '750' | '1100',
        tare_weight_kg: data.tare_weight_kg,
        status: 'active',
        is_yaris_dedicated: data.is_yaris_dedicated ?? false,
        is_metallic_dedicated: data.is_metallic_dedicated ?? false,
      })
```

- [ ] **Step 7: admin/containers — columna + toggle Metálico**

Importar un ícono en la línea de import de `lucide-react` (línea 4): agregar `Wrench`:

```ts
import { Plus, Car, Wrench } from 'lucide-react'
```

Agregar `toggleMetallic` debajo de `toggleYaris` (después de línea ~63):

```ts
  async function toggleMetallic(c: Container) {
    const next = !c.is_metallic_dedicated
    try {
      const supabase = createClient()
      await q.updateContainer(supabase, c.id, { is_metallic_dedicated: next })
    } catch (err) {
      console.error('[admin/containers] toggle Metálico falló:', err)
      return
    }
    updateContainer(c.id, { is_metallic_dedicated: next })
  }
```

Agregar el `<th>` "Metálico" después del de "Yaris" (línea ~96):

```tsx
              <th className="px-4 py-3 font-medium">Metálico</th>
```

Agregar la celda toggle después de la celda Yaris (después de línea ~129):

```tsx
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMetallic(c)}
                      disabled={c.status !== 'active'}
                      className={c.is_metallic_dedicated
                        ? 'gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'gap-1 text-muted-foreground hover:text-foreground'}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      {c.is_metallic_dedicated ? 'Sí' : 'No'}
                    </Button>
                  </td>
```

- [ ] **Step 8: Type-check + build**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/container-form.tsx src/app/admin/containers/page.tsx
git commit -m "feat(admin): alta/toggle de tachos metálicos + tamaño 120 L"
```

---

## Task 9: Mock offline — 15 metálicos + marcar 17 Yaris (TDD)

**Files:**
- Modify: `src/lib/mock-data.ts` (~líneas 56-62)
- Test: `src/__tests__/lib/mock-containers.test.ts` (nuevo)

- [ ] **Step 1: Escribir el test que falla**

Crear `src/__tests__/lib/mock-containers.test.ts`:

```ts
import { MOCK_CONTAINERS } from '@/lib/mock-data'

describe('MOCK_CONTAINERS — Yaris y metálicos', () => {
  it('incluye 15 tachos metálicos M1..M15 de 120 L sin empresa', () => {
    const metallic = MOCK_CONTAINERS.filter((c) => c.is_metallic_dedicated)
    expect(metallic).toHaveLength(15)
    expect(metallic.every((c) => c.size_liters === 120)).toBe(true)
    expect(metallic.every((c) => !c.company_id)).toBe(true)
    expect(metallic.map((c) => c.id)).toContain('M1')
    expect(metallic.map((c) => c.id)).toContain('M15')
  })

  it('marca 17 tachos Airkem como dedicados a Yaris', () => {
    expect(MOCK_CONTAINERS.filter((c) => c.is_yaris_dedicated)).toHaveLength(17)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest src/__tests__/lib/mock-containers.test.ts`
Expected: FAIL (0 metálicos, 0 yaris).

- [ ] **Step 3: Implementar en mock-data.ts**

Reemplazar el bloque `export const MOCK_CONTAINERS` (líneas ~56-62) por:

```ts
// IDs Airkem dedicados a Yaris (provistos por operaciones).
const YARIS_IDS = new Set([
  'A-020', 'A-042', 'A-044', 'A-046', 'A-048', 'A-051', 'A-064', 'A-065',
  'A-068', 'A-069', 'A-072', 'A-076', 'A-078', 'A-105', 'A-154', 'A-175', 'A-187',
])

// Tachos metálicos M1..M15 (120 L, sin empresa, taras reales).
const METALLIC_TARES: Record<string, number> = {
  M1: 8.7, M2: 8.7, M3: 8.9, M4: 8.9, M5: 9.1, M6: 9.0, M7: 9.0, M8: 8.8,
  M9: 9.2, M10: 9.2, M11: 9.1, M12: 8.7, M13: 8.9, M14: 8.7, M15: 9.1,
}

const METALLIC_CONTAINERS: Container[] = Object.entries(METALLIC_TARES).map(([id, tare]) => ({
  id,
  company_id: '',
  size_liters: 120,
  tare_weight_kg: tare,
  status: 'active',
  registered_at: '2026-06-01T00:00:00Z',
  is_metallic_dedicated: true,
}))

// Pool real: 189 tachos Airkem del histórico Excel (2026-01-01 → 2026-05-11),
// con los 17 Yaris marcados, + 15 metálicos M1..M15.
export const MOCK_CONTAINERS: Container[] = [
  ...HISTORICAL_CONTAINERS.map((c) =>
    YARIS_IDS.has(c.id) ? { ...c, is_yaris_dedicated: true } : c,
  ),
  ...METALLIC_CONTAINERS,
]
```

> Verificar que `Container` esté importado en `mock-data.ts` (ya se usa en `MOCK_CONTAINERS`).

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx jest src/__tests__/lib/mock-containers.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock-data.ts src/__tests__/lib/mock-containers.test.ts
git commit -m "feat(mock): 15 tachos metálicos + marcar 17 Yaris en el pool offline"
```

---

## Task 10: Vault — documentar tipo y feature

**Files:**
- Modify: `vault/processes/WasteTypes.md`
- Create: `vault/logs/2026-06-01-tachos-metalicos.md`
- Modify: `vault/_index.md`

- [ ] **Step 1: WasteTypes.md — agregar el 6º tipo**

Agregar fila a la tabla de tipos (después de Morgue):

```markdown
| 6 | Metálicos No reutilizables | Tachos dedicados M1-M15 (120 L); pesaje directo sin recorrido | Tachos metálicos M (sin empresa) |
```

Y una nota corta debajo de "Asignación contenedor–tipo de desecho":

```markdown
## Tachos metálicos (M1-M15)

Los tachos `M1`…`M15` (120 L) están dedicados al tipo **Metálicos No reutilizables**. No
pertenecen a ninguna empresa (`company_id = null`) ni pasan por recorrido: están siempre
disponibles en pesaje y solo aparecen cuando el operador elige ese tipo. Espejo operativo de
los tachos Yaris, pero disparados por el tipo de desecho en vez de un toggle.
```

- [ ] **Step 2: Crear el log**

Crear `vault/logs/2026-06-01-tachos-metalicos.md`:

```markdown
---
title: Tachos metálicos M1-M15 + tipo "Metálicos No reutilizables"
tags:
  - log
  - pesaje
  - tachos
  - modelo
updated: 2026-06-01
---

# 2026-06-01 — Tachos metálicos M1-M15

Nuevo 6º tipo de desecho **Metálicos No reutilizables** (enum `metallic`) y 15 tachos
dedicados `M1`…`M15` (120 L), análogos a los Yaris pero disparados por el tipo de desecho.

## Cambios
- Enum `waste_type` += `metallic`; `container_size` += `120`; columna
  `containers.is_metallic_dedicated` (espejo de `is_yaris_dedicated`).
- Seed: 17 tachos Airkem marcados Yaris (`A-020…A-187`) + 15 metálicos `M1…M15`
  (`company_id = null`, taras reales 8.7–9.2 kg).
- Pesaje: al elegir "Metálicos No reutilizables", el selector de tacho muestra solo los M
  (siempre disponibles, sin recorrido). Metálico y Yaris mutuamente excluyentes.
- Admin: alta + toggle de tacho metálico, tamaño 120 L, empresa opcional.
- Mock offline: 15 metálicos + 17 Yaris marcados.

## Decisiones
- Los metálicos no pertenecen a empresa (coherente con ADR
  `2026-05-30-empresa-tipo-dinamicos-tacho`: empresa dinámica/derivada).
- Post-pesaje van a cámara fría como los no-infecciosos.

Spec: `docs/superpowers/specs/2026-06-01-tachos-metalicos-piezas-metalicas-design.md`
Plan: `docs/superpowers/plans/2026-06-01-tachos-metalicos.md`
```

- [ ] **Step 3: _index.md — registrar log y estado**

Agregar a la tabla de estado (sección "Estado actual"):

```markdown
| Tachos metálicos M1-M15 + tipo "Metálicos No reutilizables" | 🟢 Completado | `logs/2026-06-01-tachos-metalicos.md` |
```

Y a la lista "Logs de cambios":

```markdown
- `logs/2026-06-01-tachos-metalicos.md`
```

- [ ] **Step 4: Commit**

```bash
git add vault/processes/WasteTypes.md vault/logs/2026-06-01-tachos-metalicos.md vault/_index.md
git commit -m "docs(vault): tipo metálico + tachos M1-M15"
```

---

## Task 11: Verificación final

- [ ] **Step 1: Suite de tests Jest completa**

Run: `npx jest`
Expected: PASS, incluyendo `getMetallicContainers` (2) y `mock-containers` (2). Sin regresiones.

- [ ] **Step 2: Build de producción (type-check incluido)**

Run: `npm run build`
Expected: build OK, sin errores de tipo.

- [ ] **Step 3: Verificación manual (E2E) — checklist**

1. Pesaje → Iniciar → elegir tipo "Metálicos No reutilizables" → el selector "Tacho metálico" lista `M1…M15`; el toggle Yaris desaparece.
2. Seleccionar `M3` → badge "Tacho metálico"; peso neto usa tara 8.9.
3. Cambiar el tipo a "Peligroso infeccioso" → el tacho se limpia y vuelve la cola normal + toggle Yaris.
4. Activar Yaris estando en metálico → tipo vuelve a infeccioso y aparece el selector Yaris.
5. Finalizar pesaje de un metálico → el tacho queda en cámara fría.
6. Admin → Tachos → alta de tacho metálico sin empresa; columna "Metálico" con toggle.

> Sin commit (solo verificación). Reportar resultado al usuario.
