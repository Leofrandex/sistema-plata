---
title: Equipos — frecuencia de mantenimiento libre (valor + unidad)
tags:
  - log
  - equipos
  - hub
date: 2026-08-08
---

# 2026-08-08 — Frecuencia de mantenimiento como campo libre

El coordinador reportó que en la tab **Equipos** "solo se pueden marcar
determinados meses de frecuencia".

## Por qué pasaba

El campo siempre fue un `number` libre en días, pero convivía en la misma fila
con cuatro botones fijos (1 mes / 3 meses / 6 meses / 1 año). Los botones eran
la afordancia visible y el input pedía días, una unidad en la que nadie piensa
cuando programa mantenimientos. El resultado práctico: los atajos se leían como
las únicas opciones disponibles.

No era una limitación del modelo — era de la UI.

## Qué se hizo

`hub/src/components/equipment/equipment-form.tsx`: los cuatro botones se
reemplazan por **cantidad libre + selector de unidad** (días / meses / años).
Cualquier frecuencia es expresable: 45 días, 2 meses, 18 meses, 3 años.

## Decisiones

- **Se sigue persistiendo en días** (`equipment.maintenance_frequency_days`).
  Sin migración y sin tocar el semáforo de [[EquipmentMaintenance]]
  (`hub/src/lib/data/equipment-status.ts` calcula sobre días). La unidad es
  solo presentación.
- **1 mes = 30 días, 1 año = 365**, la misma conversión que ya usaban los
  atajos, para no reinterpretar los valores de los 60 equipos sembrados.
- Al cargar un equipo, `splitFrequency` elige la unidad **más grande que divida
  exacto** (365 → "1 año", 90 → "3 meses", 45 → "45 días"), de modo que el
  coordinador ve lo que configuró y no una cifra en días que no reconoce.
- La cantidad se guarda como **texto** en el estado local, no como número: si
  fuera número, vaciar el campo para reescribirlo lo forzaría a `0` o `null` y
  el input saltaría bajo el cursor.
- Línea de eco bajo el campo con los días efectivos ("Equivale a 540 días entre
  mantenimientos"), porque el semáforo calcula sobre días y con meses de 30 la
  equivalencia no siempre es obvia.

> [!warning] Un mes no es un mes calendario
> **Fecha:** 2026-08-08
> **Problema:** "6 meses" vence a los 180 días, no en la misma fecha seis meses
> después; sobre un año el desfase acumulado ronda los 5 días.
> **Acción requerida:** decidir con el coordinador si el vencimiento debe ser
> por calendario. De serlo, el cambio va en `computeMaintenanceStatus`
> (`nextDueAt`), no en el formulario.

## Ver también

- Módulo: [[EquipmentMaintenance]]
- Log original de la tab: `logs/2026-07-16-equipos-mantenimiento-preventivo.md`

## Pendiente

- E2E manual en el hub: editar la frecuencia de un equipo existente y confirmar
  que se muestra en la unidad correcta al recargar.
