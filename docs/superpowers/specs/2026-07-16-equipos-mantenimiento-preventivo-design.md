# Equipos — Mantenimiento preventivo (diseño)

**Fecha:** 2026-07-16
**Estado:** Aprobado en brainstorming, pendiente de plan de implementación

## Objetivo

Nueva tab **"Equipos"** (solo coordinador) para dar seguimiento al mantenimiento
preventivo de la base instalada en la PTDP: una tabla con semáforo que indica
cuándo toca el mantenimiento de cada equipo, cuántos días quedan y si está
vencido. La base instalada viene del Excel
`vault/inbox/BASE INSTALADA PTDP HOSPIMED ST SOFTWARE.xlsx` (61 equipos).

## Decisiones de alcance (validadas con el usuario)

1. **Frecuencia configurable por equipo dentro de la app** (en días); el
   semáforo se calcula desde la fecha del último mantenimiento registrado.
2. Registrar un mantenimiento captura: **fecha + observaciones + fotos** de
   evidencia. Se conserva el **historial** completo por equipo.
3. **Solo el coordinador** ve la tab, configura frecuencias y registra
   mantenimientos. Operadores no la ven.
4. Semáforo con umbral fijo: 🟢 al día (> 15 días) · 🟡 próximo (≤ 15 días) ·
   🔴 vencido · ⚪ gris "sin configurar" (sin frecuencia o sin ningún
   mantenimiento registrado).
5. El Excel se carga **una vez como semilla**; después la app permite
   crear/editar/desactivar equipos.

## Enfoque elegido

**Módulo autónomo con queries directas a Supabase** (sin store Zustand, sin
hydrator, sin outbox offline). Es un flujo de coordinador en oficina con
internet; no tocar el aparato local-first del flujo operativo reduce riesgo y
código. Las fotos reutilizan la tabla `photos` y el helper `uploadEventPhotos`.

Se descartó integrarlo al patrón store+hydrator: más trabajo, infla el payload
de hidratación que también cargan los operadores, y no aporta nada a un módulo
online-only.

## Modelo de datos (migración Supabase)

### Tabla `equipment`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | ej. "TRITURADOR" |
| `brand` | text nullable | |
| `model` | text nullable | |
| `serial` | text nullable | |
| `identification` | text nullable | ej. "T3" — distingue duplicados legítimos |
| `owner` | text nullable | CSS / HOSPIMED / HOSPIWASTE (columna "COMENTARIOS" del Excel) |
| `provider` | text nullable | |
| `maintenance_frequency_days` | int nullable | null = sin configurar → semáforo gris |
| `active` | boolean default true | desactivación sin borrar |
| `created_at`, `created_by` | | |

### Tabla `equipment_maintenance`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `equipment_id` | uuid FK → equipment | |
| `performed_at` | date | fecha del mantenimiento (default hoy en UI) |
| `notes` | text nullable | observaciones |
| `created_by`, `created_at` | | |
| `voided_at`, `voided_by`, `voided_reason` | | anulación lógica, espejo de `route_events` |

### Fotos

Nuevo valor `maintenance` en el enum `photo_event_type`. Cada foto apunta con
`event_id` al registro de `equipment_maintenance`. Subida con
`uploadEventPhotos` (best-effort: si una foto falla, el mantenimiento se guarda
igual y se avisa).

### RLS

Policy "authenticated full access" del piloto, como el resto de tablas. La
restricción a coordinador es UI + middleware, igual que Admin.

## Lógica del semáforo (derivada, no se persiste)

```
último = max(performed_at) de mantenimientos no anulados
próximo = último + maintenance_frequency_days
días restantes = próximo - hoy
```

| Estado | Condición |
|---|---|
| ⚪ Sin configurar | sin frecuencia o sin mantenimientos registrados |
| 🟢 Al día | días restantes > 15 |
| 🟡 Próximo | 0 ≤ días restantes ≤ 15 |
| 🔴 Vencido | días restantes < 0 — mostrar "Vencido hace N días" |

Lógica en funciones puras testeables (módulo en `src/lib/`).

## Semilla

Script único en `scripts/` que lee el Excel del inbox e inserta los 61 equipos
con `maintenance_frequency_days = null`. Los duplicados legítimos (6 carritos
de transporte, 12 baldes inox, etc.) entran como filas separadas distinguidas
por `identification`. Normalizar espacios sobrantes del Excel (ej.
"TRITURADOR ", "HOSPIWASTE ").

## UI

### Navegación

- Entrada **"Equipos"** en `TOP_NAV` del sidebar (`src/components/layout/sidebar.tsx`),
  ícono `Wrench` (lucide), visible solo para coordinador (misma regla que
  Tachos y Reportes). Ídem en la navegación móvil de coordinador si aplica.

### Página `/equipment` — tabla

- Columnas: Semáforo (punto de color + etiqueta) · Equipo (nombre +
  identificación) · Marca/Modelo · Último mantenimiento · Próximo · Días
  restantes ("12 días" / "Vencido hace 8 días" / "—").
- Orden por urgencia: vencidos primero, luego días restantes ascendente,
  grises al final.
- Filtros: estado del semáforo + búsqueda por texto (nombre/serial/
  identificación), estilo tab de Tachos.
- Resumen superior: "N vencidos · N próximos · N al día · N sin configurar".
- Botón "Nuevo equipo".
- Solo se listan equipos `active = true`.

### Detalle del equipo (clic en fila)

- Datos del equipo editables + campo frecuencia en días con atajos
  (1 mes / 3 meses / 6 meses / 1 año).
- Historial de mantenimientos: fecha, quién registró, notas, fotos; anular
  con motivo obligatorio.
- Botón "Registrar mantenimiento": fecha (default hoy), observaciones, fotos
  opcionales con `PhotoCaptureMulti`.
- Desactivar equipo desde el detalle.

## Manejo de errores

Mutaciones directas a Supabase con toast de error si fallan. Sin outbox
offline. Fotos best-effort (patrón existente).

## Pruebas

- Jest para la lógica pura del semáforo: cálculo de próximo, días restantes,
  los 4 estados, orden por urgencia, exclusión de mantenimientos anulados.
- `next build` + E2E manual para la UI (criterio del resto de la app).
