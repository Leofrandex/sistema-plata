---
title: Tipos de Desecho
tags:
  - processes
  - domain
updated: 2026-06-01
---

# Tipos de Desecho

La planta maneja **5 tipos de desecho**. El tratamiento varía significativamente entre el tipo 1 y los tipos 2–5.

| # | Tipo | Tratamiento | Contenedor |
|---|------|-------------|------------|
| 1 | Peligroso infeccioso | En planta propia (esterilización + trituración) | Envases rojos con bolsas rojas adentro |
| 2 | Anatomopatológico | Almacenaje temporal → traslado a centro externo | Envases blancos (ej: placentas en bolsas dentro de envase blanco) |
| 3 | Citotóxico | Almacenaje temporal → traslado a centro externo | Se saca la bolsa del envase y se pesa por separado |
| 4 | Líquidos | Almacenaje temporal → traslado a centro externo | — |
| 5 | Morgue | Almacenaje temporal → traslado a centro externo | Bolsas o cooler de foam (hielera de icopor) |
| 6 | Metálicos No reutilizables | Tachos dedicados M1-M15 (120 L); pesaje directo sin recorrido | Tachos metálicos M (sin empresa) |

## Diferencia de flujo por tipo

**Tipo 1 (infeccioso):** Ciclo completo en planta. Ver [[ContainerLifecycle]].

**Tipos 2–5:** Flujo simplificado:
1. Recepción y pesaje
2. Almacenaje temporal (con registro de fecha de ingreso)
3. Salida hacia centro externo (con registro de fecha de salida y destino)

El sistema debe registrar, para tipos 2–5: fecha inicio almacenaje, fecha salida, destino del traslado.

## Asignación contenedor–tipo de desecho

Cada contenedor está **casado con un tipo de desecho**. Un mismo contenedor no se usa para dos tipos distintos. La excepción histórica es morgue (puede venir en bolsa o cooler de foam sin contenedor fijo), pero Francesca confirmó que **todos los tipos sí se pueden casar al contenedor**.

## Tachos metálicos (M1-M15)

Los tachos `M1`…`M15` (120 L) están dedicados al tipo **Metálicos No reutilizables**. No
pertenecen a ninguna empresa (`company_id = null`) ni pasan por recorrido: están siempre
disponibles en pesaje y solo aparecen cuando el operador elige ese tipo. Espejo operativo de
los tachos Yaris, pero disparados por el tipo de desecho en vez de un toggle.

## Impacto en el reporte

Un cliente puede generar los **5 tipos de desecho en el mismo día**. El reporte diario los incluye todos — no hay reportes separados por tipo.
