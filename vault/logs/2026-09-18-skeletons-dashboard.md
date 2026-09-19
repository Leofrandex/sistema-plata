---
title: Esqueletos de carga en el dashboard
tags:
  - log
  - hub
  - ux
updated: 2026-09-18
---

# Esqueletos de carga en el dashboard

## El síntoma

Al entrar al dashboard las gráficas mostraban cero durante unos segundos y
después la data aparecía de golpe.

## La causa real: no era "cargando", era el mock

El dashboard no consulta nada por su cuenta: todo sale de `useStore()`, que un
solo `SupabaseHydrator` llena con un `Promise.all` de once queries. El store
arranca **sembrado con los `MOCK_*`** de `shared/src/lib/mock-data.ts`, cuyas
fechas son de mayo. Todo lo que el dashboard calcula contra *hoy* — kilos del
día, recorridos de hoy, el mes en curso — da cero contra esos mocks.

O sea: el primer render no mostraba un estado vacío, mostraba **datos falsos
caducos presentados como reales**. El cero no era un placeholder, era una
respuesta incorrecta.

## La decisión

Se usó `connectionStatus === 'connecting'` como flag de carga, sin agregar nada
al store. El valor ya existía y tiene exactamente la semántica que hacía falta:
arranca en `'connecting'` y **ninguna rehidratación posterior vuelve a ese
estado** — ni el cambio de sesión, ni el retorno de foco, ni el reintento del
banner. Un dashboard ya cargado nunca parpadea con esqueletos.

Se descartó agregar un `hydrating: boolean` al store: habría sido un segundo
flag describiendo el mismo hecho, con el riesgo de que los dos se desincronicen.

## Qué se ve mientras carga

Cada sección decide sola, así que las piezas aparecen a medida que llegan: el
store completa once secciones a la vez, mientras el histórico de kilos
(`useHistoricalKg`) y el semáforo de equipos (`EquipmentSummaryCard`) revelan a
su propio ritmo porque siempre fueron consultas aparte.

Las tarjetas de métricas son el caso distinto: el rótulo y el ícono no son
datos, así que se siguen pintando y solo el número se reemplaza por un bloque.

## Límite conocido

Una pestaña **sin sesión** deja el dashboard en esqueletos indefinidamente. La
causa es anterior a este cambio: cuando `getCurrentProfile` devuelve `null`, el
hidratador corta sin tocar `connectionStatus`, que se queda en `'connecting'`
para siempre. Antes ese mismo caso mostraba el dashboard lleno de mocks y ceros
—peor, porque parecía data real—, pero un cargador infinito tampoco es la
respuesta correcta.

Se resuelve junto con el pendiente abierto de por qué una pestaña sin sesión no
hidrata ni redirige al login, no acá: ponerle un timeout al esqueleto sería
taparlo.

## Archivos

- `shared/src/components/ui/skeleton.tsx` — primitiva nueva
- `hub/src/components/dashboard/card-skeleton.tsx` — la tarjeta completa en gris
- Las doce secciones del dashboard reciben `loading?: boolean`
