# Diseño — Tachos metálicos M1-M15 + tipo de desecho "Metálicos No reutilizables"

**Fecha:** 2026-06-01
**Estado:** Aprobado (pendiente revisión del spec escrito)
**Rama:** `feat/recorridos-pesaje-reportes-dashboard`

## Contexto

La planta incorpora 15 tachos nuevos de 120 L con nomenclatura **M1…M15**, dedicados
exclusivamente al pesaje de **piezas metálicas**. Funcionan de forma análoga a los tachos
dedicados a Yaris (ver `is_yaris_dedicated`, log `2026-05-25-pesaje-ux-yaris-recorridos-modal.md`):
están **siempre disponibles** para pesar (no requieren un recorrido previo) y solo aparecen
como opción cuando corresponde.

La diferencia clave con Yaris: el disparador de los tachos metálicos **no es un toggle manual**,
sino la **selección del tipo de desecho**. El tipo **"Metálicos No reutilizables"** no existe hoy
(el enum tiene 5: infeccioso, anatomopatológico, citotóxico, líquidos, morgue) y se agrega como 6º
(valor de enum `'metallic'`, label visible "Metálicos No reutilizables").

Coherente con el ADR `2026-05-30-empresa-tipo-dinamicos-tacho.md`: el tipo de desecho va
**desvinculado del tacho** (es input del operador en el pesaje) y la empresa del tacho es
dinámica. Los tachos metálicos, al no pasar por recorrido, **no pertenecen a ninguna empresa**
(`company_id = null`, columna ya nullable desde `20260521020000_containers_company_id_nullable.sql`).

## Decisiones tomadas (brainstorming)

1. **Yaris y "Metálicos No reutilizables" son conceptos distintos.** Yaris conserva su toggle
   manual; metálico es un nuevo tipo de desecho que dispara su propia lista de tachos.
2. **M1-M15 siempre disponibles** (como Yaris), sin recorrido previo.
3. **Post-pesaje = cámara fría** (rama no-infecciosa), igual que anatomopatológico/citotóxico/etc.
4. **Los 17 tachos Yaris se configuran en esta entrega** (seed por migración).
5. **`company_id = null`** para los M (validado contra el ADR; columna nullable).
6. **Taras reales** provistas por el usuario (ver tabla de seed).

## Alcance

### 1. Nuevo tipo de desecho `'metallic'`
- Postgres: `ALTER TYPE waste_type ADD VALUE 'metallic'`.
- `src/lib/types.ts`: agregar `'metallic'` a `WasteType`.
- `src/lib/supabase/database.types.ts`: agregar `'metallic'` al enum `waste_type`.
- `src/components/register/weighing-form.tsx`: `WASTE_LABELS.metallic = 'Metálicos No reutilizables'`.

### 2. Flag `is_metallic_dedicated` (espejo de `is_yaris_dedicated`)
- Migración: `ALTER TABLE public.containers ADD COLUMN is_metallic_dedicated boolean not null default false` + comment.
- `src/lib/types.ts`: `Container.is_metallic_dedicated?: boolean`.
- `src/lib/supabase/database.types.ts`: campo en Row/Insert/Update de `containers`.
- `src/components/supabase-hydrator.tsx`: mapear `is_metallic_dedicated`.

### 3. Tamaño 120 L
- Postgres: `ALTER TYPE container_size ADD VALUE '120'`.
- `src/lib/types.ts`: `ContainerSize = 120 | 240 | 750 | 1100`.
- `src/lib/supabase/database.types.ts`: `'120'` en el enum `container_size`.
- `src/components/admin/container-form.tsx`: opción `{ value: 120, label: '120 L' }` en `SIZE_OPTIONS`.

### 4. Comportamiento en Pesaje (`weighing-form.tsx` + `register/weighing/page.tsx`)

**Página (`page.tsx`):**
- Calcular `metallicContainers = containers.filter(c => c.is_metallic_dedicated && c.status === 'active')`.
- `availableContainers` (cola normal) excluye también los metálicos:
  `pendingIds.has(c.id) && !c.is_yaris_dedicated && !c.is_metallic_dedicated`.
- Pasar `metallicContainers` a `WeighingForm`.

**Formulario (`weighing-form.tsx`):**
- `isMetallic = state.waste_type === 'metallic'`.
- El selector principal "Número de tacho" cambia su fuente:
  - Yaris activo → (selector "Tacho Yaris" separado, sin cambios).
  - `isMetallic` → `metallicContainers` (M1-M15).
  - resto → `availableContainers` (cola de recorrido).
- Al cambiar `waste_type` hacia/desde `'metallic'` se limpia `container_id` (como hace `toggleYaris`).
  Implementado en el handler de cambio de tipo del formulario.
- **Mutua exclusión Yaris ↔ metálico:**
  - Con `isMetallic`, ocultar el toggle "¿Es un pesaje de Yaris?".
  - Si se activa Yaris estando en metálico, resetear `waste_type` a `'infectious'`.
- Badge "Tacho metálico" al seleccionar un tacho con `is_metallic_dedicated` (espejo de "Dedicado a Yaris").
- Placeholder del selector cuando `isMetallic` y no hay metálicos: "No hay tachos metálicos configurados".

### 5. Post-pesaje
- Sin cambios. Metálico cae en la rama `else` de `handleFinish` → `cold_storage`.
- El check "tratar inmediatamente" sigue mostrándose solo para `waste_type === 'infectious'`.

### 6. Seed (migración SQL)

**Marcar Yaris (17):**
```sql
UPDATE public.containers SET is_yaris_dedicated = true
WHERE id IN ('A-020','A-042','A-044','A-046','A-048','A-051','A-064','A-065',
             'A-068','A-069','A-072','A-076','A-078','A-105','A-154','A-175','A-187');
```

**Insertar metálicos (15):** `company_id = null`, `size_liters = '120'`,
`is_metallic_dedicated = true`, `status = 'active'`, taras reales:

| Tacho | Tara | Tacho | Tara | Tacho | Tara |
|-------|------|-------|------|-------|------|
| M1 | 8.7 | M6 | 9.0 | M11 | 9.1 |
| M2 | 8.7 | M7 | 9.0 | M12 | 8.7 |
| M3 | 8.9 | M8 | 8.8 | M13 | 8.9 |
| M4 | 8.9 | M9 | 9.2 | M14 | 8.7 |
| M5 | 9.1 | M10 | 9.2 | M15 | 9.1 |

Se muestran como "M1"…"M15" (sin prefijo; `formatTachoNumber` deja igual los ids sin guion).

> Nota Postgres: `ALTER TYPE ... ADD VALUE` no puede ejecutarse en el mismo bloque transaccional
> donde se usa el nuevo valor. La migración debe separar el `ADD VALUE` del `INSERT`/`UPDATE`
> (commits distintos o `ALTER TYPE ... ADD VALUE` fuera de transacción). Se resuelve en el plan.

### 7. Admin (paridad con Yaris)
- `/admin/containers`: columna "Metálico" + toggle por fila (espejo de `toggleYaris`).
- `container-form.tsx`: checkbox "Tacho dedicado a metálico", opción 120 L, y **empresa opcional**
  (los metálicos se crean sin empresa). El `id` del tacho metálico se ingresa libre (M1…) sin
  prefijo de empresa.

### Impacto en reportes
- Receptions metálicas: `company_id = null` (sin recorrido) → agrupadas como huérfanas por fecha,
  igual que Yaris/histórico. **Sin cambios de código en reportes.**

### Mock offline (`src/lib/mock-data.ts`)
- Agregar los 15 tachos M1-M15 al mock para que el modo offline/dev funcione.
- Marcar `is_yaris_dedicated` en los 17 Airkem correspondientes del mock (best-effort; no afecta prod).

## Fuera de alcance (YAGNI)
- Flujo de tratamiento/reciclaje específico para metálico (va a cámara fría como el resto).
- Reportes separados por tipo metálico.
- Renumeración física del pool.

## Archivos afectados (resumen)
- `supabase/migrations/<nueva>_*.sql` (waste_type, container_size, is_metallic_dedicated, seed)
- `src/lib/types.ts`
- `src/lib/supabase/database.types.ts`
- `src/components/supabase-hydrator.tsx`
- `src/components/register/weighing-form.tsx`
- `src/app/register/weighing/page.tsx`
- `src/components/admin/container-form.tsx`
- `src/app/admin/containers/page.tsx`
- `src/lib/mock-data.ts`
- Vault: `processes/WasteTypes.md`, log `logs/2026-06-01-tachos-metalicos.md`, `_index.md`
