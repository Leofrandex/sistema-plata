---
title: Modo interino solo-pesaje — recorridos deshabilitados
tags:
  - log
  - pesaje
  - recorridos
  - offline
  - apk
  - hub
updated: 2026-09-01
---

# 2026-09-01 — Modo interino solo-pesaje (recorridos deshabilitados)

Rama `feat/modo-interino-solo-pesaje`, 9 commits (`7d40e82`..`6f8b831`), ejecutado por
subagent-driven-development sobre 10 tareas. Ver ADR [[2026-09-01-modo-interino-solo-pesaje]]
y spec `docs/superpowers/specs/2026-09-01-modo-interino-solo-pesaje-design.md`.

## El flag y sus cuatro puntos

`INTERIM_MODE = true` en `shared/src/lib/config/interim-mode.ts`. Lo leen:

1. **Cola de pesaje** (`app/src/app/register/weighing/page.tsx`) — `getWeighableContainerIds`
   en vez de `getPendingWeighingContainerIds`.
2. **Home del APK** (`app/src/app/page.tsx`) — entrada "Recorrido" gris.
3. **Guard de recorridos** (`app/src/app/register/route/layout.tsx`) — bloquea el subárbol.
4. **Banner del hub** (`hub/src/components/dashboard/interim-mode-banner.tsx`) — aviso en el
   dashboard.

`getPendingWeighingContainerIds` no se tocó: `getWeighableContainerIds`
(`shared/src/lib/data/containers.ts`) es una función hermana, devuelve todos los tachos
`status === 'active'` excluyendo `is_yaris_container` — sin exigir recorrido previo. Cuando B
(la re-arquitectura offline) esté lista, revertir es apagar el flag; la función vieja sigue
intacta para que la consuma de nuevo.

## Cola abierta y limpieza de UI muerta

Con la cola abierta, todo lo que solo tenía sentido con una cola cerrada dejó de tener uso y se
eliminó bajo flag: la tira "Pendientes por pesar (n)", el botón "ausente" y `markAbsent`,
`skipped`/`skippedIds`/`pendingNotSkipped`, y `pendingCount` en el diálogo de finalizar. El campo
`skipped?` de `ActiveSession` se deja declarado (B lo puede reusar) pero deja de escribirse.

## Selector de tacho: de `<Select>` a buscador

Con ~246 tachos activos, el `<Select>` plano de "Número de tacho" dejó de ser usable. Se
reemplazó por un buscador (`Input` + lista filtrada, reutilizando `filterContainers` de
`container-selector`). Los selectores de Yaris y metálicos no se tocaron — catálogos cortos,
ya funcionan.

Efecto colateral encontrado y corregido en la Task 5: `changeWasteType` no limpiaba el texto de
búsqueda del tacho al cruzar hacia/desde tipo "metálico" (a diferencia de `toggleYaris`, que sí
lo hacía). Quedaba un filtro de búsqueda pegado tras cambiar de tipo de desecho. Fix: mismo
`setTachoSearch('')` en el cruce de tipo metálico.

## Empresa obligatoria

`getContainerCurrentCompanyId` deriva la empresa del último recorrido; sin recorridos siempre
da `null`, así que toda la data interina nacería como "Sin empresa". Se agregó un `Select` de
empresa **obligatorio** en el formulario de pesaje, precargado con la empresa heredada cuando
exista (nunca existirá en el interino, pero el campo queda listo para cuando vuelvan los
recorridos). Sin migración — `container_receptions.company_id` y `submitReception` ya lo
aceptaban.

## Aviso de duplicado — día local, no UTC

Al abrir la cola desaparece la única protección contra pesar el mismo tacho dos veces. Se agregó
un aviso suave (no bloqueante): si el tacho ya tiene una recepción vigente (`voided_at is null`)
con `arrived_at` dentro del **día local del dispositivo**, se muestra "este tacho ya se pesó hoy
a las HH:MM" — el operador puede seguir, hay casos legítimos de doble pesaje el mismo día.

`findTodayReceptionForContainer` calcula el día local (`Date.getFullYear/getMonth/getDate`)
deliberadamente distinto del día UTC que usa el resto de la analítica
(`dashboard-analytics.ts`, `dashboard-metrics.ts`). La sesión de pesaje ya se llavea con
`todayLocal()`, así que el aviso tiene que respetar el día calendario del operador en Panamá, no
el corte UTC que usan los agregados del dashboard.

## Home del APK y guard de recorridos

El Home oculta la sección "Recorridos de hoy" bajo el flag, y además — en una ronda de arreglo
posterior — corta el `useEffect` que llamaba `getActiveSession` por cada horario de recorrido en
cada arranque del APK: era I/O contra IndexedDB desperdiciado para alimentar una sección que
nunca se pinta con el flag encendido. El `useMemo` de `slots` también corta temprano
(`if (INTERIM_MODE) return []`). Nada del resto se tocó — al apagar el flag, el efecto y los
`useMemo` vuelven a correr exactamente como antes.

El bloqueo del subárbol `/register/route` se hizo con un **layout** de Next
(`app/src/app/register/route/layout.tsx`), no con redirects por página: un solo punto cubre
`page`, `anden`, `anden/[slot]`, `morgue` e `history`, y no rompe el orden de hooks de las
páginas cliente que cuelgan de él.

## Banner del hub

`InterimModeBanner` en `hub/src/components/dashboard/interim-mode-banner.tsx`, montado entre
`DashboardHero` y `MetricsCards`. Cero cambios en los cálculos del dashboard: tras el reset, con
la tabla de eventos vacía, los 246 tachos van a aparecer como "En planta" y pasar a "Pendiente
por tratar" a medida que se pesen — es un artefacto conocido del modo, y el banner lo explica en
vez de ocultarlo. Mantener la lógica intacta es lo que hace la reversión trivial.

## Scripts de reset — el hallazgo del bucket `photos`

`scripts/backup-datos-operativos.sql` y `scripts/reset-datos-operativos.sql` son el espejo del
procedimiento de [[2026-07-28-reset-datos-operativos]], con un hallazgo nuevo:

El spec original copiaba el `TRUNCATE` de 10 tablas del reset de julio, `photos` incluida. Pero
`public.photos` es una tabla **compartida**: el enum `photo_event_type` incluye
`'maintenance'` desde la migración `20260716000000_equipment_maintenance.sql`, y
`hub/src/components/equipment/maintenance-history.tsx` la consume vía
`listPhotosByEvent(db, 'maintenance', row.id)`. En julio esto no importaba —
`equipment_maintenance` tenía 0 filas—, pero hoy sí: truncar `photos` entera habría borrado
también la evidencia fotográfica de los mantenimientos de equipos, sin ninguna relación con el
reset de datos operativos que se está haciendo.

Se sacó `photos` del `TRUNCATE` y se reemplazó por un borrado selectivo dentro de la misma
transacción: `delete from photos where event_type <> 'maintenance';`. El backup no cambió — ya
volcaba `photos` sin filtro, que es el superset correcto para preservar antes de borrar.

> [!warning] Bucket de fotos sin limpiar
> **Fecha:** 2026-09-01
> **Problema:** cuarto reset consecutivo sin vaciar el bucket `photos`; ronda los ~1.200
> objetos huérfanos y se acerca al límite de 1 GB del plan Free.
> **Acción requerida:** vaciarlo vía Storage API o dashboard antes del próximo reset.

## Estado real del trabajo

- **Código:** completo, en verde. `npm test` 243/243 (172 shared + 36 hub + 35 app), `npm run
  test:ui` 12/12 (vitest), `npm run build:hub` y `npm run build:app` compilan sin errores.
- **APK:** no compilado. `versionCode 4` / `versionName "1.3"` ya estaban puestos en el working
  tree por otra sesión junto con los `.gradle` regenerados por `cap sync`; no se tocó nada bajo
  `app/android/` en este cierre — ni se ejecutó `npx cap sync android` — para no arrastrar ese
  trabajo ajeno sin commitear a esta rama.
- **Reset de datos operativos:** **no ejecutado**. Los scripts SQL (`scripts/backup-datos-operativos.sql`,
  `scripts/reset-datos-operativos.sql`) están listos y commiteados; correrlos es un paso manual
  posterior al despliegue del APK (ver ADR, sección Decisión, y handoff más abajo).
- **E2E en dispositivo:** pendiente.

## Nota permanente

Los pesajes registrados durante el interino quedan sin recorrido asociado para siempre. La
trazabilidad regulatoria de esos días depende del respaldo en papel, fuera de alcance de este
spec.
