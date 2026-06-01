---
title: Memoria Fotográfica
tags:
  - processes
  - domain
  - reports
  - regulatory
updated: 2026-05-17
---

# Memoria Fotográfica (Informe Fotográfico)

## Qué es

Un informe **semanal por cliente** que demuestra regulatoriamente que cada envase fue recogido, pesado y tratado durante esa semana. Es **obligatorio por regulación**. Sin él, Hospiwaste no puede demostrar el procesamiento correcto.

Históricamente se armaba **manualmente** (foto por foto en una app → ensamblar PDF). El módulo de `/reports` lo genera automáticamente desde lunes 00:00 hasta el momento de la consulta.

## Objetivo del sistema

El operador toma las fotos durante el proceso → el sistema las almacena automáticamente → el informe se **genera con un clic** seleccionando el cliente.

## Fotos requeridas por etapa

| Etapa | Fotos necesarias |
|-------|-----------------|
| Recorrido en punto de encuentro | Fotos ilimitadas del intercambio limpio/sucio |
| Pesaje en planta | Foto del envase (número visible) + foto de la balanza mostrando el peso |

El informe incluye también los datos del envase: número, cliente, fecha, hora, tara, peso bruto, peso neto.

## Formato del informe

Layout replicado de los reportes históricos del cliente:
- **Header** por página (banda fija): logo de **Constructora RIGA** (contratista, `public/logo-riga.png`) a la izquierda, título "REGISTRO FOTOGRÁFICO" centrado, logo de **CPCH / Ciudad de la Salud** (consorcio cliente, `public/logo-cpch.jpg`) a la derecha. Debajo, la barra de metadatos con `Edificio`, `Ubicación`, `Empresa`, `Fecha`.
- **Body**: grid de 2 columnas × N filas de fotos. Cada foto con caja "Comentario:" debajo (número de envase, hora, y texto libre opcional).
- **Orden**: por etapa (recorrido → pesaje) y dentro de cada etapa, por empresa (ION → Airkem). Cada cambio de etapa o empresa empieza página nueva.
- **Rango**: lunes 00:00 → hoy 23:59 (el viernes cubre la semana completa).

## Nomenclatura en las fotos

Las fotos se marcan con: `[código operación] [cliente] [fecha] [hora]`. Ejemplo: `PTDP Centro Salud 17/05/2026 09:40 AM`.

## Peso neto = lo que se factura

`peso_neto = peso_bruto - tara`

Este es el valor que aparece en facturación, no el peso bruto.
