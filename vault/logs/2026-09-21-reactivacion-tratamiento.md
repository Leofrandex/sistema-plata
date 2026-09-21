---
title: Reactivación del módulo de tratamiento
tags:
  - log
  - tratamiento
  - offline
  - outbox
updated: 2026-09-21
---

# 2026-09-21 — Reactivación del módulo de tratamiento

## El apagado nunca se documentó

El 2026-09-15, commit `5fd0575`, el módulo de tratamiento se deshabilitó en el
código: `disabled: true` en la tarjeta de Home, un guard permanente en la ruta
que nunca renderizaba sus hijos, el tab del bottom-nav deshabilitado, y el
checkbox "tratar inmediatamente" quitado del formulario de pesaje. Ese apagado
no dejó log ni entrada en pendientes. Esta nota cierra esa incoherencia.

Mientras tanto, los teléfonos de planta seguían en **APK v1.5**, anterior a
ese commit — la pantalla de tratamiento siguió viva en producción sin que
nadie lo supiera desde el código. El 2026-09-18 se registraron 22 tratamientos
desde ahí. Esa versión escribe directo contra Supabase sin outbox: una
escritura fallida moría en un `console.error`. Planta estaba operando, a
ciegas, un camino que perdía registros en silencio cada vez que se caía la
red.

**Este trabajo no le dio a planta una funcionalidad nueva: reparó la que ya
estaba usando sin red de seguridad.**

## Qué se construyó

Nueve commits, `b6466f0..b9f0912`:

- Selector puro de candidatos en `shared/src/lib/data/treatment.ts`, ordenado
  del más viejo al más nuevo y con el tiempo en cámara fría visible, para que
  un operador frente a una cola de 151 tachos pueda distinguir uno de once
  días de uno de esta mañana.
- Ids deterministas UUID v5, derivados de tacho + recepción, en vez de
  aleatorios (ver ADR [[2026-09-21-id-determinista-tratamiento]]).
- Todas las escrituras pasan ahora por el outbox offline
  (`app/src/lib/data/treat-containers.ts`): SQLite local primero, red después.
- Registrar un tratamiento ahora cierra el `exit_at` del evento de cámara
  fría. Antes nadie cerraba uno: había 641 eventos de almacenamiento abiertos,
  así que la métrica "tiempo en cámara fría" que [[Overview]] pone en alcance
  nunca había funcionado. **Solo es confiable desde el 2026-09-21 en
  adelante** — los 22 tachos ya tratados mantienen su evento de cámara fría
  abierto y no se van a cerrar nunca: rellenar esos timestamps sería inventar
  un dato de un registro regulatorio.
- La pantalla informa cuántos tachos se escribieron de verdad, no cuántos se
  seleccionaron. Antes podía decir "12 tratados" cuando solo se habían
  escrito 9.
- El dashboard suma un quinto balde de circulación, `sin_actividad`, porque
  `en_planta` mezclaba 22 tachos genuinamente tratados con 73 que nunca
  habían tenido un solo evento.

## Decisiones

- **Un solo punto de entrada.** El atajo "tratar inmediatamente" del
  formulario de pesaje no volvió — un único camino de escritura es más fácil
  de mantener correcto y de auditar.
- **La cola arranca con el backlog completo de 151 tachos, sin backfill.**
  Rellenar tratamientos que puede que nunca hayan ocurrido sería fabricar
  evidencia regulatoria.
- **Fotos, lavado como estado separado, duración del tratamiento y lotes de
  autoclave quedan fuera de alcance, a propósito.** Consecuencia que hay que
  decir con todas sus letras: [[Overview]] exige que el reporte fotográfico
  cubra cada tacho "recibido, pesado y tratado", y después de este trabajo
  sigue sin cubrir la etapa de tratado. Ese hueco queda abierto.

## Pendiente para Francesca

1. ¿El tratamiento se hace por carga de autoclave o tacho por tacho? Define
   si hace falta más adelante una tabla "corrida" con su propia duración. No
   bloquea lo construido: la duración no se captura todavía, así que el
   esquema actual sobrevive cualquiera de las dos respuestas y una tabla
   padre sería aditiva.
2. Si es por carga, ¿planta cronometra el ciclo?
3. ¿Qué debe mostrar la foto de un tacho tratado — el tacho, la carga, el
   equipo? Hace falta antes de encarar la etapa de evidencia fotográfica.

## Verificación pendiente en dispositivo

No cambia nada en planta hasta desplegar el APK. Antes del rollout:

1. Pesar un tacho infeccioso y finalizar la sesión → debe aparecer en la cola
   de tratamiento.
2. Modo avión, tratarlo → debe confirmar normalmente.
3. Restaurar la red → el registro debe aparecer en Supabase, y el
   `storage_event` correspondiente con `exit_at` no nulo.
4. Tratar el mismo tacho dos veces seguidas → debe quedar **una sola** fila
   en `treatment_runs`.
