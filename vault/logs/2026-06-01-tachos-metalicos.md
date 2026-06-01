---
title: Tachos metálicos M1-M15 + tipo "Metálicos No reutilizables"
tags:
  - log
  - pesaje
  - tachos
  - modelo
updated: 2026-06-01
---

# 2026-06-01 — Tachos metálicos M1-M15

Nuevo 6º tipo de desecho **Metálicos No reutilizables** (enum `metallic`) y 15 tachos
dedicados `M1`…`M15` (120 L), análogos a los Yaris pero disparados por el tipo de desecho.

## Cambios
- Enum `waste_type` += `metallic`; `container_size` += `120`; columna
  `containers.is_metallic_dedicated` (espejo de `is_yaris_dedicated`).
- Seed: 17 tachos Airkem marcados Yaris (`A-020…A-187`) + 15 metálicos `M1…M15`
  (`company_id = null`, taras reales 8.7–9.2 kg).
- Pesaje: al elegir "Metálicos No reutilizables", el selector de tacho muestra solo los M
  (siempre disponibles, sin recorrido). Metálico y Yaris mutuamente excluyentes.
- Admin: alta + toggle de tacho metálico, tamaño 120 L, empresa opcional.
- Mock offline: 15 metálicos + 17 Yaris marcados.

## Decisiones
- Los metálicos no pertenecen a empresa (coherente con ADR
  `2026-05-30-empresa-tipo-dinamicos-tacho`: empresa dinámica/derivada).
- Post-pesaje van a cámara fría como los no-infecciosos.

Spec: `docs/superpowers/specs/2026-06-01-tachos-metalicos-piezas-metalicas-design.md`
Plan: `docs/superpowers/plans/2026-06-01-tachos-metalicos.md`
