---
title: ADR-014 — Toda lista acumulativa de Supabase se pagina
tags: [decisions, adr, supabase, datos]
date: 2026-09-17
status: accepted
---

## Contexto

PostgREST corta cada respuesta en el `max-rows` del proyecto (1000 en Supabase
por defecto) y lo hace **sin error**: la consulta devuelve 200 con las primeras
1000 filas del orden pedido, y el consumidor no tiene forma de notar que falta
algo.

Esto ya nos mordió dos veces:

1. **2026-09-14** — `historical_daily_kg` (~1.9k filas) truncaba los graficos del
   dashboard a mediados de 2025. Se arregló paginando *esa* consulta ([[2026-09-14-historico-kilos-2024-2026]]).
2. **2026-09-11** — `photos` cruzó las 1000 filas a las 11:50 (hora Venezuela).
   `listAllPhotos` ordena por `taken_at` ascendente, así que lo que se perdió
   fueron las fotos **más nuevas**. El hydrator arma `photo_ids` con lo que
   recibió, las recepciones posteriores quedaron con `photo_ids: []` y el
   reporte fotográfico las mostró vacías. Operaciones lo reportó como "las fotos
   no se están subiendo desde el 12 de septiembre" — y sí se estaban subiendo:
   fila en `photos`, objeto en el bucket y JPEG de tamaño normal, todos los días.

El arreglo puntual de 2026-09-14 no generalizó, y `container_receptions` (988
filas el 2026-09-17, ~100/día) estaba a horas de repetir el mismo fallo sobre los
kilos del dashboard.

## Decisión

Toda consulta que traiga una tabla **que crece con la operación** se pagina con
`selectAll` (`shared/src/lib/supabase/queries/_helpers.ts`), que avanza con
`range()` hasta que una vuelta vuelve vacía.

Dos reglas que el helper no puede imponer solo:

- **El orden debe ser total.** Se agrega `id` como desempate (o la PK compuesta,
  como en las tablas puente de recorrido). Con empates sin desempatar, una fila
  puede repetirse en una página y faltar en la siguiente.
- **El corte es por página vacía**, nunca comparando contra `PAGE_SIZE`. Si el
  `max-rows` del proyecto fuera menor que `PAGE_SIZE`, esa comparación cortaría
  en la primera vuelta — el mismo bug que el paginado vino a arreglar.

Quedan sin paginar a propósito las consultas acotadas por naturaleza: filtradas
por un id (`listReceptionsBySession`, `listMaintenanceByEquipment`), por fecha
(`listRouteEventsByDate`) o por estado (`listActiveWeighingSessions`), y los
catálogos que no crecen con la operación (`profiles`, `clients`, `companies`).

## Alternativas consideradas

- **Subir el `max-rows` del proyecto.** Mueve el umbral, no lo elimina: la tabla
  `photos` crece ~200 filas/día y volvería a chocar. Además es configuración de
  infraestructura invisible desde el código, o sea el mismo fallo silencioso más
  tarde y más difícil de encontrar.
- **Traer solo la ventana visible (últimos N días).** Es lo correcto a mediano
  plazo y reduciría muchísimo la hidratación, pero cambia la forma del store, que
  hoy asume tener todo en memoria. Se deja anotado como pendiente en [[_index]],
  no se mezcla con un arreglo de producción urgente.
- **Contar antes y avisar si `count` > filas recibidas.** Detecta el problema pero
  no lo resuelve; igual habría que paginar.

## Consecuencias

- Una hidratación completa cuesta un round-trip extra por tabla (la vuelta vacía
  que cierra el bucle). Aceptable: pasa una vez al arrancar.
- Las tablas grandes ahora se traen enteras de verdad. `photos` son 2.121 filas
  al 2026-09-17 y creciendo ~200/día — la hidratación del hub y del APK se va a
  hacer cada vez más pesada. **Esto empuja la ventana por fecha**, que deja de
  ser optimización y pasa a ser necesidad en cuestión de semanas.
- Consulta nueva sobre una tabla operativa ⇒ nace paginada. Es la regla, no el
  caso excepcional.
