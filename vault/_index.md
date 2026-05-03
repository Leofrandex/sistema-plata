---
title: Índice del Vault — Hospimed Waste Tracking
tags:
  - index
  - meta
updated: 2026-05-02
---

# Vault Index — Sistema de Trazabilidad de Desechos Clínicos

> [!info] Cómo usar este archivo
> Punto de entrada obligatorio. Leerlo al inicio de cada sesión para tener el estado actual del proyecto antes de tocar cualquier otra cosa.

## Estado actual del proyecto

**Fase:** Pre-desarrollo — dominio definido, stack pendiente, código sin escribir  
**Última reunión:** 2026-04-30 (Francesca Labella + Sebastian Castro)  
**Próxima reunión:** 2026-05-08 (viernes, 12pm Panamá) — revisión de avance del sistema de desechos  
**Última actualización del vault:** 2026-05-02

| Área | Estado | Archivo |
|------|--------|---------|
| Descripción del negocio y stakeholders | 🟢 | [[Overview]] |
| Stack y arquitectura | 🔴 Pendiente | [[Architecture]] |
| Modelo de datos conceptual | 🟢 | [[DataModel]] |
| Roadmap de módulos | 🟢 | [[Roadmap]] |
| Tipos de desecho | 🟢 | [[WasteTypes]] |
| Ciclo de vida del contenedor | 🟢 | [[ContainerLifecycle]] |
| Memoria fotográfica | 🟢 | [[PhotoDocumentation]] |
| Decisiones de diseño | 🔴 Pendiente | `decisions/` |

**Leyenda:** 🔴 Pendiente · 🟡 En progreso · 🟢 Completo · ⚠️ Tiene incoherencias

---

## Mapa del vault

### Proyecto
- [[Overview]] — empresa, problema, stakeholders, alcance, contexto regulatorio
- [[Architecture]] — stack técnico, patrones, convenciones *(pendiente de definir)*
- [[DataModel]] — entidades principales, relaciones, campos clave
- [[Roadmap]] — módulos planificados, prioridades, estado

### Procesos de negocio
- [[WasteTypes]] — los 5 tipos de desecho y su tratamiento diferenciado
- [[ContainerLifecycle]] — ciclo completo del contenedor desde alta hasta lavado
- [[PhotoDocumentation]] — requisito regulatorio: memoria fotográfica diaria

### Módulos del sistema
*(Se crean cuando empiece el desarrollo)*

### Tipos y modelos TypeScript
*(Se crean cuando se defina el stack)*

### Decisiones de diseño
*(Se crean cuando se tomen decisiones no obvias)*

### Logs de cambios
*(Se crean al completar features)*

---

## Inbox — pendiente de procesar

*(Vacío)*

## Notas del último procesamiento

**2026-05-02** — Procesado transcript de reunión `2026-04-30` (Francesca Labella + Sebastian Castro).  
Archivos actualizados: `Overview`, `DataModel`, `Roadmap`.  
Archivos creados: `WasteTypes`, `ContainerLifecycle`, `PhotoDocumentation`.  
Transcript archivado en `inbox/procesado/`.
