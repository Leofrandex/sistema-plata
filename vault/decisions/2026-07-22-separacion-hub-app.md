---
title: Separación en monorepo — hub (coordinadores) + app (operadores) + shared
tags:
  - decision
  - arquitectura
updated: 2026-07-22
---

# Separación hub / app / shared (npm workspaces)

## Contexto

El producto se divide en dos experiencias: los **coordinadores** consumen información
(dashboard, tachos, equipos, historial, reportes, admin) desde la web, y los
**operadores** registran operaciones (recorrido, pesaje, tratamiento, traslado) desde
el APK Capacitor. Hasta ahora una sola app Next.js servía a ambos filtrando la
navegación por rol.

## Decisión

Monorepo con npm workspaces en subcarpetas del root (preferencia de Sebastián):

- **`hub/`** — Next.js web solo coordinadores: Dashboard renovado, Tachos, Equipos,
  **Historial** (tab nueva con edición/anulación de recorridos y pesajes), Reportes,
  Admin. **Sin Registrar.**
- **`app/`** — Next.js + Capacitor solo operadores: Home nuevo (saludo + 4 accesos +
  semáforo de slots del día), register/**. **Sin dashboard.** `android/` y
  `capacitor.config.ts` viven aquí.
- **`shared/`** — paquete fuente `@hospiwaste/shared` (sin build step, `exports`
  `"./*": "./src/*"`, consumido vía `transpilePackages`): store, types, Supabase
  (client + queries), lógica de datos, offline/outbox, UI base, history,
  AuthGuard, hydrator, tokens CSS y preset de Tailwind.

## Reglas clave

- **Convención de imports**: todo lo de shared se importa como
  `@hospiwaste/shared/...` (también dentro de shared — cero `@/` ahí). `@/*` es
  local de cada app.
- **AuthGuard parametrizado**: la política la inyecta cada app. Hub exige
  `role === 'coordinator'` (otro rol ve pantalla de acceso restringido); app acepta
  ambos roles. Sigue siendo client-side (export estático, sin middleware) + RLS.
- **Ambos proyectos siguen `output: 'export'`** y build/dev con `--webpack`
  (Turbopack no resuelve igual los imports de CSS/paquete fuente).
- **Gradle**: `capacitor.settings.gradle` es generado; tras el split se regenera con
  `npx cap sync android` desde `app/` y apunta al node_modules hoisted del root.
  Nunca editarlo a mano.
- **React deduplicado**: pineado en devDependencies del root para que los peers de
  las herramientas no instalen una segunda copia (rompía los tests con
  "Cannot read properties of null (reading 'useState')").

## Alternativas descartadas

- Dos repos separados: duplicaba store, tipos, offline y cliente Supabase.
- Filtrado por rol en una sola app (status quo): mezclaba navegaciones y permitía
  que el operador navegara rutas de coordinador con gating solo visual.
