---
title: Finalizar pesaje sin resolver todos los pendientes
tags: [pesaje, ux, log]
updated: 2026-07-17
---

# Finalizar pesaje sin resolver todos los pendientes

## Contexto

"Finalizar pesaje" exigía que cada tacho de la cola estuviera pesado o marcado
"ausente" uno por uno. En producción (julio 2026) eso resultó impracticable: el
11-jul había ~57 pendientes y el operador solo pesó 1 tacho (Yaris), así que las
sesiones del 9-jul y 11-jul quedaron `in_progress` para siempre. Consecuencia en
cadena: ninguna recepción pasó a cámara fría (los derivados StorageEvent /
TreatmentRun se crean **solo al finalizar la sesión**), la pantalla de
tratamiento quedó vacía y el dashboard mensual en 0.

## Cambio

En `src/app/register/weighing/page.tsx`:

- El botón "Finalizar pesaje" ya solo exige ≥1 tacho pesado; deja de bloquear
  por pendientes sin resolver (`pendingNotSkipped`).
- El diálogo de confirmación muestra una advertencia ámbar con cuántos tachos
  quedan sin pesar, aclarando que **siguen en la cola** para la próxima sesión
  (la cola se deriva de recorridos/recepciones, no de la sesión — no se pierde
  nada al finalizar).
- "Marcar ausente" se mantiene como mecanismo opcional para depurar la lista
  visible.

## Pendiente conocido (no resuelto aquí)

- Las 2 sesiones de julio siguen `in_progress` en la BD; hay que cerrarlas (o
  darles una vía de cierre desde la UI/BD) para que sus recepciones avancen.
- Las notas de "ausente" viven solo en IndexedDB local, no en Supabase.
- Pesajes Yaris/Metálico quedan con `company_id` null → invisibles en el
  widget mensual del dashboard (ver conversación 2026-07-17).
