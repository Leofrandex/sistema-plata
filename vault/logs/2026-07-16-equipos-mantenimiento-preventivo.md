---
title: Equipos — mantenimiento preventivo (tab nueva)
tags:
  - log
  - equipos
date: 2026-07-16
---

# 2026-07-16 — Tab Equipos con mantenimiento preventivo

Nueva tab **Equipos** (solo coordinador) para la base instalada PTDP.

## Qué se hizo

- Migración `20260716000000_equipment_maintenance.sql`: tablas `equipment` y
  `equipment_maintenance` (anulación lógica) + valor `maintenance` en
  `photo_event_type` + RLS piloto. Aplicada al proyecto.
- Semilla de 60 equipos desde el Excel del inbox
  (`scripts/seed-equipment-supabase.py`), frecuencias en null.
- Lógica pura del semáforo en `src/lib/data/equipment-status.ts` (tests jest).
- `/equipment`: tabla ordenada por urgencia con semáforo, filtros
  (estado + búsqueda) y resumen de conteos.
- `/equipment/detail?id=`: editar datos + frecuencia (atajos 1/3/6/12 meses),
  registrar mantenimiento (fecha + observaciones + fotos vía
  `uploadEventPhotos`), historial con anulación por motivo, desactivar equipo.
- Nav: entrada "Equipos" en sidebar y menú móvil de coordinador.

## Ver también

- Spec: `docs/superpowers/specs/2026-07-16-equipos-mantenimiento-preventivo-design.md`
- Módulo: [[EquipmentMaintenance]]

## Pendiente

- E2E manual (registrar mantenimiento con fotos desde el navegador).
