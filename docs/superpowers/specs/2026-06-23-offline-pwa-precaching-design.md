# Diseño — Resiliencia offline de la PWA: precaching + verificación (paso previo al APK)

**Fecha:** 2026-06-23
**Estado:** Aprobado (brainstorming) — pendiente de plan de implementación
**Alcance:** Opción A — arreglar las fallas offline en la PWA actual y verificarlas en modo avión, *antes* de empaquetar en APK.

---

## Contexto

En campo la conexión es muy inestable. El objetivo de largo plazo es un APK que los operadores
instalen, que guarde todo en el teléfono y suba una cola pendiente al recuperar señal. Pero el
motor local-first **ya existe** desde el 2026-06-19 (`logs/2026-06-19-offline-outbox-campo.md`):
outbox en IndexedDB (`hospiwaste-offline`), blobs de foto, cola idempotente con drenaje al
reconectar. Lo que el APK aporta encima es durabilidad del almacenamiento, arranque en frío sin
red e instalación sin fricción — **no** reimplementar la cola.

### Prueba de campo que disparó esto (2026-06-23)

1. **Falla 1 — navegación offline rota.** Tras entrar y poner el teléfono en modo avión, navegar
   de `/dashboard` a `/register` mostró "la página no carga".
2. **Falla 2 — guardado offline bloqueado.** Con conexión, se inició un recorrido; en modo avión
   se llenaron todos los campos del andén, pero "Guardar andén y agregar otro" no avanzó hasta
   recuperar conexión.

El deploy probado es **el actual** (`main` en Vercel), no uno desfasado. Por tanto la Falla 2 es
un bug real en producción, no un problema de versión.

## Hallazgos del código

- `next.config.ts` envuelve con `next-pwa` usando la config por defecto (`register`, `skipWaiting`)
  **sin `runtimeCaching` ni `fallbacks`**. La config por defecto no cachea la navegación entre
  rutas del App Router: cada navegación pide el documento/RSC al servidor → falla sin red.
- El camino de **crear** andén (`src/app/register/route/anden/[slot]/page.tsx`,
  `handleCreateAnden`) es local-first puro: `submitRouteEvent` + `enqueueEventPhotos`, sin tocar
  red; abrir IndexedDB no requiere red. En teoría debería funcionar offline.
- El camino de **editar** andén (`handleUpdateAnden`) sí es online a propósito (llama a
  `q.updateRouteEvent` y hace `alert` si no hay red) — fuera de alcance offline por decisión previa.
- `src/lib/data/field-writes.ts`, `enqueueEventPhotos` (`src/lib/data/photos.ts`) y `src/lib/idb.ts`
  no tienen dependencias de red en el camino de creación.

## Hipótesis de causa raíz (a confirmar, no asumir)

**Causa común para ambas fallas: el service worker de `next-pwa` no precachea todos los chunks.**
Offline, cualquier cosa que dispare la carga de un chunk (navegar a otra ruta, o un `import()`
diferido dentro de la página) falla al ir a la red. Eso explica la Falla 1 (navegación) y *podría*
explicar la Falla 2 si el guardado o un componente lazy (cámara, canvas de firma) necesita un chunk
no cacheado. Si la hipótesis es correcta, arreglar el precaching resuelve ambas — pero **se valida
con el error real capturado en Fase 0**, no por suposición.

---

## Diseño por fases

### Fase 0 — Reproducir y capturar el error real

Objetivo: obtener el error exacto antes de tocar el fix de la Falla 2.

- Conectar el teléfono por USB a Chrome DevTools (remote debugging) **o** embeber un visor de
  consola en el móvil (`eruda` o `vConsole`) detrás de una flag, para ver consola/red en el propio
  dispositivo.
- Reproducir en modo avión: (a) navegar `/dashboard` → `/register`; (b) en un recorrido iniciado,
  guardar un andén.
- Registrar el error de consola/red de cada caso. Determina si la Falla 2 es chunk-loading (misma
  causa que Falla 1) o un fallo distinto en el guardado.

**Criterio de salida:** error de ambas fallas documentado.

### Fase 1 — Arreglar el precaching del PWA

- Configurar `runtimeCaching` en `next-pwa`:
  - **Documentos / navegación / RSC:** `NetworkFirst` con fallback a caché (para que la navegación
    offline sirva la última versión cacheada en vez de fallar).
  - **Chunks JS/CSS y assets estáticos:** `StaleWhileRevalidate` o `CacheFirst`.
  - **Imágenes (incl. URLs firmadas de Supabase Storage):** estrategia acorde, sin romper el
    `next/image` ya permitido en `next.config.ts`.
- Añadir un `fallbacks` de documento offline para navegaciones a rutas aún no visitadas.
- Verificar: navegación entre rutas y **arranque en frío** (cerrar la app y abrir en modo avión).

**Criterio de salida:** navegación offline funciona, incluido arranque en frío.

### Fase 2 — Cerrar Falla 2 (solo si persiste tras Fase 1)

- Si tras arreglar el precaching el guardado offline sigue bloqueado, entra `systematic-debugging`
  sobre el camino concreto, usando el error capturado en Fase 0.
- Candidatos acotados (no rediseño): excepción en `enqueueEventPhotos`/`putPhotoBlob`; botón
  deshabilitado porque una foto/firma no se registró offline; chunk lazy de cámara/firma.

**Criterio de salida:** guardar andén nuevo y "agregar otro" funciona en modo avión.

---

## Verificación (gate de cierre del proyecto)

E2E manual en modo avión:

- [ ] Navegar entre rutas offline (incl. arranque en frío con la app cerrada).
- [ ] Crear recorrido + 2 andenes consecutivos sin red (la pantalla avanza y los muestra).
- [ ] Reconectar → el outbox drena a 0.
- [ ] Verificar en Supabase que no hay duplicados.
- [ ] Recargar la app a mitad (con pendientes) → los registros locales no desaparecen.

---

## Fuera de alcance

- **APK con Capacitor.** Es el proyecto siguiente, con su propio spec, una vez verificado el offline
  en la PWA. Aporta durabilidad del almacenamiento (Android puede desalojar IndexedDB de una PWA),
  arranque en frío garantizado (assets dentro del `.apk`) e instalación sin fricción. No reimplementa
  la cola: reutiliza el motor local-first existente.
- **Edición/cancelación/anulación offline.** Siguen online por decisión previa
  (`logs/2026-06-19-offline-outbox-campo.md`).

## Riesgos / notas

- Hacer App Router + `next-pwa` navegable 100% offline es conocidamente delicado; la estrategia de
  caché de documentos/RSC es la parte de mayor riesgo y donde se concentra la verificación.
- Si Fase 0 revela que la Falla 2 **no** comparte causa con la Falla 1, Fase 2 deja de ser
  condicional y necesita su propio ciclo de debugging.
