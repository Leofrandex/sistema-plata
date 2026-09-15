---
title: Modo interino solo-pesaje mientras se rehace el offline de recorridos
tags:
  - decision
  - pesaje
  - recorridos
  - offline
updated: 2026-09-01
---

# ADR — Modo interino solo-pesaje

**Fecha:** 2026-09-01
**Estado:** Aceptada — temporal, se revierte al cerrar el rediseño de recorridos

## Contexto

Los recorridos se registran fuera de planta, sin WiFi y con cobertura móvil pobre. La
capa offline actual no aguanta ese escenario y la operación pierde tiempo. Se decide
congelar el registro de recorridos y rediseñarlo, manteniendo la app viva para el pesaje,
que ocurre dentro de planta con conectividad.

## Decisión

Un flag único (`INTERIM_MODE`, `shared/src/lib/config/interim-mode.ts`) gobierna cuatro
puntos: cola de pesaje abierta a todos los tachos activos, Home del APK con Recorrido
gris, subárbol `/register/route` bloqueado y banner en el dashboard del hub. La empresa
del pesaje pasa a elegirse a mano, porque hoy se hereda del recorrido.

No se modifica `getPendingWeighingContainerIds` ni el ADR
[[2026-07-28-cola-pesaje-por-fecha]]: se agrega `getWeighableContainerIds` al lado y la
UI elige según el flag. Revertir es apagar el flag.

## Alternativas descartadas

- **Cambiar `getPendingWeighingContainerIds` para que devuelva todo** — borra la cola real
  y obliga a reconstruirla desde cero cuando vuelvan los recorridos.
- **Apagar la app entera hasta tener la arquitectura nueva** — deja a la planta sin
  registro de pesos, que es la data que alimenta la facturación y los reportes.

## Consecuencias

- Nada impide pesar dos veces el mismo tacho: queda un aviso suave, no un bloqueo.
- Los estados de circulación del dashboard dejan de ser representativos mientras dure.
- Los pesajes del interino quedan **sin recorrido asociado para siempre**; la trazabilidad
  regulatoria de esos días depende del respaldo en papel.

Ver log: [[2026-09-01-modo-interino-solo-pesaje]]
Spec: `docs/superpowers/specs/2026-09-01-modo-interino-solo-pesaje-design.md`
