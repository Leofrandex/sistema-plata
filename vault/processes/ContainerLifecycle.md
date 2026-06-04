---
title: Ciclo de Vida del Contenedor
tags:
  - processes
  - domain
  - containers
updated: 2026-06-04
---

# Ciclo de Vida del Tacho

Este es el proceso central del sistema. Aplica principalmente al desecho **peligroso infeccioso** (tipo 1). Para tipos 2–5 ver [[WasteTypes]].

> [!important] Actualización 2026-05-30 — empresa y tipo de desecho son dinámicos
> Lo que sigue describe el alta con empresa y tipo "fijos"; eso quedó **obsoleto**. Hoy el tacho
> es del pool de Hospiwaste: la **empresa** se elige en el recorrido y se hereda al pesaje
> (reset al tratar), y el **tipo de desecho** lo ingresa el operador en pesaje. Ver
> `decisions/2026-05-30-empresa-tipo-dinamicos-tacho.md`. Además, el "tratar inmediatamente" en
> pesaje permite saltar cámara fría (tipo 1).

## Registro inicial (alta del contenedor)

Se hace **una sola vez** cuando el contenedor entra en operación:
- Número de serie único (pintado en el envase, no etiqueta — se lava con agua caliente y químicos abrasivos)
- Tamaño: 240L / 750L / 1100L
- Tara (peso en vacío)
- Empresa propietaria (dentro de un Cliente)
- Tipo de desecho asignado

> [!important] Numeración por empresa
> La secuencia de números puede coincidir entre empresas distintas. Para evitar ambigüedad, se agrega una **letra de prefijo por empresa** (ej: `I-001` para ION, `A-001` para Airkem). Ambas empresas pueden estar bajo un mismo cliente (ej: "Centro de la Salud").

Si un contenedor se rompe, **sale de operación definitivamente** — su número no se reasigna.

## Flujo operativo (ciclo diario)

```
[Recorrido — punto de encuentro]
Hospiwaste entrega contenedores LIMPIOS
Empresa de aseo entrega contenedores SUCIOS (llenos)
        ↓
[Registro fotográfico del recorrido]
Fotos ilimitadas del intercambio limpio/sucio
        ↓
[Traslado a la planta]
6 recorridos diarios fijos: 6:30 / 10:30 / 13:20 / 14:30 / 18:30 / 21:00
Cada recorrido se ejecuta en un único slot por día (cronómetro persistente)
        ↓
[Pesaje en planta]
Sesión de pesaje con cronómetro y múltiples envases
Memoria fotográfica: foto del envase + foto de la balanza con el número visible
        ↓
[Cámara fría]
Transición automática al finalizar la sesión de pesaje
El sistema registra cuánto tiempo permanece aquí
        ↓
[Tratamiento] (solo tipo 1 - infeccioso)
Esterilización + trituración
En el sistema es un registro PUNTUAL: el envío crea el treatment_run ya
completado (started_at == completed_at) y el tacho pasa directo a 'clean'.
No existe fase 'treatment' en curso en la operación actual.
        ↓
[Sale como desecho común]
        ↓
[Lavado del contenedor]
Agua caliente + producto químico abrasivo
        ↓
[Vuelve al punto de encuentro como contenedor LIMPIO]
```

## Ubicación del contenedor

Cuando se entrega a la empresa de aseo, se quiere saber **dónde lo colocaron** (hospital, piso, área). El operador de aseo lo registra en el momento de la entrega.

La ubicación se actualiza **manualmente** — no hay GPS en tiempo real (decisión pendiente de cotización). Hasta que alguien actualice la ubicación, las coordenadas del último registro quedan fijas.

## Compactador

El compactador (equipo de la planta) tiene su propio ciclo de recogida por parte de un tercero. El sistema debe registrar: cada vez que el compactador es recogido → hora de salida y hora de retorno.
