---
title: Data Model
tags:
  - project
  - data
  - types
updated: 2026-05-02
---

# Modelo de Datos Conceptual

> [!note]
> Este modelo es conceptual — extraído del dominio antes de que exista código. Los nombres de tablas/colecciones y tipos exactos se definen cuando se elija el stack.

## Entidades principales

### Container (Envase / Tacho)
La entidad central del sistema. Identificador físico real.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | Compuesto: `{letra_cliente}-{numero}` ej: `A-069` |
| client_id | FK → Client | Un contenedor pertenece a un solo cliente |
| size_liters | enum | 240 / 750 / 1100 |
| tare_weight_kg | decimal | Peso en vacío, se registra una sola vez al dar de alta |
| waste_type | enum | Ver [[WasteTypes]] |
| status | enum | `active` / `decommissioned` (si se rompe, nunca se reutiliza) |
| registered_at | datetime | Fecha de alta en el sistema |

### Client (Cliente / Operación)
Empresa o instalación hospitalaria a la que se le presta el servicio.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| name | string | ej: "Ciudad de la Salud", "Agua Dulce" |
| code_letter | string | Letra de prefijo para numeración de contenedores (ej: `A`, `B`) |
| locations | array | Ubicaciones / pisos donde tiene contenedores |

### ExchangeEvent (Intercambio en punto de encuentro)
Registro de cada intercambio entre Hospimed y la empresa de aseo.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| timestamp | datetime | |
| operator_id | FK → User | Quién registró |
| clean_containers_given | array FK → Container | Contenedores limpios entregados |
| dirty_containers_received | array FK → Container | Contenedores sucios recibidos |
| location | string | Punto de encuentro |
| photos | array FK → Photo | |

### ContainerReception (Recepción en planta)
Registro de llegada a la planta y pesaje.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| arrived_at | datetime | |
| gross_weight_kg | decimal | |
| net_weight_kg | decimal (computed) | `gross_weight - tare_weight` |
| origin_location | string | De dónde vino (hospital, piso, área) — para trazabilidad |
| photos | array FK → Photo | Foto del envase + foto de balanza |
| operator_id | FK → User | |

### StorageEvent (Estancia en cámara fría)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| entry_at | datetime | Cuándo entró a la cámara |
| exit_at | datetime | nullable — cuándo salió para tratamiento |

### TreatmentRun (Tratamiento en planta)
Solo aplica a desecho peligroso infeccioso (tipo 1).

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| started_at | datetime | |
| completed_at | datetime | nullable |
| operator_id | FK → User | |

### ExternalTransfer (Traslado externo)
Para desechos tipos 2–5 que se trasladan a otro centro.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| storage_started_at | datetime | Cuando llegó a almacenaje temporal |
| transferred_at | datetime | Cuando salió hacia el centro externo |
| destination | string | Centro externo de tratamiento |
| operator_id | FK → User | |

### CompactorEvent (Ciclo del compactador)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| picked_up_at | datetime | Cuando fue recogido por tercero |
| returned_at | datetime | nullable |
| operator_id | FK → User | |

### Photo
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| url | string | |
| event_type | enum | `exchange` / `weighing` / `storage` / `other` |
| event_id | string | FK polimórfico al evento correspondiente |
| taken_at | datetime | |
| label | string | ej: "PTDP Ciudad Salud 01/03/2026 09:40 PM" |

### User (Operador)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| name | string | |
| role | enum | Por definir cuando se levanten los requisitos de acceso |

## Relaciones clave

- Un `Client` tiene muchos `Container`
- Un `Container` tiene muchos `ContainerReception` (histórico de todos los pesajes)
- Cada `ContainerReception` genera fotos en `Photo`
- Un `Container` puede tener múltiples `StorageEvent` y `TreatmentRun` a lo largo de su vida

## Lote (Batch)

Unidad que agrupa todos los contenedores de un cliente procesados en un día calendario. Un cliente puede tener múltiples viajes/visitas en el día — todos se consolidan en un único lote.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| client_id | FK → Client | |
| date | date | Día del lote |
| status | enum | `active` / `completed` |
| containers | array FK → Container | Contenedores incluidos en este lote |

> [!note] PENDIENTE DE CONFIRMAR CON FRANCESCA — 2026-05-03
> **Pregunta:** ¿Un lote = todos los contenedores de un cliente en un día (independientemente de cuántos viajes hubo), o un lote = una visita específica?
> **Asumido temporalmente:** Lote = todos los contenedores de un cliente en un día (opción B).
> **Acción requerida:** Confirmar con Francesca en reunión 2026-05-08 y ajustar si es necesario.

## Peso neto

`net_weight_kg = gross_weight_kg - container.tare_weight_kg`

Este es el valor que se factura al cliente.
