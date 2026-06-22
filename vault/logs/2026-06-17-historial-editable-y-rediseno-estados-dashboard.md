---
title: Historial editable de recorridos y pesajes + rediseño de los 4 estados del dashboard
tags:
  - logs
  - historial
  - dashboard
  - trazabilidad
  - soft-delete
updated: 2026-06-17
---

# Historial editable (recorridos + pesajes) + rediseño de estados del dashboard

**Fecha:** 2026-06-17
**Rama:** `feat/historial-editable-recorridos-pesajes`
**Spec:** `docs/superpowers/specs/2026-06-17-historial-editable-recorridos-pesajes-design.md`
**Plan:** `docs/superpowers/plans/2026-06-17-historial-editable-recorridos-pesajes.md`

## Qué se hizo y por qué

### 1. Historial editable con anulación lógica

Hasta ahora, corregir un recorrido o un pesaje ya registrado solo se podía con SQL directo a
Supabase — inviable en operación (lo advertía el ADR `2026-05-21-estado-envase-derivado`). Se
agregó el historial como **pantalla dedicada** por sección: `/register/route/history` y
`/register/weighing/history`. El acceso es una **tarjeta "Historial de recorridos"** (sección
"Consultar", estilo andén/morgue) en `/register/route`, y un **botón "Historial"** en el encabezado
de `/register/weighing`. (Se descartó el patrón de pestañas Registrar/Historial: el componente
de tabs se renderizaba mal y mezclaba registro con consulta.)

- **Visible para todos; editar/anular solo coordinador** (mismo criterio de roles del resto del
  sistema; el control es por `currentRole === 'coordinator'` en UI, reforzado por middleware/RLS).
- **"Eliminar" = anulación lógica (soft-delete)**, nunca borrado físico: se conserva la fila con
  `voided_at/voided_by/void_reason`, espejando lo que ya hacía `container_receptions` ("deshacer
  pesaje"). La trazabilidad regulatoria exige conservar el hecho. Se agregaron esas columnas a
  `route_events` y `weighing_sessions` (migración `20260617000000`), y la vista
  `v_containers_pending_weighing` ahora ignora recorridos anulados.
- **Campos editables:** recorrido → empresa, área, tachos limpios/sucios; pesaje (por recepción) →
  peso bruto, tipo de desecho, tacho. La **empresa del pesaje no se edita aquí**: se corrige en el
  recorrido, su origen canónico (ver `decisions/2026-06-10-empresa-por-registro`).
- **Toda modificación requiere confirmación** (decisión del usuario). Las ediciones usan **modo
  borrador + botón "Guardar cambios"** con un diálogo de confirmación que aplica todos los cambios
  de una; las anulaciones usan el diálogo con **motivo obligatorio**. Patrón write-through:
  Supabase primero, luego el store local.
- **Por qué importa para la derivación:** como el estado del tacho se deriva de eventos, anular un
  registro reordena el dashboard solo. El requisito crítico es filtrar `voided_at is null` en
  **toda** la derivación; se hizo en `getRouteEventIdsForContainer`/`AnyDirection`
  (`containers.ts`), en la circulación del dashboard, y en reportes. También se corrigió un hueco
  preexistente: el hydrator no propagaba `voided_at` de las recepciones, así que una anulación se
  perdía al recargar.

### 2. Rediseño de los 4 estados del dashboard (modelo de línea de tiempo)

El gráfico "Tachos en circulación" pasó a un modelo donde **gana el último evento vigente** del
tacho, cerrando el ciclo completo:

**En planta (limpio)** → _recorrido entrega limpio_ → **En cliente** → _recorrido recoge sucio_ →
**Pendiente por pesar** → _pesaje_ → **Pendiente por tratar** → _tratamiento_ → **En planta**.

| Bucket | Color | Condición (último evento vigente) |
|---|---|---|
| **En planta** | slate `#94A3B8` | limpio en planta: recién dado de alta o tratamiento/traslado completado |
| **En cliente** | emerald `#10B981` | último evento = entregado limpio (`containers_clean_delivered`) |
| **Pendiente por pesar** | amber `#F59E0B` | recogido sucio sin recepción vigente |
| **Pendiente por tratar** | accent `#2A27E9` | pesado, esperando tratamiento |

Cambios clave respecto al modelo anterior:
- "En cliente" ya **no** sale de `container_locations` (`client_site`); ahora se deriva de los
  **tachos limpios entregados** en el recorrido.
- El viejo "En planta" (pesado) se renombró a **"Pendiente por tratar"**; el bucket "Sin registro"
  desapareció y su caso (limpio en planta) ahora es **"En planta"**.
- Implementado en `computeCirculationBucket` (`src/lib/data/dashboard-metrics.ts`), testeable; el
  componente del gráfico no cambió (itera buckets genéricamente).

## Estado / verificación

- `npm run test:jest`: **98/98** verde. `npm run build`: OK.
- **Pendiente:** E2E manual en navegador (coordinador vs operador): visibilidad de la pestaña,
  gating de edición/anulación, y observar el reordenamiento de colores del dashboard al anular.
- **Sin aplicar a producción aún:** la migración `20260617000000` está escrita pero **no** se
  aplicó a la base del piloto; aplicarla antes de usar el historial en producción.

## Notas de implementación

- Se extrajeron dos diálogos compartidos en `src/components/ui/`: `ConfirmVoidDialog`
  (confirmación + motivo, para anular) y `ConfirmDialog` (sí/no, para guardar ediciones).
- Guarda de integridad en pesaje: al editar el tacho de una recepción, el selector excluye tachos
  que ya tienen otra recepción vigente (evita doble conteo de kg).
- Decisión consciente: `route_events` y `weighing_sessions` usan columnas `voided_*` dedicadas (no
  un valor de enum), para conservar el motivo y separar estado operativo de anulación.
