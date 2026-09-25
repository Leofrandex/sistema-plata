---
title: Informe fotográfico liviano y sin huecos + fotos más livianas al capturar
tags:
  - log
  - reportes
  - fotos
  - apk
date: 2026-09-25
updated: 2026-09-25
---

# 2026-09-25 — Informe fotográfico liviano y sin huecos

## Problemas
- **Recuadros en blanco:** @react-pdf descargaba todas las fotos a la vez desde Storage. Las que
  fallaban quedaban vacías, sin aviso. Las fotos sí estaban en la base: todos los pesajes tienen
  sus 2 fotos y los archivos existen.
- **PDF de 500 MB:** cada foto entraba a tamaño original (1920 px, JPEG 0,9, ~340 KB) aunque se
  imprime en un recuadro de ~3 cm.

## Qué se hizo
1. **El hub prepara las fotos antes de armar el PDF** (`hub/src/lib/report-images.ts`): 6 descargas
   en paralelo, 3 reintentos, y reducción a 480 px en JPEG 0,7. La foto que no carga sale como
   "Foto no disponible" y el hub avisa cuántas faltaron. El PDF se arma recién al hacer clic, con
   el avance "Preparando fotos X de Y".
2. **Fotos más livianas al capturar** (`shared/src/lib/photo-watermark.ts`, `capture-photo.ts`):
   1280 px y JPEG 0,75 (~110 KB) en vez de 1920 px y 0,9 (~340 KB). Solo aplica a fotos nuevas y
   **cuando los teléfonos tengan el APK nuevo**.
3. El informe muestra **Edificio 4E** en la barra de metadatos.

## Medido en el navegador (2026-09-25, sesión de coordinador)
- ION, semana 21–25/09: 34 fotos → **0,76 MB** (antes ~11,5 MB).
- Airkem, misma semana: 864 fotos → **16,6 MB**, 0 faltantes (antes ~290 MB).
- Se leen los pesos del visor y los números de tacho con el PDF ampliado.
- Velocidad: ~1,8 fotos/s tanto con 6 como con 12 descargas en paralelo. Manda el ancho de banda,
  así que una semana de Airkem tarda ~8–10 min con las fotos viejas. Con fotos de 110 KB debería
  bajar a ~3 min.

## Decisiones
- **No se recomprimen las 4.480 fotos existentes:** es irreversible (son evidencia regulatoria) y
  el informe ya no las necesita livianas.
- **No se capturan a 480 px:** el detalle perdido no se recupera si una auditoría lo pide.

## Pendiente
- Si 8–10 min por informe semanal molesta antes del rollout del APK: las transformaciones de
  imagen de Supabase (plan Pro) servirían las fotos ya reducidas desde el servidor, también las
  viejas. Tienen costo por imagen.
