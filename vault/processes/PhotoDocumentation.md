---
title: Memoria Fotográfica
tags:
  - processes
  - domain
  - reports
  - regulatory
updated: 2026-05-02
---

# Memoria Fotográfica (Informe Fotográfico)

## Qué es

Un informe diario por contenedor que demuestra regulatoriamente que cada envase fue recibido, pesado y tratado. Es **obligatorio por regulación**. Sin él, Hospimed no puede demostrar el procesamiento correcto.

Hoy se arma **manualmente** (foto por foto en una app → ensamblar PDF). Con ~300 contenedores/día, esto es extremadamente tedioso.

## Objetivo del sistema

El operador toma las fotos durante el proceso → el sistema las almacena automáticamente → el informe se **genera con un clic**.

## Fotos requeridas por etapa

| Etapa | Fotos necesarias |
|-------|-----------------|
| Intercambio en punto de encuentro | Foto del contenedor limpio entregado + foto del contenedor sucio recibido |
| Pesaje en planta | Foto del envase (número visible) + foto de la balanza mostrando el peso |

El informe incluye también los datos del envase: número, cliente, fecha, hora, tara, peso bruto, peso neto.

## Formato actual del informe

Cada página del informe corresponde a un envase. Contiene:
- Fecha y hora
- Identificación de la operación (ej: PTDP, Ciudad de la Salud)
- Número de contenedor
- Tara / peso bruto / peso neto
- Fotos de evidencia

La longitud del informe es proporcional a la cantidad de contenedores del día. Un cliente con 300 contenedores genera un informe muy extenso.

## Nomenclatura en las fotos

Actualmente las fotos se marcan con: `[fecha] [hora] [código operación] [cliente]`. Ejemplo: `01/03/2026 09:40 PM PTDP Ciudad Salud`.

## Peso neto = lo que se factura

`peso_neto = peso_bruto - tara`

Este es el valor que aparece en facturación, no el peso bruto.
