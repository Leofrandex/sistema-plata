---
title: Las fotos de pesaje "que no se subían" — paginado de PostgREST
tags:
  - log
  - supabase
  - fotos
  - pesaje
  - datos
updated: 2026-09-17
---

# 2026-09-17 — Las fotos de pesaje nunca dejaron de subirse

Operaciones reportó que desde el 12 de septiembre se registraban pesajes pero las
fotos "no se estaban subiendo". ADR: [[2026-09-17-paginado-obligatorio-postgrest]].

## Lo que decía la base

Nada roto. Auditoría sobre el proyecto `hospiwaste` (`xqqnthyipkdkwyknbtnw`), del
2026-09-07 (reset de datos operativos) a hoy:

- **Cero** recepciones sin fotos. Todas tienen exactamente 2.
- Fila en `photos` + objeto en `storage.objects` para las 2.121 fotos.
- JPEG de 240–500 KB, sin archivos vacíos, ningún día distinto de otro.
- El bucket `photos` no se tocó desde el 2026-05-21.

## Lo que pasaba en realidad

`listAllPhotos` hacía `select('*').order('taken_at')` sin paginar. `photos` cruzó
las 1000 filas el **2026-09-11 a las 15:50 UTC** (11:50 hora Venezuela) y desde
ese instante PostgREST devolvía solo las 1000 más viejas — con status 200 y sin
error. El hydrator arma `photoIdsByEvent` con lo recibido, así que toda recepción
posterior quedaba con `photo_ids: []` y el reporte fotográfico la mostraba vacía.

De ahí el "desde el 12 de septiembre": el corte fue a media mañana del 11.

## Lo que se cambió

Helper `selectAll` en `shared/src/lib/supabase/queries/_helpers.ts` (pagina con
`range()`, corta con página vacía), aplicado a las listas acumulativas:
`listAllPhotos`, `listReceptionsBySessionIds`, `listWeighingSessions`,
`listRouteEvents`, `listAllRouteContainers{Dirty,Clean}`, `listContainerLocations`,
`listStorageEvents`, `listExternalTransfers`, `listTreatmentRuns`,
`listContainers`, `listLatestMaintenanceByEquipment`. Cada una lleva `id` (o la PK
compuesta) como desempate del orden.

`listHistoricalDailyKg` tenía su propio bucle desde el 2026-09-14; ahora usa el
helper — era el mismo bug, arreglado en un solo lugar.

## Lo que se evitó de paso

`container_receptions` estaba en **988 filas** el 2026-09-17, con ~100 al día.
Al cruzar las 1000 habría empezado a perder los pesajes **más nuevos** — kilos del
dashboard, cola de pesaje y reportes cortos, otra vez sin ningún error visible.
Cuestión de horas.

## Sin migración, sin datos perdidos

No se perdió nada: las fotos y las recepciones siempre estuvieron en la base.
Solo habían dejado de leerse. Al desplegar, los reportes del 11 al 17 de
septiembre se completan solos.

## Pendiente

La hidratación trae ahora **todo** de verdad, y `photos` crece ~200 filas/día.
Hay que pasar a una ventana por fecha en vez de "traer la tabla entera" — ver el
pendiente en [[_index]].
