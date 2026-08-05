---
title: Fix — la cola de pesaje excluía para siempre a todo tacho ya pesado
tags:
  - log
  - fix
  - pesaje
updated: 2026-07-28
---

# 2026-07-28 — Fix: cola de pesaje bloqueada tras el primer pesaje

## Cómo se detectó

Reporte de campo: en el recorrido de las 06:30 del 2026-07-28 se registraron los tachos
186, 1, 127, 157, 97, 130 y 149 en el andén 3, y "hubo problemas con la carga de data"
porque el sitio no tiene señal.

La validación contra Supabase descartó el problema de sincronización: los 7 tachos
estaban cargados, sin anular, con 24 fotos de sucios + 23 de limpios + 12 firmas subidas,
la última 2 segundos antes del cierre del recorrido. **El offline funcionó.**

Lo que sí falló fue otra cosa: **3 de los 7 (130, 157, 149) nunca aparecieron en la cola
de pesaje**, así que el operador no podía seleccionarlos. No era falta de señal.

## Causa raíz

`getPendingWeighingContainerIds` comparaba existencia en vez de fechas — ver ADR
`decisions/2026-07-28-cola-pesaje-por-fecha.md` para el detalle y las alternativas.

Los tachos 130 y 157 se habían pesado el 2026-07-23 y el 149 el 2026-07-24. Desde
entonces eran invisibles para el pesador, aunque el dashboard los siguiera mostrando
como "Pendiente por pesar".

El síntoma que el coordinador percibía como "no se cargaron unos tachos" era en realidad
**"el operador no podía seleccionarlos"**. Vale la pena tenerlo presente: un reporte de
campo sobre conectividad terminó siendo un bug de derivación en tiempo de lectura.

## Cambio

`shared/src/lib/data/containers.ts` — pendiente = última recogida sucia posterior al
último pesaje vigente. Se conserva el comportamiento de recepciones anuladas (devuelven
el tacho a pendiente) y la exclusión de `is_yaris_container`.

Sin migración: el bug era de lectura, así que los tachos afectados reaparecen solos al
desplegar. No se tocó ningún dato.

## Verificación

- TDD: test RED reproduciendo el caso real del 130 (recogido 28-jul, pesado 23-jul),
  verificado fallando antes de implementar. El test de multi-recorrido se validó por
  mutación (`Math.max` → `Math.min`) para confirmar que sí detecta la regresión.
- `npm test` 212/212 (160 shared + 35 hub + 17 app).
- `build:hub` y `build:app` verdes, `cap sync android` regenerado.
- **APK compilado**: `app/android/app/build/outputs/apk/debug/app-debug.apk` (30.2 MB),
  `versionCode` 1 → 2, `versionName` "1.0" → "1.1". Sin subir el `versionCode` los
  teléfonos con la app instalada rechazan la actualización.
- Contraste con datos reales del piloto: 83 tachos pendientes con la regla nueva, de los
  cuales **41 estaban invisibles** con la regla anterior.

> [!note] JDK
> El APK sí compila con el Temurin 21 embebido en la extensión Java de Antigravity
> (`~/.antigravity/extensions/redhat.java-*/jre/21.0.10-win32-x86_64`), pasándolo como
> `JAVA_HOME` a `gradlew`. Queda corregida la nota de logs anteriores que daba el APK
> por bloqueado ("falta JDK").

## Pendiente

- **E2E en dispositivo**: instalar el APK y confirmar que 130, 157 y 149 aparecen en la
  cola. No verificado en hardware.
- **Área mal atribuida (sin corregir)**: en el recorrido del 06:30 los tachos 127, 157,
  097 y 130 quedaron registrados en área "Pediatría" pese a estar físicamente en el
  andén 3. Es corregible desde el Historial del hub (rol coordinador). Falta decidir si
  fue error de captura del operador o un problema de cómo el flujo multi-andén asigna
  el área.
- **Sesiones de pesaje que no se cierran**: quedaron `in_progress` las 2 sesiones del
  28-jul, 1 del 27-jul y 1 del 26-jul con 0 recepciones. Sin diagnosticar.
