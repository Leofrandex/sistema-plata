---
title: Reset de datos operativos (tercero del piloto)
tags:
  - log
  - supabase
  - datos
updated: 2026-07-28
---

# Reset de datos operativos (2026-07-28)

Segundo "empezar de cero" documentado del piloto (ver `logs/2026-07-06-reset-datos-piloto.md`).
Proyecto Supabase `hospiwaste` (`xqqnthyipkdkwyknbtnw`).

Alcance decidido por el usuario: **solo datos operativos**, conservando master data.

## Qué se borró

`TRUNCATE ... RESTART IDENTITY` de 10 tablas. Rango de datos afectado: 2026-07-18 → 2026-07-30.

| Tabla | Filas borradas |
|---|---|
| `route_events` | 43 |
| `route_event_containers_dirty` / `_clean` | 348 / 335 |
| `weighing_sessions` | 22 |
| `container_receptions` (los **pesos**) | 98 |
| `storage_events` | 13 |
| `treatment_runs` | 18 |
| `container_locations` | 31 |
| `external_transfers` | 0 |
| `photos` | 430 |

## Qué se conservó

`containers` 246 · `equipment` 60 · `profiles` 13 · `clients` 2 · `companies` 2.
`equipment_maintenance` no se tocó (tenía 0 filas).

Como el estado del tacho se **deriva** de eventos, con la tabla de eventos vacía los 246
tachos vuelven a "recién dado de alta" y la cola de pesaje queda en 0.

## Respaldo

`backups/2026-07-28-reset/` (gitignored), conteos validados 1:1 antes de borrar:

- `routes-weighing-receptions.json` (127 KB) — 43 / 348 / 335 / 22 / 98
- `storage-treatment-locations-photos.json` (265 KB) — 13 / 18 / 31 / 0 / 430
  + `containers_master_snapshot` (246) por seguridad

⚠️ Igual que en los resets anteriores: el respaldo tiene **metadata** de fotos y rutas de
objeto, **no los binarios**. La columna `photos.url` estaba NULL en las 430 filas (las URLs
se firman al vuelo, 24 h), así que no se pierde nada al no respaldarla.

## Pendiente: bucket de fotos

El bucket `photos` tiene **943 objetos huérfanos, 259 MB** (acumulado del 2026-05-25 al
2026-07-30) — ninguno referenciado ya por `public.photos`, que quedó en 0. El borrado por
SQL sigue bloqueado por el trigger `storage.protect_delete`; hay que usar la Storage API o
el dashboard (Storage → `photos` → seleccionar todo → borrar).

Es el tercer reset que deja huérfanos sin limpiar. En plan Free (1 GB) esto ya consume
~26 % de la cuota; conviene vaciarlo antes del próximo reset.

> [!warning] Reset del 2026-07-20 sin documentar
> **Fecha:** 2026-07-28
> **Problema:** existe `backups/2026-07-20-reset-tachos/` pero no hay log ni entrada en
> `_index.md` para un reset el 2026-07-20. El histórico del piloto tiene un hueco.
> **Acción requerida:** confirmar con el usuario qué se borró ese día y documentarlo, o
> descartar el directorio si fue una prueba.

## Después del reset

- En el APK: re-sincronizar / re-login para bajar el estado vacío.
- **Efecto sobre el fix de la cola de pesaje** (`logs/2026-07-28-fix-cola-pesaje-ciclo-reabierto.md`):
  al no quedar eventos, ya no se puede validar el fix contra los datos que lo revelaron
  (130/157/149). La verificación en dispositivo ahora exige que un tacho complete **dos
  ciclos completos** recorrido→pesaje→recorrido para comprobar que reaparece en la cola.
