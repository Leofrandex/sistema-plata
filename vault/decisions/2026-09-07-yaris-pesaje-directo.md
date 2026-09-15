---
title: La flota Yaris se pesa directamente (fin de los tachos dedicados)
tags:
  - decision
  - adr
  - pesaje
  - yaris
updated: 2026-09-07
---

# ADR 2026-09-07 — La flota Yaris se pesa directamente

**Estado:** aceptada · **Revierte:** [[2026-06-03-contenedores-yaris-recorrido]]

## Contexto

La flota Yaris (`Y1`…`Y26`, 1100 L) no tenía balanza que la aguantara. El operador volcaba
la carga del contenedor Yaris en un tacho normal marcado `is_yaris_dedicated` y pesaba ése.
De ahí salieron dos banderas distintas y fáciles de confundir:

- `is_yaris_container` — el contenedor físico de la flota. Tara 0, **excluido** de la cola de
  pesaje y del pool de circulación del dashboard (si entraba, quedaba atascado en "pendiente
  por pesar" para siempre, porque nada lo pesaba nunca).
- `is_yaris_dedicated` — el tacho sustituto sobre el que se pesaba esa carga. Vivía en su
  propio `<Select>` del formulario, detrás de un toggle "¿Es un pesaje de Yaris?".

Operaciones informó el 2026-09-07 que la flota **ya tiene pesa dedicada**: los Yaris se suben
a la balanza tal cual.

## Decisión

Se elimina el rodeo completo.

1. Los `Y1`…`Y26` se pesan directamente: dejan de estar excluidos de la cola de pesaje
   (`getPendingWeighingContainerIds` y `getWeighableContainerIds`) y de la vista
   `v_containers_pending_weighing`.
2. Se cargan sus **taras reales** (50.9–52.6 kg, provistas por operaciones). Sin tara el neto
   habría salido igual al bruto, inflando ~51 kg por pesaje.
3. Los `Y1`…`Y26` entran al **dashboard de circulación** y al pool de flota: ahora sí
   recorren el ciclo de planta como cualquier tacho.
4. El **modo Yaris del formulario de pesaje desaparece**: se van el toggle, el segundo
   selector y el campo de estado `is_yaris_weighing`. Queda un único buscador de tacho.
5. Los tachos que estaban marcados `is_yaris_dedicated` **vuelven a la operación normal**
   (bandera a `false`), y el flag sale del alta y de la tabla en Admin → Tachos.

## Por qué no dropear `is_yaris_dedicated`

La columna documenta el histórico y la referencia `database.types.ts`. Dropearla obliga a
regenerar tipos y no compra nada: cuesta una fila en el esquema y se marca deprecada en
[[DataModel]] y en `shared/src/lib/types.ts`. `is_yaris_container` **sí se mantiene viva**:
sigue identificando a la flota (tamaño, badge en pesaje) aunque ya no filtre nada.

## Consecuencias

- Con recorridos congelados ([[2026-09-01-modo-interino-solo-pesaje]]) los 26 Yaris aparecen
  en el dashboard y, como nada los "entrega limpios", tienden a quedarse en *Pendiente por
  tratar* tras cada pesaje. Es el mismo comportamiento que ya tiene el resto de la flota en
  modo interino, solo que con 26 tachos más.
- El buscador de tacho pasó de `inputMode="numeric"` a `text`: con el teclado numérico de
  Android no se podía escribir la `Y` de `Y3` y la flota quedaba inalcanzable.
- Los pesajes históricos hechos "en modo Yaris" no se tocan: `is_yaris_weighing` nunca se
  persistió en la BD, era estado de formulario.
