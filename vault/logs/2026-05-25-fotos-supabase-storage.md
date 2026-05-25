---
title: Fotos → Supabase Storage (upload + hidratación con URLs firmadas)
tags:
  - log
  - supabase
  - storage
  - fotos
  - pilot
date: 2026-05-25
updated: 2026-05-25
---

# Fotos migradas a Supabase Storage

## Contexto

Última pieza pendiente de la integración Supabase para el piloto. Hasta ahora la
infraestructura existía (bucket privado `photos`, queries en
`queries/photos.ts`) pero **`uploadPhoto` no se llamaba desde ningún componente**:
las pantallas capturaban data URLs (base64 vía `FileReader`) y los guardaban solo
en el store Zustand (`addPhoto`), perdiéndose al recargar. La tabla `public.photos`
tenía 0 filas y el bucket estaba vacío.

## Qué se hizo

### Capa de queries (`src/lib/supabase/queries/photos.ts`)
- `uploadPhotoFromDataUrl()` — variante de `uploadPhoto` que recibe el data URL
  que producen `PhotoCapture`/`PhotoCaptureMulti`, lo convierte a Blob
  (`dataUrlToBlob`) y sube.
- `listAllPhotos()` — bulk para hidratar el store.
- `getPhotoUrls()` — firma URLs en lote (`createSignedUrls`), devuelve `Map id→url`.
- TTL de URL firmada subido de 1 h → **24 h** (cubre jornada + reportes posteriores
  sin recargar).

### Helper compartido (`src/lib/data/photos.ts`)
- `uploadEventPhotos()` — sube N data URLs, registra en `public.photos` y devuelve
  objetos `Photo` (forma del store) con URL firmada lista para mostrar.
  **Best-effort**: si una foto falla, se loguea y se omite; no aborta el cierre
  del recorrido ni la recepción.

### Write-through en las pantallas
- **Pesaje** (`weighing/page.tsx`): `handleCreateReception` y `handleSaveEdit`
  suben las 2 fotos (envase + balanza) tras crear la reception. El `photo_ids` de
  la reception ahora usa los **IDs reales de la BD**.
- **Recorrido andén** (`anden/[slot]/page.tsx`) y **morgue** (`morgue/page.tsx`):
  `handleFinish` sube todas las fotos del recorrido antes de cerrar el evento.

### Hidratación (`src/components/supabase-hydrator.tsx`)
- Carga `listAllPhotos` + firma URLs y vuelca `photos` al store.
- Reconstruye los `photo_ids` inline de **receptions** y **routeEvents** desde un
  índice `event_id → photo_ids[]` (las fotos son polimórficas: `event_type` +
  `event_id`, sin FK).

### Config (`next.config.ts`)
- `images.remotePatterns` ahora permite `*.supabase.co` en `/storage/v1/object/**`
  para que `next/image` (galería de envases) renderice las URLs firmadas. El PDF de
  reportes usa `@react-pdf/renderer` (no requiere config).

## Decisiones de diseño

- **Subir al finalizar / al crear la reception**, no en cada captura: el data URL
  ya da preview instantáneo en el formulario; la subida ocurre cuando el evento se
  confirma (mismo momento en que ya se persistía a Supabase).
- **URLs firmadas (no público)**: el bucket es privado. Se firman a 24 h en
  hidratación y al subir. Si la sesión dura >24 h, recargar refresca las URLs.
- **Best-effort por foto**: una foto que falla no debe bloquear el registro
  operativo (prioridad piloto = no perder pesajes/recorridos).

## Verificación

- Typecheck: **0 errores** en código fuente (los errores de `tsc` son solo en
  archivos `__tests__/` por globals del runner — preexistente).
- ESLint: **0 errores** en los archivos tocados.
- vitest: 12/12. jest: 55 passed (2 fallos preexistentes en `button`/`input-field`
  por usar `vi` bajo jest — ajenos a este cambio).
- **Pendiente**: prueba E2E manual contra Supabase (tomar foto en pesaje/recorrido
  → confirmar fila en `public.photos` + objeto en bucket → recargar → ver foto en
  reporte y galería).
