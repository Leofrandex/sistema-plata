---
title: Pesaje + Tratamiento + Empresa/Tipo dinámicos + rename "tacho"
tags:
  - log
  - pesaje
  - tratamiento
  - recorridos
  - reportes
  - modelo
updated: 2026-05-30
---

# 2026-05-30 — Pesaje / Tratamiento / Empresa-Tipo dinámicos / rename "tacho"

Lote grande post-piloto. Spec y plan:
- `docs/superpowers/specs/2026-05-29-pesaje-tratamiento-rename-tacho-design.md`
- `docs/superpowers/plans/2026-05-29-pesaje-tratamiento-rename-tacho.md`

## Cambio de modelo (lo más importante)

> [!important] Empresa y tipo de desecho dejan de ser propiedades permanentes del tacho
> Antes: cada `Container` tenía `company_id` (empresa dueña) y `waste_type` fijos.
> Ahora: el tacho es del **pool de Hospiwaste** y tanto la **empresa** (ION/Airkem) como
> el **tipo de desecho** son **dinámicos por ciclo**. Ver ADR
> `decisions/2026-05-30-empresa-tipo-dinamicos-tacho.md`.

- **Empresa**: se elige en el **recorrido** y se hereda al pesaje (derivada del recorrido
  abierto vía `getContainerCurrentCompanyId`); vuelve a `null` al completarse el tratamiento.
  Snapshot en `container_receptions.company_id` para el reporte.
- **Tipo de desecho**: lo **ingresa el operador en pesaje** (`container_receptions.waste_type`).
  Se **eliminó** `containers.waste_type` (columna dropeada; backfill previo a las recepciones).
- **Numeración**: la BD del piloto ya usa números limpios **`001`..`189`** con `company_id`
  null. En UI se muestra el número pelado vía `formatTachoNumber` (`A-001`→`001`, no-op sobre
  `001`). Se eliminaron los 10 tachos ION mock (eran ficción de demo; el pool real son 189).

## Features entregadas

1. **Pesaje — pendientes + bloqueo + ausente**: en la sesión activa se listan los tachos
   pendientes **por número**; "Finalizar" se bloquea hasta pesarlos todos. Escape: marcar un
   tacho **ausente** (nota opcional, guardado transitorio en la `ActiveSession` de IndexedDB);
   el ausente sigue en la cola para la próxima sesión.
2. **Pesaje — empresa heredada + tipo input**: se quitó el selector de cliente; la empresa se
   muestra informativa (heredada del recorrido). Tipo de desecho = selector (default infeccioso).
3. **Pesaje — "tratar inmediatamente"**: check por tacho (solo infeccioso). Al finalizar la
   sesión, esos tachos saltan cámara fría y se les registra un `TreatmentRun` completado →
   fase `clean`. `computeContainerPhase` ahora da `clean` con tratamiento/traslado completado
   aunque no haya pasado por storage (avanza el **P1** de `estado-envase-derivado`).
4. **Tratamiento (`/register/treatment`)**: activado contra Supabase (antes era mock con
   `user-1`). Multi-select; candidatos = infecciosos en cámara fría (según la última recepción);
   cierre en un paso (`createTreatmentRun`). Query nueva `createTreatmentRun`.
5. **Recorrido — selector de empresa** (andén + morgue): se elige al iniciar la sesión y se
   guarda en `route_events.company_id`.
6. **Reportes**: agrupan por la **empresa registrada** (`reception.company_id` /
   `routeEvent.company_id`), con **fallback histórico** a `container.company_id` para data sin
   snapshot (preserva el histórico de Airkem).
7. **Rename "envase → tacho"** en toda la app (strings y comentarios) + display por número.

## Migraciones (aplicadas al piloto `xqqnthyipkdkwyknbtnw` vía MCP)

- `20260529000000` — `container_receptions`: `+ company_id text`, `+ waste_type` (con backfill
  desde `containers.waste_type`), `+ treat_immediately`.
- `20260529010000` — `route_events`: `+ company_id text`.
- `20260529020000` — `DROP COLUMN containers.waste_type` (tras backfill).

> [!note] `company_id` es **text**, no uuid (`companies.id` es text, ej. `company-ion`).

## Estado técnico

- `next build` OK (20 rutas). Jest `src/__tests__` 61/61. Vitest (ui) 12/12.
- Campos nuevos modelados como **opcionales** en los tipos de dominio para no romper literales/
  histórico sin snapshot.

## Pendiente

- E2E manual en dispositivo real (multi-andén, tratado inmediato, tratamiento multi-select,
  empresa en recorrido → reporte, tachos ausentes).
- Mock data (offline) usa ids `A-xxx`/históricos; la BD en vivo usa `001..189`. El display por
  número uniforma ambos, pero el mock no se renumeró (solo afecta modo offline/demo).
