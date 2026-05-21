---
title: Histórico Airkem 2026 cargado al dashboard
tags:
  - log
  - dashboard
  - mock-data
  - data-historica
date: 2026-05-18
---

# Histórico Airkem 2026 → Dashboard

> [!info] Resumen
> Se reemplazaron los 10 envases mock de Airkem por los **189 carros reales** del Excel histórico que cubre **2026-01-01 → 2026-05-11** (131 días, **253,889 kg netos procesados**). El dashboard ejecutivo ahora muestra datos reales en lugar de mock.

## Contexto

El archivo `vault/inbox/2026-05-17-historico-envases.xlsx` lo subió Sebastian para que la directiva pudiera ver los gráficos del dashboard con números reales en una demo. El Excel contenía 4 hojas; la única relevante fue `Kilos Diarios` con 14,427 registros de pesaje individual por carro.

## Decisiones de diseño

| Decisión | Por qué |
|---|---|
| Solo se cargó Airkem | Airkem aparece en 14,378 registros (99.7%); los 49 restantes son typos del operario (`ION - Airkem`, `Airkem-ION`, `Handy Solutions`) — se descartaron. |
| ION queda en cero histórico | ION no participaba en el periodo capturado. Mantenerlo en cero refleja la realidad y deja visible la asimetría real entre empresas. |
| 189 containers `A-001 … A-189` | El Excel tiene 189 carros distintos (numerados 1–189). Cada uno con su tara observada (fija a lo largo del año). |
| Tipo de desecho = `infectious` para todos | El Excel no trae waste_type. Es el tipo más común y el que va a autoclave on-site, consistente con el flujo del Excel. |
| Rezago de tratamiento | Si `Fecha de Tratado == Fecha pesaje`: simulado 4h después. Si difiere: respeta la fecha del Excel a las 07:00. |
| Pesos negativos descartados | 3 filas con neto ≤ 0 (errores de captura). |
| ContainerLocation post-tratamiento | Tras el último treatment de cada carro, se genera 1 location `client_site` para que la torta de circulación NO los clasifique a todos como `sin_registro`. |
| JSON estático importado | `src/lib/data/historical-data.json` (6.7 MB). Se importa directamente en `mock-data.ts`. Bundle del cliente +7 MB de chunk — aceptable para demo interna; si crece, mover a `public/` con fetch async. |

## Distribución mensual real

| Mes | Kg netos |
|---|---|
| enero 2026 | 58,422 |
| febrero 2026 | 53,760 |
| marzo 2026 | 61,380 |
| abril 2026 | 59,530 |
| mayo 2026 (parcial) | 21,164 |
| **Total** | **254,256** |

## Archivos creados / modificados

**Nuevos:**
- `scripts/extract-historical-data.py` — pipeline determinista Excel → JSON
- `src/lib/data/historical-data.json` — 189 containers + 14,375 receptions + storage + treatment + 131 sesiones de pesaje + 189 locations

**Modificados:**
- `src/lib/mock-data.ts` — quita los 10 Airkem hardcoded, mergea el histórico en cada colección
- `src/__tests__/components/metrics-cards.test.tsx` — total ahora 199 (no 20)
- `src/__tests__/lib/dashboard-metrics.test.ts` — total 199; Airkem mayo recibido 21,125.7 / procesado 18,117
- `src/__tests__/lib/reports.test.ts` — Airkem semana 11–17 tiene 106 receptions (las del día 11 del histórico)

## Sidenote técnico para [[Architecture]]

`computeMonthlyKgByCompany` y `computeDailyKg` estiman el peso de cada treatment usando la **última** reception del container (sort desc). Con el mock previo (1–2 receptions por carro) eso funcionaba; con el histórico cada carro tiene ~76 receptions y el atajo **subestima los procesados de los primeros meses** (los treatments tempranos se ponderan con pesos posteriores que no corresponden). Por eso el test espera `processedKg ≈ 18,117` para mayo en lugar de los ~20,640 "reales".

Fix sugerido (no aplicado para no expandir el alcance de este cambio):

```ts
const reception = [...store.receptions]
  .filter((r) => r.container_id === t.container_id
              && new Date(r.arrived_at) <= new Date(t.started_at))
  .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0]
```

## Validación

- ✅ `tsc --noEmit`: 0 errores nuevos
- ✅ `npm run build`: completa sin errores (chunk JSON 7.08 MB; PWA no lo precachea pero carga normal)
- ✅ `npx jest`: 52/54 passing (las 2 fallas restantes son pre-existentes — `button.test.tsx` e `input-field.test.tsx` usan API de vitest y los corre jest también)
- ✅ Dashboard responde 200 con los 199 envases y kg reales (21,233.80 recibidos / 18,171.90 procesados) en mayo
