---
title: Estado del envase derivado vs. materializado
tags:
  - decisions
  - data-model
  - supabase
  - performance
  - traceability
updated: 2026-05-21
---

# ADR: Estado de envase derivado de eventos (piloto) — evolución pendiente antes de producción

**Fecha:** 2026-05-21
**Estado:** Aceptado para piloto · Revisar antes de lanzamiento oficial (2026-06-01)
**Contexto:** durante el piloto se detectó que, tras pesar todos los envases de prueba, no había forma desde la app de "volver a hacerlos disponibles". Esto disparó la pregunta: ¿es sostenible el modelo actual para producción?

## Contexto

El sistema **no tiene** una columna de estado/fase mutable en `containers`. La tabla solo tiene `status enum ('active', 'decommissioned')`. La "fase" operativa (en recorrido, en pesaje, en cámara fría, etc.) se **deriva** en tiempo real de los eventos registrados.

En particular, "envase disponible para pesar" se calcula en el cliente con `getPendingWeighingContainerIds` (`src/lib/data/containers.ts:101`):

1. `containers.status = 'active'`
2. El envase aparece en algún `route_event` (recogido en un recorrido)
3. **No** existe ninguna fila en `container_receptions` para ese envase

Existe el enum `container_phase` (`route, weighing, cold_storage, treatment, transfer, clean`) declarado en el schema, pero **no se usa como columna**. Está reservado para una evolución futura.

## Decisión

Mantener el modelo derivado **para el piloto**. La trazabilidad regulatoria exige que la fuente de verdad sean los hechos registrados (eventos), no un campo mutable que pueda perder historia.

## Por qué está bien hoy

- Es el modelo **correcto desde el punto de vista de trazabilidad**: auditable, sin estado huérfano, no se puede "saltar" una fase sin dejar evento.
- Con < 200 envases activos y pocos meses de historia, el cálculo en cliente es trivialmente rápido.
- Mantiene la lógica concentrada en un solo helper (`getPendingWeighingContainerIds`), fácil de razonar.

## Por qué no es sostenible a producción tal cual

1. **Cálculo en cliente**: hoy se cargan *todos* los `containers`, `route_events` y `container_receptions` al navegador y se filtra en JS. Con miles de envases y un año de historia, el bundle de datos y la latencia crecen mal.
2. **No hay forma de "deshacer" desde la app**: el operador real se va a equivocar (peso mal tecleado, envase equivocado). Hoy la única salida es SQL directo a Supabase. **No viable** en operación.
3. **`DELETE` sobre `container_receptions` rompe la trazabilidad**: si alguien borra una recepción para "corregir", no queda rastro. Para auditoría se necesita **anulación lógica** (soft-delete con `voided_at` + `voided_by` + `void_reason`), nunca borrado físico.
4. **Cada consulta re-escanea eventos**: vistas, dashboards y reportes recalculan la misma derivación una y otra vez. No es indexable directamente.

## Plan de evolución (orden de prioridad)

### Antes del lanzamiento oficial (2026-06-01)

- **[P1] Acción "Deshacer pesaje" en la UI** con soft-delete:
  - Migration: agregar `voided_at timestamptz`, `voided_by uuid references profiles(id)`, `void_reason text` a `container_receptions`.
  - Filtrar `where voided_at is null` en todas las queries y vistas.
  - Botón en la fila del drawer de pesaje + confirmación + obligar motivo.
- **[P1] Mover `getPendingWeighingContainerIds` a una vista de Postgres** (`v_containers_pending_weighing`) → el cliente solo hace `select * from v_containers_pending_weighing`. Misma lógica, sin traer todo a memoria.

### Después del lanzamiento, cuando el volumen lo justifique

- **[P2] Columna `current_phase container_phase` en `containers`** mantenida por triggers al insertar/anular eventos. Queda derivada pero **indexable y barata de leer**. Se valida contra los eventos en un job de auditoría nocturno.

  > [!note] Reafirmado 2026-06-03
  > Al agregar los contenedores Yaris se evaluó adelantar esta columna y se decidió
  > **no acoplarla** a ese cambio. Sigue siendo el próximo proyecto, con la condición
  > clave: la columna es **caché mantenida por triggers** (los eventos siguen siendo la
  > fuente de verdad), nunca un campo que la app escriba a mano — eso reintroduciría el
  > problema de doble fuente de verdad y rompería la trazabilidad. Acompañar con job de
  > auditoría que valide la columna contra los eventos.
  > Ver `logs/2026-06-03-contenedores-yaris-recorrido.md`.
- **[P2] Vista materializada** (`mv_container_current_state`) refrescada por trigger o cron para dashboards de alto tráfico.
- **[P3] Política de retención / particionado** de `container_receptions` y `route_events` por año cuando crucemos > 100k filas.

## Consecuencias

- **A favor:** seguimos teniendo trazabilidad completa, sin perder historia. El piloto puede correr tal cual está.
- **En contra:** asumimos deuda explícita que **debe resolverse antes del 2026-06-01** (al menos los dos puntos P1). Si no se resuelve, el operador va a depender de soporte técnico para corregir errores triviales.

## Acción inmediata

- Durante el piloto, las correcciones se hacen vía SQL en Supabase (ver instrucciones en conversación 2026-05-21).
- Agregar al [[Roadmap]] los items P1 con bloqueo "antes de 2026-06-01".

## Referencias

- Schema: `supabase/migrations/20260521000000_initial_schema.sql:88-99` (tabla `containers`), líneas 17-20 (enums `container_status`, `container_phase`).
- Lógica derivada: `src/lib/data/containers.ts:101` (`getPendingWeighingContainerIds`).
- Uso: `src/app/register/weighing/page.tsx:82`, `src/components/dashboard/metrics-cards.tsx`.
- ADR relacionado: [[2026-05-21-supabase-integracion]].
