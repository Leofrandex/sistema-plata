---
title: Project Overview
tags:
  - project
  - business
updated: 2026-05-02
---

# Hospimed — Sistema de Trazabilidad de Desechos Clínicos

## Empresa y contexto

Hospimed opera una **planta de tratamiento de desechos peligrosos** (ubicación: dentro de un conjunto/campus hospitalario). Forma parte de un **holding empresarial** más grande — el mismo grupo que incluye Hospitalar. El sistema que se está construyendo es específico para la planta, no para Hospitalar.

La planta procesa aproximadamente **3,000 kg de desecho por día**, lo que equivale a unos **300 contenedores en circulación** activa.

## Problema que resuelve el sistema

Hoy el proceso de trazabilidad es **manual y fragmentado**:
- Un software de balanza exporta un Excel básico (número de contenedor, peso, hora)
- Las fotos de evidencia se toman en una app y se ensamblan manualmente en un informe PDF/Word
- No hay visión de dónde está cada contenedor ni cuánto tiempo lleva en cada etapa
- El reporte diario por contenedor toma mucho tiempo de armar

El sistema reemplaza este flujo con trazabilidad completa y generación automática de informes fotográficos.

## Stakeholders

| Persona | Rol | Empresa |
|---------|-----|---------|
| Francesca Labella | Operaciones / experta del dominio | Planta de desechos (dentro del holding) |
| Sebastian Castro | Desarrollador | Hospitalar |

**Próximas reuniones:**
- 2026-05-05 (martes, 3pm Panamá) — revisión del sistema Hospitalar
- 2026-05-08 (viernes, 12pm Panamá) — revisión de avance del sistema de desechos

## Alcance del sistema

### Dentro del alcance
- Registro y alta de contenedores (serial, tara, cliente, tipo de desecho)
- Trazabilidad del ciclo de vida completo del contenedor
- Registro de recorrido en punto de encuentro (limpios entregados ↔ sucios recibidos) — 6 slots fijos por día con cronómetro persistente
- Pesaje: peso bruto, tara, peso neto (lo que se factura)
- Captura fotográfica en cada etapa + generación automática del informe fotográfico diario
- Registro de ubicación del contenedor (manual, actualizado por el operador)
- Control de tiempo en cámara fría
- Registro de ciclos del compactador (salida / retorno)
- Soporte para los 5 tipos de desecho (flujo diferenciado)

### Fuera del alcance (por ahora)
- Geolocalización GPS en tiempo real (se investigará costo de chips IoT)
- Validaciones del proceso (prueba de sellado de cámara, indicadores químicos/biológicos) — Francesca descartó esto explícitamente

### Pendiente de decisión
- GPS en tiempo real: Francesca quiere cotización (~$2,000 de implementación + mantenimiento mensual estimado)

## Estructura de clientes (estado actual)

El sistema atiende un solo Cliente activo: **Centro de la Salud**. Dentro de ese cliente operan dos Empresas — **ION** y **Airkem** — a las que se les presta el servicio diferenciado. Los envases se identifican por el prefijo de la empresa (`I-001`, `A-001`).

El modelo soporta múltiples clientes a futuro.

## Usuarios del sistema

Múltiples operadores en campo (no siempre la misma persona por turno). La app debe ser fácil de usar en condiciones de campo, posiblemente desde celular. Los cronómetros de recorrido y pesaje persisten en IndexedDB, así que el operador puede cerrar la app y retomar.

## Contexto regulatorio

La **memoria fotográfica** (informe con fotos de cada contenedor recibido, pesado y tratado) es un **requisito regulatorio obligatorio**, no solo una preferencia operativa. Sin este informe no pueden demostrar que se hizo el procesamiento correcto.
