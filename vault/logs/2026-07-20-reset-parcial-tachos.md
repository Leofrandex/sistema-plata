---
title: Reset parcial de datos operativos (hasta el 13-jul)
tags: [log, supabase, datos]
updated: 2026-07-20
---

# Reset parcial de datos operativos (2026-07-20)

El usuario pidió resetear los tachos a estado inicial. Al ir a ejecutar se detectó
**uso activo en ese momento** (recorrido de hoy `in_progress` + sesión de pesaje
recién abierta), así que se optó por un **reset parcial**: borrar solo lo del
**6 al 13 de julio** y conservar el trabajo del sábado 18 y del lunes 20.

## Qué se borró (proyecto `xqqnthyipkdkwyknbtnw`)

| Tabla | Borradas | Quedan |
|---|---|---|
| `route_events` (6–11 jul) | 11 | 3 (2 del 18-jul + 1 de hoy) |
| `route_event_containers_dirty` / `_clean` | 94 / 87 | 24 / 25 |
| `weighing_sessions` (9-jul y 11-jul, atascadas `in_progress`) | 2 | 2 (18-jul y hoy, ambas aún `in_progress`) |
| `container_receptions` (4 pesajes del 068 sin empresa) | 4 | 7 (del 18-jul, con empresa Airkem) |
| `photos` (de los eventos borrados) | 58 | 26 |

Con esto los ~57 tachos "pendiente por pesar" acumulados de la semana del 6–11
vuelven a estado limpio/en planta. Los tachos del 18 y de hoy conservan su ciclo.

## Respaldo previo

`backups/2026-07-20-reset-tachos/` (gitignored): `routes-weighing-receptions.json`
y `storage-treatment-locations-transfers-photos.json`. Igual que en el reset del
06-jul, es metadata — los binarios de fotos viven en el bucket y quedan huérfanos
(mismo pendiente de limpieza vía Storage API).

## Pendientes que siguen vivos

- Sesiones de pesaje del 18-jul y de hoy siguen `in_progress`; con el APK del
  20-jul (fix "finalizar con pendientes") el operador ya puede cerrarlas.
- Recepción del 18-jul con `gross_weight_kg=292` en el tacho 033 — casi seguro
  error de tipeo (los demás pesan 14–40 kg). Corregir o anular.
- Objetos huérfanos en el bucket `photos` (los 455 del reset anterior + 58 de hoy).
