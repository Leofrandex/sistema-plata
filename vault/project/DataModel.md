---
title: Data Model
tags:
  - project
  - data
  - types
updated: 2026-05-17
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
`decisions/2026-06-10-empresa-por-registro.md`.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | Identificador físico: `001`, `M1`, `Y1` (en Supabase, sin prefijo de empresa — ver `decisions/2026-06-01-ids-tachos-supabase-vs-mock.md`) |
| size_liters | enum | 120 / 240 / 750 / 1100 |
| tare_weight_kg | decimal | Peso en vacío, se registra una sola vez al dar de alta |
| waste_type | enum | Ver [[WasteTypes]] |
| status | enum | `active` / `decommissioned` |
| registered_at | datetime | Fecha de alta en el sistema |
| is_yaris_dedicated | boolean | Tacho con el que se **pesa** una carga Yaris/Picanto (aparece en Pesaje en modo Yaris) |
| is_metallic_dedicated | boolean | Tacho dedicado a "Metálicos No reutilizables" |
| is_yaris_container | boolean | **Contenedor físico** de la flota Yaris (`Y1`…`Y26`): sin empresa, sin tara, siempre disponible en recorrido, EXCLUIDO de la cola de pesaje y del dashboard. Distinto de `is_yaris_dedicated`. Ver `logs/2026-06-03-contenedores-yaris-recorrido.md` |

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
| containers_exchanged | array FK → Container | Selección acumulativa |
| floor | string | Piso del recorrido |
| area | string | Área / sala |
| dock | string | Andén |
| photo_ids | array FK → Photo | Fotos ilimitadas |

Los **slots** son fijos: 6:30 AM, 10:30 AM, 1:20 PM, 2:30 PM, 6:30 PM, 9:00 PM. Solo un RouteEvent activo o completado puede existir por (slot, fecha) — slots compartidos por todo el equipo.

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

### Photo

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| url | string | |
| event_type | enum | `'route'` / `'weighing'` / `'storage'` / `'treatment'` / `'other'` |
| event_id | string | FK polimórfico al evento correspondiente |
| taken_at | datetime | |
| label | string | ej: "PTDP Centro Salud 17/05/2026 07:00 AM" |

## Relaciones clave

- Un `Client` tiene muchas `Company`
- Un `Container` es **independiente** (sin empresa); su empresa "actual" se deriva del último registro
- La empresa de un `RouteEvent` y de un `ContainerReception` es del **registro** (snapshot), no del tacho
- Un `Container` tiene muchos `ContainerReception` (histórico)
- Un `RouteEvent` agrupa N envases intercambiados por (slot, día)
- Un `WeighingSession` agrupa N receptions de una misma jornada de pesaje

## Reportes

El entregable de la directiva es un **PDF de Registro Fotográfico semanal por Cliente** (consolida todas las empresas hijas). Rango: lunes 00:00 → hoy 23:59 (cuando se genera un viernes cubre toda la semana). Orden: por etapa (recorrido → pesaje) y dentro de cada etapa, por empresa.

## Peso neto

`net_weight_kg = gross_weight_kg - container.tare_weight_kg`

Es el valor que se factura al cliente.
