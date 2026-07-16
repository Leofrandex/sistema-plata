---
title: Equipos — Mantenimiento preventivo
tags:
  - module
  - equipos
updated: 2026-07-16
---

# Equipos — Mantenimiento preventivo

Tab **Equipos** (solo coordinador): semáforo de mantenimiento preventivo de la
base instalada de la PTDP. Spec completo:
`docs/superpowers/specs/2026-07-16-equipos-mantenimiento-preventivo-design.md`.

## Modelo

- `equipment` — un registro por equipo físico; `maintenance_frequency_days`
  nullable (null = "Sin configurar"); `active` para baja lógica.
- `equipment_maintenance` — historial; anulación lógica (`voided_*`, espejo de
  `route_events`). Fotos en `photos` con `event_type = 'maintenance'`.
- Semilla: 60 equipos del Excel `BASE INSTALADA PTDP HOSPIMED ST SOFTWARE.xlsx`
  (en `inbox/procesado/`) vía `scripts/seed-equipment-supabase.py`.
  La columna "COMENTARIOS" del Excel es el **dueño** (CSS/HOSPIMED/HOSPIWASTE)
  → `equipment.owner`.

## Semáforo (lógica en `src/lib/data/equipment-status.ts`)

`próximo = último mantenimiento no anulado + frecuencia`. Estados:
🔴 vencido (< 0 días) · 🟡 próximo (≤ 15) · 🟢 al día (> 15) ·
⚪ sin configurar (sin frecuencia o sin mantenimiento). Umbral fijo 15 días.

## Decisiones

- **Módulo autónomo**: queries directas a Supabase (sin store/hydrator/outbox).
  Es flujo de coordinador en oficina; no infla la hidratación de operadores.
  Aclaración: las fotos de mantenimiento sí entran a la hidratación general
  (`listAllPhotos` del hydrator las trae, por vivir en `photos`); el payload
  extra es marginal y se aceptó.
- Solo coordinador: `/equipment` no está en `OPERATOR_PATHS` → AuthGuard bloquea.
- Detalle vía `/equipment/detail?id=` (export estático, sin rutas dinámicas).
