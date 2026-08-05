---
title: Inventario de tachos 240 L — altas 190–200 y verificación de taras
tags:
  - log
  - tachos
  - datos
date: 2026-07-27
---

# 2026-07-27 — Inventario de tachos 240 L (1–200)

El usuario entregó el inventario físico completo de tachos de 240 L con sus taras (1–200).
Se sincronizó contra `public.containers` en Supabase (piloto) con un upsert idempotente
(`on conflict (id) do update ... where is distinct from`).

## Resultado

- **Altas:** tachos `190`–`200` (11 nuevos, 240 L, `active`). Taras: 190=13.7, 191=13.6,
  192=13.6, 193=13.7, 194=13.7, 195=13.7, 196=13.6, 197=13.6, 198=13.1, 199=13.1, 200=13.1.
- **Sin cambios:** las taras de `001`–`189` ya coincidían con el inventario nuevo
  (0 filas actualizadas).
- **Altas metálicos:** `M16`–`M20` (5 nuevos, 120 L, `is_metallic_dedicated`, `active`).
  Taras: M16=8.9, M17=8.9, M18=8.7, M19=8.7, M20=8.9. Los `M1`–`M15` ya coincidían con
  el inventario entregado (0 filas actualizadas).
- Total en `containers`: 246 (200 numéricos + Y1–Y26 + M1–M20).

## Notas del inventario (no requirieron cambios en BD)

- **Tacho 52:** el original (tara 15.6) se rompió; el actual es una unidad nueva desde
  junio con tara **14.7** — la BD ya la tenía.
- **Tacho 76:** el original (tara 13.9) se perdió; el actual es una unidad nueva desde
  junio con tara **13.6** — la BD ya la tenía.
- No se crearon filas para los tachos retirados (52.1/76.1 del Excel): el ID en el
  sistema identifica la posición del inventario, no la unidad física
  (ver `decisions/2026-06-01-ids-tachos-supabase-vs-mock.md`).

Sin migración: cambio de datos aplicado directo con `execute_sql` (mismo criterio que
`logs/2026-07-06-reset-datos-piloto.md`).
