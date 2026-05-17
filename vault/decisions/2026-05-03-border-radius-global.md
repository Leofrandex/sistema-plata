---
title: "ADR: Border radius global = 8px"
tags:
  - decision
  - design-system
  - branding
updated: 2026-05-03
---

# ADR: Border radius global = 8px (`--radius: 0.5rem`)

**Fecha:** 2026-05-03  
**Estado:** Aceptado

## Contexto

El sistema usa el token `--radius` de shadcn como base para todos los border-radii de los componentes:
- `rounded-lg` = `var(--radius)` = 8px
- `rounded-md` = `calc(var(--radius) - 2px)` = 6px
- `rounded-sm` = `calc(var(--radius) - 4px)` = 4px

El valor por defecto de shadcn era `0.625rem` (10px). El branding de Hospimed especifica `8px` para botones e inputs.

## Decisión

Usar `--radius: 0.5rem` (8px) como radio global para **todos** los componentes del sistema: botones, inputs, cards, popovers, dropdowns, badges, etc.

Esta decisión afecta todo el árbol de componentes que consumen `--radius`.

## Confirmación

Confirmado por Sebastian Castro el 2026-05-03: "confirmamos 8px para el border radius".

## Consecuencias

- Todos los componentes shadcn (Button, Input, Card, Select, Popover, Badge, etc.) usarán 8px como base de radio.
- Cards se ven con `rounded-lg` = 8px (antes 10px) — sutilmente más cuadradas.
- Componentes inline (badges, chips) usan `rounded-sm` = 4px.
