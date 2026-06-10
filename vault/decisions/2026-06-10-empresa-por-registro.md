---
title: La empresa es propiedad del registro, no del tacho
tags:
  - decision
  - adr
  - tachos
  - empresa
  - recorrido
  - pesaje
updated: 2026-06-10
---

# ADR 2026-06-10 — Empresa por registro; el tacho es independiente

**Fecha:** 2026-06-10
**Estado:** Aceptado

## Contexto

El modelo arrancó con `containers.company_id` (el tacho "pertenecía" a una empresa).
En la práctica eso es falso: un mismo tacho físico circula por distintas empresas
(ION, Airkem) a lo largo de su vida. En la DB del piloto **0/230 tachos** tenían
empresa asignada — la columna era código muerto. Además, en un mismo recorrido puede
haber tachos de varias empresas a la vez, y el reporte se arma **por empresa**
(necesita saber a qué empresa atribuir cada registro y sus fotos).

## Decisión

La **empresa es propiedad del registro**, nunca del tacho:

- `route_events.company_id` — empresa de ESE registro de recorrido.
- `container_receptions.company_id` — snapshot de la empresa en ESE pesaje.
- Se **elimina** `containers.company_id` (migración `20260610000000`). El tacho es un
  identificador físico independiente.

### Recorrido de andén (cambio de UX)
Antes la empresa se elegía **una vez al iniciar la sesión** del horario y quedaba fija
para todos los andenes. Ahora la empresa se elige **en cada registro** (campo del
formulario, igual que la ubicación). En una sesión se hacen N registros, cada uno con
su empresa + ubicación. Ej.: en Pediatría → 1 registro ION + 1 Airkem; en Andén → otro
ION + otro Airkem = 4 registros. Iniciar la sesión ya no pide empresa.

Morgue queda igual (un solo registro por sesión): elige empresa al iniciar.

### Pesaje
Sin cambio de UX: la empresa de cada recepción se **hereda** del recorrido donde se
recogió el tacho (`getContainerCurrentCompanyId`, vía el último route_event que lo
recibió sucio). Sigue siendo un snapshot por registro.

### Derivados
- Reporte (`reports.ts`): pertenencia por `company_id` del registro; se quitó el
  fallback a la empresa del tacho. Un registro sin empresa no entra en ningún reporte.
- Dashboard mensual por empresa (`dashboard-metrics.ts`): agrupa por
  `reception.company_id` (antes por `container.company_id`, lo que estaba latentemente
  roto). El histórico mock se backfilleó a `company-airkem` (todo el histórico es Airkem).
- Inventario/admin de tachos: se quitaron columnas/filtros "Empresa/Cliente" del tacho
  (eran UI muerta). El admin de tachos ya no asigna empresa; el ID es el valor tecleado.

## Alternativas descartadas

- **Mantener `containers.company_id` oculto:** menos limpio y deja una fuente de verdad
  ambigua. Descartado: 0 filas lo usaban.

## Relacionado

- `logs/2026-06-10-empresa-por-registro-tacho-independiente.md`
- `decisions/2026-06-01-ids-tachos-supabase-vs-mock.md`
- [[DataModel]]
