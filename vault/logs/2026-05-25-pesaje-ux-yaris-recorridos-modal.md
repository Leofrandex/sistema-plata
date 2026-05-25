---
title: Ajustes UX post-piloto — Pesaje / Yaris / Recorridos / Colores
tags:
  - log
  - pesaje
  - recorridos
  - ux
updated: 2026-05-25
---

# 2026-05-25 — Ajustes post-piloto

Conjunto de correcciones de UX surgidas tras el deploy del piloto 2026-05-21.

## Cambios

### 1. Fix loading bloqueado en /register/weighing y /register/route/anden/[slot]
- Quitado el gate `if (!hydrated) → "Cargando…"` en las tres páginas que tenían sesión activa en IndexedDB (`weighing`, `anden/[slot]`, `morgue`).
- Ahora el render no depende de IDB: `activeSession` arranca en `null` y se actualiza cuando IDB resuelve. Si IDB tarda o falla, la página sigue usable.
- Causa probable del bug reportado: la promesa de `openDB` no resolvía en SPA-navigation en algunos navegadores, dejando `hydrated=false` permanente.

### 2. Concepto "envase dedicado a Yaris"
- Nueva columna `containers.is_yaris_dedicated boolean not null default false` (migration `20260525000000`).
- Tipo `Container` extendido (opcional para compat con mocks/histórico).
- `SupabaseHydrator` lee el flag.
- `admin/containers`: nueva columna "Yaris" con toggle por fila, y checkbox al crear envase.
- `admin/containers` ahora persiste a Supabase en alta y dar-de-baja (antes solo escribía al store local).

### 3. Restructura del formulario de Pesaje
- Primera fila: dos selectores lado a lado — "Número de envase" (normal) y "Envase Yaris". Solo uno activo según el toggle de modo Yaris.
- Peso bruto: input más compacto (`max-w-[12rem]`) a la izquierda; **Peso neto** destacado a la derecha en una tarjeta grande con color accent y fuente `text-3xl`.
- Nuevo botón tipo checklist "¿Es un pesaje de Yaris?" justo arriba de Observaciones. Al activarlo se limpia la selección y habilita el selector de envases Yaris.
- Eliminado el hint inline "Peso neto estimado: …" — ahora siempre está en la tarjeta destacada.

### 4. Selección de envases en Recorridos — modal full-screen
- Nuevo componente `ContainerPickerSheet` (`src/components/register/container-picker-sheet.tsx`) — modal full-screen con buscador grande, lista de tarjetas grandes con checkmark multi-select, footer con "Listo".
- `RouteForm` ahora muestra un botón grande "Agregar envases (X seleccionados)" por sección en lugar del selector inline pequeño. Mucho mejor para móvil.
- Aplica tanto a sucios recogidos como a limpios entregados.

### 5. Convención de colores
- **Sucios recogidos** → rojo (antes: amber).
- **Limpios entregados** → verde / emerald (sin cambios).
- Aplicado a headers, badges de envases seleccionados, bordes del botón "Agregar envases", icono del modal, botones de confirmación.

### 6. Rename de estado de envase
- Bucket "En tránsito" del dashboard renombrado a **"Pendiente por pesar"** (`src/lib/data/dashboard-metrics.ts:35`). Solo cambio de label; el bucket key y la lógica se mantienen.

## Archivos afectados (resumen)

- `supabase/migrations/20260525000000_containers_is_yaris_dedicated.sql` (nuevo)
- `src/lib/supabase/database.types.ts` — campo `is_yaris_dedicated` en `containers`
- `src/lib/types.ts` — campo opcional en `Container`
- `src/components/supabase-hydrator.tsx` — mapeo del nuevo campo
- `src/app/register/weighing/page.tsx` — quita gate `hydrated`, calcula `yarisContainers`, deriva `is_yaris_weighing` en edición
- `src/components/register/weighing-form.tsx` — reescrito (yaris dual selector + peso neto destacado + toggle Yaris)
- `src/app/register/route/anden/[slot]/page.tsx` — quita gate `hydrated`
- `src/app/register/route/morgue/page.tsx` — quita gate `hydrated`
- `src/components/register/route-form.tsx` — reescrito (modal picker, colores rojo/verde)
- `src/components/register/container-picker-sheet.tsx` (nuevo)
- `src/lib/data/dashboard-metrics.ts` — label "Pendiente por pesar"
- `src/app/admin/containers/page.tsx` — columna + toggle Yaris, persistencia Supabase
- `src/components/admin/container-form.tsx` — checkbox Yaris al alta
