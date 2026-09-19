---
title: El reporte PDF adopta la identidad de la app y suma el comparativo anual
tags:
  - log
  - hub
  - reportes
  - branding
updated: 2026-09-18
---

# Reporte PDF con identidad de marca + gráfico interanual

## Los tokens ahora existen también en hex

`shared/src/styles/tokens.css` es la fuente de verdad de la interfaz, pero está
en `oklch()` dentro de custom properties: un PDF de `@react-pdf/renderer` no
puede resolver ninguna de las dos cosas. Se creó `shared/src/lib/brand.ts` con
los mismos colores en hexadecimal, tomados de [[Branding]].

> [!warning] Los dos archivos no se sincronizan solos
> **Fecha:** 2026-09-18
> **Problema:** `tokens.css` y `brand.ts` son el mismo color dicho en dos
> idiomas, y nada obliga a que coincidan. Cambiar uno sin el otro hace que el
> reporte impreso contradiga a la pantalla.
> **Acción requerida:** tocar los dos juntos. Si algún día son más de un puñado
> de colores, derivar el hex del oklch en build en vez de escribirlo a mano.

`YEAR_COLORS` se movió de `year-comparison-section.tsx` a `brand.ts` por la
misma razón: la usan dos renderers distintos —recharts en la web, SVG de
react-pdf en el reporte— y tienen que pintar el mismo año del mismo color.

## La tipografía: por qué hay TTF en `public/`

El hub carga Plus Jakarta Sans con `next/font/google`, que la sirve como
**woff2**. `fontkit`, el motor de react-pdf, no lee woff2. Se bajaron los
estáticos a `hub/public/fonts/` y se registran desde ahí con ruta relativa: el
PDF se arma en el navegador vía `PDFDownloadLink`, así que resuelve contra el
origen del hub.

Son los **estáticos** (400/600/700) y no el TTF variable a propósito: de un
variable react-pdf saca una sola instancia y las negritas salen iguales que el
texto normal.

Verificado con un render en Node: las tres familias quedan embebidas como
subset (`PlusJakartaSans-Regular`, `-SemiBold`, `-Bold`) y no hay fallback a
Helvetica.

## El gráfico interanual, redibujado

recharts renderiza al DOM y no existe dentro de un PDF, así que
`year-comparison-chart-pdf.tsx` dibuja el mismo gráfico con las primitivas
`Svg`/`Rect`/`Line`/`G`/`Text` de react-pdf.

Los datos ya estaban: `KgComparisonReportData.years` es un `YearMonthlySeries[]`
con los 12 totales mensuales. No hizo falta tocar `buildKgComparisonReport` ni
pasar props nuevas.

Se conserva la regla del gráfico de la web: **un mes en `null` no dibuja barra**.
`null` es "todavía no ocurrió" y una barra en cero diría que ese mes no entró
nada, que es otra cosa. La nota al pie del reporte ahora lo dice explícito.

## Pase de diseño sobre el documento

- **Jerarquía** — los cuatro KPI pesaban igual. El total del período pasó a
  doble ancho y doble cuerpo (22pt contra 13pt), con el desglose —kilos, días,
  pesajes— en su pie. Es la misma jerarquía que la tarjeta de `/analytics`.
- **Acento** — el `#2A27E9` aparece en dos lugares y nada más: la barra de
  identidad del encabezado y el borde izquierdo del KPI primario.
- **Variación con signo** — los deltas usan los mismos verde y rojo que la web
  (`green-700` / `red-700`), y gris cuando no hay con qué comparar.
- **Formas** — radio de 8px, el del ADR [[2026-05-03-border-radius-global]], y
  separación por hairline de 0.75pt en vez de cajas grises.
- **Fechas** — el encabezado decía `2026-01-01 al 2026-09-18`. Ahora va en
  palabras, como el selector de rango.

## Analíticas: la tarjeta del total

El desglose del hero era texto corrido de 12px y dejaba media tarjeta en blanco
contra la columna de dos tarjetas de la derecha. Pasó a tres cifras propias de
20px ancladas al pie con `mt-auto`, así el bloque crece con la tarjeta. Es el
Tell 6 de `.claude/skills/smart-ui-ux`.
