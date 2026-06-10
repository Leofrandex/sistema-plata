---
title: Empresa por registro + tacho independiente
tags:
  - log
  - tachos
  - empresa
  - recorrido
  - reportes
  - supabase
updated: 2026-06-10
---

# Log 2026-06-10 — Empresa por registro; eliminado company_id del tacho

## Qué se pidió

1. En recorrido de andén dejar de pedir la empresa al inicio de la sesión: poder
   registrar tachos de **varias empresas en un mismo recorrido**, eligiendo la empresa
   **por registro** (como ya se hace con la ubicación Pediatría/Andén).
2. El tacho no debe tener empresa: es independiente. La empresa vive en el registro
   (recorrido / pesaje). En el reporte, cada registro se atribuye a su empresa.

Decisión de diseño: `decisions/2026-06-10-empresa-por-registro.md`.

## Qué se hizo

### Fase 1 — Recorrido de andén: empresa por registro
- `route-form.tsx`: `RouteFormState.companyId` + selector de empresa (prop
  `showCompanySelector`). Andén lo activa; morgue no (un registro, elige al iniciar).
- `anden/[slot]/page.tsx`: se quitó el selector/gate de empresa del inicio de sesión;
  la sesión arranca sin empresa. Cada andén guarda su `company_id` (crear/editar).
  `canSaveAnden` ahora exige empresa. Recovery de sesión: `context.company_id = null`.

### Fase 2 — Tacho independiente (drop de `containers.company_id`)
- Migración `20260610000000_drop_containers_company_id`: `drop column company_id`.
  Hubo que **recrear la vista `v_containers_pending_weighing`** (dependía de la columna;
  no se consume en el cliente).
- Tipos: `Container` sin `company_id`; `database.types.ts` (tabla + vista).
- `reports.ts`: pertenencia solo por `company_id` del registro (quitado fallback al tacho).
- `dashboard-metrics.ts`: kg por empresa agrupando por `reception.company_id`
  (antes por `container.company_id`; estaba roto porque 0 tachos tenían empresa).
- Mock (`mock-data.ts`): backfill `company-airkem` en route_events, recepciones y el
  histórico (~14k filas, todo Airkem); quitado `company_id` de literales metálicos/Yaris.
- UI: inventario (filtro + columnas Empresa/Cliente), admin de tachos (alta sin empresa),
  pickers/selectores y detalle de tacho ("Última empresa" derivada de la recepción).
- `supabase-hydrator.tsx`: el mapper de container ya no setea `company_id`.

## Verificación

- `tsc --noEmit`: sin errores de producción (queda ruido pre-existente de tipos `jest`).
- `next build`: OK.
- `jest`: **75/75** (se actualizaron fixtures de `reports.test` y `dashboard-metrics.test`
  al nuevo modelo: empresa en el registro).
- DB: columna `company_id` eliminada de `containers` (8 columnas restantes); vista
  recreada. Confirmado vía MCP.

## Notas / gotchas

- **Consecuencia importante:** al quitar el fallback al tacho, cualquier registro
  histórico **sin** `company_id` deja de aparecer en reportes/dashboard por empresa. En
  Supabase había 9/18 recepciones sin empresa (pre-snapshot) — quedan fuera de los
  reportes por empresa. Todos los route_events (8/8) sí tienen empresa.
- El histórico mock se asume Airkem (el periodo capturado era íntegramente Airkem).

Relacionado: `decisions/2026-06-10-empresa-por-registro.md`,
`logs/2026-06-10-sesion-no-persistente-cookies-de-sesion.md`, [[DataModel]].
