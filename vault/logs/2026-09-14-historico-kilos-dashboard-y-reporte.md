---
title: Histórico de kilos 2024–2026 cargado; comparativo anual y reporte para directiva
tags:
  - log
  - dashboard
  - reportes
  - data-historica
date: 2026-09-14
---

# Histórico de kilos 2024–2026 → dashboard y reporte comparativo

> [!info] Resumen
> Se cargaron los **70,386 pesajes históricos** de PTDP (2024-01-15 → 2026-09-06,
> **1,231 toneladas netas**) en `historical_daily_kg`, agregados por día y
> empresa. Con eso se llenó la barra mensual del dashboard, que hasta ahora no
> tenía con qué retroceder, y se agregaron dos entregables nuevos: un gráfico
> comparativo año-contra-año en el dashboard y un reporte de kilos exportable a
> PDF en `/reports/comparativo`.

La decisión de fondo —por qué tabla aparte, por qué agregado diario, por qué no
se muestran los procesados históricos— está en
[[2026-09-14-historico-kilos-2024-2026]]. Este log cubre qué se hizo.

## El número que importa

La curva de crecimiento de la planta, que hasta hoy no estaba a la vista en
ningún lado:

| Período | Kg netos |
|---|---|
| 2024 (desde el 15-ene) | 216,212 |
| 2025 | 499,651 |
| 2026 (hasta el 6-sep) | 515,498 |

Enero 2024 cerró en 10.2 t. Agosto 2026 cerró en 69.3 t. Casi 7× en dos años y
medio.

## Limpieza de la frontera

El sistema tenía 36 pesajes de prueba previos al arranque real (21 del
2026-08-10, 15 del 2026-09-04). La operación de verdad empieza el **2026-09-07**
y el Excel termina el **2026-09-06**: la frontera queda sin solapamiento y sin
hueco.

Los 36 se borraron junto con sus sesiones de pesaje huérfanas. Quedan
respaldados dentro de la misma base:

```sql
select * from public._archivo_receptions_pre_2026_09_07;         -- 36 filas
select * from public._archivo_weighing_sessions_pre_2026_09_07;  -- 8 filas
```

No se tocaron `route_events` (9 previos, congelados por el modo interino, ver
[[2026-09-01-modo-interino-solo-pesaje]]) ni los `storage_events` y
`container_locations` de esas fechas, porque no son pesajes y nadie pidió
borrarlos.

## Cómo se recarga

```bash
python scripts/extract-kilos-historicos.py   # Excel -> JSON + SQL, con validación
python scripts/load-kilos-historicos.py      # empuja por PostgREST
```

El primero **falla** si sus totales no reproducen la tabla dinámica del propio
Excel, así que una planilla corregida o reemplazada no puede entrar en silencio.

La carga necesita una política de inserción temporal, porque la tabla solo
acepta escritura de coordinador y el script corre con la publishable key:

```sql
create policy "tmp carga historico" on public.historical_daily_kg
  for insert to anon with check (true);
-- ... correr load-kilos-historicos.py ...
drop policy "tmp carga historico" on public.historical_daily_kg;
```

**Acordarse de borrarla.** Si algún día esto se hace seguido, conviene una
service key en vez del baile de políticas.

## Qué se tocó

**Nuevos:**

- `scripts/extract-kilos-historicos.py` — Excel → agregado diario, determinista y autovalidado
- `scripts/load-kilos-historicos.py` — carga por PostgREST
- `shared/src/lib/data/historical-kg.ts` — serie unificada histórico + sistema y sus rollups
- `shared/src/lib/supabase/queries/historical-kg.ts` — query y las constantes del corte
- `shared/src/__tests__/lib/historical-kg.test.ts` — 17 tests
- `hub/src/hooks/use-historical-kg.ts` — carga cacheada por sesión de browser
- `hub/src/components/dashboard/year-comparison-section.tsx` — comparativo anual
- `hub/src/lib/data/kg-comparison-report.ts` — armado del reporte
- `hub/src/components/reports/kg-comparison-document.tsx` — PDF
- `hub/src/components/reports/reports-tabs.tsx` — navegación entre los dos reportes
- `hub/src/app/reports/comparativo/page.tsx` — la pantalla

**Modificados:**

- `hub/src/app/dashboard/page.tsx` — elige la fuente según el mes y arma la serie unificada
- `hub/src/components/dashboard/monthly-bar-chart.tsx` — props `showProcessed` y `note`
- `hub/src/app/reports/page.tsx` — tabs
- `shared/src/lib/supabase/database.types.ts` — la tabla nueva

**Migración:** `historical_daily_kg` con RLS igual al resto (lectura para
autenticados, escritura solo coordinador).

## Dos cosas para tener en cuenta

**La fecha de tratado histórica no sirve para comparar.** Era opcional en el
formulario de planta: cobertura del 42% en 2024, 84% en 2025, 50% en 2026. Se
guarda en `treated_kg` porque es real, pero la barra mensual oculta la serie de
procesados en los meses históricos y lo aclara al pie. Si alguien pide "por qué
no se ve el procesado de 2024", la respuesta es esta.

**El mes en curso queda fuera de las variaciones porcentuales.** Septiembre 2026
lleva 14 días y septiembre 2025 tiene 30: compararlos daría una caída inventada.
El resumen del comparativo anual excluye el mes en curso —sí lo dibuja en las
barras, donde se lee como parcial— y el reporte por rango no tiene el problema
porque compara rangos de fechas equivalentes.

## Timeout y estado de error

El hook corta la consulta del histórico a los 20 s y muestra un mensaje
accionable en vez de dejar el spinner para siempre. No es paranoia: el DNS de
la operadora no resuelve el host de Supabase desde planta (ver
[[2026-08-25-fix-sesion-apk-preferences-sqlite]]), y ahí un "Cargando…" eterno
no le dice nada a nadie.

> [!warning] Ese camino de error NO está verificado en vivo
> **Fecha:** 2026-09-14
> **Problema:** compila y typechequea, pero no se lo vio funcionando. Al
> intentar comprobarlo en el navegador, la pestaña de prueba no tenía sesión de
> Supabase y **React nunca completó la hidratación** (`__react*` ausente en
> `<main>`), así que ningún `useEffect` llegó a correr — ni el mío ni el de la
> tarjeta de equipos, que estaba igual de vacía. El spinner eterno que se vio
> era eso, no el timeout fallando.
> **Acción requerida:** con sesión válida, cortar la red y confirmar que a los
> 20 s aparece el mensaje de error en el comparativo anual y en
> `/reports/comparativo`.

Vale la pena mirar aparte por qué una pestaña sin sesión queda sin hidratar en
vez de redirigir al login: si pasa igual en producción, cualquier pantalla del
hub se queda colgada en su estado inicial en vez de mandar al usuario a
autenticarse.

## Validación

- ✅ `npm test` — 281 tests en los 3 workspaces, ninguno roto (17 nuevos)
- ✅ `npm run build:hub` — compila; `/reports/comparativo` aparece en el árbol de rutas
- ✅ `tsc --noEmit` en `hub/` y `app/` sin errores propios
- ✅ Totales en Supabase idénticos a los del Excel de origen
- ✅ Comparativo mes a mes recalculado en SQL sobre las dos fuentes unidas: coincide
- ✅ El maquetado de ambas pantallas renderiza (tabs, rango por defecto, secciones)
- ⬜ **Pendiente:** los gráficos con datos reales — hace falta una sesión de coordinador
- ⬜ **Pendiente:** el estado de error del timeout (ver arriba)
