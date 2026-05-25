---
title: Índice del Vault — Hospimed Waste Tracking
tags:
  - index
  - meta
updated: 2026-05-21
---

> [!info] Nota de marca (2026-05-12)
> El **producto** pasó a llamarse **Hospiwaste**. Este vault conserva la denominación original "Hospimed" como historial; el código, PWA, login y reportes ya reflejan "Hospiwaste". Ver log `2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi.md`.

> [!info] Nota de modelo (2026-05-17)
> Rediseño operativo en curso: rename **intercambio → recorrido**, jerarquía **Cliente → Empresa**, nomenclatura **`{letra_empresa}-NNN`** (`I-`/`A-`). Se elimina la entidad `Batch`. Ver log `2026-05-17-recorridos-pesaje-reportes-dashboard.md` y ADR `decisions/2026-05-17-cliente-empresa-recorrido.md`.

# Vault Index — Sistema de Trazabilidad de Desechos Clínicos

> [!info] Cómo usar este archivo
> Punto de entrada obligatorio. Leerlo al inicio de cada sesión para tener el estado actual del proyecto antes de tocar cualquier otra cosa.

## Estado actual del proyecto

**Fase:** Preparación lanzamiento PTDP — implementando ajustes post Demo 2; piloto 2026-05-21, lanzamiento oficial 2026-06-01
**Última reunión:** 2026-05-18 (Francesca + Karolyne + Marely + Sebastián) — ver `logs/2026-05-18-reunion-ptdp-demo-piloto.md`
**Próxima reunión:** 2026-05-25 lunes 2:00 PM Panamá (seguimiento general); 2026-05-19 martes 9:30 AM Colombia (1-a-1 con Karolyne)
**Hito crítico:** 2026-05-21 jueves 10:00 AM Panamá — prueba piloto con operador real
**Última actualización del vault:** 2026-05-21

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
| Integración Supabase (schema + auth + storage) | 🟢 Provisionado | `decisions/2026-05-21-supabase-integracion.md` · `logs/2026-05-21-supabase-bootstrap.md` |
| Recorridos → Supabase (write-through + hidratación) | 🟢 Completado | `logs/2026-05-25-recorridos-supabase-writethrough.md` |

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
- `decisions/2026-05-21-supabase-integracion.md`
- `decisions/2026-05-21-estado-envase-derivado.md` — estado derivado de eventos; revisar P1 antes de 2026-06-01

### Logs de cambios
- `logs/2026-05-03-branding-system.md`
- `logs/2026-05-05-dashboard-containers-polish.md`
- `logs/2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi.md`
- `logs/2026-05-17-recorridos-pesaje-reportes-dashboard.md`
- `logs/2026-05-18-historico-airkem-dashboard.md`
- `logs/2026-05-18-reunion-ptdp-demo-piloto.md`
- `logs/2026-05-21-supabase-bootstrap.md`
- `logs/2026-05-25-recorridos-supabase-writethrough.md`
- `logs/2026-05-25-pesaje-ux-yaris-recorridos-modal.md`

---

## Inbox — pendiente de procesar

*(Vacío)*

## Notas del último procesamiento

**2026-05-25** — Fix: los envases sucios de un recorrido no aparecían en Pesaje.
Causa: `routeEvents` salía de mocks en memoria y el flujo de recorrido nunca
escribía a Supabase, mientras pesaje leía `containers`/`receptions` de Supabase.
Solución: migración completa de recorridos a Supabase (write-through en andén +
morgue, e hidratación de `route_events` + join tables en `SupabaseHydrator`).
Log: `logs/2026-05-25-recorridos-supabase-writethrough.md`.

**2026-05-21** — Bootstrap de Supabase para el piloto (sin migrar el store aún).
Proyecto `hospiwaste` (ref `xqqnthyipkdkwyknbtnw`, us-east-2, Free). 14 tablas + 9 enums + vista `container_receptions_with_net` + trigger `on_auth_user_created`. RLS habilitado con policies "authenticated full access" (decisión piloto). Bucket Storage `photos` privado. Cliente Next.js: `@supabase/ssr` con browser/server/middleware clients y `src/middleware.ts` para refresco de sesión. Tipos TS en `src/lib/supabase/database.types.ts`. Migration en `supabase/migrations/`.
Pendiente: reemplazar `src/lib/store.ts` (Zustand) por queries a Supabase, página `/login`, upload de fotos al bucket.
Log: `logs/2026-05-21-supabase-bootstrap.md` · ADR: `decisions/2026-05-21-supabase-integracion.md`.

**2026-05-21** — Procesado resumen de reunión PTDP del 2026-05-18 (Demo 2 + plan de lanzamiento).
Plan acordado: piloto operador real 2026-05-21 10am Panamá, lanzamiento oficial 2026-06-01.
Backlog de **12 cambios al software** dividido en 2 sesiones:
- **Sesión 1 (hoy):** Pesaje (observaciones + reordenar), Recorridos (selector tipo desecho), Dashboard (quitar cámara fría + reemplazo) + integrar Supabase + push GitHub + hosting.
- **Sesión 2:** Reportes (4 cambios), Dashboard (tendencia anual + cliente padre), Admin envases (carga masiva + edición).
Riesgos pendientes: integración API balanza (pasiva), data oficial sin cerrar (ene–mar 2026), Morgue/envases grandes sin contemplar.
Log: `logs/2026-05-18-reunion-ptdp-demo-piloto.md`. Archivo movido a `inbox/procesado/`.

**2026-05-18** — Cargado el histórico real de Airkem 2026-01-01 → 2026-05-11 al dashboard.
Excel `inbox/2026-05-17-historico-envases.xlsx` → `src/lib/data/historical-data.json` vía `scripts/extract-historical-data.py`.
189 carros Airkem (`A-001..A-189`), 14,375 recepciones, 253,889 kg netos. ION queda en cero (no participaba en el histórico).
Log: `logs/2026-05-18-historico-airkem-dashboard.md`.

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
