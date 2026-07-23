---
title: Índice del Vault — Hospimed Waste Tracking
tags:
  - index
  - meta
updated: 2026-07-23
---

> [!info] Nota de marca (2026-05-12)
> El **producto** pasó a llamarse **Hospiwaste**. Este vault conserva la denominación original "Hospimed" como historial; el código, PWA, login y reportes ya reflejan "Hospiwaste". Ver log `2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi.md`.

> [!info] Nota de modelo (2026-05-17)
> Rediseño operativo en curso: rename **intercambio → recorrido**, jerarquía **Cliente → Empresa**, nomenclatura **`{letra_empresa}-NNN`** (`I-`/`A-`). Se elimina la entidad `Batch`. Ver log `2026-05-17-recorridos-pesaje-reportes-dashboard.md` y ADR `decisions/2026-05-17-cliente-empresa-recorrido.md`.

# Vault Index — Sistema de Trazabilidad de Desechos Clínicos

> [!info] Cómo usar este archivo
> Punto de entrada obligatorio. Leerlo al inicio de cada sesión para tener el estado actual del proyecto antes de tocar cualquier otra cosa.

## Estado actual del proyecto

**Fase:** Preparación lanzamiento PTDP — ajustes post-piloto; lanzamiento oficial 2026-06-01
**Última reunión:** 2026-05-18 (Francesca + Karolyne + Marely + Sebastián) — ver `logs/2026-05-18-reunion-ptdp-demo-piloto.md`
**Hito crítico:** lanzamiento oficial lunes 2026-06-01
**Última actualización del vault:** 2026-07-16

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
| Fotos → Supabase Storage (upload + URLs firmadas) | 🟢 Completado | `logs/2026-05-25-fotos-supabase-storage.md` |
| Empresa y tipo de desecho **dinámicos** del tacho | 🟢 Completado | `decisions/2026-05-30-empresa-tipo-dinamicos-tacho.md` |
| Pesaje (pendientes+bloqueo, tipo input, tratar inmediato) + Tratamiento activo + rename "tacho" | 🟢 Completado | `logs/2026-05-30-pesaje-tratamiento-rename-tacho.md` |
| Tachos metálicos M1-M15 + tipo "Metálicos No reutilizables" | 🟢 Completado | `logs/2026-06-01-tachos-metalicos.md` |
| Roles coordinador/operador (UI + middleware + RLS) + cuentas reales | 🟢 Completado | `logs/2026-06-01-roles-coordinador-operador.md` · `decisions/2026-06-01-roles-acceso.md` |
| Firma por recorrido (andén+morgue) + saludo dashboard + redacción pesaje | 🟢 Completado | `logs/2026-06-16-firma-recorrido-saludo-dashboard-redaccion-pesaje.md` |
| Fix: área del andén no persistía al crear + recorrido "activo" fantasma | 🟢 Completado | `logs/2026-06-16-fix-area-anden-y-activo-fantasma.md` |
| Historial editable (recorridos+pesajes) + rediseño 4 estados dashboard | 🟢 Completado (E2E manual pendiente; migración sin aplicar) | `logs/2026-06-17-historial-editable-y-rediseno-estados-dashboard.md` |
| Login por tarjetas + auto-logout de operador (1h) | 🟢 Completado (roster + E2E manual pendientes) | `logs/2026-06-19-login-tarjetas-auto-logout-operador.md` |
| Offline: outbox de campo (local-first, datos + fotos) | 🟢 Completado (E2E manual en modo avión pendiente) | `logs/2026-06-19-offline-outbox-campo.md` |
| Recolor 4 estados + historial 2 líneas + tab tachos (filtros/fase/tiempo) + fotos reporte | 🟢 Completado (E2E manual pendiente) | `logs/2026-06-22-colores-historial-tachos-reportes.md` |
| Tab Equipos: mantenimiento preventivo (semáforo + historial + fotos) | 🟢 Completado (E2E manual pendiente) | `logs/2026-07-16-equipos-mantenimiento-preventivo.md` |
| Monorepo hub/app/shared + tab Historial + dashboard renovado (7 grupos de métricas) | 🟢 Completado (APK sin compilar — falta JDK; E2E manual pendiente) | `logs/2026-07-22-monorepo-hub-app-dashboard.md` · `decisions/2026-07-22-separacion-hub-app.md` |
| Offline SQLite local-first (motor TS, backend dual IndexedDB/SQLite) | 🟢 Completado (Plan B nativo + E2E dispositivo pendientes) | `logs/2026-07-23-offline-sqlite-local-first.md` |

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
- `decisions/2026-05-21-estado-envase-derivado.md` — estado derivado de eventos; P1 avanzado (tratamiento completado → clean)
- `decisions/2026-05-30-empresa-tipo-dinamicos-tacho.md` — empresa y tipo de desecho dinámicos del tacho
- `decisions/2026-06-10-empresa-por-registro.md` — la empresa es del registro (recorrido/pesaje), no del tacho; `containers.company_id` eliminado
- `decisions/2026-06-01-roles-acceso.md` — roles coordinador/operador; control en UI + middleware + RLS
- `decisions/2026-06-01-ids-tachos-supabase-vs-mock.md` — ⚠️ IDs en Supabase son numéricos sin prefijo (`020`), no `A-020`; el prefijo es solo del mock

### Credenciales (sensible)
- `credenciales/2026-07-06-credenciales-completas.md` — ⚠️ TODAS las contraseñas (12 usuarios) en texto plano; 9 reseteadas el 2026-07-06 para consolidar
- `credenciales/2026-06-23-passwords-temporales.md` — ⚠️ contraseñas temporales en texto plano (operadores nuevos); revierte el criterio de no versionar

### Logs de cambios
- `logs/2026-07-23-offline-sqlite-local-first.md` — motor offline SQLite local-first (Plan A), reemplaza el outbox de IndexedDB
- `logs/2026-07-16-equipos-mantenimiento-preventivo.md` — tab Equipos (solo coordinador): semáforo de mantenimiento preventivo, historial con fotos, seed de 60 equipos del Excel
- `logs/2026-07-08-fotos-opcionales-recorrido.md` — fotos ya no bloquean el guardado de recorrido (andén+morgue); regla = empresa+tacho+firma; revierte parte de `f93a8bc`
- `logs/2026-07-06-reset-datos-piloto.md` — ⚠️ reset total de datos operativos (TRUNCATE 10 tablas, 230 tachos intactos); respaldo en `backups/`
- `logs/2026-05-03-branding-system.md`
- `logs/2026-05-05-dashboard-containers-polish.md`
- `logs/2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi.md`
- `logs/2026-05-17-recorridos-pesaje-reportes-dashboard.md`
- `logs/2026-05-18-historico-airkem-dashboard.md`
- `logs/2026-05-18-reunion-ptdp-demo-piloto.md`
- `logs/2026-05-21-supabase-bootstrap.md`
- `logs/2026-05-25-recorridos-supabase-writethrough.md`
- `logs/2026-05-25-pesaje-ux-yaris-recorridos-modal.md`
- `logs/2026-05-25-fotos-supabase-storage.md`
- `logs/2026-05-27-pesaje-login-recorridos-multianden.md`
- `logs/2026-05-30-pesaje-tratamiento-rename-tacho.md`
- `logs/2026-06-01-reporte-logos-riga-cpch.md`
- `logs/2026-06-01-quitar-ubicacion-traslado-en-construccion.md`
- `logs/2026-06-01-tachos-metalicos.md`
- `logs/2026-06-01-roles-coordinador-operador.md`
- `logs/2026-06-03-deshacer-pesaje-vista-pendientes.md`
- `logs/2026-06-03-tratamiento-confirmacion-refresco.md`
- `logs/2026-06-03-fix-sesion-no-cargada-boton-iniciar.md`
- `logs/2026-06-03-contenedores-yaris-recorrido.md`
- `logs/2026-06-10-sesion-no-persistente-cookies-de-sesion.md`
- `logs/2026-06-10-empresa-por-registro-tacho-independiente.md`
- `logs/2026-06-10-recorrido-fotos-persistencia-traza.md`
- `logs/2026-06-16-firma-recorrido-saludo-dashboard-redaccion-pesaje.md`
- `logs/2026-06-16-fix-area-anden-y-activo-fantasma.md`
- `logs/2026-06-17-historial-editable-y-rediseno-estados-dashboard.md`
- `logs/2026-06-19-login-tarjetas-auto-logout-operador.md`
- `logs/2026-06-19-offline-outbox-campo.md`
- `logs/2026-06-22-colores-historial-tachos-reportes.md`

---

## Inbox — pendiente de procesar

*(Vacío)*

## Notas del último procesamiento

**2026-07-23** — Motor offline SQLite local-first (Plan A, rama
`feat/offline-sqlite-local-first`). Contrato `LocalStore` con backend dual: IndexedDB
(web/dev) y SQLite+Filesystem (APK), tabla genérica `local_rows` (payload JSON) en vez de
DDL por entidad, `local_photos` con `synced` propio, tabla `meta`. Sync engine con fases
registro/fotos, timeout 15s, mutex. Hidratación local-first 1×/mount con `unionById`
(fix de un Critical: no pisar estado del server). Migración idempotente del outbox
IndexedDB legacy (Situación 2, `logs/2026-06-19-offline-outbox-campo.md`, ahora
reemplazado) — sin descartar operaciones silenciosamente. Sesión APK en
`@capacitor/preferences`, expira por 1h de inactividad. `event_type` de fotos usa el
enum real de la BD (`route`/`weighing`), no lo que decía el plan — nota dejada para
Plan B nativo (Kotlin) sobre el mapeo `drainPhotos`. jest 204 (152+35+17), vitest 12,
builds hub+app OK, `cap sync android` regenerado. Pendiente: Plan B nativo (bloqueado
por JDK) y E2E en dispositivo. Log: `logs/2026-07-23-offline-sqlite-local-first.md`.

**2026-07-22** — Separación en monorepo (rama `feat/monorepo-split`): `hub/` (web
coordinadores: Dashboard renovado con 7 grupos de métricas, Tachos, Equipos,
**Historial** nuevo, Reportes, Admin — sin Registrar), `app/` (APK operadores: Home
nuevo + register/**, sin dashboard), `shared/` (paquete `@hospiwaste/shared`).
AuthGuard parametrizado por app (hub exige coordinador). Analítica nueva en
`shared/src/lib/data/dashboard-analytics.ts` (15 tests). jest 179 + vitest 12,
builds verdes. Pendiente: APK (sin JDK en la máquina) y E2E manual. Log:
`logs/2026-07-22-monorepo-hub-app-dashboard.md`; ADR:
`decisions/2026-07-22-separacion-hub-app.md`.

**2026-07-16** — Excel de base instalada `BASE INSTALADA PTDP HOSPIMED ST SOFTWARE.xlsx`
procesado: seed de 60 equipos (`scripts/seed-equipment-supabase.py`) + módulo nuevo
**Equipos** (mantenimiento preventivo, solo coordinador). Archivo movido a
`inbox/procesado/`. Módulo: [[EquipmentMaintenance]]. Log:
`logs/2026-07-16-equipos-mantenimiento-preventivo.md`.

**2026-06-22** — Lote de UI post-lanzamiento (4 cambios, rama
`feat/colores-estados-historial-tachos-reportes`). (1) Recolor de los 4 estados en
`BUCKET_DEFINITIONS` (verde=En planta, naranja=En cliente, gris=Pendiente por pesar,
rojo=Pendiente por tratar) — fuente única que alimenta pie del dashboard y badge del tab de
Tachos. (2) Historial de recorridos: limpios (verde) y sucios (rojo) en líneas separadas con
contador por tarjeta. (3) Tab de Tachos: filtros Empresa+Fase, la columna de fase muestra los
**4 estados del dashboard** (no las 6 fases internas, que quedan solo en el detalle del tacho),
y "Ubicación" → "Tiempo en fase" (`computeCirculationStatus`+`formatDuration`, refresco 60s);
empresa del tacho vía `deriveContainerCompanyId`. (4) Reportes: se excluyen las firmas (por
`signature_photo_id`) y cada pesaje se renderiza en columna (peso arriba / tacho abajo, 4 por
bloque, vía `WeighingPair`). Sin migraciones. `jest` 138/138, `next build` OK. Ejecutado con
subagent-driven-development (7 tareas, review por tarea + review final opus = listo para merge).
Pendiente: E2E manual. Log: `logs/2026-06-22-colores-historial-tachos-reportes.md`.

**2026-06-17** — Historial editable de recorridos y pesajes + rediseño de los 4 estados del
dashboard. Apartado "Historial" como pestaña dentro de `/register/route` y `/register/weighing`:
visible para todos, editar/anular solo coordinador. "Eliminar" es **anulación lógica**
(`voided_*` en `route_events`/`weighing_sessions`, migración `20260617000000` — espejo de
`container_receptions`); toda derivación (fase, cola de pesaje, circulación, reportes) filtra
`voided_at is null`. Ediciones en **modo borrador + Guardar con confirmación**; anulaciones con
motivo obligatorio. Se corrigió que el hydrator no propagaba `voided_at` de recepciones.
**Dashboard**: nuevos 4 estados por línea de tiempo (gana el último evento) — En planta (limpio en
planta) / En cliente (entregado limpio) / Pendiente por pesar (recogido sucio) / Pendiente por
tratar (pesado). `jest` 98/98, `next build` OK. Pendiente: E2E manual + **aplicar la migración al
piloto**. Log: `logs/2026-06-17-historial-editable-y-rediseno-estados-dashboard.md`.

**2026-06-16** — Firma por recorrido + saludo dashboard + redacción pesaje.
Firma dibujada **obligatoria** y distinta por registro (andén y morgue), capturada con un
`SignaturePad` (canvas + pointer events, overlay full-screen) y persistida como foto con
`role='signature'` — **sin migración**, reutilizando `uploadEventPhotos` y
`groupRoutePhotosByRole` (ahora devuelve `signatureByEvent`; última gana). Campo derivado
`RouteEvent.signature_photo_id`. Dashboard saluda con el primer nombre del usuario logueado.
Texto de "Tratar inmediatamente" en pesaje → "Marcar para enviar el tacho directamente a
tratamiento". `jest` 82/82, `next build` OK. Pendiente: E2E manual de firma.
Log: `logs/2026-06-16-firma-recorrido-saludo-dashboard-redaccion-pesaje.md`.

**2026-06-10/11** — Lote post-lanzamiento (rama `feat/lote-fotos-persistencia-traza`).
Causa raíz común de varios síntomas: hidratación/persistencia incompleta — el store solo
hidrataba 5 colecciones y `storage_events`/`container_locations` se escribían solo al store
local (nunca a Supabase). Se completó write-through + hidratación de las 4 tablas
posteriores → arregla tratamiento cross-device y el gráfico kg/día. Además: fotos de
recorrido por categoría (sucios/limpios, obligatorias, visibles al editar) vía `photos.role`;
anti doble-submit en andén (+ borrado del andén duplicado en prod); traza `containers.created_by`
con "registrado por" en admin; drop de `route_events.floor`/`dock`. 3 migraciones aplicadas.
Eventos siguen siendo fuente de verdad (próximo paso de escala = vista de Postgres, no columna).
`npm run test:jest` 81/81, `next build` OK. Pendiente E2E manual cross-device.
Log: `logs/2026-06-10-recorrido-fotos-persistencia-traza.md`.

**2026-05-30** — Lote grande: empresa y tipo de desecho pasan a ser **dinámicos** del tacho
(empresa derivada del recorrido, reset al tratar; tipo = input en pesaje, `DROP` de
`containers.waste_type`). Pesaje: pendientes por número + bloqueo con escape "ausente", check
"tratar inmediatamente". Tratamiento activado en Supabase (multi-select). Empresa seleccionable
en recorrido; reportes por empresa registrada (fallback histórico). Rename "envase → tacho" +
display por número (`formatTachoNumber`). 3 migraciones aplicadas al piloto. `next build` OK,
jest 61/61. Pendiente: E2E manual. Log: `logs/2026-05-30-pesaje-tratamiento-rename-tacho.md`;
ADR: `decisions/2026-05-30-empresa-tipo-dinamicos-tacho.md`.

**2026-05-27** — Lote de ajustes post-piloto (5 cambios, completos).
(1) Pesaje: "vehículo Yaris" → "tacho Yaris" y se quita el ícono de carro.
(2) Login: botón ojo para mostrar/ocultar contraseña.
(3) Pesaje: foto de balanza arriba, foto del envase abajo (solo orden visual).
(4) **Recorridos multi-andén por horario**: se replica el patrón de pesaje (sesión →
varios andenes editables) sin tabla nueva — cada andén es un `route_event` agrupado por
`(date, slot)`; migración `20260527010000` elimina el índice único parcial. Las fotos se
suben al guardar cada andén (no al finalizar) para no perderlas al editar.
(5) **Reportes rediseñados**: orden estricto día→ruta→(recorrido+pesaje), layout 4 cuadros
2×2 / 8 fotos por cuadro, salto de página por día, selector de rango de fechas (default
semana). Pesajes huérfanos (histórico/Yaris) agrupados por fecha. Pendiente: E2E manual.
Specs/Plans: `docs/superpowers/{specs,plans}/2026-05-27-pesaje-login-recorridos-multianden*`
y `…/2026-05-27-reporte-fotografico-rediseno*`.
Log: `logs/2026-05-27-pesaje-login-recorridos-multianden.md`.

**2026-05-25** — Fotos migradas a Supabase Storage (última pieza de la integración).
Las pantallas guardaban data URLs solo en memoria (`addPhoto`); `uploadPhoto` existía
pero no se llamaba. Ahora pesaje (`handleCreateReception`/`handleSaveEdit`) y recorridos
(`handleFinish` andén + morgue) suben las fotos al bucket privado `photos` y registran en
`public.photos`; el hydrator firma URLs (24 h) y reconstruye los `photo_ids` de receptions
y routeEvents. Helper compartido `uploadEventPhotos` (`src/lib/data/photos.ts`, best-effort).
`next.config.ts` permite `*.supabase.co` en `next/image`. Pendiente: E2E manual.
Log: `logs/2026-05-25-fotos-supabase-storage.md`.

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
