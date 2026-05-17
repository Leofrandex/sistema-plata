---
title: Índice del Vault — Hospimed Waste Tracking
tags:
  - index
  - meta
updated: 2026-05-12
---

> [!info] Nota de marca (2026-05-12)
> El **producto** pasó a llamarse **Hospiwaste**. Este vault conserva la denominación original "Hospimed" como historial; el código, PWA, login y reportes ya reflejan "Hospiwaste". Ver log `2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi.md`.

# Vault Index — Sistema de Trazabilidad de Desechos Clínicos

> [!info] Cómo usar este archivo
> Punto de entrada obligatorio. Leerlo al inicio de cada sesión para tener el estado actual del proyecto antes de tocar cualquier otra cosa.

## Estado actual del proyecto

**Fase:** Pre-desarrollo — dominio definido, stack pendiente, código sin escribir  
**Última reunión:** 2026-04-30 (Francesca Labella + Sebastian Castro)  
**Próxima reunión:** 2026-05-08 (viernes, 12pm Panamá) — revisión de avance del sistema de desechos  
**Última actualización del vault:** 2026-05-03

| Área | Estado | Archivo |
|------|--------|---------|
| Descripción del negocio y stakeholders | 🟢 | [[Overview]] |
| Stack y arquitectura | 🟢 | [[Architecture]] |
| Modelo de datos conceptual | 🟢 | [[DataModel]] |
| Roadmap de módulos | 🟢 | [[Roadmap]] |
| Tipos de desecho | 🟢 | [[WasteTypes]] |
| Ciclo de vida del contenedor | 🟢 | [[ContainerLifecycle]] |
| Memoria fotográfica | 🟢 | [[PhotoDocumentation]] |
| Branding y sistema de diseño | 🟢 | [[Branding]] |
| Decisiones de diseño | 🟡 En progreso | `decisions/` — border-radius global (2026-05-03) |

**Leyenda:** 🔴 Pendiente · 🟡 En progreso · 🟢 Completo · ⚠️ Tiene incoherencias

---

## Mapa del vault

### Proyecto
- [[Overview]] — empresa, problema, stakeholders, alcance, contexto regulatorio
- [[Architecture]] — stack técnico, patrones, convenciones *(pendiente de definir)*
- [[DataModel]] — entidades principales, relaciones, campos clave
- [[Roadmap]] — módulos planificados, prioridades, estado
- [[Branding]] — colores, tipografía, componentes base, tokens CSS *(3 incoherencias pendientes de confirmar)*

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

**2026-05-12** — Tres cambios operativos.
(1) Rename de marca Hospimed → Hospiwaste en código, PWA, login, reportes PDF y CLAUDE.md (vault y docs/specs|plans/ quedan como historial).
(2) Eliminado el paso manual de cámara fría: tras pesar, el envase entra automáticamente al estado `cold_storage` sin foto ni formulario.
(3) Traslado externo ahora acepta selección múltiple acumulativa (mismo patrón que intercambio).
Log: `logs/2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi.md`.

**2026-05-05** — Polish de Dashboard y Inventario de Envases.
Filas de envase clickeables en su totalidad, filtros con labels, dashboard de lotes unificado a ancho completo, hero decorativo y KPI cards renovadas. Mejoras a11y (aria-labelledby en Selects, aria-hidden en íconos decorativos, role=radiogroup en segmented control).
Log: `logs/2026-05-05-dashboard-containers-polish.md`.

**2026-05-03** — Procesado `inbox/branding.json` (datos de branding extraídos de hospimed.com.pa).  
Archivos creados: `Branding.md`.  
3 incoherencias detectadas (textPrimary, escala tipográfica, border-radius botón secundario) — pendientes de confirmar con Sebastian.  
Archivo movido a `inbox/procesado/`.

**2026-05-02** — Procesado transcript de reunión `2026-04-30` (Francesca Labella + Sebastian Castro).  
Archivos actualizados: `Overview`, `DataModel`, `Roadmap`.  
Archivos creados: `WasteTypes`, `ContainerLifecycle`, `PhotoDocumentation`.  
Transcript archivado en `inbox/procesado/`.
