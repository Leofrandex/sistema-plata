---
title: Rename Hospimed → Hospiwaste · Cámara fría automática · Traslado externo multi-selección
tags:
  - log
  - branding
  - container-lifecycle
  - registration-flow
date: 2026-05-12
---

# 2026-05-12 — Tres cambios operativos

## Resumen

Tres cambios en paralelo sobre la aplicación:

1. **Rename de marca**: la aplicación pasa a llamarse **Hospiwaste**. Cambio aplicado en código, configuración y `CLAUDE.md`. El vault y `docs/` conservan "Hospimed" como historial del proyecto.
2. **Cámara fría automática**: se eliminó el paso manual de "Registrar cámara fría". Tras confirmar el pesaje, el envase queda en cámara fría automáticamente sin foto ni formulario. Mantenemos el evento `StorageEvent` y la `ContainerLocation` — solo desaparece la fricción de UI.
3. **Traslado externo multi-selección**: `/register/transfer` ahora acepta varios envases por sesión usando el mismo patrón acumulativo de `/register/exchange` (badges con remove, botón "Continuar con N envases"). Cada sesión genera N registros `ExternalTransfer` con el mismo `destination`.

## Por qué

- El nombre comercial del producto es Hospiwaste, no Hospimed (que es la empresa). Tener el nombre correcto en la PWA, el login, el sidebar y los PDFs evita confusión con usuarios y stakeholders.
- El paso manual de cámara fría era fricción innecesaria: en la práctica, todo envase pesado entra a cámara fría. Automatizarlo asegura consistencia (siempre se registra) y elimina un trámite con foto que aporta poco valor regulatorio si la foto del pesaje ya documenta el contenedor.
- El traslado externo se hacía envase por envase, lo cual no escala cuando un viaje cubre varios contenedores hacia el mismo centro. El intercambio ya tenía el patrón resuelto — replicarlo era barato.

## Cambios técnicos

### Rename
- Nuevo: `src/lib/constants.ts` exporta `APP_NAME`, `APP_SHORT_NAME`, `APP_DESCRIPTION`, `APP_TAGLINE`. Componentes que muestran el nombre importan de ahí. Strings que viven fuera del runtime de React (manifest, package.json, CLAUDE.md, nombres de identificadores, IndexedDB) se renombraron en su sitio.
- IndexedDB: `hospimed-offline` → `hospiwaste-offline`. Aceptable porque estamos en pre-producción.
- PWA manifest, package.json, package-lock.json, layout metadata, sidebar, mobile header, login, reportes PDF, branding-demo: todos consistentes con `Hospiwaste`.
- URL del sitio corporativo `hospimed.com.pa` en `branding-demo/page.tsx` se mantiene intencionalmente (sitio real de la empresa, no la app).

### Cámara fría automática
- Eliminada la página `src/app/register/storage/page.tsx` y su ruta `/register/storage`.
- Quitado el link "Cámara fría" del sidebar y la entrada en `mobile-header` page titles.
- `src/app/register/weighing/page.tsx` ahora, tras `addReception(...)`, crea automáticamente:
  - Un `StorageEvent` con `entry_at: now`, `exit_at: null`, `photo_ids: []`.
  - Una `ContainerLocation` con `location_type: 'cold_storage'`.
- `computeContainerPhase()` ya retornaba `'cold_storage'` cuando había `reception + storage sin exit_at`, así que el ciclo de vida queda consistente.
- El KPI "En cámara fría" del dashboard ahora se actualiza inmediatamente al confirmar pesaje.
- El reporte PDF (`batch-report-document.tsx`) ya rendereaba la sección "Cámara fría" solo si había fotos — al no haberlas, la sección desaparece sola del PDF.

### Traslado externo multi-selección
- `src/app/register/transfer/page.tsx` reescrito: `selected: Container | null` → `selectedIds: string[]`. Handler acumulativo con guard contra duplicados. UI con badges removibles y botón "Continuar con N envases".
- `handleSubmit()` itera sobre `selectedIds` creando un `ExternalTransfer` por envase con el mismo `destination`. Se preserva el filtro `waste_type !== 'infectious'`.
- Paso 2 muestra resumen con los envases seleccionados como badges read-only antes del input de destino.

## Decisiones

- **Foto regulatoria de cámara fría**: optamos por no exigirla en el paso manual eliminado. Si en el futuro se necesita evidencia fotográfica de cámara fría, se podrá adjuntar desde el detalle del envase. No es parte de este cambio.
- **Vault como historial**: el rename no toca el vault ni `docs/superpowers/specs|plans/`. Estos archivos conservan "Hospimed" como referencia histórica de cómo se llamaba el proyecto. Solo `CLAUDE.md` se actualizó porque es la guía operativa viva.
- **`ExternalTransfer` sigue siendo singular**: una sesión de UI genera N registros con el mismo `destination`. No se cambió el modelo de datos para evitar churn — el agrupamiento es a nivel UI/operación, no a nivel persistencia.

## Verificación

- `npx tsc --noEmit`: 0 errores en código de producción (errores preexistentes en `__tests__/` por tipos de vitest faltantes — no relacionados).
- `npm run test:run`: 12/12 tests pasando.
- `npx eslint` en archivos modificados: 0 errores (4 warnings preexistentes: `alt` props en `<Image>` del PDF e import no usado en `offline-queue`).
- Grep `hospimed` en `src/` y `public/`: solo la URL externa `hospimed.com.pa` (intencional, sitio corporativo).

## Archivos clave tocados

- **Creado**: `src/lib/constants.ts`
- **Modificado**: `src/components/layout/sidebar.tsx`, `src/components/layout/mobile-header.tsx`, `src/app/login/page.tsx`, `src/app/layout.tsx`, `src/lib/store.ts`, `src/lib/offline-queue.ts`, `src/components/reports/report-preview.tsx`, `src/components/reports/batch-report-document.tsx`, `src/app/branding-demo/page.tsx`, `public/manifest.json`, `package.json`, `package-lock.json`, `CLAUDE.md`, `src/app/register/weighing/page.tsx`, `src/app/register/transfer/page.tsx`
- **Eliminado**: `src/app/register/storage/page.tsx` (y carpeta `src/app/register/storage/`)

## Pendientes / capacidades futuras

- **Foto opcional de cámara fría** desde el detalle del envase si el regulador la pide eventualmente.
- **Actualizar `vault/processes/ContainerLifecycle.md`** y `vault/processes/PhotoDocumentation.md` para reflejar que la entrada a cámara fría dejó de tener foto obligatoria — pendiente de confirmar con Francesca si el proceso regulatorio lo acepta.
- **Migración de IndexedDB**: si en algún momento se quiere preservar datos offline históricos al cambiar nombres de DB, agregar lógica de copia. Hoy no aplica.
