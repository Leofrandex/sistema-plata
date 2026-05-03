---
title: Ciclo de Vida del Contenedor
tags:
  - processes
  - domain
  - containers
updated: 2026-05-02
---

# Ciclo de Vida del Contenedor (Envase/Tacho)

Este es el proceso central del sistema. Aplica principalmente al desecho **peligroso infeccioso** (tipo 1). Para tipos 2–5 ver [[WasteTypes]].

## Registro inicial (alta del contenedor)

Se hace **una sola vez** cuando el contenedor entra en operación:
- Número de serie único (pintado en el envase, no etiqueta — se lava con agua caliente y químicos abrasivos)
- Tamaño: 240L / 750L / 1100L
- Tara (peso en vacío)
- Cliente al que pertenece
- Tipo de desecho asignado

> [!important] Numeración por cliente
> La secuencia de números puede coincidir entre clientes distintos. Para evitar ambigüedad, se agrega una **letra de prefijo por cliente** (ej: `A-069` para Ciudad de la Salud, `B-069` para Agua Dulce). El sistema debe soportar este formato.

Si un contenedor se rompe, **sale de operación definitivamente** — su número no se reasigna.

## Flujo operativo (ciclo diario)

```
[Punto de encuentro]
Hospimed entrega contenedores LIMPIOS
Empresa de aseo entrega contenedores SUCIOS (llenos)
        ↓
[Registro fotográfico del intercambio]
Foto: contenedor limpio entregado
Foto: contenedor sucio recibido
        ↓
[Traslado a la planta]
Mínimo 6 recorridos/día
Puede haber más de 1 viaje por recorrido
        ↓
[Pesaje en planta]
Peso bruto registrado
Memoria fotográfica: foto del envase + foto de la balanza con el número visible
        ↓
[Cámara fría]
Contenedor espera su turno de tratamiento
El sistema debe registrar cuánto tiempo permanece aquí
        ↓
[Tratamiento] (solo tipo 1 - infeccioso)
Esterilización + trituración
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
