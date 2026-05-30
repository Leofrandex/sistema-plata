---
title: ADR — Empresa y tipo de desecho son propiedades dinámicas del tacho
tags:
  - decision
  - adr
  - modelo
  - tachos
updated: 2026-05-30
---

# ADR 2026-05-30 — Empresa y tipo de desecho dinámicos del tacho

## Contexto

El modelo original asumía que cada tacho (`Container`) pertenecía permanentemente a una
**empresa** (`company_id`) y tenía un **tipo de desecho** (`waste_type`) fijo asignado al alta.
En la operación real esto es falso: los tachos son del **pool de Hospiwaste** y se reutilizan —
un mismo tacho sirve a ION en un ciclo y a Airkem en el siguiente, y puede llevar distinto tipo
de desecho según el uso. El prefijo de empresa en el id (`I-`/`A-`) era un artefacto de
importación del Excel; la numeración física real es global y única (`001..189`).

## Decisión

**La empresa y el tipo de desecho dejan de ser propiedades permanentes del tacho.**

- **Empresa (ION/Airkem)** = dinámica, **derivada de eventos**:
  - Se selecciona en el **recorrido** (`route_events.company_id`).
  - La empresa actual de un tacho = `company_id` del recorrido más reciente que lo recogió sucio
    **dentro del ciclo abierto** (posterior al último tratamiento/traslado completado) →
    `getContainerCurrentCompanyId`. Vuelve a `null` al cerrarse el ciclo (tratamiento completado).
  - En pesaje se **hereda** (no se re-selecciona) y se **snapshotea** en
    `container_receptions.company_id` para estabilidad del reporte.
- **Tipo de desecho** = lo **ingresa el operador en pesaje** (`container_receptions.waste_type`).
  Se eliminó `containers.waste_type`. El ruteo tratamiento (tipo 1) vs traslado (tipos 2–5) usa
  la **última recepción**.
- **Reportes** se consolidan por **institución** (cliente), usando la empresa **registrada** en
  recepciones/recorridos, con fallback a `container.company_id` para data histórica sin snapshot.

## Por qué (derivación de eventos, no estado mutable)

Coherente con [[2026-05-21-estado-envase-derivado]]: el estado del tacho se deriva de sus eventos
en vez de guardarse mutable. La empresa "actual" no se persiste en el tacho; emerge del último
recorrido del ciclo abierto y se resetea solo al tratar. Esto evita un campo mutable que habría
que limpiar manualmente y mantiene una sola fuente de verdad (los eventos).

## Consecuencias

- `Container` ya no tiene `company_id` operativo (en la BD del piloto es `null`) ni `waste_type`.
- El reporte depende de que el operador seleccione empresa en el recorrido; sin ella, fallback
  histórico por dueño del tacho (solo aplica a data vieja).
- El display de tachos es por número pelado (`formatTachoNumber`). El renumerado físico real ya
  está en la BD (`001..189`); el renumerado del **mock** offline quedó pendiente (no afecta prod).

Ver log `logs/2026-05-30-pesaje-tratamiento-rename-tacho.md`.
