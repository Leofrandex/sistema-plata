---
title: Header del Registro Fotográfico con logos RIGA + CPCH
tags:
  - logs
  - reports
date: 2026-06-01
---

# Header del Registro Fotográfico — logos RIGA + Ciudad de la Salud

## Qué cambió

El reporte fotográfico (`src/components/reports/photographic-report-document.tsx`) tenía
solo el título "REGISTRO FOTOGRÁFICO" centrado. Se agregó una **banda de header fija** por
página con tres elementos:

- **Izquierda:** logo de Constructora RIGA (contratista) — `public/logo-riga.png`.
- **Centro:** título "REGISTRO FOTOGRÁFICO".
- **Derecha:** logo de CPCH / Ciudad de la Salud (consorcio cliente) — `public/logo-cpch.jpg`.

La barra de metadatos (`Edificio`, `Ubicación`, `Empresa`, `Fecha`) queda igual, debajo del header.
Los assets fuente los entregó el usuario en la raíz (`logo-black.png` → RIGA, `BrW1JbIM.jpg` → CPCH)
y se copiaron a `public/` con nombres limpios.

## Por qué RIGA izq · CPCH der

Decisión del usuario (formato clásico de reporte de obra: contratista a la izquierda, consorcio
cliente a la derecha). Ver [[PhotoDocumentation]] § Formato del informe.

## Demo

Se generó un preview con las **fotos reales del piloto** en Supabase (cliente "Centro de la
Salud", 20 fotos del 2026-05-25 y 2026-05-27) vía `scripts/demo-report-preview.mjs` (sharp+SVG,
replica el layout del componente). Salida: `demo-report-page{1,2}.png` en la raíz.

> [!note] Acceso a las fotos para el demo
> El bucket `photos` es privado y la columna `photos.url` está vacía. Para descargar las fotos
> del demo se expuso el bucket como público de forma temporal y **se revirtió a privado en la
> misma sesión** (verificado). El render real en producción usa URLs firmadas vía `getPhotoUrls`.

## Verificación

- `tsc --noEmit`: sin errores nuevos en `photographic-report-document.tsx`.
- `jest src/__tests__/lib/reports.test.ts`: 10/10 OK.
- Pendiente: E2E manual (descargar el PDF desde `/reports` con sesión iniciada y confirmar que
  los logos cargan desde `public/`).
