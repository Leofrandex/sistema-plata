---
title: Firma por recorrido + saludo con nombre en dashboard + redacción pesaje
tags:
  - log
  - recorrido
  - firma
  - dashboard
  - pesaje
updated: 2026-06-16
---

# Firma por recorrido + saludo dashboard + redacción pesaje

**Fecha:** 2026-06-16
**Rama:** `feat/lote-fotos-persistencia-traza`
**Spec:** `docs/superpowers/specs/2026-06-15-firma-recorrido-saludo-dashboard-redaccion-pesaje-design.md`
**Plan:** `docs/superpowers/plans/2026-06-15-firma-recorrido-saludo-dashboard-redaccion-pesaje.md`

## Qué cambió

Tres ajustes post-lanzamiento:

1. **Firma dibujada por registro de recorrido** (andén y morgue), **obligatoria** y
   distinta por registro.
2. **Saludo con nombre** en el dashboard: "Buenos días, Karolyne".
3. **Redacción** de la opción "Tratar inmediatamente" en pesaje → el texto descriptivo
   ahora es "Marcar para enviar el tacho directamente a tratamiento".

## Decisión clave: la firma es una foto con `role='signature'`

En vez de agregar una columna/migración, la firma se persiste como una fila en
`public.photos` con `role='signature'` (el campo `role` ya es texto libre desde el lote
de fotos por categoría). Esto **reutiliza todo el pipeline existente**:

- Subida: `uploadEventPhotos(..., role: 'signature')`.
- Hidratación: `groupRoutePhotosByRole` extendido devuelve `signatureByEvent` (una firma
  por evento; **si hay varias, gana la última** → re-firmar deja la previa como huérfana).
- El campo derivado `RouteEvent.signature_photo_id` se rellena al hidratar y se resuelve
  contra el array `photos` del store para reconstruir la firma al editar un andén.

**Por qué:** cero migración, consistente con el manejo de fotos sucios/limpios, y el
reporte/traza ya "ven" la firma vía `event_id` sin trabajo extra.

## Obligatoriedad

Validada en UI (igual que las fotos): `canSaveAnden` (andén, crear/editar) y `canFinish`
(morgue) exigen `!!formState.signature || !!existingSignature`. No hay constraint en DB
(patrón actual del proyecto).

## Componente

`src/components/register/signature-pad.tsx` — `SignaturePad`: tarjeta colapsada
"tocá para firmar" que abre un overlay full-screen con `<canvas>` (pointer events nativos,
DPR-aware, sin librerías); exporta PNG data URL. Integrado en `RouteForm` (compartido por
andén y morgue). Morgue no tiene modo de edición de firma existente (registro único que se
finaliza).

## Deuda conocida (heredada, no nueva)

Re-firmar o quitar una firma deja la fila/archivo previo huérfano en Supabase — mismo
comportamiento que las fotos sucios/limpios. Pendiente: limpieza.

## Fuera de alcance

Firma en el reporte fotográfico PDF (solo se captura y persiste por ahora).

## Verificación

`npm run test:jest` 82/82 (antes 81; +1 test de `groupRoutePhotosByRole` para `signature`).
`next build` OK. Pendiente: E2E manual de la firma (dibujar/guardar/editar/re-firmar) en
andén y morgue.
