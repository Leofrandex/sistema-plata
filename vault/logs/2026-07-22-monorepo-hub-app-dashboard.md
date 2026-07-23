---
title: Monorepo hub/app/shared + dashboard renovado del coordinador
tags:
  - log
  - monorepo
  - dashboard
updated: 2026-07-22
---

# 2026-07-22 — Separación hub/app + dashboard renovado

Rama `feat/monorepo-split` (desde `feat/apk-capacitor`). Ver ADR
[[2026-07-22-separacion-hub-app]].

## Qué se hizo

### Fase 0 — Higiene
- Fix: `computeDashboardMetrics.routesToday` no excluía recorridos anulados (+ test).

### Fases 1–2 — Workspaces y extracción de shared
- Root con `workspaces: ["shared","hub","app"]`; scripts `build:hub`, `build:app`,
  `dev:hub`, `dev:app`, `test -ws`.
- `git mv` del proyecto completo a `hub/`, luego extracción a `shared/src/` (store,
  types, supabase, data core, offline, ui, history, guards, hydrator) con codemod
  `@/X → @hospiwaste/shared/X` (~116 archivos).
- Tailwind preset compartido (`shared/tailwind-preset.ts`) + tokens CSS
  (`shared/src/styles/tokens.css`). Jest por workspace (shared usa ts-jest; hub y
  app usan next/jest con `moduleNameMapper`); vitest de `components/ui` vive en shared.
- Se eliminaron `next-pwa` y `@supabase/ssr` (cero imports).

### Fase 3 — App de operadores + hub depurado
- `app/`: Home nuevo en `/` (saludo, 4 botones grandes, semáforo de los 6 slots del
  día combinando BD + sesión local IndexedDB), bottom-nav Inicio/Recorrido/Pesaje/
  Tratamiento/Traslado, login con redirect a `/`.
- `hub/`: sidebar sin Registrar (Dashboard/Tachos/Equipos/Historial/Reportes/Admin),
  página **`/history`** con tabs Recorridos/Pesajes (componentes de shared, edición
  de coordinador), header móvil propio, login con redirect a `/dashboard`.
- La cadena de captura de fotos (`photo-capture-multi`, `capture-photo`,
  `photo-watermark`, `data/photos`) se movió a shared porque Equipos (hub) también
  la usa. Los imports de Capacitor son dinámicos con try/catch (seguros en web).

### Fase 4 — Capacitor
- `npx cap sync android` desde `app/` regeneró los gradle → `../../node_modules/...`.
- ⚠️ **Pendiente**: compilar el APK (`cd app/android && gradlew assembleDebug`) — en
  esta máquina no hay ningún JDK instalado; el `app-debug.apk` presente es previo.

### Fase 5 — Dashboard renovado (hub)
- `shared/src/lib/data/dashboard-analytics.ts` (15 tests): kg por tipo de desecho
  (sin tipo → "Sin clasificar"), serie diaria 30d, comparativa mensual, acumulado
  anual, promedio por tacho, tachos estancados (top-N por `sinceMs`), cumplimiento
  de slots, stats de recorridos 7d vs 7d, actividad por operador, indicadores de
  calidad (observaciones, anulaciones, recorridos sin firma/fotos), desglose de flota.
- 8 secciones nuevas en `hub/src/components/dashboard/`. La tarjeta de equipos es la
  única async (equipos no viven en el store). Paleta categórica de tipos de desecho
  validada con el validador CVD del skill dataviz; identidad siempre por label
  directo (barras horizontales), el color es refuerzo.

## Verificación
- Tests: shared 130 + hub 35 + app 14 = 179 jest, vitest 12. Builds de hub y app
  verdes (`--webpack`).
- Revisión visual del dashboard en dev con el histórico Airkem (acumulado 2026 =
  253,991.71 kg ✓; estancados con 66d desde el fin del histórico ✓).

## Deploy en Vercel (2026-07-22, configurado)

Proyecto **`sistema-ptdp`** (team Sebastian's projects), conectado por Git al repo
`Leofrandex/sistema-plata`, rama `main`. Configuración aplicada vía API:
`rootDirectory: "hub"` + `sourceFilesOutsideRootDirectory: true` → cada push a
main despliega **solo el hub**. Dominio público (exento de Deployment
Protection): **https://sistema-ptdp.vercel.app**. Fixes que exigió el monorepo:
el install de Vercel no incluye las devDependencies del root, así que hub/app
declaran su propio toolchain (tailwind/typescript/@types); `@capacitor/core+camera`
declarados en shared (los usa `capture-photo` con import dinámico); tests y
configs de jest excluidos del type-check de `next build`. No crear un repo
aparte para el hub: depende de `shared/` y los workspaces.

## Pendiente
- Compilar/instalar el APK cuando haya JDK (Android Studio) y E2E manual en
  dispositivo (cámara, offline, sync).
- E2E manual de roles: coordinador→hub, operador→app, operador→hub denegado.
- Deploy del hub: apuntar el hosting a `npm run build:hub` con output `hub/out`.
