---
title: Data Model
tags:
  - project
  - data
  - types
updated: 2026-09-24
---

# Modelo de Datos Conceptual

> [!note] Actualización 2026-05-17
> Cambios estructurales del rediseño operativo:
> - Aparece la entidad **Company** (Empresa) como nivel intermedio entre Client y Container. Los envases ahora pertenecen a Empresa, no a Cliente directamente.
> - El antiguo `code_letter` de Client se movió a Company.
> - `ExchangeEvent` → renombrado a **`RouteEvent`** (Recorrido) y enriquecido con `slot`, `started_at`, `ended_at`, `status`, `floor`, `area`, `dock`.
> - Aparece **`WeighingSession`** que agrupa N receptions del mismo turno de pesaje.
> - Se **elimina** la entidad `Batch` — las unidades operativas pasan a ser RouteEvent (por slot/día) y WeighingSession (por turno).

## Entidades principales

### Container (Envase)
Identificador físico real. **Independiente: NO pertenece a ninguna empresa.** La
empresa es propiedad del *registro* (recorrido / pesaje), no del tacho — un mismo
tacho pasa por distintas empresas a lo largo de su vida. Ver
[[2026-06-10-empresa-por-registro]].

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | Identificador físico: `001`, `M1`, `Y1` (en Supabase, sin prefijo de empresa — ver [[2026-06-01-ids-tachos-supabase-vs-mock]]) |
| size_liters | enum | 120 / 240 / 750 / 1100 |
| tare_weight_kg | decimal | Peso en vacío, se registra una sola vez al dar de alta |
| waste_type | enum | Ver [[WasteTypes]] |
| status | enum | `active` / `decommissioned` |
| registered_at | datetime | Fecha de alta en el sistema |
| is_yaris_dedicated | boolean | ⚠️ **Deprecado 2026-09-07**. Marcaba el tacho con el que se pesaba una carga Yaris cuando la flota no tenía balanza. Hoy siempre `false`; la columna sobrevive por el histórico y nada la lee. Ver [[2026-09-07-yaris-pesaje-directo]] |
| is_metallic_dedicated | boolean | Tacho dedicado a "Metálicos No reutilizables" |
| is_yaris_container | boolean | **Contenedor físico** de la flota Yaris (`Y1`…`Y26`, 1100 L): sin empresa, con tara real desde 2026-09-07. Desde esa fecha se pesa directamente y entra en la cola de pesaje y en el dashboard como cualquier tacho; la bandera solo lo identifica. Ver [[2026-09-07-yaris-pesaje-directo]] |
| created_by | FK → Profile / null | Quién registró el tacho. Null para históricos importados. Ver [[2026-06-10-recorrido-fotos-persistencia-traza]] |

- **Atributos físicos (desde 2026-09-24):** `has_wheels` (con/sin llantas) y `color` (Yaris rojo/verde).
  Vienen del Excel de inventario de planta y se cargan con `scripts/sync_inventario_fisico.py`;
  no hay pantalla de edición. `null` = sin dato. El estado limpio / en proceso **no** se guarda:
  se deriva en vivo de la circulación. Ver [[2026-09-24-inventario-fisico-dashboard]].

> [!note] Desactualizado en esta tabla: `waste_type` ya **no** es columna de `containers`
> (se eliminó; el tipo de desecho es input de pesaje). Ver [[2026-05-30-empresa-tipo-dinamicos-tacho]].

### Client (Cliente)
Entidad legal a la que se le presta el servicio. Agrupa varias Empresas.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| name | string | ej: "Centro de la Salud" |
| locations | array | Ubicaciones / pisos donde tiene contenedores |

> [!note]
> El antiguo campo `code_letter` ya **no existe** en Client. Pasó a vivir en Company.

### Company (Empresa)
Operación interna del cliente. Los envases se identifican por su prefijo. Ej: ION (I) y Airkem (A) dentro de "Centro de la Salud".

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| client_id | FK → Client | Cliente padre |
| name | string | ej: "ION", "Airkem" |
| code_letter | string | Letra única — prefijo de envases |

### RouteEvent (Recorrido)
Antes llamado `ExchangeEvent`. Registro de un recorrido completo: intercambio limpio↔sucio en un punto de encuentro durante un slot horario fijo.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| client_id | FK → Client | Un recorrido pertenece a un cliente |
| slot | enum `RouteSlot` | `'06:30' \| '10:30' \| '13:20' \| '14:30' \| '18:30' \| '21:00'` |
| date | date | `YYYY-MM-DD` — junto con slot, identifica un único recorrido por día |
| started_at | datetime | Cuando se tocó "Iniciar recorrido" |
| ended_at | datetime / null | null mientras está en curso |
| operator_id | FK → User | |
| status | enum | `'in_progress'` / `'completed'` |
| company_id | FK → Company / null | Empresa de ESTE registro (snapshot). Ver [[2026-06-10-empresa-por-registro]] |
| containers_dirty_received | array FK → Container | Tachos sucios recogidos (van a pesaje) |
| containers_clean_delivered | array FK → Container | Tachos limpios entregados al cliente |
| area | string | Ubicación del recorrido (único selector activo). |
| photo_ids | array FK → Photo | Unión de fotos del recorrido (lo usan los reportes) |
| dirty_photo_ids | array FK → Photo | Fotos de tachos sucios (campo solo-store, derivado por `photos.role`) |
| clean_photo_ids | array FK → Photo | Fotos de tachos limpios (campo solo-store, derivado por `photos.role`) |

> [!note] 2026-06-10 — `floor` y `dock` se **eliminaron** de `route_events` (columnas
> muertas, siempre `""`). La ubicación vive en `area`. Las fotos de recorrido se separan
> en sucios/limpios vía `photos.role`. Ver [[2026-06-10-recorrido-fotos-persistencia-traza]].

Los **slots** son fijos: 6:30 AM, 10:30 AM, 1:20 PM, 2:30 PM, 6:30 PM, 9:00 PM. Para `anden` cada andén es un `route_event` agrupado por (date, slot) — pueden coexistir varios (multi-andén).

### WeighingSession (Sesión de pesaje)
Agrupa todas las recepciones pesadas durante una misma sesión (cronómetro entre "Iniciar pesaje" y "Finalizar pesaje").

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| client_id | FK → Client | |
| date | date | `YYYY-MM-DD` |
| started_at | datetime | |
| ended_at | datetime / null | null mientras está activa |
| operator_id | FK → User | |
| status | enum | `'in_progress'` / `'completed'` |
| reception_ids | array FK → ContainerReception | Receptions creadas dentro de la sesión |

### ContainerReception (Recepción / Pesaje individual)

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| weighing_session_id | FK → WeighingSession / null | Asociación a una sesión |
| arrived_at | datetime | |
| gross_weight_kg | decimal | |
| net_weight_kg | decimal (computed) | `gross_weight - container.tare_weight` |
| operator_id | FK → User | |
| photo_ids | array FK → Photo | Foto del envase + foto de balanza |

### StorageEvent, TreatmentRun, ExternalTransfer
Sin cambios estructurales — solo se quitó el `batch_id` (que ya no existe).

> [!note] 2026-06-10 — `storage_events` y `container_locations` **ahora se persisten** a
> Supabase (antes el write-through se quedaba en el store local → 0 filas, causa del bug
> cross-device de tratamiento). El hydrator carga las 4 tablas posteriores
> (`storage_events`, `treatment_runs`, `external_transfers`, `container_locations`).
> `client_locations` y `external_transfers` siguen **sin cablear** (0 filas):
> `external_transfers` espera la pantalla de traslado "en construcción", no es obsoleta.

### Photo

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| url | string | |
| event_type | enum | `'route'` / `'weighing'` / `'storage'` / `'treatment'` / `'other'` |
| event_id | string | FK polimórfico al evento correspondiente |
| taken_at | datetime | |
| label | string | ej: "PTDP Centro Salud 17/05/2026 07:00 AM" |
| role | string / null | Rol en el evento. Recorrido: `'dirty'` / `'clean'`. Null en pesaje (posicional) y resto. Ver [[2026-06-10-recorrido-fotos-persistencia-traza]] |

## Relaciones clave

- Un `Client` tiene muchas `Company`
- Un `Container` es **independiente** (sin empresa); su empresa "actual" se deriva del último registro
- La empresa de un `RouteEvent` y de un `ContainerReception` es del **registro** (snapshot), no del tacho
- Un `Container` tiene muchos `ContainerReception` (histórico)
- Un `RouteEvent` agrupa N envases intercambiados por (slot, día)
- Un `WeighingSession` agrupa N receptions de una misma jornada de pesaje

### HistoricalDailyKg (Histórico de kilos, pre-sistema)

Kilos de la operación **anterior** a que el sistema empezara a registrar: desde
que arrancó PTDP en enero de 2024 hasta el **2026-09-06**. Vive en
`historical_daily_kg`, agregado por **día y empresa**, y es deliberadamente una
entidad aparte de `ContainerReception`: no tiene operador, foto, sesión ni tacho
trazable, así que no participa de la trazabilidad, de la cola de pesaje ni del
ciclo del tacho. Solo alimenta métricas agregadas.

La frontera con el sistema es exacta y sin solapamiento:

```
histórico   2024-01-15 ─────────────► 2026-09-06
sistema                               2026-09-07 ────────►
```

Guarda suma **y** conteo (kilos, pesajes, carros distintos), de modo que
cualquier promedio sale exacto en cualquier nivel de agrupación. Trae también
kilos tratados por día, pero **no son comparables** contra los recibidos: la
fecha de tratado era opcional en el formulario de planta y su cobertura va del
42% al 84% según el año.

Razón de la separación y detalle de la limpieza en
[[2026-09-14-historico-kilos-2024-2026]].

## Reportes

El entregable de la directiva es un **PDF de Registro Fotográfico semanal por Cliente** (consolida todas las empresas hijas). Rango: lunes 00:00 → hoy 23:59 (cuando se genera un viernes cubre toda la semana). Orden: por etapa (recorrido → pesaje) y dentro de cada etapa, por empresa.

El segundo entregable es el **Comparativo de kilos** (`/reports/comparativo`):
kilos recibidos de un rango libre contra el mismo rango del año anterior, con
desglose mes a mes, participación por empresa y totales por año. Une el
histórico con lo que registra el sistema en una sola serie, así que el corte del
2026-09-07 no se ve como un escalón.

## Peso neto

`net_weight_kg = gross_weight_kg - container.tare_weight_kg`

Es el valor que se factura al cliente.
