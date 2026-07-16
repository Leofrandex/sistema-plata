# Equipos — Mantenimiento preventivo · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva tab "Equipos" (solo coordinador) con semáforo de mantenimiento preventivo por equipo, historial de mantenimientos con fotos, y semilla desde el Excel de la base instalada.

**Architecture:** Módulo autónomo que consulta Supabase directamente (sin store Zustand, sin hydrator, sin outbox offline). Dos tablas nuevas (`equipment`, `equipment_maintenance` con anulación lógica); las fotos reutilizan `photos` con un valor nuevo `maintenance` en el enum `photo_event_type` y el helper `uploadEventPhotos`. La lógica del semáforo son funciones puras testeadas con jest.

**Tech Stack:** Next.js (App Router, `output: 'export'` — todo es client component), Supabase (`@supabase/ssr` browser client), Tailwind, lucide-react, jest + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-16-equipos-mantenimiento-preventivo-design.md`

## Global Constraints

- Solo coordinador ve/usa el módulo: la nav ya filtra `TOP_NAV` para operadores; `/equipment` NO se agrega a `OPERATOR_PATHS` de `src/lib/auth/route-access.ts` (así el AuthGuard lo bloquea solo).
- Semáforo: 🟢 `ok` (días restantes > 15) · 🟡 `due_soon` (0 ≤ días ≤ 15) · 🔴 `overdue` (< 0) · ⚪ `unconfigured` (sin frecuencia o sin mantenimiento). Umbral fijo `15`.
- Export estático: NO usar rutas dinámicas `[id]`; el detalle es `/equipment/detail?id=<uuid>` con `useSearchParams` + `<Suspense>` (patrón de `src/app/containers/detail/page.tsx`).
- Fechas de mantenimiento son `date` (string `YYYY-MM-DD`); comparar en UTC para no tener off-by-one por timezone.
- Mutaciones: try/catch con `console.error('[equipment] …', err)` + mensaje de error inline; sin toast lib (no existe en el proyecto).
- Textos de UI en español (es-PA). Copy exacto en cada task.
- Comandos de verificación: `npx jest <path>` para tests puntuales, `npm run test:jest` suite completa, `npx next build` para build.
- Commits frecuentes con prefijos `feat:`/`fix:`/`docs:` como el historial existente.

## File Structure

```
supabase/migrations/20260716000000_equipment_maintenance.sql   (nueva)
src/lib/supabase/database.types.ts                             (regenerado vía MCP)
src/lib/data/equipment-status.ts                               (nueva — lógica pura semáforo)
src/__tests__/lib/equipment-status.test.ts                     (nueva)
src/lib/supabase/queries/equipment.ts                          (nueva — queries CRUD)
src/lib/supabase/queries/index.ts                              (modificar — re-export)
scripts/seed-equipment-supabase.py                             (nueva — Excel → SQL)
src/components/layout/sidebar.tsx                              (modificar — nav)
src/components/layout/mobile-bottom-nav.tsx                    (modificar — nav)
src/app/equipment/page.tsx                                     (nueva — tabla)
src/components/equipment/equipment-table.tsx                   (nueva)
src/components/equipment/equipment-form.tsx                    (nueva — crear/editar)
src/app/equipment/detail/page.tsx                              (nueva — detalle)
src/components/equipment/maintenance-form.tsx                  (nueva — registrar mant.)
src/components/equipment/maintenance-history.tsx               (nueva — historial + anular)
vault/modules/EquipmentMaintenance.md                          (nueva)
vault/logs/2026-07-16-equipos-mantenimiento-preventivo.md      (nueva)
vault/_index.md                                                (modificar)
```

---

### Task 1: Migración Supabase + regenerar tipos

**Files:**
- Create: `supabase/migrations/20260716000000_equipment_maintenance.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerado completo vía MCP)

**Interfaces:**
- Produces: tablas `public.equipment` y `public.equipment_maintenance`; valor `maintenance` en enum `photo_event_type`; tipos TS `Tables<'equipment'>`, `Tables<'equipment_maintenance'>` disponibles vía `database.types.ts`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260716000000_equipment_maintenance.sql`:

```sql
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
```

- [ ] **Step 2: Aplicar la migración al proyecto Supabase**

Usar el MCP de Supabase (proyecto ref `xqqnthyipkdkwyknbtnw`):
`mcp__plugin_supabase_supabase__apply_migration` con `name: "equipment_maintenance"` y el SQL de arriba como `query`.

Expected: éxito sin errores. Verificar con `mcp__plugin_supabase_supabase__list_tables` que aparecen `equipment` y `equipment_maintenance`.

- [ ] **Step 3: Regenerar los tipos TS**

Usar `mcp__plugin_supabase_supabase__generate_typescript_types` y reemplazar el contenido completo de `src/lib/supabase/database.types.ts` con el resultado.

Expected: el archivo contiene `equipment: {` y `equipment_maintenance: {` en `Tables`, y `"maintenance"` dentro de `photo_event_type`.

- [ ] **Step 4: Verificar build**

Run: `npx next build`
Expected: build OK sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716000000_equipment_maintenance.sql src/lib/supabase/database.types.ts
git commit -m "feat(equipos): tablas equipment + equipment_maintenance y enum de fotos"
```

---

### Task 2: Lógica pura del semáforo (TDD)

**Files:**
- Create: `src/lib/data/equipment-status.ts`
- Test: `src/__tests__/lib/equipment-status.test.ts`

**Interfaces:**
- Produces (usado por Tasks 6 y 7):

```ts
export type MaintenanceState = 'unconfigured' | 'ok' | 'due_soon' | 'overdue'
export interface MaintenanceStatus {
  state: MaintenanceState
  lastPerformedAt: string | null  // 'YYYY-MM-DD'
  nextDueAt: string | null        // 'YYYY-MM-DD'
  daysRemaining: number | null    // negativo = vencido
}
export const DUE_SOON_THRESHOLD_DAYS = 15
export function computeMaintenanceStatus(args: {
  frequencyDays: number | null
  lastPerformedAt: string | null
  today: string
}): MaintenanceStatus
export function latestMaintenanceDate(
  maintenances: { performed_at: string; voided_at: string | null }[]
): string | null
export function compareByUrgency(a: MaintenanceStatus, b: MaintenanceStatus): number
export function formatDaysRemaining(status: MaintenanceStatus): string
export function todayISO(): string  // fecha local en 'YYYY-MM-DD'
```

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/__tests__/lib/equipment-status.test.ts`:

```ts
import {
  computeMaintenanceStatus,
  latestMaintenanceDate,
  compareByUrgency,
  formatDaysRemaining,
} from '@/lib/data/equipment-status'

describe('computeMaintenanceStatus', () => {
  it('sin frecuencia → unconfigured', () => {
    const s = computeMaintenanceStatus({ frequencyDays: null, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('unconfigured')
    expect(s.nextDueAt).toBeNull()
    expect(s.daysRemaining).toBeNull()
  })

  it('sin mantenimiento registrado → unconfigured', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 90, lastPerformedAt: null, today: '2026-07-16' })
    expect(s.state).toBe('unconfigured')
  })

  it('faltan más de 15 días → ok', () => {
    // último 2026-07-01 + 90 días = 2026-09-29; hoy 2026-07-16 → faltan 75
    const s = computeMaintenanceStatus({ frequencyDays: 90, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('ok')
    expect(s.nextDueAt).toBe('2026-09-29')
    expect(s.daysRemaining).toBe(75)
  })

  it('faltan exactamente 15 días → due_soon (borde)', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 30, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('due_soon')
    expect(s.daysRemaining).toBe(15)
  })

  it('faltan 16 días → ok (borde)', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 31, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('ok')
    expect(s.daysRemaining).toBe(16)
  })

  it('vence hoy → due_soon con 0 días', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 15, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('due_soon')
    expect(s.daysRemaining).toBe(0)
  })

  it('fecha pasada → overdue con días negativos', () => {
    const s = computeMaintenanceStatus({ frequencyDays: 10, lastPerformedAt: '2026-07-01', today: '2026-07-16' })
    expect(s.state).toBe('overdue')
    expect(s.daysRemaining).toBe(-5)
    expect(s.nextDueAt).toBe('2026-07-11')
  })
})

describe('latestMaintenanceDate', () => {
  it('devuelve la fecha más reciente ignorando anulados', () => {
    expect(latestMaintenanceDate([
      { performed_at: '2026-06-01', voided_at: null },
      { performed_at: '2026-07-10', voided_at: '2026-07-11T00:00:00Z' },
      { performed_at: '2026-07-05', voided_at: null },
    ])).toBe('2026-07-05')
  })

  it('sin mantenimientos válidos → null', () => {
    expect(latestMaintenanceDate([])).toBeNull()
    expect(latestMaintenanceDate([{ performed_at: '2026-06-01', voided_at: '2026-06-02T00:00:00Z' }])).toBeNull()
  })
})

describe('compareByUrgency', () => {
  const at = (state: 'unconfigured' | 'ok' | 'due_soon' | 'overdue', days: number | null) => ({
    state, daysRemaining: days, lastPerformedAt: null, nextDueAt: null,
  })

  it('vencidos primero, luego por días ascendente, grises al final', () => {
    const items = [at('ok', 75), at('unconfigured', null), at('overdue', -5), at('due_soon', 3)]
    const sorted = [...items].sort(compareByUrgency)
    expect(sorted.map((s) => s.state)).toEqual(['overdue', 'due_soon', 'ok', 'unconfigured'])
  })

  it('entre vencidos, el más vencido primero', () => {
    const sorted = [at('overdue', -2), at('overdue', -30)].sort(compareByUrgency)
    expect(sorted[0].daysRemaining).toBe(-30)
  })
})

describe('formatDaysRemaining', () => {
  const at = (state: 'unconfigured' | 'ok' | 'due_soon' | 'overdue', days: number | null) => ({
    state, daysRemaining: days, lastPerformedAt: null, nextDueAt: null,
  })

  it('formatea cada estado', () => {
    expect(formatDaysRemaining(at('unconfigured', null))).toBe('—')
    expect(formatDaysRemaining(at('ok', 75))).toBe('75 días')
    expect(formatDaysRemaining(at('due_soon', 1))).toBe('1 día')
    expect(formatDaysRemaining(at('due_soon', 0))).toBe('Vence hoy')
    expect(formatDaysRemaining(at('overdue', -1))).toBe('Vencido hace 1 día')
    expect(formatDaysRemaining(at('overdue', -8))).toBe('Vencido hace 8 días')
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx jest src/__tests__/lib/equipment-status.test.ts`
Expected: FAIL — `Cannot find module '@/lib/data/equipment-status'`

- [ ] **Step 3: Implementar**

Crear `src/lib/data/equipment-status.ts`:

```ts
/**
 * Lógica pura del semáforo de mantenimiento preventivo de equipos.
 * Fechas como strings 'YYYY-MM-DD' comparadas en UTC (sin off-by-one por TZ).
 */

export type MaintenanceState = 'unconfigured' | 'ok' | 'due_soon' | 'overdue'

export interface MaintenanceStatus {
  state: MaintenanceState
  lastPerformedAt: string | null
  nextDueAt: string | null
  daysRemaining: number | null
}

export const DUE_SOON_THRESHOLD_DAYS = 15

const MS_PER_DAY = 86_400_000

function toUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Fecha local de hoy como 'YYYY-MM-DD' (en-CA formatea exactamente así). */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function computeMaintenanceStatus(args: {
  frequencyDays: number | null
  lastPerformedAt: string | null
  today: string
}): MaintenanceStatus {
  const { frequencyDays, lastPerformedAt, today } = args
  if (frequencyDays === null || lastPerformedAt === null) {
    return { state: 'unconfigured', lastPerformedAt, nextDueAt: null, daysRemaining: null }
  }
  const nextMs = toUtcMs(lastPerformedAt) + frequencyDays * MS_PER_DAY
  const daysRemaining = Math.round((nextMs - toUtcMs(today)) / MS_PER_DAY)
  const state: MaintenanceState =
    daysRemaining < 0 ? 'overdue' : daysRemaining <= DUE_SOON_THRESHOLD_DAYS ? 'due_soon' : 'ok'
  return { state, lastPerformedAt, nextDueAt: fromUtcMs(nextMs), daysRemaining }
}

/** Última fecha de mantenimiento no anulado, o null. */
export function latestMaintenanceDate(
  maintenances: { performed_at: string; voided_at: string | null }[]
): string | null {
  let latest: string | null = null
  for (const m of maintenances) {
    if (m.voided_at) continue
    if (!latest || m.performed_at > latest) latest = m.performed_at
  }
  return latest
}

/** Orden: vencidos primero (más vencido arriba), luego días ascendente, grises al final. */
export function compareByUrgency(a: MaintenanceStatus, b: MaintenanceStatus): number {
  const key = (s: MaintenanceStatus) => (s.daysRemaining === null ? Infinity : s.daysRemaining)
  return key(a) - key(b)
}

export function formatDaysRemaining(status: MaintenanceStatus): string {
  const d = status.daysRemaining
  if (d === null) return '—'
  if (d === 0) return 'Vence hoy'
  if (d < 0) return `Vencido hace ${-d} ${-d === 1 ? 'día' : 'días'}`
  return `${d} ${d === 1 ? 'día' : 'días'}`
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx jest src/__tests__/lib/equipment-status.test.ts`
Expected: PASS (todos los tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/equipment-status.ts src/__tests__/lib/equipment-status.test.ts
git commit -m "feat(equipos): lógica pura del semáforo de mantenimiento preventivo"
```

---

### Task 3: Módulo de queries de equipos

**Files:**
- Create: `src/lib/supabase/queries/equipment.ts`
- Modify: `src/lib/supabase/queries/index.ts` (agregar `export * from './equipment'`)

**Interfaces:**
- Consumes: `DB`, `unwrap` de `./_helpers`; tipos `Tables`/`TablesInsert`/`TablesUpdate` de `../database.types` (Task 1).
- Produces (usado por Tasks 6, 7, 8):

```ts
export type EquipmentRow = Tables<'equipment'>
export type EquipmentMaintenanceRow = Tables<'equipment_maintenance'>
listEquipment(db: DB): Promise<EquipmentRow[]>                      // solo active, orden por name
getEquipment(db: DB, id: string): Promise<EquipmentRow | null>
createEquipment(db: DB, input: TablesInsert<'equipment'>): Promise<EquipmentRow>
updateEquipment(db: DB, id: string, patch: TablesUpdate<'equipment'>): Promise<EquipmentRow>
listLatestMaintenanceByEquipment(db: DB): Promise<Map<string, string>>  // equipment_id → performed_at más reciente (no anulado)
listMaintenanceByEquipment(db: DB, equipmentId: string): Promise<EquipmentMaintenanceRow[]>  // todos, incl. anulados, desc
createMaintenance(db: DB, input: TablesInsert<'equipment_maintenance'>): Promise<EquipmentMaintenanceRow>
voidMaintenance(db: DB, id: string, args: { voidedBy: string | null; reason: string }): Promise<void>
```

- [ ] **Step 1: Implementar el módulo**

Crear `src/lib/supabase/queries/equipment.ts`:

```ts
import type { Tables, TablesInsert, TablesUpdate } from '../database.types'
import { unwrap, unwrapOrNull, type DB } from './_helpers'

export type EquipmentRow = Tables<'equipment'>
export type EquipmentMaintenanceRow = Tables<'equipment_maintenance'>

export async function listEquipment(db: DB): Promise<EquipmentRow[]> {
  return unwrap(
    await db.from('equipment').select('*').eq('active', true).order('name')
  )
}

export async function getEquipment(db: DB, id: string): Promise<EquipmentRow | null> {
  return unwrapOrNull(
    await db.from('equipment').select('*').eq('id', id).maybeSingle()
  )
}

export async function createEquipment(
  db: DB,
  input: TablesInsert<'equipment'>
): Promise<EquipmentRow> {
  return unwrap(await db.from('equipment').insert(input).select().single())
}

export async function updateEquipment(
  db: DB,
  id: string,
  patch: TablesUpdate<'equipment'>
): Promise<EquipmentRow> {
  return unwrap(
    await db.from('equipment').update(patch).eq('id', id).select().single()
  )
}

/** equipment_id → performed_at más reciente (solo mantenimientos no anulados). */
export async function listLatestMaintenanceByEquipment(db: DB): Promise<Map<string, string>> {
  const rows = unwrap(
    await db
      .from('equipment_maintenance')
      .select('equipment_id, performed_at')
      .is('voided_at', null)
  )
  const map = new Map<string, string>()
  for (const r of rows) {
    const prev = map.get(r.equipment_id)
    if (!prev || r.performed_at > prev) map.set(r.equipment_id, r.performed_at)
  }
  return map
}

/** Historial completo (incluye anulados, para mostrarlos tachados), más reciente primero. */
export async function listMaintenanceByEquipment(
  db: DB,
  equipmentId: string
): Promise<EquipmentMaintenanceRow[]> {
  return unwrap(
    await db
      .from('equipment_maintenance')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('performed_at', { ascending: false })
  )
}

export async function createMaintenance(
  db: DB,
  input: TablesInsert<'equipment_maintenance'>
): Promise<EquipmentMaintenanceRow> {
  return unwrap(
    await db.from('equipment_maintenance').insert(input).select().single()
  )
}

export async function voidMaintenance(
  db: DB,
  id: string,
  args: { voidedBy: string | null; reason: string }
): Promise<void> {
  unwrap(
    await db
      .from('equipment_maintenance')
      .update({
        voided_at: new Date().toISOString(),
        voided_by: args.voidedBy,
        voided_reason: args.reason,
      })
      .eq('id', id)
      .select()
      .single()
  )
}
```

- [ ] **Step 2: Re-exportar**

En `src/lib/supabase/queries/index.ts` agregar (junto a los exports existentes):

```ts
export * from './equipment'
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/queries/equipment.ts src/lib/supabase/queries/index.ts
git commit -m "feat(equipos): queries de equipment y equipment_maintenance"
```

---

### Task 4: Semilla desde el Excel

**Files:**
- Create: `scripts/seed-equipment-supabase.py`

**Interfaces:**
- Consumes: `vault/inbox/BASE INSTALADA PTDP HOSPIMED ST SOFTWARE.xlsx` (hoja `Hoja1`; fila 3 = headers `EQUIPO, MARCA, MODELO, SERIAL, IDENTIFICACION, COMENTARIOS, PROVEEDOR` en columnas B–H; datos desde fila 4; 60 filas).
- Produces: filas en `public.equipment` con `maintenance_frequency_days = null`.

- [ ] **Step 1: Escribir el script**

Crear `scripts/seed-equipment-supabase.py`:

```python
#!/usr/bin/env python3
"""
Genera el SQL de seed de equipos (base instalada PTDP) para Supabase.

Lee el Excel del inbox e imprime un INSERT en stdout. La columna
"COMENTARIOS" del Excel es en realidad el dueño (CSS/HOSPIMED/HOSPIWASTE)
→ va a equipment.owner. maintenance_frequency_days queda NULL (se
configura en la app).

Idempotente a nivel tabla: solo inserta si equipment está vacía.

Uso:
    python scripts/seed-equipment-supabase.py > seed-equipment.sql
    # Aplicar vía MCP execute_sql o SQL editor de Supabase.
"""
from __future__ import annotations
from pathlib import Path
import openpyxl

XLSX = (
    Path(__file__).resolve().parent.parent
    / "vault" / "inbox" / "BASE INSTALADA PTDP HOSPIMED ST SOFTWARE.xlsx"
)

COLS = ["name", "brand", "model", "serial", "identification", "owner", "provider"]


def clean(value) -> str | None:
    """Normaliza celdas: números → str, strips de espacios, vacío → None."""
    if value is None:
        return None
    text = " ".join(str(value).split())  # colapsa espacios internos y bordes
    return text or None


def sql_literal(value: str | None) -> str:
    if value is None:
        return "null"
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["Hoja1"]
    rows = []
    for row in ws.iter_rows(min_row=4, min_col=2, max_col=8, values_only=True):
        values = [clean(v) for v in row]
        if values[0] is None:  # fila sin nombre de equipo → ignorar
            continue
        rows.append("(" + ", ".join(sql_literal(v) for v in values) + ")")

    print(f"-- Seed de {len(rows)} equipos (base instalada PTDP)")
    print("insert into public.equipment")
    print("  (name, brand, model, serial, identification, owner, provider)")
    print("select * from (values")
    print(",\n".join(rows))
    print(f") as v({', '.join(COLS)})")
    print("where not exists (select 1 from public.equipment);")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Generar el SQL y revisarlo**

Run: `python scripts/seed-equipment-supabase.py > seed-equipment.sql && head -8 seed-equipment.sql`
Expected: primera línea `-- Seed de 60 equipos (base instalada PTDP)` (60 filas de datos; si difiere en ±1 revisar el Excel a mano) y values como `('TRITURADOR', 'SILMISA', 'LINCE 52/150', '310', 'T3', 'CSS', 'HOSPIMED')` — sin espacios colgantes.

- [ ] **Step 3: Aplicar a Supabase**

Usar `mcp__plugin_supabase_supabase__execute_sql` con el contenido de `seed-equipment.sql`.
Luego verificar: `execute_sql` con `select count(*) from public.equipment;`
Expected: el mismo conteo que imprimió el script (60).

- [ ] **Step 4: Limpiar y commitear**

```bash
rm seed-equipment.sql
git add scripts/seed-equipment-supabase.py
git commit -m "feat(equipos): seed de la base instalada desde el Excel del inbox"
```

---

### Task 5: Navegación (sidebar + móvil)

**Files:**
- Modify: `src/components/layout/sidebar.tsx:5,25-29`
- Modify: `src/components/layout/mobile-bottom-nav.tsx:53-58`

**Interfaces:**
- Consumes: ruta `/equipment` (Task 6 la crea; la nav puede ir antes — el link 404ea hasta entonces, aceptable dentro de la misma rama).
- Produces: entrada "Equipos" visible solo para coordinador.

- [ ] **Step 1: Sidebar**

En `src/components/layout/sidebar.tsx`:
1. Agregar `Wrench` al import de lucide-react (línea 5).
2. En `TOP_NAV` agregar después de Tachos:

```ts
const TOP_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/containers', label: 'Tachos', icon: Package },
  { href: '/equipment', label: 'Equipos', icon: Wrench },
  { href: '/reports', label: 'Reportes', icon: FileText },
]
```

(El filtro existente `topNav = isCoordinator ? TOP_NAV : TOP_NAV.filter(...)` ya lo oculta a operadores — no tocar.)

- [ ] **Step 2: Nav móvil**

En `src/components/layout/mobile-bottom-nav.tsx`, agregar `Wrench` al import de lucide-react y en `MORE_LINKS` (el menú "más" de coordinador), después de la entrada de Tachos:

```ts
  { href: '/equipment', label: 'Equipos', icon: Wrench },
```

- [ ] **Step 3: Verificar que route-access NO cambia**

Confirmar que `/equipment` NO está en `OPERATOR_PATHS` de `src/lib/auth/route-access.ts` — así el operador queda bloqueado por el AuthGuard sin tocar nada.

- [ ] **Step 4: Build y commit**

Run: `npx next build`
Expected: OK.

```bash
git add src/components/layout/sidebar.tsx src/components/layout/mobile-bottom-nav.tsx
git commit -m "feat(equipos): entrada Equipos en la navegación de coordinador"
```

---

### Task 6: Página `/equipment` — tabla con semáforo, filtros y resumen

**Files:**
- Create: `src/app/equipment/page.tsx`
- Create: `src/components/equipment/equipment-table.tsx`

**Interfaces:**
- Consumes: `listEquipment`, `listLatestMaintenanceByEquipment` (Task 3); `computeMaintenanceStatus`, `compareByUrgency`, `formatDaysRemaining`, `todayISO`, tipos `MaintenanceStatus`/`MaintenanceState` (Task 2); `createClient` de `@/lib/supabase/client`.
- Produces: tipo `EquipmentTableRow` (exportado por `equipment-table.tsx`) y la ruta `/equipment`; el link de fila apunta a `/equipment/detail?id=<uuid>` (Task 7).

- [ ] **Step 1: Componente de tabla**

Crear `src/components/equipment/equipment-table.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatDaysRemaining, type MaintenanceStatus, type MaintenanceState } from '@/lib/data/equipment-status'

export interface EquipmentTableRow {
  id: string
  name: string
  identification: string | null
  brand: string | null
  model: string | null
  serial: string | null
  status: MaintenanceStatus
}

export const STATE_LABELS: Record<MaintenanceState, string> = {
  ok: 'Al día',
  due_soon: 'Próximo',
  overdue: 'Vencido',
  unconfigured: 'Sin configurar',
}

const STATE_DOT: Record<MaintenanceState, string> = {
  ok: 'bg-emerald-500',
  due_soon: 'bg-amber-400',
  overdue: 'bg-red-500',
  unconfigured: 'bg-slate-300',
}

const STATE_TEXT: Record<MaintenanceState, string> = {
  ok: 'text-emerald-700',
  due_soon: 'text-amber-700',
  overdue: 'text-red-700',
  unconfigured: 'text-slate-400',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function EquipmentTable({ rows }: { rows: EquipmentTableRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-slate-500 text-left">
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Equipo</th>
            <th className="px-4 py-3 font-medium">Marca / Modelo</th>
            <th className="px-4 py-3 font-medium">Último mantenimiento</th>
            <th className="px-4 py-3 font-medium">Próximo</th>
            <th className="px-4 py-3 font-medium">Días restantes</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <span className={cn('inline-flex items-center gap-2 font-medium', STATE_TEXT[r.status.state])}>
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', STATE_DOT[r.status.state])} />
                  {STATE_LABELS[r.status.state]}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link href={`/equipment/detail?id=${r.id}`} className="font-semibold text-slate-800 hover:underline">
                  {r.name}
                  {r.identification && <span className="text-slate-400 font-normal"> · {r.identification}</span>}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {[r.brand, r.model].filter(Boolean).join(' / ') || '—'}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDate(r.status.lastPerformedAt)}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(r.status.nextDueAt)}</td>
              <td className={cn('px-4 py-3 font-medium', STATE_TEXT[r.status.state])}>
                {formatDaysRemaining(r.status)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin equipos que coincidan con el filtro</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Página**

Crear `src/app/equipment/page.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import {
  computeMaintenanceStatus, compareByUrgency, todayISO,
  type MaintenanceState,
} from '@/lib/data/equipment-status'
import { EquipmentTable, STATE_LABELS, type EquipmentTableRow } from '@/components/equipment/equipment-table'

type StateFilter = MaintenanceState | 'all'

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<q.EquipmentRow[]>([])
  const [lastDates, setLastDates] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')

  useEffect(() => {
    const db = createClient()
    Promise.all([q.listEquipment(db), q.listLatestMaintenanceByEquipment(db)])
      .then(([eq, dates]) => { setEquipment(eq); setLastDates(dates) })
      .catch((err) => {
        console.error('[equipment] cargar equipos falló:', err)
        setError('No se pudieron cargar los equipos. Revisa tu conexión e intenta de nuevo.')
      })
      .finally(() => setLoading(false))
  }, [])

  const rows: EquipmentTableRow[] = useMemo(() => {
    const today = todayISO()
    return equipment
      .map((e) => ({
        id: e.id,
        name: e.name,
        identification: e.identification,
        brand: e.brand,
        model: e.model,
        serial: e.serial,
        status: computeMaintenanceStatus({
          frequencyDays: e.maintenance_frequency_days,
          lastPerformedAt: lastDates.get(e.id) ?? null,
          today,
        }),
      }))
      .sort((a, b) => compareByUrgency(a.status, b.status))
  }, [equipment, lastDates])

  const counts = useMemo(() => {
    const c: Record<MaintenanceState, number> = { overdue: 0, due_soon: 0, ok: 0, unconfigured: 0 }
    for (const r of rows) c[r.status.state]++
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (stateFilter !== 'all' && r.status.state !== stateFilter) return false
      if (!needle) return true
      return [r.name, r.identification, r.brand, r.model, r.serial]
        .some((v) => v?.toLowerCase().includes(needle))
    })
  }, [rows, search, stateFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Equipos</h1>
        <Button asChild className="gap-2">
          <Link href="/equipment/detail"><Plus className="h-4 w-4" />Nuevo equipo</Link>
        </Button>
      </div>

      <p className="text-sm text-slate-500">
        <span className="font-medium text-red-700">{counts.overdue} vencidos</span>
        {' · '}
        <span className="font-medium text-amber-700">{counts.due_soon} próximos</span>
        {' · '}
        <span className="font-medium text-emerald-700">{counts.ok} al día</span>
        {' · '}
        <span>{counts.unconfigured} sin configurar</span>
      </p>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar equipo, marca, identificación…"
            className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-72 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as StateFilter)}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Todos los estados</option>
          <option value="overdue">{STATE_LABELS.overdue}</option>
          <option value="due_soon">{STATE_LABELS.due_soon}</option>
          <option value="ok">{STATE_LABELS.ok}</option>
          <option value="unconfigured">{STATE_LABELS.unconfigured}</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-8"><Loader2 className="h-4 w-4 animate-spin" />Cargando equipos…</div>
      ) : (
        <EquipmentTable rows={filtered} />
      )}
    </div>
  )
}
```

Nota: el botón "Nuevo equipo" apunta a `/equipment/detail` **sin** `id` — Task 7 hace que esa ruta sin id muestre el formulario de creación.

- [ ] **Step 3: Build**

Run: `npx next build`
Expected: OK; la ruta `/equipment` aparece en el output del build.

- [ ] **Step 4: Commit**

```bash
git add src/app/equipment/page.tsx src/components/equipment/equipment-table.tsx
git commit -m "feat(equipos): tabla con semáforo, filtros y resumen en /equipment"
```

---

### Task 7: Detalle del equipo — crear, editar, frecuencia, desactivar

**Files:**
- Create: `src/components/equipment/equipment-form.tsx`
- Create: `src/app/equipment/detail/page.tsx`

**Interfaces:**
- Consumes: `getEquipment`, `createEquipment`, `updateEquipment`, tipo `EquipmentRow` (Task 3); `computeMaintenanceStatus`, `todayISO` (Task 2); `useStore((s) => s.currentProfileId)`; `ConfirmDialog` de `@/components/ui/confirm-dialog` NO se usa — la desactivación usa `window`-less confirm inline (botón con doble estado, ver código).
- Produces: ruta `/equipment/detail` (`?id=<uuid>` = ver/editar; sin id = crear). Task 8 se monta dentro de esta página (deja el placeholder `{/* TASK-8: historial de mantenimientos */}`).

- [ ] **Step 1: Formulario de equipo**

Crear `src/components/equipment/equipment-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export interface EquipmentFormValues {
  name: string
  brand: string | null
  model: string | null
  serial: string | null
  identification: string | null
  owner: string | null
  provider: string | null
  maintenance_frequency_days: number | null
}

interface Props {
  initial?: EquipmentFormValues
  submitLabel: string
  onSubmit: (values: EquipmentFormValues) => Promise<void>
  onCancel?: () => void
}

const FREQUENCY_SHORTCUTS = [
  { label: '1 mes', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 año', days: 365 },
]

const EMPTY: EquipmentFormValues = {
  name: '', brand: null, model: null, serial: null,
  identification: null, owner: null, provider: null,
  maintenance_frequency_days: null,
}

export function EquipmentForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<EquipmentFormValues>(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setText(field: keyof EquipmentFormValues, raw: string) {
    setValues((v) => ({ ...v, [field]: raw.trim() === '' ? null : raw }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) { setError('El nombre del equipo es obligatorio.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ ...values, name: values.name.trim() })
    } catch (err) {
      console.error('[equipment] guardar equipo falló:', err)
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const textField = (label: string, field: keyof EquipmentFormValues, required = false) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      <input
        value={(values[field] as string | null) ?? ''}
        onChange={(e) => field === 'name'
          ? setValues((v) => ({ ...v, name: e.target.value }))
          : setText(field, e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {textField('Nombre del equipo', 'name', true)}
        {textField('Identificación', 'identification')}
        {textField('Marca', 'brand')}
        {textField('Modelo', 'model')}
        {textField('Serial', 'serial')}
        {textField('Dueño', 'owner')}
        {textField('Proveedor', 'provider')}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Frecuencia de mantenimiento (días)</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            value={values.maintenance_frequency_days ?? ''}
            onChange={(e) => setValues((v) => ({
              ...v,
              maintenance_frequency_days: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
            }))}
            placeholder="Sin configurar"
            className="w-40 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          {FREQUENCY_SHORTCUTS.map(({ label, days }) => (
            <Button
              key={days}
              type="button"
              variant={values.maintenance_frequency_days === days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setValues((v) => ({ ...v, maintenance_frequency_days: days }))}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-slate-400">Sin frecuencia el equipo queda “Sin configurar” en el semáforo.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : submitLabel}</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Página de detalle**

Crear `src/app/equipment/detail/page.tsx`:

```tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { useStore } from '@/lib/store'
import { EquipmentForm, type EquipmentFormValues } from '@/components/equipment/equipment-form'

function EquipmentDetailInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const currentProfileId = useStore((s) => s.currentProfileId)

  const [equipment, setEquipment] = useState<q.EquipmentRow | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    const db = createClient()
    q.getEquipment(db, id)
      .then((row) => {
        if (!row) setError('Equipo no encontrado.')
        setEquipment(row)
      })
      .catch((err) => {
        console.error('[equipment] cargar equipo falló:', err)
        setError('No se pudo cargar el equipo.')
      })
      .finally(() => setLoading(false))
  }, [id, reloadKey])

  async function handleCreate(values: EquipmentFormValues) {
    const db = createClient()
    const row = await q.createEquipment(db, { ...values, created_by: currentProfileId })
    router.replace(`/equipment/detail?id=${row.id}`)
  }

  async function handleUpdate(values: EquipmentFormValues) {
    if (!equipment) return
    const db = createClient()
    const row = await q.updateEquipment(db, equipment.id, values)
    setEquipment(row)
  }

  async function handleDeactivate() {
    if (!equipment) return
    try {
      const db = createClient()
      await q.updateEquipment(db, equipment.id, { active: false })
      router.replace('/equipment')
    } catch (err) {
      console.error('[equipment] desactivar equipo falló:', err)
      setError('No se pudo desactivar el equipo.')
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-slate-500 py-8"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/equipment"><ArrowLeft className="h-4 w-4" />Equipos</Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-800">
          {id ? (equipment ? equipment.name : 'Equipo') : 'Nuevo equipo'}
          {equipment?.identification && <span className="text-slate-400 font-normal"> · {equipment.identification}</span>}
        </h1>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!id && (
        <Card>
          <CardHeader><CardTitle className="text-base">Datos del equipo</CardTitle></CardHeader>
          <CardContent>
            <EquipmentForm submitLabel="Crear equipo" onSubmit={handleCreate} onCancel={() => router.push('/equipment')} />
          </CardContent>
        </Card>
      )}

      {equipment && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Datos del equipo</CardTitle></CardHeader>
            <CardContent>
              <EquipmentForm
                initial={{
                  name: equipment.name,
                  brand: equipment.brand,
                  model: equipment.model,
                  serial: equipment.serial,
                  identification: equipment.identification,
                  owner: equipment.owner,
                  provider: equipment.provider,
                  maintenance_frequency_days: equipment.maintenance_frequency_days,
                }}
                submitLabel="Guardar cambios"
                onSubmit={handleUpdate}
              />
            </CardContent>
          </Card>

          {/* TASK-8: historial de mantenimientos */}

          <div className="pt-2 border-t">
            {confirmDeactivate ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">¿Desactivar este equipo? Deja de aparecer en la tabla.</span>
                <Button variant="outline" size="sm" onClick={() => setConfirmDeactivate(false)}>Cancelar</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeactivate}>Desactivar</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDeactivate(true)}>
                Desactivar equipo
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function EquipmentDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-slate-500 py-8"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>}>
      <EquipmentDetailInner />
    </Suspense>
  )
}
```

Nota: `reloadKey` queda listo para que Task 8 fuerce recarga tras registrar mantenimiento (`setReloadKey((k) => k + 1)`); si el linter marca `reloadKey` sin usar antes de Task 8, dejar el `useEffect` con dependencia `[id, reloadKey]` como está (es uso suficiente).

- [ ] **Step 3: Build**

Run: `npx next build`
Expected: OK; ruta `/equipment/detail` en el output.

- [ ] **Step 4: Commit**

```bash
git add src/components/equipment/equipment-form.tsx src/app/equipment/detail/page.tsx
git commit -m "feat(equipos): detalle con crear/editar equipo, frecuencia y desactivar"
```

---

### Task 8: Registrar mantenimiento + historial con fotos + anular

**Files:**
- Create: `src/components/equipment/maintenance-form.tsx`
- Create: `src/components/equipment/maintenance-history.tsx`
- Modify: `src/app/equipment/detail/page.tsx` (reemplazar el placeholder `{/* TASK-8: historial de mantenimientos */}`)

**Interfaces:**
- Consumes: `listMaintenanceByEquipment`, `createMaintenance`, `voidMaintenance`, tipo `EquipmentMaintenanceRow` (Task 3); `listPhotosByEvent`... **no** — usar `db.from('photos')` vía queries existentes: `q.listPhotosByEvent(db, 'maintenance', eventId)` y `q.getPhotoUrls(db, photos)` de `src/lib/supabase/queries/photos.ts`; `uploadEventPhotos` de `@/lib/data/photos`; `PhotoCaptureMulti` de `@/components/register/photo-capture-multi` (props: `label, required?, disabled?, photos: string[], onAdd(dataUrl), onRemove(index)`); `ConfirmVoidDialog` de `@/components/ui/confirm-void-dialog` (props: `title, description, confirmLabel, onCancel, onConfirm(reason)`); `todayISO` (Task 2); `useStore((s) => s.currentProfileId)` y `useStore((s) => s.users)` para mostrar quién registró.
- Produces: sección "Mantenimientos" completa dentro del detalle.

- [ ] **Step 1: Formulario de mantenimiento**

Crear `src/components/equipment/maintenance-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PhotoCaptureMulti } from '@/components/register/photo-capture-multi'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { uploadEventPhotos } from '@/lib/data/photos'
import { todayISO } from '@/lib/data/equipment-status'
import { useStore } from '@/lib/store'

interface Props {
  equipmentId: string
  equipmentName: string
  onSaved: () => void
  onCancel: () => void
}

export function MaintenanceForm({ equipmentId, equipmentName, onSaved, onCancel }: Props) {
  const currentProfileId = useStore((s) => s.currentProfileId)
  const [performedAt, setPerformedAt] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!performedAt) { setError('La fecha es obligatoria.'); return }
    setSaving(true)
    setError(null)
    try {
      const db = createClient()
      const row = await q.createMaintenance(db, {
        equipment_id: equipmentId,
        performed_at: performedAt,
        notes: notes.trim() || null,
        created_by: currentProfileId,
      })
      // Best-effort: si alguna foto falla, el mantenimiento ya quedó guardado.
      const uploaded = await uploadEventPhotos(db, {
        dataUrls: photos,
        eventType: 'maintenance',
        eventId: row.id,
        label: `Mantenimiento ${equipmentName}`,
        uploadedBy: currentProfileId,
      })
      if (uploaded.length < photos.length) {
        console.error('[equipment] algunas fotos no se subieron:', photos.length - uploaded.length)
      }
      onSaved()
    } catch (err) {
      console.error('[equipment] registrar mantenimiento falló:', err)
      setError('No se pudo registrar el mantenimiento. Revisa tu conexión e intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Fecha del mantenimiento <span className="text-red-600">*</span></label>
        <input
          type="date"
          value={performedAt}
          max={todayISO()}
          onChange={(e) => setPerformedAt(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Observaciones</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Ej.: cambio de aceite, revisión de resistencias…"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <PhotoCaptureMulti
        label="Fotos de evidencia (opcional)"
        photos={photos}
        onAdd={(dataUrl) => setPhotos((p) => [...p, dataUrl])}
        onRemove={(index) => setPhotos((p) => p.filter((_, i) => i !== index))}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Registrar mantenimiento'}</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Historial con fotos y anulación**

Crear `src/components/equipment/maintenance-history.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ConfirmVoidDialog } from '@/components/ui/confirm-void-dialog'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface Props {
  equipmentId: string
  /** Cambia para forzar recarga (tras registrar un mantenimiento). */
  reloadKey: number
  /** Avisa al padre que cambió el historial (para refrescar el semáforo si aplica). */
  onChanged: () => void
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function MaintenanceHistory({ equipmentId, reloadKey, onChanged }: Props) {
  const users = useStore((s) => s.users)
  const currentProfileId = useStore((s) => s.currentProfileId)
  const [items, setItems] = useState<q.EquipmentMaintenanceRow[]>([])
  const [photoUrls, setPhotoUrls] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [voiding, setVoiding] = useState<q.EquipmentMaintenanceRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const db = createClient()
    setLoading(true)
    q.listMaintenanceByEquipment(db, equipmentId)
      .then(async (rows) => {
        if (cancelled) return
        setItems(rows)
        // Fotos por mantenimiento (best-effort)
        const map = new Map<string, string[]>()
        for (const row of rows) {
          try {
            const photos = await q.listPhotosByEvent(db, 'maintenance', row.id)
            if (photos.length === 0) continue
            const urls = await q.getPhotoUrls(db, photos)
            map.set(row.id, photos.map((p) => urls.get(p.id)).filter((u): u is string => Boolean(u)))
          } catch (err) {
            console.error('[equipment] cargar fotos de mantenimiento falló:', err)
          }
        }
        if (!cancelled) setPhotoUrls(map)
      })
      .catch((err) => {
        console.error('[equipment] cargar historial falló:', err)
        if (!cancelled) setError('No se pudo cargar el historial de mantenimientos.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [equipmentId, reloadKey])

  async function handleVoid(reason: string) {
    if (!voiding) return
    try {
      const db = createClient()
      await q.voidMaintenance(db, voiding.id, { voidedBy: currentProfileId, reason })
      setVoiding(null)
      onChanged()
    } catch (err) {
      console.error('[equipment] anular mantenimiento falló:', err)
      setError('No se pudo anular el mantenimiento.')
      setVoiding(null)
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Cargando historial…</p>

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.length === 0 && <p className="text-sm text-slate-400">Sin mantenimientos registrados todavía.</p>}
      {items.map((m) => {
        const voided = Boolean(m.voided_at)
        const author = m.created_by ? users.find((u) => u.id === m.created_by)?.name ?? '—' : '—'
        const urls = photoUrls.get(m.id) ?? []
        return (
          <div key={m.id} className={cn('rounded-lg border p-4 space-y-2', voided ? 'bg-slate-50 opacity-70' : 'bg-white')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn('font-medium text-slate-800', voided && 'line-through')}>
                  {formatDate(m.performed_at)}
                  <span className="text-slate-400 font-normal"> · registrado por {author}</span>
                </p>
                {m.notes && <p className={cn('text-sm text-slate-600', voided && 'line-through')}>{m.notes}</p>}
                {voided && (
                  <p className="text-xs text-red-600">Anulado{m.voided_reason ? `: ${m.voided_reason}` : ''}</p>
                )}
              </div>
              {!voided && (
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0" onClick={() => setVoiding(m)}>
                  Anular
                </Button>
              )}
            </div>
            {urls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <Image src={url} alt={`Foto ${i + 1}`} width={96} height={96} className="h-24 w-24 rounded-md object-cover border" unoptimized />
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {voiding && (
        <ConfirmVoidDialog
          title="Anular mantenimiento"
          description={`Se anulará el mantenimiento del ${formatDate(voiding.performed_at)}. El semáforo dejará de contarlo.`}
          confirmLabel="Anular"
          onCancel={() => setVoiding(null)}
          onConfirm={handleVoid}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Integrar en el detalle**

En `src/app/equipment/detail/page.tsx`, reemplazar el comentario `{/* TASK-8: historial de mantenimientos */}` por:

```tsx
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Mantenimientos</CardTitle>
              {!showMaintenanceForm && (
                <Button size="sm" onClick={() => setShowMaintenanceForm(true)}>Registrar mantenimiento</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {showMaintenanceForm && (
                <div className="rounded-lg border bg-slate-50 p-4">
                  <MaintenanceForm
                    equipmentId={equipment.id}
                    equipmentName={equipment.name}
                    onSaved={() => { setShowMaintenanceForm(false); setReloadKey((k) => k + 1) }}
                    onCancel={() => setShowMaintenanceForm(false)}
                  />
                </div>
              )}
              <MaintenanceHistory
                equipmentId={equipment.id}
                reloadKey={reloadKey}
                onChanged={() => setReloadKey((k) => k + 1)}
              />
            </CardContent>
          </Card>
```

Y agregar en `EquipmentDetailInner`:
1. Estado: `const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)` (junto a los otros useState).
2. Imports: `import { MaintenanceForm } from '@/components/equipment/maintenance-form'` y `import { MaintenanceHistory } from '@/components/equipment/maintenance-history'`.

- [ ] **Step 4: Suite completa + build**

Run: `npm run test:jest`
Expected: PASS (suite completa, sin regresiones).

Run: `npx next build`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add src/components/equipment/maintenance-form.tsx src/components/equipment/maintenance-history.tsx src/app/equipment/detail/page.tsx
git commit -m "feat(equipos): registrar mantenimiento con fotos, historial y anulación"
```

---

### Task 9: Vault, inbox y cierre

**Files:**
- Create: `vault/modules/EquipmentMaintenance.md`
- Create: `vault/logs/2026-07-16-equipos-mantenimiento-preventivo.md`
- Modify: `vault/_index.md` (fila en la tabla de estado + link del log + nota de procesamiento)
- Move: `vault/inbox/BASE INSTALADA PTDP HOSPIMED ST SOFTWARE.xlsx` → `vault/inbox/procesado/`

- [ ] **Step 1: Documento del módulo**

Crear `vault/modules/EquipmentMaintenance.md`:

```markdown
---
title: Equipos — Mantenimiento preventivo
tags:
  - module
  - equipos
updated: 2026-07-16
---

# Equipos — Mantenimiento preventivo

Tab **Equipos** (solo coordinador): semáforo de mantenimiento preventivo de la
base instalada de la PTDP. Spec completo:
`docs/superpowers/specs/2026-07-16-equipos-mantenimiento-preventivo-design.md`.

## Modelo

- `equipment` — un registro por equipo físico; `maintenance_frequency_days`
  nullable (null = "Sin configurar"); `active` para baja lógica.
- `equipment_maintenance` — historial; anulación lógica (`voided_*`, espejo de
  `route_events`). Fotos en `photos` con `event_type = 'maintenance'`.
- Semilla: 60 equipos del Excel `BASE INSTALADA PTDP HOSPIMED ST SOFTWARE.xlsx`
  (en `inbox/procesado/`) vía `scripts/seed-equipment-supabase.py`.
  La columna "COMENTARIOS" del Excel es el **dueño** (CSS/HOSPIMED/HOSPIWASTE)
  → `equipment.owner`.

## Semáforo (lógica en `src/lib/data/equipment-status.ts`)

`próximo = último mantenimiento no anulado + frecuencia`. Estados:
🔴 vencido (< 0 días) · 🟡 próximo (≤ 15) · 🟢 al día (> 15) ·
⚪ sin configurar (sin frecuencia o sin mantenimiento). Umbral fijo 15 días.

## Decisiones

- **Módulo autónomo**: queries directas a Supabase (sin store/hydrator/outbox).
  Es flujo de coordinador en oficina; no infla la hidratación de operadores.
- Solo coordinador: `/equipment` no está en `OPERATOR_PATHS` → AuthGuard bloquea.
- Detalle vía `/equipment/detail?id=` (export estático, sin rutas dinámicas).
```

- [ ] **Step 2: Log del feature**

Crear `vault/logs/2026-07-16-equipos-mantenimiento-preventivo.md`:

```markdown
---
title: Equipos — mantenimiento preventivo (tab nueva)
tags:
  - log
  - equipos
date: 2026-07-16
---

# 2026-07-16 — Tab Equipos con mantenimiento preventivo

Nueva tab **Equipos** (solo coordinador) para la base instalada PTDP.

## Qué se hizo

- Migración `20260716000000_equipment_maintenance.sql`: tablas `equipment` y
  `equipment_maintenance` (anulación lógica) + valor `maintenance` en
  `photo_event_type` + RLS piloto. Aplicada al proyecto.
- Semilla de 60 equipos desde el Excel del inbox
  (`scripts/seed-equipment-supabase.py`), frecuencias en null.
- Lógica pura del semáforo en `src/lib/data/equipment-status.ts` (tests jest).
- `/equipment`: tabla ordenada por urgencia con semáforo, filtros
  (estado + búsqueda) y resumen de conteos.
- `/equipment/detail?id=`: editar datos + frecuencia (atajos 1/3/6/12 meses),
  registrar mantenimiento (fecha + observaciones + fotos vía
  `uploadEventPhotos`), historial con anulación por motivo, desactivar equipo.
- Nav: entrada "Equipos" en sidebar y menú móvil de coordinador.

## Ver también

- Spec: `docs/superpowers/specs/2026-07-16-equipos-mantenimiento-preventivo-design.md`
- Módulo: [[EquipmentMaintenance]]

## Pendiente

- E2E manual (registrar mantenimiento con fotos desde el navegador).
```

- [ ] **Step 3: Actualizar `vault/_index.md`**

1. En la tabla "Estado actual del proyecto", agregar al final:

```markdown
| Tab Equipos: mantenimiento preventivo (semáforo + historial + fotos) | 🟢 Completado (E2E manual pendiente) | `logs/2026-07-16-equipos-mantenimiento-preventivo.md` |
```

2. En "Logs de cambios", agregar arriba de la lista:

```markdown
- `logs/2026-07-16-equipos-mantenimiento-preventivo.md` — tab Equipos (solo coordinador): semáforo de mantenimiento preventivo, historial con fotos, seed de 60 equipos del Excel
```

3. En "Notas del último procesamiento", agregar arriba una nota fechada 2026-07-16 resumiendo: Excel de base instalada procesado → seed + módulo nuevo; archivo movido a `inbox/procesado/`; actualizar el campo "Última actualización del vault" a 2026-07-16.

- [ ] **Step 4: Mover el Excel a procesado**

El xlsx no está versionado en git, se mueve directo:

```bash
mv "vault/inbox/BASE INSTALADA PTDP HOSPIMED ST SOFTWARE.xlsx" "vault/inbox/procesado/"
```

- [ ] **Step 5: Verificación final**

Run: `npm run test:jest`
Expected: PASS completo.

Run: `npx next build`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add vault/
git commit -m "docs(vault): módulo y log de tab Equipos; Excel de base instalada procesado"
```
