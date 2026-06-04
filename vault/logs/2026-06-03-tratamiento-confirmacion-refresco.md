---
title: Tratamiento — confirmación de envío + fix lista no se refrescaba
tags:
  - log
  - tratamiento
  - bugfix
  - piloto
updated: 2026-06-03
---

# Tratamiento: paso de confirmación + fix de candidatos tratados

`src/app/register/treatment/page.tsx`

## Motivación (piloto)

Dos pedidos del operador tras el piloto:

1. **Confirmación explícita** antes de enviar tachos a tratamiento ("¿seguro que
   quieres mandar los tachos … a tratamiento?").
2. **Bug:** al enviar a tratamiento y volver atrás, los tachos recién tratados
   **seguían apareciendo** como pendientes en cámara fría.

## Cambios

### 1. Paso de confirmación
El flujo pasó de 2 estados (`select` → `done`) a 3: `select` → `confirm` → `done`
(state `step`). El botón "Enviar a tratamiento" ya no envía: abre una pantalla de
confirmación (card ámbar) que lista los números de tacho seleccionados con botones
**Cancelar** / **Confirmar**. El submit real corre desde "Confirmar", con flag
`submitting` para evitar doble envío y mostrar "Enviando…".

### 2. Fix: tachos tratados seguían en la lista
**Causa raíz:** el filtro de `candidates` buscaba el tratamiento con
`treatmentRuns.find((t) => !t.completed_at)` (solo tratamientos *en curso*). Pero el
envío a tratamiento crea el run inmediato con `started_at == completed_at`, así que
ese `find` devolvía `null`, `computeContainerPhase` no veía el tratamiento y el tacho
seguía en fase `cold_storage` → reaparecía al volver.

**Fix:** ahora se toma el tratamiento/traslado **más reciente posterior a la recepción
actual** (incluye completados), comparando `started_at`/`storage_started_at` contra
`reception.arrived_at`. Así un tacho recién tratado sale de la lista, y uno
re-ingresado en un ciclo nuevo (recepción posterior al tratamiento viejo) vuelve a
aparecer correctamente. La lista, al derivar de `useMemo` sobre el store, se refresca
sola tras el submit.

### 3. Mismo fix en el inventario de tachos
El bug latente equivalente vivía en `src/app/containers/page.tsx` (`find((t) => !t.completed_at)`,
un tacho tratado se mostraba `cold_storage` en vez de `clean`) y en
`src/app/containers/[id]/page.tsx` (un `find` sin orden que podía tomar un tratamiento
de un ciclo anterior). Ambas se alinearon a la misma lógica: tratamiento/traslado más
reciente **posterior a la recepción actual**, incluyendo completados.
Relacionado: `decisions/2026-05-21-estado-envase-derivado.md` ("tratamiento completado → clean").

## Verificación

- `npx tsc --noEmit`: 0 errores en código de app (solo ruido pre-existente de tipos
  de test runner en `*.test.*`).
- `npm test`: verde.
- E2E manual pendiente en el piloto.
