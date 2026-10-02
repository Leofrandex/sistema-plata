---
title: Contenedor descartable — cito/anato/morgue sin tacho
tags:
  - log
  - pesaje
  - datos
date: 2026-09-28
updated: 2026-09-28
---

# Contenedor descartable — cito/anato/morgue sin tacho

## Qué cambió

Los 3 tipos citotóxico, anatomopatológico y morgue se pesan **sin tacho**: el operador
escribe el número del contenedor descartable (`container_ref`) en vez de elegir un tacho
del catálogo, y neto = bruto (no hay tara que restar).

## Por qué

Estos contenedores se desechan junto con el residuo — no vuelven a planta, no tienen
tara registrable. Antes del cambio, los operadores elegían un tacho cualquiera del
catálogo para poder pesar (11 casos en anatomopatológico), lo que dejaba el neto mal
calculado (restaba una tara que no correspondía) y generaba circulación falsa de un
tacho que en realidad nunca se movió.

## Históricos

Los 11 pesajes de anatomopatológico afectados se corrigieron con `container_ref =
"S/N (histórico)"` y `container_id = null`.

## Spec deviation

Una recepción que referencia un tacho ausente del catálogo queda **excluida de los
kilos** (no se cuenta como bruto) — comportamiento deliberado, preserva el criterio
anterior del sistema ante datos inconsistentes.

## Vista sin usar

La vista de base de datos `container_receptions_with_net` hace inner join contra
`containers`, así que las recepciones sin tacho (descartables) no aparecen en ella.
No la usa código de la app — se deja como está.

## Despliegue urgente

La migración 1 (`container_id` opcional + `container_ref`) ya está **aplicada en
producción**. El hub desplegado hoy y los APKs ≤ v1.11 **crashean al abrir Historial**
en una sesión que contiene un pesaje sin tacho — hay **7 sesiones así hoy**. Desplegar
el hub inmediatamente después de mergear esta rama, e instalar v1.12 en los teléfonos
lo antes posible. Hasta entonces, **no abrir esas sesiones en Historial**.

## Pendiente

Aplicar `20260928000100_contenedor_descartable_check.sql` (migración 2, CHECK) cuando
todos los teléfonos tengan v1.12; antes de aplicarla, correr el `update` que trae en el
comentario del archivo.

## Referencias

- Spec: `docs/superpowers/specs/2026-09-28-contenedor-descartable-design.md`
- [[WasteTypes]], [[DataModel]]
