---
title: Deshacer pesaje (soft-delete) + vista v_containers_pending_weighing
tags:
  - log
  - pesaje
  - supabase
  - trazabilidad
updated: 2026-06-03
---

# 2026-06-03 — P1 resueltos: deshacer pesaje + vista de pendientes

Se cerraron los dos bloqueantes P1 del ADR [[2026-05-21-estado-envase-derivado]]
antes/durante el piloto.

## P1a — Soft-delete de recepciones ("Deshacer pesaje")
- Migración `20260603000000_reception_soft_delete_and_pending_view.sql`:
  columnas `voided_at`, `voided_by`, `void_reason` en `container_receptions`
  (aditivo, nullable). **Nunca** se borra físico → trazabilidad intacta.
- `container_receptions_with_net` recreada con `where r.voided_at is null`.
- Query `voidReception` (anulación lógica, no `delete`); el flujo de edición del
  drawer de pesaje ahora abre `ConfirmVoidDialog` con **motivo obligatorio**.
- Botón "Eliminar" → "Deshacer pesaje". El tacho vuelve a quedar disponible.
- Todas las derivaciones de cliente ignoran anuladas: `getPendingWeighingContainerIds`,
  kg del dashboard (`dashboard-metrics.ts`), reportes (`reports.ts`) y los pickers de
  "última recepción" (containers, container[id], tratamiento).

## P1b — Cola de pesaje como vista
- Vista `v_containers_pending_weighing` (security_invoker): tacho activo + recogido
  sucio + sin recepción vigente. Réplica de `getPendingWeighingContainerIds`.
- **No** se cableó el cliente a la vista todavía (decisión: menor riesgo en día de
  piloto; con <204 tachos el cálculo en cliente es trivial). Pendiente post-piloto.

## Verificación
- Migración aplicada al proyecto remoto `xqqnthyipkdkwyknbtnw` + registrada en historial.
- Tests: 55 de lib (jest) en verde, incl. 3 nuevos de `getPendingWeighingContainerIds`
  (pendiente / pesado / anulado→pendiente). vitest 12 en verde. Sin errores de tipo.
- Las 2 fallas de `components/ui/*.test.tsx` (global `vi` bajo jest) son preexistentes.

> [!note] No pusheado
> A pedido del usuario, estos cambios quedaron **solo locales** (sin commit/push) a la
> espera de revisión. La migración SÍ está aplicada en la DB remota.
