---
title: Roadmap
tags:
  - project
  - roadmap
updated: 2026-05-21
---

# Roadmap de Módulos

**Enfoque acordado:** Frontend primero (UI + funcionalidades), luego conectar base de datos.

> [!important] Backlog de lanzamiento PTDP (acordado 2026-05-18)
> 12 cambios definidos para llegar al **piloto 2026-05-21** y **lanzamiento oficial 2026-06-01**. Detalle, prioridad y división en sesiones en `logs/2026-05-18-reunion-ptdp-demo-piloto.md`.
> - **Sesión 1:** Pesaje (observaciones + reordenar), Recorridos (selector tipo desecho), Dashboard (quitar cámara fría) + Supabase + GitHub + hosting.
> - **Sesión 2:** Reportes (formato Mantis, logos PNG/JPG, rango fechas, export Excel), Dashboard (tendencia anual, cliente padre), Admin envases (carga masiva + edición).
> - **Fase 2 (post-lanzamiento, cotizar aparte):** validaciones esterilización, checklists turno, KPIs operadores, base instalada equipos + mantenimiento, módulo compras no-SAP, reporte limpieza profunda.

> [!important] Bloqueantes antes de 2026-06-01 (sostenibilidad)
> Ver ADR `decisions/2026-05-21-estado-envase-derivado.md`.
> - **[P1] ✅ "Deshacer pesaje" en la UI** con soft-delete en `container_receptions` (`voided_at`, `voided_by`, `void_reason`). Resuelto 2026-06-03 — `logs/2026-06-03-deshacer-pesaje-vista-pendientes.md`.
> - **[P1] ✅ Vista de Postgres `v_containers_pending_weighing`** creada. (Cableado del cliente a la vista diferido a post-piloto; el cálculo en cliente sigue activo.)
> - **[P2 post-lanzamiento]** Columna `current_phase` en `containers` mantenida por triggers; vista materializada para dashboard cuando el volumen lo justifique.

## Módulos planificados

| Módulo | Prioridad | Estado | Descripción |
|--------|-----------|--------|-------------|
| Gestión de contenedores | Alta | 🟢 Hecho | Alta, consulta y baja. Numeración con prefijo de empresa (`I-001`, `A-001`) |
| Gestión de clientes y empresas | Alta | 🟢 Hecho | Cliente → varias Empresas; envases pertenecen a Empresa |
| Registro de recorrido | Alta | 🟡 En progreso | 6 slots fijos por día con cronómetro persistente (Fase 2) |
| Pesaje y recepción en planta | Alta | 🟡 En progreso | Sesión multi-envase con drawer lateral editable (Fase 3) |
| Control de cámara fría | Media | 🟢 Hecho | Transición automática tras pesaje |
| Registro de tratamiento | Media | 🟢 Hecho | Solo tipo 1 (infeccioso): inicio y fin de tratamiento |
| Traslado externo | Media | 🟢 Hecho | Tipos 2–5: almacenaje temporal + traslado a centro externo (multi-select) |
| Ciclo del compactador | Baja | 🔴 Pendiente | Registro de recogida y retorno del compactador |
| Reporte fotográfico semanal | Alta | 🟡 En progreso | Generación automática por Cliente/semana en `/reports` (Fase 4) |
| Ubicación de contenedores | Media | 🟢 Hecho | Registro manual; GPS en tiempo real pendiente de cotización |
| Dashboard con gráficos | Media | 🟡 En progreso | Torta circulación, donut kg/día, barras kg/cliente/mes (Fase 5) |

## GPS en tiempo real

Decisión pendiente. Costo estimado de implementación: ~$2,000 USD + mantenimiento mensual. Requeriría un chip IoT por contenedor con conectividad permanente. Francesca solicitó cotización formal.

## Criterios generales de completitud

- Múltiples operadores pueden usar el sistema simultáneamente (no es de una sola persona)
- Funciona desde celular (operadores en campo)
- El informe fotográfico diario se genera sin ensamblar manualmente
- La trazabilidad cubre desde la entrega del contenedor limpio hasta su devolución limpia

## Leyenda

🔴 Pendiente · 🟡 En progreso · 🟢 Completo
