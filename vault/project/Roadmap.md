---
title: Roadmap
tags:
  - project
  - roadmap
updated: 2026-05-02
---

# Roadmap de Módulos

**Enfoque acordado:** Frontend primero (UI + funcionalidades), luego conectar base de datos.

## Módulos planificados

| Módulo | Prioridad | Estado | Descripción |
|--------|-----------|--------|-------------|
| Gestión de contenedores | Alta | 🔴 Pendiente | Alta, consulta y baja de contenedores. Numeración con prefijo de cliente |
| Gestión de clientes | Alta | 🔴 Pendiente | Alta de clientes, asignación de letra/código, ubicaciones |
| Registro de intercambio | Alta | 🔴 Pendiente | Punto de encuentro: limpios entregados ↔ sucios recibidos + fotos |
| Pesaje y recepción en planta | Alta | 🔴 Pendiente | Registro de peso bruto, cálculo de neto, fotos de balanza |
| Control de cámara fría | Media | 🔴 Pendiente | Tiempo de ingreso/egreso por contenedor |
| Registro de tratamiento | Media | 🔴 Pendiente | Solo tipo 1 (infeccioso): inicio y fin de tratamiento |
| Traslado externo | Media | 🔴 Pendiente | Tipos 2–5: almacenaje temporal + traslado a centro externo |
| Ciclo del compactador | Baja | 🔴 Pendiente | Registro de recogida y retorno del compactador |
| Informe fotográfico diario | Alta | 🔴 Pendiente | Generación automática con un clic: 1 página por contenedor |
| Ubicación de contenedores | Media | 🔴 Pendiente | Registro manual de ubicación; GPS en tiempo real pendiente de cotización |
| Dashboard / vista general | Media | 🔴 Pendiente | Estado del día: contenedores en circulación, en planta, en tratamiento |

## GPS en tiempo real

Decisión pendiente. Costo estimado de implementación: ~$2,000 USD + mantenimiento mensual. Requeriría un chip IoT por contenedor con conectividad permanente. Francesca solicitó cotización formal.

## Criterios generales de completitud

- Múltiples operadores pueden usar el sistema simultáneamente (no es de una sola persona)
- Funciona desde celular (operadores en campo)
- El informe fotográfico diario se genera sin ensamblar manualmente
- La trazabilidad cubre desde la entrega del contenedor limpio hasta su devolución limpia

## Leyenda

🔴 Pendiente · 🟡 En progreso · 🟢 Completo
