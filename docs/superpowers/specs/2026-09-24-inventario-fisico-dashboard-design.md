# Inventario físico en la tarjeta "Flota y planta" — diseño

**Fecha:** 2026-09-24
**Estado:** aprobado en chat, pendiente de revisión del spec escrito

## Objetivo

La tarjeta "Flota y planta" del dashboard del hub muestra el mismo desglose que el inventario
físico de planta ("Inventario de Contenedores en Proceso.xlsx"):

- **Tachos de 240 L:** con llantas o sin llantas × limpios o en proceso.
- **Yaris de 1100 L:** rojos o verdes × limpios o en proceso.

## Decisiones del usuario

| Pregunta | Decisión |
|---|---|
| ¿De dónde sale "limpio / en proceso"? | **Del sistema, en vivo**: se calcula con los eventos registrados, no se copia del Excel |
| ¿Cómo se actualizan las llantas? | **Recargando el Excel** — no hay pantalla de edición |
| ¿Quién recarga el Excel? | **Un script del repo**: el usuario deja el Excel en `vault/inbox/` y el desarrollador lo corre |
| ¿Dónde se guardan los datos? | Dos columnas en `containers`, sin historial de cargas (enfoque A) |

## 1. Datos

Migración `supabase/migrations/20260924000000_containers_inventario_fisico.sql`:

```sql
alter table public.containers
  add column has_wheels boolean,          -- null = sin dato
  add column color text check (color in ('rojo', 'verde'));  -- null = sin dato
```

- Ambas columnas admiten `null`, que significa "sin dato", y ninguna tiene valor por defecto. Un
  contenedor que nunca apareció en el Excel queda sin dato, no se inventa un valor.
- En `shared/src/lib/types.ts`, `Container` suma `has_wheels?: boolean | null` y
  `color?: 'rojo' | 'verde' | null`.
- Se regeneran los tipos de Supabase. El hydrator y `rowToContainer` propagan las dos columnas.

## 2. Script de carga

`scripts/sync-inventario-fisico.py`, con el mismo estilo que `scripts/seed-containers-supabase.py`.

- **Entrada:** la ruta del Excel. Se lee la hoja "Data".
- **Cruce de filas:**
  - Columna 240 L: `N` → `str(N).zfill(3)`. Si el número trae texto, como en `192 ION`, se toma
    solo el número.
  - Columna 1100 L: `N` → `Y{N}`.
- **Traducción de valores:**
  - "Con llantas …" → `has_wheels = true`.
  - "Sin llantas …" → `has_wheels = false`.
  - "… rojos" → `color = 'rojo'`.
  - "… Verde" → `color = 'verde'`.
- **Qué escribe:** solo `has_wheels` y `color`. Nunca toca `status`, `tare_weight_kg` ni otras columnas.
- **Por defecto es una corrida en seco:** imprime qué cambiaría y lo que no pudo cruzar. Los
  cambios se aplican solo con `--apply`.
- **Qué informa sin cargar:**
  - Filas sin número, como los Yaris verdes de hoy.
  - Números que no existen en `containers`.
  - Contenedores activos que no aparecen en el Excel.
- La columna "limpio / en proceso" del Excel **se ignora**, porque ese estado se calcula en vivo.

## 3. Limpio / en proceso en vivo

Se reutiliza `computeCirculationBucket` de `shared/src/lib/data/dashboard-metrics.ts`, sin lógica
de estados nueva:

| Bucket de circulación | Estado en la tarjeta |
|---|---|
| `en_planta`, `en_cliente`, `sin_actividad` | Limpio |
| `pendiente_pesar`, `pendiente_tratar` | En proceso |

## 4. Cálculo del desglose

Nueva función pura en `shared/src/lib/data/dashboard-analytics.ts`:

```ts
export interface PhysicalInventoryRow { label: string; clean: number; inProcess: number }
export interface PhysicalInventory {
  tachos: PhysicalInventoryRow[]  // Con llantas, Sin llantas, Sin dato (solo si > 0)
  yaris: PhysicalInventoryRow[]   // Rojos, Verdes, Sin dato (solo si > 0)
}
export function computePhysicalInventory(slice: CirculationStoreSlice): PhysicalInventory
```

- Solo cuenta contenedores `status === 'active'`.
- Tachos = `size_liters === 240`. Yaris = `is_yaris_container`. Los metálicos no entran en este bloque.
- La fila "Verdes" siempre se muestra, aunque tenga cero, porque es parte del inventario físico.
  Las filas "Sin dato" se muestran solo si tienen algún contenedor.

## 5. Tarjeta

En `hub/src/components/dashboard/fleet-section.tsx` se agrega un bloque "Inventario físico" entre
"Por tamaño / Por empresa" y los indicadores de tratamientos y traslados:

```
Inventario físico     Limpios  En proceso
240 L
  Con llantas             112          27
  Sin llantas               9          31
1100 L (Yaris)
  Rojos                    20           5
  Verdes                    0           0
```

- Números con `tabular-nums` y alineados a la derecha, con el mismo estilo que las listas actuales.
- `FleetBreakdown` suma `physicalInventory: PhysicalInventory`. La página del dashboard lo pasa
  igual que el resto del desglose.

## 6. Pruebas

- Jest para `computePhysicalInventory`:
  - Con llantas / sin llantas / sin dato.
  - Yaris rojo / verde / sin dato.
  - Excluye los contenedores de baja y los metálicos.
  - Cada bucket cae en su estado correcto.
- Corrida en seco del script contra `docs/fuentes/Inventario de Contenedores en Proceso (1).xlsx`
  antes de aplicarlo en el piloto.
- `npm run build:hub` sin errores.

## Límites conocidos

- Mientras planta no registre tratamientos (los teléfonos siguen en v1.5), la columna
  "En proceso" sale inflada. Es un problema de los datos que llegan, no de la tarjeta.
- Los Yaris verdes aparecen en cero hasta que se defina su numeración y se den de alta.
- Las llantas quedan como estaban en la última carga del Excel.

## Fuera de alcance

- Pantalla para editar las llantas o el color.
- Historial de cargas del inventario.
- Subir el Excel desde el hub.
