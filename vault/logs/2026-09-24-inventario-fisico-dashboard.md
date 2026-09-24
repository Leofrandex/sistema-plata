---
title: Inventario físico en la tarjeta Flota y planta
tags:
  - log
  - dashboard
  - tachos
  - inventario
date: 2026-09-24
updated: 2026-09-24
---

# 2026-09-24 — Inventario físico en "Flota y planta"

La tarjeta del dashboard muestra el mismo desglose que el Excel de inventario de planta:
tachos 240 L por llantas y Yaris por color, cada fila con limpios / en proceso.

## Decisiones del usuario
- **Limpio / en proceso sale del sistema en vivo**, no del Excel: el Excel envejece al día siguiente.
  Limpio = en planta, en cliente o sin actividad; en proceso = pendiente de pesar o de tratar.
- **Llantas y color se actualizan recargando el Excel** con `scripts/sync_inventario_fisico.py`
  (el usuario deja el Excel en el inbox; se corre la vista previa y luego `--apply`). No hay pantalla de edición.
- Dos columnas en `containers`, sin historial de cargas.

## Límites conocidos
- Mientras planta no registre tratamientos (teléfonos en v1.5), "En proceso" sale inflado.
- Los 8 Yaris verdes no tienen número y no están en el sistema; la fila Verdes muestra 0.
- `Y26` no está en el Excel: queda sin color, en "Sin dato".

Spec: `docs/superpowers/specs/2026-09-24-inventario-fisico-dashboard-design.md`.
