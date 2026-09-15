---
title: Roadmap
tags:
  - project
  - roadmap
updated: 2026-09-14
---

# Roadmap de Módulos

**Enfoque acordado:** Frontend primero (UI + funcionalidades), luego conectar base de datos.

> [!info] Backlog de lanzamiento PTDP — cerrado
> 12 cambios acordados el 2026-05-18 para el piloto (2026-05-21) y el lanzamiento oficial
> (2026-06-01). Ambas fechas pasaron y el sistema está en producción; queda como historial.
> Detalle y división en sesiones en [[2026-05-18-reunion-ptdp-demo-piloto]].
> - **Sesión 1:** Pesaje (observaciones + reordenar), Recorridos (selector tipo desecho), Dashboard (quitar cámara fría) + Supabase + GitHub + hosting.
> - **Sesión 2:** Reportes (formato Mantis, logos PNG/JPG, rango fechas, export Excel), Dashboard (tendencia anual, cliente padre), Admin envases (carga masiva + edición).
> - **Fase 2 (post-lanzamiento, cotizar aparte):** validaciones esterilización, checklists turno, KPIs operadores, base instalada equipos + mantenimiento, módulo compras no-SAP, reporte limpieza profunda.

> [!important] Bloqueantes antes de 2026-06-01 (sostenibilidad)
> Ver ADR [[2026-05-21-estado-envase-derivado]].
> - **[P1] ✅ "Deshacer pesaje" en la UI** con soft-delete en `container_receptions` (`voided_at`, `voided_by`, `void_reason`). Resuelto 2026-06-03 — [[2026-06-03-deshacer-pesaje-vista-pendientes]].
> - **[P1] ✅ Vista de Postgres `v_containers_pending_weighing`** creada. (Cableado del cliente a la vista diferido a post-piloto; el cálculo en cliente sigue activo.)
> - **[P2 post-lanzamiento]** Columna `current_phase` en `containers` como **caché mantenida por triggers** (eventos = fuente de verdad) + job de auditoría nocturno; vista materializada para dashboard cuando el volumen lo justifique. Reafirmado como próximo proyecto el 2026-06-03 (no se acopló a los contenedores Yaris). Ver [[2026-06-03-contenedores-yaris-recorrido]].
> - **[P1] ✅ Cola de pesaje consciente del ciclo.** La derivación excluía un tacho si tenía **cualquier** recepción no anulada → se pesaba una sola vez en su vida y no volvía a la cola al reingresar sucio. Resuelto 2026-07-28: la regla compara por fecha (recogido sucio *después* del último pesaje), no por existencia. Ver ADR [[2026-07-28-cola-pesaje-por-fecha]] y log [[2026-07-28-fix-cola-pesaje-ciclo-reabierto]].

## Módulos planificados

| Módulo | Prioridad | Estado | Descripción |
|--------|-----------|--------|-------------|
| Gestión de contenedores | Alta | 🟢 Hecho | Alta, consulta y baja. Numeración con prefijo de empresa (`I-001`, `A-001`) |
| Gestión de clientes y empresas | Alta | 🟢 Hecho | Cliente → varias Empresas; envases pertenecen a Empresa |
| Registro de recorrido | Alta | ⏸️ Congelado | Deshabilitado en el APK por `INTERIM_MODE`; se rehace junto con la capa offline. Ver [[2026-09-01-modo-interino-solo-pesaje]] |
| Pesaje y recepción en planta | Alta | 🟢 Hecho | En producción. Cola por fecha de ciclo ([[2026-07-28-cola-pesaje-por-fecha]]); Yaris se pesan directo ([[2026-09-07-yaris-pesaje-directo]]) |
| Equipos — mantenimiento preventivo | Media | 🟢 Hecho | Semáforo + historial con fotos, solo coordinador. Ver [[EquipmentMaintenance]] |
| Control de cámara fría | Media | 🟢 Hecho | Transición automática tras pesaje |
| Registro de tratamiento | Media | 🟢 Hecho | Solo tipo 1 (infeccioso): inicio y fin de tratamiento |
| Traslado externo | Media | 🟢 Hecho | Tipos 2–5: almacenaje temporal + traslado a centro externo (multi-select) |
| Ciclo del compactador | Baja | 🔴 Pendiente | Registro de recogida y retorno del compactador |
| Reporte fotográfico semanal | Alta | 🟢 Hecho | Generación automática por Cliente/semana en `/reports`. Ver [[PhotoDocumentation]] |
| Ubicación de contenedores | Media | ⚫ Retirado | El registro manual se quitó de la UI ([[2026-06-01-quitar-ubicacion-traslado-en-construccion]]); GPS sigue sin cotizar |
| Dashboard con gráficos | Media | 🟢 Hecho | 7 grupos de métricas tras el monorepo. Ver [[2026-07-22-monorepo-hub-app-dashboard]] |

## GPS en tiempo real

Decisión pendiente. Costo estimado de implementación: ~$2,000 USD + mantenimiento mensual. Requeriría un chip IoT por contenedor con conectividad permanente. Francesca solicitó cotización formal.

## Criterios generales de completitud

- Múltiples operadores pueden usar el sistema simultáneamente (no es de una sola persona)
- Funciona desde celular (operadores en campo)
- El informe fotográfico diario se genera sin ensamblar manualmente
- La trazabilidad cubre desde la entrega del contenedor limpio hasta su devolución limpia

## Leyenda

🔴 Pendiente · 🟡 En progreso · 🟢 Completo · ⏸️ Congelado · ⚫ Retirado del alcance
