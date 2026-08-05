---
title: La cola de pesaje se reabre por fecha, no por existencia de pesaje
tags:
  - decision
  - pesaje
  - ciclo-tacho
updated: 2026-07-28
---

# ADR — Cola de pesaje: comparación por fecha, sin exigir tratamiento

**Fecha:** 2026-07-28
**Estado:** Aceptada

## Contexto

`getPendingWeighingContainerIds` (`shared/src/lib/data/containers.ts`) decidía la cola
del pesador comparando **existencia**: "¿el tacho tiene alguna recepción?" contra
"¿tiene algún recorrido que lo recogió sucio?". Sin fechas.

Como el tacho recorre el ciclo muchas veces, el primer pesaje lo sacaba de la cola
**para siempre**. Evidencia en producción al detectarlo: de 86 tachos con pesajes,
**82 tenían exactamente 1 recepción**; los únicos 4 con más eran `is_yaris_dedicated`,
que entran a pesaje por una lista aparte y se saltan esta función. Ningún tacho normal
se había pesado dos veces en la historia del sistema.

El camino de retorno que el modelo asumía era el **tratamiento** (ver
[[2026-05-21-estado-envase-derivado]]: tratamiento completado → `clean`). En la práctica
ese módulo casi no se usa: 15 corridas en `treatment_runs` en total. Exigir tratamiento
para reabrir la cola habría dejado el bug igual de vivo.

## Decisión

Un tacho está pendiente de pesaje cuando **su última recogida sucia (`route_events.started_at`)
es posterior a su último pesaje vigente (`container_receptions.arrived_at`)**.

No se exige tratamiento intermedio. El ciclo operativo real es
recorrido → pesaje → recorrido, y el tratamiento se registra de forma irregular.

## Alternativas descartadas

- **Exigir tratamiento completado para reabrir la cola** — es el modelo "puro" del ADR
  de estado derivado, pero con 15 tratamientos registrados dejaría fuera de la cola a
  casi toda la flota. Se descarta hasta que el módulo de tratamiento se use de forma
  sistemática.
- **Marcar un flag `pendiente_pesaje` en `containers`** — introduce estado denormalizado
  que hay que mantener sincronizado. Los eventos siguen siendo la fuente de verdad
  (mismo criterio que [[2026-06-10-empresa-por-registro]]).

## Consecuencias

- La cola del pesador ahora coincide con el bucket `pendiente_pesar` del dashboard.
  `computeCirculationStatus` (`dashboard-metrics.ts`) **ya comparaba por timestamp** y
  nunca tuvo este bug: las dos vistas se contradecían y esa contradicción era el síntoma
  visible para el coordinador.
- Al aplicar el fix sobre los datos del piloto, **41 tachos** vuelven a estar disponibles
  para pesar (83 pendientes en total, contra 42 que la versión anterior mostraba).
- Un tacho puede pesarse de nuevo sin haber pasado formalmente por tratamiento. Es
  intencional; si se quiere forzar el paso por tratamiento, es un cambio de proceso
  operativo, no de esta función.

Ver log: `logs/2026-07-28-fix-cola-pesaje-ciclo-reabierto.md`
