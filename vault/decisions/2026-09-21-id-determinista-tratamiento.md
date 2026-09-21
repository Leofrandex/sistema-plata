---
title: Id determinista para treatment_run
tags: [decisions, adr, tratamiento, offline, outbox]
date: 2026-09-21
status: accepted
---

## Contexto

El registro de tratamiento pasó a escribir a través del outbox offline
(ver [[2026-09-21-reactivacion-tratamiento]]): SQLite local primero, red
después, con reintentos en segundo plano cuando vuelve la conexión. Un mismo
tratamiento puede llegar a intentar escribirse más de una vez: un doble tap
en el botón, el mismo tacho tratado desde dos teléfonos, o el propio outbox
reintentando un envío que en realidad sí había llegado a Supabase pero cuya
confirmación se perdió. Cada `treatment_run` es un registro regulatorio — una
fila duplicada no es un detalle cosmético, es un doble conteo de un
tratamiento que ocurrió una sola vez.

Con un id aleatorio, evitar el duplicado exigiría o bien coordinación por red
antes de escribir (que el modo offline explícitamente no puede dar) o un
constraint de unicidad en la base que rechace el segundo insert. Esto último
falla tarde: el drenado del outbox es un proceso en segundo plano sin
operador mirando la pantalla, así que un rebote de constraint horas después
de que el tacho salió de planta no lo ve nadie ni se puede corregir a tiempo.

## Decisión

El id de `treatment_run` es un **UUID v5 determinista**, derivado de
`tacho:recepción` (el contenedor y la recepción que se está tratando), en vez
de un UUID v4 aleatorio.

## Alternativas consideradas

- **UUID v4 aleatorio + constraint de unicidad en Supabase.** Descartado:
  el rechazo llega en el drenado del outbox, sin operador presente, y no hay
  forma de que el sistema se autocorrija en ese momento — solo de detectar
  el problema después.
- **Deduplicar contra el servidor antes de escribir.** Descartado: requiere
  red disponible en el momento de tratar, que es justo el caso que el outbox
  existe para no necesitar.

## Consecuencias

- Un doble tap, el mismo tacho tratado desde dos teléfonos, o un reintento
  del outbox generan el mismo id y colapsan en una sola fila — el segundo
  intento es un upsert idempotente, no un conflicto.
- La derivación depende únicamente de datos ya presentes en el dispositivo
  (tacho + recepción), así que funciona completamente offline y sin
  coordinación con el servidor.
- Dos tratamientos genuinamente distintos del mismo tacho requieren
  recepciones distintas — ya es así en el modelo de datos, no es una
  restricción nueva que introduzca esta decisión.
