---
title: Reset total de datos operativos del piloto
tags:
  - log
  - supabase
  - datos
updated: 2026-07-06
---

# Reset total de datos operativos (2026-07-06)

Se vació la base operativa para **empezar a usar el sistema desde cero**, conservando el
master data (tachos, clientes, empresas, perfiles). Proyecto Supabase `hospiwaste`
(`xqqnthyipkdkwyknbtnw`).

## Qué se hizo

`TRUNCATE` de 10 tablas operativas (los 230 `containers` quedan intactos → cada tacho vuelve a
estado "recién dado de alta", ya que el estado se **deriva** de eventos y ya no hay eventos):

| Tabla | Filas borradas |
|---|---|
| `route_events` (+ `route_event_containers_dirty` 139 / `_clean` 129) | 24 |
| `weighing_sessions` | 15 |
| `container_receptions` (los **pesos**) | 123 |
| `storage_events` | 133 |
| `treatment_runs` | 14 |
| `container_locations` | 147 |
| `external_transfers` | 0 |
| `photos` | 355 |

Decisión del usuario: **reset total incluyendo los pesos** (se evaluó conservarlos, pero en el
modelo derivado una recepción posiciona al tacho en su ciclo → conservarlas dejaría tachos como
"pesados/en planta"; además sin fotos los reportes quedan inservibles). Ver la discusión del
tradeoff en `decisions/2026-05-21-estado-envase-derivado.md`.

## Respaldo previo

Antes de borrar se exportó todo a JSON en `backups/2026-07-06-reset-tachos/` (gitignored):
`routes-weighing-receptions.json`, `storage-treatment-locations-transfers.json`,
`photos-and-storage-objects.json`. Conteos validados 1:1 contra la base.
⚠️ El respaldo tiene metadata de fotos y **nombres** de objetos, no los binarios de imagen.

## Pendiente: archivos físicos del bucket

Quedaron **455 objetos huérfanos** en el bucket `photos`. El borrado directo por SQL sobre
`storage.objects` está bloqueado por el trigger `storage.protect_delete` (a propósito). Para
vaciar el bucket de verdad hay que usar la **Storage API** (dashboard: Storage → `photos` →
seleccionar todo → borrar; o `DELETE` vía API con `service_role`). Funcionalmente el app ya está
limpio: 0 filas en `public.photos`, nada referencia esas imágenes.

## Notas

- La cola de pesaje (`v_containers_pending_weighing`) quedó en 0.
- En el APK: re-sincronizar / re-login para bajar el estado vacío.
