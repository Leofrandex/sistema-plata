---
title: Cliente → Empresa, Recorrido (rename) y eliminación de Batch
tags:
  - decision
  - adr
  - data-model
date: 2026-05-17
status: accepted
---

# ADR — Cliente / Empresa / Recorrido (rediseño operativo)

## Contexto

Tras observar el uso real del sistema en campo y la elaboración manual de reportes para la directiva, Sebastian redefinió tres aspectos del modelo de dominio que estaban modelados de forma diferente en el código:

1. **Jerarquía de cliente.** El cliente activo "Centro de la Salud" no es realmente una entidad única — internamente contiene dos empresas operativas (ION y Airkem) a las que se les presta el servicio. Los envases pertenecen a estas empresas, no al cliente legal.
2. **Concepto de "intercambio".** El término "intercambio" no refleja la operación real: lo que sucede no es solo el cambio limpio↔sucio, sino un recorrido completo con horario fijo (6 slots por día), cronómetro persistente y fotografía exhaustiva. Además, "intercambio" se confundía con `ExternalTransfer` (traslado externo).
3. **Concepto de "lote" (Batch).** Los lotes nunca operaron como unidad real: agrupaban arbitrariamente contenedores por cliente/día, pero la operación real se ejecuta por slot horario (recorridos) y por sesión de pesaje. Los reportes se generan por **cliente / semana**, no por lote.

## Decisión

### 1. Jerarquía Cliente → Empresa

Se introduce la entidad `Company` (Empresa) como nivel intermedio:

- `Client` representa la entidad legal (ej: "Centro de la Salud"). Pierde el campo `code_letter`.
- `Company` representa la operación interna (ej: ION, Airkem). Tiene `client_id` y `code_letter`.
- `Container.client_id` se reemplaza por `Container.company_id`.

Los reportes se generan a nivel **Cliente** (consolidando empresas). El form de alta de envase pide cliente y luego empresa en cascada.

### 2. Rename `intercambio → recorrido`

- `ExchangeEvent` → `RouteEvent`, enriquecido con `slot` (uno de 6 valores fijos: `06:30 | 10:30 | 13:20 | 14:30 | 18:30 | 21:00`), `started_at`, `ended_at`, `status` (`in_progress | completed`), `floor`, `area`, `dock`, `photo_ids` ilimitadas.
- `ContainerPhase.exchange` → `route`.
- `PhotoEventType.exchange` → `route`.
- Ruta `/register/exchange` → `/register/route`.
- Strings UI: "Intercambio" → "Recorrido".
- **`ExternalTransfer` NO cambia** — es traslado externo (tipos 2-5 a otro centro), distinto de un recorrido.

### 3. Eliminación de Batch

Se elimina la entidad `Batch` y todo el código asociado. Las unidades operativas pasan a ser:

- `RouteEvent` — un único registro por `(slot, fecha)`, compartido por todo el equipo.
- `WeighingSession` — agrupa N receptions creadas durante una misma sesión de pesaje.

Los reportes consultan estos eventos directamente por cliente y rango de fechas (semana). No hay agregación intermedia.

### 4. Nomenclatura de envases

`Container.id` pasa de `{letra_cliente}-NNN` a `{letra_empresa}-NNN`. Ejemplos del estado actual:

- `I-001..I-010` para ION
- `A-001..A-010` para Airkem

Si en el futuro hay más clientes/empresas, cada empresa nueva trae su propia letra única.

## Alternativas consideradas

- **Mantener `code_letter` en Client y agregar Company sin código.** Rechazado: implicaría que dos empresas del mismo cliente comparten prefijo, perdiendo la diferenciación operativa que el usuario quiere ver en los envases.
- **Renombrar `ExternalTransfer → traslado` y dejar `ExchangeEvent → recorrido`.** Innecesario: `ExternalTransfer` ya se llama "Traslado externo" en UI. No hay confusión semántica siempre que no se llame "intercambio" a nada.
- **Conservar `Batch` como agregación derivada.** Rechazado: no aporta valor sobre consultar RouteEvent + WeighingSession directamente, y los reportes no son por lote sino por semana.

## Consecuencias

- Migración limpia: como no hay backend persistente, se rehacen `types.ts` y `mock-data.ts` sin compatibilidad histórica.
- Los tests que referenciaban `batch_id` y `code_letter` en Container se actualizan.
- El dashboard pierde la sección de "Lotes activos / completados" hasta su rediseño en la Fase 5 (que la reemplaza por gráficos).
- La ruta `/batches/[id]` y `/batches/[id]/report` se eliminan; la generación de PDF se rehace en `/reports` (Fase 4).
- Los planos del cliente se mantienen porque `ContainerLocation` no depende del modelo Batch.

## Referencias

- Plan de implementación: `bubbly-wandering-lighthouse.md`
- Log de ejecución: `logs/2026-05-17-recorridos-pesaje-reportes-dashboard.md`
