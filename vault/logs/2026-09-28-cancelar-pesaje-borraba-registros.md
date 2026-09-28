---
title: "Cancelar" en Pesaje borraba los pesajes de otro operador
tags:
  - log
  - apk
  - pesaje
  - trazabilidad
date: 2026-09-28
updated: 2026-09-28
---

# 2026-09-28 — "Cancelar" en Pesaje borraba los pesajes de otro operador

## Cómo se encontró
El 18-09 tenía 35 pesajes contra ~75–107 de los días vecinos. La pregunta era si la app había
fallado o si los operadores no la usaron. Ninguna de las dos: había **fotos de pesaje sin pesaje**,
es decir, fotos subidas cuyo registro ya no existe:

| Día | Pesajes perdidos | Fotos de |
|---|---|---|
| 16-09 | 4 | Nodier Pinilla |
| 18-09 | 20 | Gregory Tenorio (16), Nodier Pinilla (4) |
| 20-09 | 3 | Aldair Díaz |
| 26-09 | 8 | Gregory Tenorio |

## Causa (confirmada con los logs del 26-09)
- 12:21–12:29: Gregory abre una sesión y registra 8 pesajes. El servidor responde `201`; llegaron.
- Gregory no finaliza la sesión.
- 15:54: Aaron Vasquez, en **el mismo teléfono** (Honor ALT-NX3, Android 15), toca "Cancelar".
  El servidor recibe `DELETE container_receptions` + `DELETE weighing_sessions` (204).

La sesión activa se guarda por **día y teléfono**, no por operador, así que el del turno siguiente
la veía como propia. Y "Cancelar" hacía un **borrado físico** de sesión y pesajes (servidor y
LocalStore); solo quedaban las fotos. Para el 16, 18 y 20 ya no quedan logs, pero el rastro es
idéntico.

## Arreglo (APK v1.11)
Las reglas viven en `app/src/lib/weighing-session-rules.ts`:
- **"Cancelar" solo aparece con la sesión vacía.** Con pesajes, lo único posible es finalizar.
- **La sesión de otro operador se muestra como tal:** "Sesión abierta de Gregory Tenorio · N tachos",
  con el formulario bloqueado. Se puede finalizar (guarda sus pesajes) y después iniciar la propia.

## Recuperación (2026-09-28)
Se leyeron las 70 fotos: número de tacho y visor de la balanza. El usuario aprobó la tabla y se
cargaron **34 pesajes** en 5 sesiones `completed` (una por operador y día):
- `id` de la recepción = `event_id` de sus fotos, así que las fotos quedan vinculadas.
- `arrived_at` = hora de la foto; operador = quien la subió.
- `infectious`, Airkem (ION para 193 y 195).
- Observación "Recuperado desde fotos — sesión borrada con Cancelar (2026-09-28)".

Total: 946,5 kg netos. El #27 (085, 20-09, 39,5 kg) **no se cargó**: Aldair lo re-registró a las
07:20 con el mismo peso; sus 2 fotos quedan sueltas a propósito.

Lecturas dudosas, a confirmar con planta:
- 18-09 07:18 → `021` (número ilegible).
- 18-09 07:08 → `008` (un solo dígito pintado).

> [!warning] Zona horaria
> Planta está en **America/Panama (UTC−5)**, no en Caracas. Las horas de reportes y análisis se
> expresan en hora de Panamá: el sello de las fotos y el locale `es-PA` ya lo usan.
