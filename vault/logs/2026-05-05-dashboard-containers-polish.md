---
title: Dashboard & Containers UI Polish
tags:
  - log
  - dashboard
  - containers
  - ui
date: 2026-05-05
---

# 2026-05-05 — Dashboard & Containers UI Polish

## Qué cambió

### Inventario de Envases (`/containers`)
- Filtros con labels visibles (Buscar envase, Cliente, Tipo de desecho, Tamaño) en grid responsive
- Ícono de búsqueda dentro del input
- Toda la fila de la tabla es clickeable (cursor pointer + ring de focus + Enter)
- Selección de texto preservada (no navega si hay selección activa)
- Selects asociados con su label vía `aria-labelledby` (a11y)

### Dashboard (`/dashboard`)
- Hero decorativo con saludo + fecha en español (gradient navy → accent + blobs blur)
- KPI cards renovadas con íconos, acentos de color y blur sutil (Lotes activos, Envases en circulación, Cámara fría, Tratamiento)
- Tabs reemplazadas por `BatchStatusToggle` (segmented control) con contadores y patrón ARIA `radiogroup`
- Diseño unificado de lote con `BatchCard` (variant `active` | `completed`)
- Grid responsive de 1/2/3/4 columnas — usa todo el ancho disponible
- Filtros de completados con labels (Cliente, Desde, Hasta)
- Íconos decorativos marcados `aria-hidden`; tarjetas con `aria-label` descriptivo

## Archivos creados
- `src/components/dashboard/batch-card.tsx`
- `src/components/dashboard/batch-status-toggle.tsx`
- `src/components/dashboard/completed-batches-filters.tsx`
- `src/components/dashboard/dashboard-hero.tsx`

## Archivos modificados
- `src/components/containers/container-filters.tsx`
- `src/components/containers/container-table.tsx`
- `src/components/dashboard/metrics-cards.tsx`
- `src/app/dashboard/page.tsx`

## Archivos eliminados
- `src/components/dashboard/active-batches-tab.tsx`
- `src/components/dashboard/completed-batches-tab.tsx`

## Por qué
- El dashboard se sentía "muerto" y desperdiciaba el ancho disponible.
- Activos y completados tenían diseños distintos sin razón funcional.
- Filtros sin labels obligaban al usuario a leer placeholders.
- Click solo en el serial no aprovechaba el target completo de la fila.
