---
title: Fix — área del andén no persistía al crear + recorrido "activo" fantasma del coordinador
tags:
  - log
  - recorrido
  - bug
  - supabase
  - indexeddb
fecha: 2026-06-16
updated: 2026-06-16
---

# Log 2026-06-16 — Fix área de andén + activo fantasma

Dos bugs reportados desde operación real (cuenta coordinador), diagnosticados sobre
producción (`xqqnthyipkdkwyknbtnw`). Eran **independientes** aunque aparecieron juntos.

## Síntomas

1. **Recorridos completados se veían "activos" para el coordinador**, aunque en Supabase
   los `route_events` ya estaban `status='completed'`.
2. **No había forma de saber dónde se hizo cada recorrido** (andén 3 / pediatría): dos
   `route_events` del mismo slot 10:30 con `area=''` en la BD.

## Diagnóstico (causas raíz, distintas)

### Bug 1 — `area` no se persistía al crear el andén
`handleCreateAnden` (`src/app/register/route/anden/[slot]/page.tsx`) llamaba a
`q.createRouteEvent(...)` **sin el campo `area`**; el valor solo iba al store local. La
única ruta que escribía `area` a Supabase era `handleUpdateAnden` (al **editar** un andén
ya guardado). Resultado: un andén creado y finalizado sin editar quedaba con `area=''`
para siempre. (Morgue NO tenía el bug: su `handleFinish` siempre escribe `area`.)

### Bug 2 — el estado "en curso" se leía de IndexedDB, sin reconciliar con la BD
El listado de horarios (`anden/page.tsx > computeStatus`) marcaba un slot "en curso" si
existía una `ActiveSession` en **IndexedDB local** (`listActiveSessions`) **o** si había
`route_events` `in_progress`. La `ActiveSession` está cliqueada por
`route:anden:{fecha}:{slot}` — **no por usuario** — y nunca se cruzaba contra el `status`
real de Supabase. Si quedaba colgada (sesión finalizada en otro dispositivo, o mismo
navegador compartido entre operador y coordinador), el slot se mostraba "en curso"
indefinidamente. La página de slot tenía el mismo problema vía `getActiveSession`.

## Cambios

- **Fix 1:** se agrega `area: formState.area` al `createRouteEvent` del andén. Una línea.
- **Fix 2:** nueva función pura `computeSlotStatus(routeEvents, date, slot, localStartedAt)`
  en `src/lib/data/route-sessions.ts`. **Regla: la BD manda sobre la sesión local** — si
  hay andenes `completed` y ninguno `in_progress`, el horario está cerrado aunque exista
  una sesión local; ésta se marca `staleLocalSession`. La sesión local solo fuerza
  "en curso" cuando se inició el recorrido pero aún no se guardó ningún andén.
  - `anden/page.tsx`: `computeStatus` usa `computeSlotStatus`; el effect que carga sesiones
    activas **borra de IndexedDB** (`endSession`) las que quedaron colgadas (stale).
  - `anden/[slot]/page.tsx`: el effect de hidratación, si el horario ya cerró en la BD,
    limpia la sesión local y no marca "en curso" (antes resucitaba la sesión fantasma y
    permitía seguir agregando andenes a un recorrido ya finalizado). Se agregó `routeEvents`
    a sus deps para reconciliar tras la hidratación.

## Decisión

La fuente de verdad de "recorrido cerrado" son los `route_events` de Supabase. IndexedDB
solo sostiene el cronómetro (elapsed); deja de poder "ganarle" al estado real. Ver ADR
`decisions/2026-05-21-estado-envase-derivado.md` (eventos = fuente de verdad).

## Alcance del dato perdido

Los dos recorridos del 2026-06-16 ya tenían `area=''` antes del fix; ese dato **no es
recuperable** desde la BD (nunca se escribió). Distinguibles solo por sus tachos: el
segundo usó contenedores Yaris (Y3/Y15/Y17/Y26). Por decisión del usuario **no** se
limpiaron manualmente.

## Verificación

- `computeSlotStatus`: 6 casos nuevos en `__tests__/lib/route-sessions.test.ts`.
- `npm run test:jest`: 17 suites / 88 tests verdes.
- `npm run build`: OK.
- Pendiente: E2E manual (crear andén con ubicación → verificar `area` en Supabase;
  finalizar en un dispositivo → abrir como coordinador en otro y verificar que no aparece
  "en curso").
