---
title: El dashboard se queda con el día a día; el histórico se va a Analíticas
tags:
  - log
  - hub
  - ux
updated: 2026-09-18
---

# Dashboard operativo vs. Analíticas

Cierre de la separación que quedó a medias cuando se cargó el histórico
2024–2026 ([[2026-09-14-historico-kilos-dashboard-y-reporte]]): `/analytics`
existía y estaba en el menú, pero el dashboard seguía mostrando lo mismo.

## La línea que separa las dos páginas

**`/dashboard` no toca `historical_daily_kg`.** Se alimenta únicamente del
store, así que termina de cargar cuando termina la hidratación y no espera una
segunda consulta. Todo lo que mira más atrás que los últimos 30 días vive en
`/analytics`.

Se movieron tres cosas:

| Qué | De | A |
|---|---|---|
| Comparativo año contra año (2024·2025·2026) | dashboard | ya estaba en Analíticas — se borró del dashboard |
| Kg del mes por empresa, **con navegador** hasta ene-2024 | dashboard | Analíticas |
| Kg del mes por empresa, **mes en curso**, solo sistema | — | se queda en el dashboard, sin navegador |

`MonthlyBarChart` sirve a las dos con el mismo código: `onMonthChange` pasó a
ser opcional y sin él la tarjeta queda anclada al mes que reciba, con el mes
escrito en vez de las flechas.

## El acumulado anual era un número falso

`KgTrendsSection` mostraba "Acumulado 2026". Ese total sale de `receptions`, y
el sistema solo es dueño de los kilos desde el **2026-09-07**: el número cubría
dos semanas y se leía como el año entero. No se movió, se borró — el acumulado
real, unido al histórico, es el "Consolidado anual" de Analíticas.

`computeYearAccumulated` queda en `shared/src/lib/data/dashboard-analytics.ts`
sin ningún consumidor: hoy solo lo ejercita su propio test. Borrarlo o no es
decisión abierta.

## Layout: una grilla en vez de filas sueltas

El dashboard eran diez tarjetas apiladas en filas de 1 o 2 columnas fijas, así
que el ancho sobraba en todas las cortas — el semáforo de equipos ocupaba la
página entera para mostrar cuatro chips de 64 px.

Ahora es **una sola grilla de 12 columnas** y cada tarjeta pide el ancho que su
contenido necesita. `items-start` evita que una tarjeta corta se estire hasta el
alto de su vecina: estirarla no agrega información, solo hueco al pie.

Los dos donuts (circulación y kg del día) dejaron de abrirse en dos columnas
internas: ahora viven en un tercio de la grilla, donde el gráfico y su leyenda
lado a lado no entran. Apilan siempre.

## Pase de smart-ui-ux

Sobre las tarjetas de métricas, siguiendo `.claude/skills/smart-ui-ux`:

- **Jerarquía** — las cuatro pesaban igual. "Pendientes de pesar" pasó a
  primaria a 6/12 con su denominador al lado (`47 de 189 en circulación · 25%`);
  es la única accionable mientras dure el modo interino solo-pesaje. Las otras
  tres se compactan a 2/12.
- **Tiles de color** — fuera los cuatro cuadraditos pastel con ícono. Cuatro
  colores para cuatro números es decoración: no se relacionan entre sí ni con
  nada del resto de la app. El número es el dato.
- **Gradientes** — fuera el glow radial de cada tarjeta y el de 64 px del
  gráfico de barras. No codificaban nada.
- **Sombra** — fuera el `hover:shadow-md` de tarjetas que viven en el flujo.

El acento quedó en un solo lugar: el borde izquierdo de 2 px de la primaria,
que es donde se actúa.

> [!warning] El radio se salió del sistema
> **Fecha:** 2026-09-18
> **Problema:** el ADR [[2026-05-03-border-radius-global]] fija 8 px global, y
> las tarjetas del dashboard usan `rounded-2xl` (16 px) desde el rediseño de
> julio.
> **Acción requerida:** confirmar cuál manda. No se tocó acá para no meter un
> recolor de toda la app dentro de un cambio de layout.

## Filtros de fecha de Analíticas

Eran dos `type="date"` sueltos y tres píldoras. Ahora
`components/analytics/date-range-toolbar.tsx`:

- Los atajos son **un control segmentado**, no tres botones sueltos: se usan
  casi siempre y verlos juntos comunica que son excluyentes.
- El rango de cada atajo se define en un solo lugar, así el resaltado no se
  puede desincronizar de lo que el botón aplica. **Bug arreglado de paso:**
  "Últimos 12m" nunca se prendía porque su comparación no existía.
- Debajo, el rango **escrito en palabras y contado en días**. Dos campos que
  dicen `2026-01-01` y `2026-09-18` son ciertos pero no se leen.
- Los `min`/`max` del calendario se limitan a donde hay datos.
