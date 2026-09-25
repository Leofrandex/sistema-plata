---
title: El pesaje sobrevive a que Android cierre la app con la cámara abierta
tags:
  - log
  - apk
  - pesaje
  - fotos
date: 2026-09-25
updated: 2026-09-25
---

# 2026-09-25 — El pesaje sobrevive a que Android cierre la app con la cámara abierta

## Síntoma (reportado por planta)
A veces, al tomar una foto en Pesaje, el APK vuelve al Home y hay que entrar de nuevo. Lo ya
registrado no se pierde (vive en el LocalStore); sí se pierde lo que estaba en el formulario:
tacho, peso y la foto recién tomada.

## Causa (probable, sin confirmar en dispositivo)
"Tomar foto" abre la app de cámara de Android y el APK queda en segundo plano. Con poca memoria,
Android mata el proceso. Al volver, la app arranca de cero en `/`.

Hay una variante con el mismo síntoma: el sellado de una foto de 1920 px agota la memoria del
renderer del WebView al volver, y Capacitor no maneja `onRenderProcessGone`, así que Android cierra
la app.

Se descartó que sea código propio: al volver a primer plano solo se redirige a `/login`, y solo si
la sesión expiró.

## Qué se hizo
- **Borrador del pesaje** (`app/src/lib/weighing-draft.ts`): se guarda en Preferences 400 ms después
  de cada cambio y, sí o sí, antes de abrir la cámara, anotando qué hueco se está fotografiando.
  Caduca a los 15 min y solo se restaura en la misma sesión de pesaje.
- **Al arrancar** (`AppLifecycle`): si la app abrió en `/` y hay un borrador reciente, vuelve a
  Pesaje. Si Android entrega la foto pendiente (`appRestoredResult` de Camera), se sella y se
  coloca en su hueco.
- **Diagnóstico:** `/diagnostico` muestra los últimos cierres según Android (`ApplicationExitInfo`,
  Android 11+). `LOW_MEMORY` en segundo plano confirma la causa.
- La captura a 1280 px (ver [[2026-09-25-informe-fotografico-liviano]]) baja la memoria de la
  variante del renderer.

## Pendiente
- Probar en un teléfono con "No conservar actividades" (opciones de desarrollador): simula que
  Android mate la app al abrir la cámara.
- Después del rollout de v1.9, pedir a planta una captura de `/diagnostico` la próxima vez que pase.
