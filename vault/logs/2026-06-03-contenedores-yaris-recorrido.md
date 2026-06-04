---
title: Contenedores Yaris de recorrido (Y1…Y26)
tags:
  - log
  - containers
  - yaris
  - recorrido
  - pesaje
  - dashboard
updated: 2026-06-03
---

# 2026-06-03 — Contenedores Yaris de recorrido

Se agregaron **26 contenedores físicos de la flota Yaris** (`Y1`…`Y26`) que circulan en
recorrido. Son una flota aparte sin ciclo de planta.

## Qué se agregó

- Columna nueva `containers.is_yaris_container boolean not null default false`.
- 26 registros `Y1`…`Y26`: `company_id = null`, `size_liters = 1100`, `tare_weight_kg = 0`,
  `status = 'active'`, `is_yaris_container = true`. IDs literales en mayúscula (como `M1`…`M15`).

## Decisiones

| Decisión | Valor | Razón |
|----------|-------|-------|
| ID | `Y1`…`Y26` literal, sin padding | Consistente con metálicos `M1`…`M15` |
| Empresa | `null` | Flota compartida, no pertenece a ION/Airkem |
| Tamaño | `1100 L` | Contenedor grande rodante |
| Tara | `0` | No se pesan directamente |
| Cola de pesaje | **Excluidos** | Se pesan con los tachos alternativos `is_yaris_dedicated` |
| Dashboard de circulación | **Excluidos** | Sin ciclo de planta; evita que queden atascados en "pendiente por pesar" |

## `is_yaris_container` ≠ `is_yaris_dedicated`

- `is_yaris_dedicated` (existía): marca el **tacho con el que se pesa** una carga Yaris/Picanto.
  Aparece en Pesaje cuando el operador activa el modo Yaris.
- `is_yaris_container` (nuevo): marca el **contenedor físico** de la flota Yaris que circula
  en recorrido. Nunca se pesa directamente.

## Comportamiento

- **Recorrido:** aparecen automáticamente en el picker (cualquier tacho `active`). Sin cambios de UI.
- **Pesaje:** excluidos en `getPendingWeighingContainerIds` (cliente) y en la vista
  `v_containers_pending_weighing` (Postgres). Nunca aparecen en "pendiente por pesar".
- **Dashboard:** excluidos del pool activo en `computeCirculationBreakdown`.
- **Admin:** columna/toggle "Contenedor Yaris" y checkbox al alta (paridad con los otros flags).

## Archivos

3 migraciones (`20260603010000` columna, `010100` seed, `010200` vista), `types.ts`,
`database.types.ts`, `supabase-hydrator.tsx`, `containers.ts`, `dashboard-metrics.ts`,
`mock-data.ts`, `admin/containers/page.tsx`, `container-form.tsx`, + 3 tests.

## Fuera de alcance (decidido)

La idea de una columna `current_phase` materializada en `containers` se discutió y se decidió
**no acoplarla** a este cambio. Queda como próximo proyecto: caché mantenida por triggers
(eventos = fuente de verdad) + job de auditoría. Ver
`decisions/2026-05-21-estado-envase-derivado.md` y [[Roadmap]].

Spec: `docs/superpowers/specs/2026-06-03-contenedores-yaris-recorrido-design.md`.
Plan: `docs/superpowers/plans/2026-06-03-contenedores-yaris-recorrido.md`.
