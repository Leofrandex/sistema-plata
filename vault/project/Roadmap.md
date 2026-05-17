---
title: Roadmap
tags:
  - project
  - roadmap
updated: 2026-05-17
---

# Roadmap de Módulos

**Enfoque acordado:** Frontend primero (UI + funcionalidades), luego conectar base de datos.

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
