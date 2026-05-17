---
title: Índice del Vault — Hospimed Waste Tracking
tags:
  - index
  - meta
updated: 2026-05-17
---

> [!info] Nota de marca (2026-05-12)
> El **producto** pasó a llamarse **Hospiwaste**. Este vault conserva la denominación original "Hospimed" como historial; el código, PWA, login y reportes ya reflejan "Hospiwaste". Ver log `2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi.md`.

> [!info] Nota de modelo (2026-05-17)
> Rediseño operativo en curso: rename **intercambio → recorrido**, jerarquía **Cliente → Empresa**, nomenclatura **`{letra_empresa}-NNN`** (`I-`/`A-`). Se elimina la entidad `Batch`. Ver log `2026-05-17-recorridos-pesaje-reportes-dashboard.md` y ADR `decisions/2026-05-17-cliente-empresa-recorrido.md`.

# Vault Index — Sistema de Trazabilidad de Desechos Clínicos

> [!info] Cómo usar este archivo
> Punto de entrada obligatorio. Leerlo al inicio de cada sesión para tener el estado actual del proyecto antes de tocar cualquier otra cosa.

## Estado actual del proyecto

**Fase:** Rediseño operativo completado — 5/5 fases listas en rama `feat/recorridos-pesaje-reportes-dashboard`
**Última reunión:** 2026-04-30 (Francesca Labella + Sebastian Castro)
**Próxima reunión:** 2026-05-08 (viernes, 12pm Panamá)
**Última actualización del vault:** 2026-05-17

| Área | Estado | Archivo |
|------|--------|---------|
| Descripción del negocio y stakeholders | 🟢 | [[Overview]] |
| Stack y arquitectura | 🟢 | [[Architecture]] |
| Modelo de datos | 🟢 | [[DataModel]] |
| Roadmap de módulos | 🟢 | [[Roadmap]] |
| Tipos de desecho | 🟢 | [[WasteTypes]] |
| Ciclo de vida del contenedor | 🟢 | [[ContainerLifecycle]] |
| Memoria fotográfica | 🟢 | [[PhotoDocumentation]] |
| Branding y sistema de diseño | 🟢 | [[Branding]] |
| Cliente / Empresa / Recorrido | 🟢 | `decisions/2026-05-17-cliente-empresa-recorrido.md` |
| Rediseño operativo (5 fases) | 🟢 Completado | `logs/2026-05-17-recorridos-pesaje-reportes-dashboard.md` |

**Leyenda:** 🔴 Pendiente · 🟡 En progreso · 🟢 Completo · ⚠️ Tiene incoherencias

---

## Mapa del vault

### Proyecto
- [[Overview]] — empresa, problema, stakeholders, alcance, contexto regulatorio
- [[Architecture]] — stack técnico, patrones, convenciones
- [[DataModel]] — entidades principales, relaciones, campos clave (Cliente/Empresa/Recorrido)
- [[Roadmap]] — módulos planificados, prioridades, estado
- [[Branding]] — colores, tipografía, componentes base, tokens CSS

### Procesos de negocio
- [[WasteTypes]] — los 5 tipos de desecho y su tratamiento diferenciado
- [[ContainerLifecycle]] — ciclo completo del contenedor desde alta hasta lavado
- [[PhotoDocumentation]] — requisito regulatorio: registro fotográfico semanal por cliente

### Decisiones de diseño
- `decisions/2026-05-03-border-radius-global.md`
- `decisions/2026-05-17-cliente-empresa-recorrido.md`

### Logs de cambios
- `logs/2026-05-03-branding-system.md`
- `logs/2026-05-05-dashboard-containers-polish.md`
- `logs/2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi.md`
- `logs/2026-05-17-recorridos-pesaje-reportes-dashboard.md`

---

## Inbox — pendiente de procesar

*(Vacío)*

## Notas del último procesamiento

**2026-05-17** — Rediseño operativo completo (5 fases).
- Fase 1: modelo Cliente→Empresa, rename `intercambio → recorrido`, eliminado `Batch`, nomenclatura `I-`/`A-`.
- Fase 2: `/register/route` con 6 slots fijos y cronómetro persistente en IndexedDB.
- Fase 3: `/register/weighing` multi-registro con drawer lateral editable.
- Fase 4: `/reports` con PDF semanal por cliente (header tipo "REGISTRO FOTOGRÁFICO", grid 2-col de fotos con comentarios).
- Fase 5: `/dashboard` con 3 gráficos Recharts (torta circulación, donut kg/día, barras kg/cliente/mes).
Log: `logs/2026-05-17-recorridos-pesaje-reportes-dashboard.md`.

**2026-05-12** — Tres cambios operativos.
(1) Rename de marca Hospimed → Hospiwaste en código, PWA, login, reportes PDF y CLAUDE.md (vault y docs/specs|plans/ quedan como historial).
(2) Eliminado el paso manual de cámara fría: tras pesar, el envase entra automáticamente al estado `cold_storage` sin foto ni formulario.
(3) Traslado externo ahora acepta selección múltiple acumulativa.
Log: `logs/2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi.md`.

**2026-05-05** — Polish de Dashboard y Inventario de Envases.
Log: `logs/2026-05-05-dashboard-containers-polish.md`.

**2026-05-03** — Procesado `inbox/branding.json` (datos de branding).
Archivos creados: `Branding.md`. Archivo movido a `inbox/procesado/`.

**2026-05-02** — Procesado transcript de reunión 2026-04-30.
Archivos actualizados: `Overview`, `DataModel`, `Roadmap`.
Archivos creados: `WasteTypes`, `ContainerLifecycle`, `PhotoDocumentation`.
