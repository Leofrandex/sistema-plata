---
title: Fix — el APK no instalaba en los teléfonos de planta (firma debug vs release)
tags:
  - log
  - fix
  - apk
  - android
  - distribucion
updated: 2026-08-25
---

# 2026-08-25 — Por qué el APK no instalaba en los teléfonos de planta

## Síntoma

Los teléfonos de planta (Honor X6) daban "no se puede instalar la aplicación" al intentar
actualizar. El Pixel del desarrollador y un Samsung A17 sí instalaban. La hipótesis
inicial era una incompatibilidad con la versión de Android del Honor.

## Esa hipótesis era falsa

Nada en el build es específico de una versión de Android:

| Chequeo | Valor | ¿Explica el fallo? |
|---|---|---|
| `minSdkVersion` | 24 (Android 7) | No |
| `targetSdkVersion` | 36 | No — un targetSdk mayor que el SO instala igual |
| Historial de `variables.gradle` | 24/36/36 desde el primer commit | No — nunca cambió |
| ABIs | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` | No |
| Alineación de 16 KB (`zipalign -P 16`) | verification successful | No |
| Firma | v2 ✅ (v1 desactivado) | No para Android ≥ 7 |

## Causa real: dos APKs con la misma versión y distinta llave

| APK | versionCode/Name | Firmado con |
|---|---|---|
| `apk/debug/app-debug.apk` (28-jul) | 2 / 1.1 | `CN=Android Debug` — llave genérica |
| `apk/release/app-release.apk` (11-ago) | 2 / 1.1 | `CN=Sebastian Castro, OU=oito` — llave real |

[[2026-07-28-fix-cola-pesaje-ciclo-reabierto]] documenta que lo distribuido en julio
fue el **de debug**. Android no permite cambiar la llave de firma sobre una app instalada:
el intento devuelve `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, cuyo mensaje al usuario es
literalmente "no se puede instalar la aplicación". No depende del modelo — depende de si el
teléfono ya tenía el build de debug.

Confirmado en el Pixel por `adb`: firma `d4de0f31…` (la real), instalado el 30-jun y
actualizado el 12-ago. Nunca tuvo el debug, por eso siempre actualizó sin problema.

Segundo defecto acumulado: ambos APKs eran `versionCode` 2, así que aun con la firma
correcta un teléfono con el 2 instalado rechazaba la actualización.

## Qué hacer

1. **Distribuir siempre el APK de `release/`**, nunca el de `debug/`. La llave de debug no
   es tuya, no es reproducible y es la que causó esto.
2. En los teléfonos que tienen el build de julio: sincronizar la cola **con red** hasta
   dejarla vacía, desinstalar, e instalar el release. Desinstalar borra la base local
   (SQLite + fotos), así que el orden importa.
3. Los teléfonos sin la app instalada no necesitan el paso de desinstalar.
4. De acá en adelante las actualizaciones son instalación encima, sin desinstalar, porque
   la llave ya no cambia. Subir `versionCode` en cada build.

> [!warning] Pendiente operativo
> Al 2026-08-25 los teléfonos de planta siguen con el build de debug del 28-jul, que además
> trae los dos bugs de [[2026-08-25-fix-sesion-apk-preferences-sqlite]]. La migración a
> v1.2 (versionCode 3) está sin hacer.
