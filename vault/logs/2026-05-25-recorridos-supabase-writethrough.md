---
title: Recorridos → Supabase (write-through + hidratación) — fix pesaje no muestra sucios
tags:
  - log
  - supabase
  - recorridos
  - pesaje
date: 2026-05-25
updated: 2026-05-25
---

# Recorridos migrados a Supabase — los envases sucios ya aparecen en Pesaje

## Síntoma reportado

Los envases registrados como **sucios recogidos** en un recorrido no aparecían
en el dropdown de **Pesaje** ("envases pendientes de pesar").

## Causa raíz

Desfase de fuentes de datos. La cola de pesaje se deriva con
`getPendingWeighingContainerIds(containers, routeEvents, receptions)`
(`src/lib/data/containers.ts`): un envase aparece solo si está en
`routeEvents[].containers_dirty_received`.

- `containers` y `receptions` → **Supabase** (vía `SupabaseHydrator`).
- `routeEvents` → **solo mocks en memoria**. El hydrator no cargaba `route_events`
  y el flujo de recorrido (`anden/[slot]` y `morgue`) **nunca escribía a Supabase**
  (solo `addRouteEvent`/`updateRouteEvent` al store Zustand, sin persistencia).

El write-through de la sesión del 2026-05-21 (`55f3afa`) cubrió **solo pesaje**.
Las queries `createRouteEvent` / `setRouteContainersDirty` / `listRouteEvents`
existían en `queries/route-events.ts` pero no se llamaban desde ningún componente.

Consecuencia: un recorrido registrado solo "casi" funcionaba sin recargar; al
recargar, `routeEvents` volvía a los mocks y el recorrido desaparecía → pesaje vacío.

## Solución (migración completa de recorridos a Supabase)

1. **Hidratación** (`src/components/supabase-hydrator.tsx`): se cargan
   `route_events` + join tables `dirty`/`clean` y se vuelcan al store. Mapper puro
   `mapRouteEvents()` exportado (testeado en `__tests__/lib/map-route-events.test.ts`).
2. **Bulk queries** (`src/lib/supabase/queries/route-events.ts`):
   `listAllRouteContainersDirty` / `listAllRouteContainersClean` + tipo `RouteContainerLink`.
3. **Write-through andén** (`anden/[slot]/page.tsx`) y **morgue** (`morgue/page.tsx`):
   - `handleStart`: `createRouteEvent` en Supabase usando el `id` (uuid) real y
     `currentProfileId` como `operator_id` (antes hardcodeaba `'user-1'`, que no es
     un `profiles.id` válido → la FK lo habría rechazado).
   - `handleFinish`: `updateRouteEvent` (status/ended_at/floor/area/dock) +
     `setRouteContainersDirty` + `setRouteContainersClean`.
   - `handleCancel`: `deleteRouteEvent` (las join tables caen por `ON DELETE CASCADE`).

   Las ediciones incrementales del formulario siguen siendo solo-store; la
   sincronización a Supabase ocurre al **finalizar** el recorrido, que es cuando
   los envases deben volverse visibles para pesaje.

## Decisión de diseño

Persistir en `handleFinish` (no en cada keystroke) para no escribir a la BD en cada
edición de piso/área/andén. Pesaje solo necesita los envases una vez el recorrido
está cerrado, así que el momento del cierre es suficiente.

## Verificación

- Typecheck: archivos de la migración limpios.
- `jest`: 55/55 (incluye 3 tests nuevos de `mapRouteEvents`).
- `vitest`: 12/12.
- **Pendiente**: prueba E2E manual en la app corriendo contra Supabase
  (registrar recorrido → recargar → confirmar envases en pesaje).

## Notas

- Trabajo concurrente de "Yaris" (`is_yaris_dedicated`/`is_yaris_weighing` en
  `weighing/page.tsx` y `WeighingForm`) estaba en curso durante esta sesión; sus
  errores de typecheck son ajenos a esta migración.
- Fotos de recorrido siguen en memoria (mock) hasta migrar Storage.
