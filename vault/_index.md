---
title: Índice del Vault — Hospiwaste
tags:
  - index
  - meta
updated: 2026-09-14
---

# Vault — Hospiwaste

Punto de entrada. Leer al inicio de cada sesión, antes de tocar código.

> [!info] Qué vive acá y qué no
> Este vault es memoria de negocio y de decisiones: **solo `.md`**, escrito a mano.
> La estructura del código (carpetas, tipos, dependencias, quién llama a qué) **no se
> documenta acá** — se deriva del código. Los binarios de origen (Excel, JSON de marca)
> viven en `docs/fuentes/`, fuera del vault.

> [!info] Nota de marca (2026-05-12)
> El producto se llamaba **Hospimed** y pasó a llamarse **Hospiwaste**. Algunas notas
> anteriores a esa fecha conservan el nombre viejo como historial. Ver [[2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi]].

---

## Estado actual

**Fase:** producción — piloto PTDP en planta, operando en **modo interino solo-pesaje**
(recorridos congelados mientras se rehace la capa offline). Ver [[2026-09-01-modo-interino-solo-pesaje]].

**Rama de trabajo:** `feat/modo-interino-solo-pesaje` · último commit `32add8c`
**APK:** v1.6 compilado · **los teléfonos de planta siguen en v1.5**

### Pendientes abiertos

| Pendiente | Origen |
|---|---|
| Desplegar el APK v1.6 en los dos teléfonos de planta | [[2026-09-07-yaris-pesaje-directo]] |
| Aclarar con planta qué es `ION - Airkem` en el histórico (390 pesajes de 2026) | [[2026-09-14-historico-kilos-2024-2026]] |
| Revisar dashboard y `/reports/comparativo` en el navegador con sesión de coordinador | [[2026-09-14-historico-kilos-dashboard-y-reporte]] |
| Verificar el estado de error del histórico cortando la red (nunca se vio funcionando) | [[2026-09-14-historico-kilos-dashboard-y-reporte]] |
| Investigar por qué una pestaña sin sesión no hidrata ni redirige al login | [[2026-09-14-historico-kilos-dashboard-y-reporte]] |
| Captura de `/diagnostico` desde planta — cierra el diagnóstico del crash nativo | [[2026-09-06-auditoria-apk-crash-nativo-y-diagnostico]] |
| Correr el reset de datos operativos (después del rollout del APK, no antes) | [[2026-09-01-modo-interino-solo-pesaje]] |
| E2E manual: pesar un `Y*` de punta a punta contra la balanza nueva | [[2026-09-07-yaris-pesaje-directo]] |
| Decidir custom domain de Supabase — el DNS de Movistar VE no resuelve el subdominio | [[2026-08-25-fix-sesion-apk-preferences-sqlite]] |
| Rediseño de la capa offline de recorridos (levanta el modo interino) | [[2026-09-01-modo-interino-solo-pesaje]] |
| Ciclo del compactador — módulo nunca empezado | [[Roadmap]] |
| GPS en tiempo real — pendiente de cotización formal (~$2,000 + mensual) | [[Overview]] |

> [!warning] Ventana abierta
> La migración de taras Yaris ya está aplicada en el piloto, pero planta corre el APK v1.5.
> Hasta el rollout, esos teléfonos ven los `Y1`…`Y26` con tara real sin poder pesarlos.
> No corrompe datos. Detalle en [[2026-09-07-yaris-pesaje-directo]].

> [!warning] El reset de datos operativos ahora abriría un hueco
> **Fecha:** 2026-09-14
> **Problema:** desde la carga del histórico, el sistema es dueño de los kilos
> del **2026-09-07 en adelante** y el histórico termina el 2026-09-06 (ver
> [[2026-09-14-historico-kilos-2024-2026]]). El reset pendiente borra
> `container_receptions`, así que dejaría los kilos de septiembre en cero desde
> el día 7 — y el dashboard y el reporte comparativo mostrarían esa caída como
> si fuera real.
> **Acción requerida:** antes de correr `scripts/reset-datos-operativos.sql`,
> decidir qué pasa con esos kilos. O se exportan y se pasan a
> `historical_daily_kg` moviendo el corte, o se asume el hueco a conciencia.

---

## Notas ancla

### Proyecto
- [[Overview]] — empresa, problema, stakeholders, alcance, contexto regulatorio
- [[DataModel]] — entidades, relaciones y campos clave (Cliente → Empresa → Recorrido)
- [[Roadmap]] — módulos, prioridades y estado
- [[Architecture]] — stack, convenciones e integraciones
- [[CodeMap]] — dónde vive el grafo de código y cómo consultarlo
- [[Branding]] — colores, tipografía, tokens

### Procesos de negocio
- [[WasteTypes]] — los 5 tipos de desecho y su tratamiento diferenciado
- [[ContainerLifecycle]] — ciclo del tacho desde el alta hasta el lavado
- [[PhotoDocumentation]] — memoria fotográfica: requisito regulatorio obligatorio
- [[EquipmentMaintenance]] — semáforo de mantenimiento preventivo de la base instalada

---

## Decisiones (ADR)

Formato y plantilla en [[Formato-ADR]] (`decisions/`).

- [[2026-09-14-historico-kilos-2024-2026]] — el histórico de kilos vive en tabla aparte, agregado por día; el sistema es dueño desde el 2026-09-07
- [[2026-09-07-yaris-pesaje-directo]] — la flota Yaris estrena balanza: se pesa directo y muere el modo Yaris del formulario
- [[2026-09-01-modo-interino-solo-pesaje]] — flag `INTERIM_MODE`: recorridos congelados, cola de pesaje abierta a todos los tachos
- [[2026-07-28-cola-pesaje-por-fecha]] — la cola se reabre con cada recogida sucia posterior al último pesaje; no exige tratamiento intermedio
- [[2026-07-22-separacion-hub-app]] — monorepo: `hub/` coordinadores, `app/` operadores, `shared/` común
- [[2026-06-10-empresa-por-registro]] — la empresa es del registro, no del tacho; `containers.company_id` eliminado
- [[2026-06-01-roles-acceso]] — roles coordinador/operador; control en UI + middleware + RLS
- [[2026-06-01-ids-tachos-supabase-vs-mock]] — los IDs en Supabase son numéricos sin prefijo (`020`); el prefijo `A-` es solo del mock
- [[2026-05-30-empresa-tipo-dinamicos-tacho]] — empresa y tipo de desecho son propiedades dinámicas del tacho
- [[2026-05-21-estado-envase-derivado]] — el estado se deriva de eventos; los eventos son la fuente de verdad
- [[2026-05-21-supabase-integracion]] — por qué Supabase y cómo se integra
- [[2026-05-17-cliente-empresa-recorrido]] — jerarquía Cliente → Empresa, rename a "recorrido", eliminación de `Batch`
- [[2026-05-03-border-radius-global]] — radio global de 8px

---

## Logs de cambios

Uno por feature o cambio mayor, en orden inverso. Obsidian lista la carpeta completa;
acá van solo los que siguen teniendo consecuencias abiertas o reglas que aplican hoy.

### Vigentes — leer antes de tocar el APK
- [[2026-09-14-historico-kilos-dashboard-y-reporte]] — histórico 2024–2026 cargado; comparativo anual en el dashboard y reporte de kilos para directiva
- [[2026-09-14-vault-solo-md-y-grafo-de-codigo]] — el vault queda solo-markdown; la estructura del código se deriva con graphify
- [[2026-09-07-yaris-pesaje-directo]] — taras reales `Y1`…`Y26` cargadas y migración aplicada; planta sigue en v1.5
- [[2026-09-06-auditoria-apk-crash-nativo-y-diagnostico]] — toda excepción en un `@PluginMethod` mata el APK (Capacitor 8); pantalla `/diagnostico`
- [[2026-09-04-fix-banner-sin-conexion-tras-cancelar-pesaje]] — el banner "Sin conexión" salía por una ruta `/dashboard` que no existe en la app
- [[2026-09-01-modo-interino-solo-pesaje]] — recorridos deshabilitados, empresa obligatoria en el pesaje
- [[2026-08-25-fix-sesion-apk-preferences-sqlite]] — el objeto de plugin de Capacitor es *thenable*: sesión y LocalStore muertos desde julio
- [[2026-08-25-instalacion-apk-firma-debug-vs-release]] — distribuir siempre el build de `release/`; cambiar de llave impide actualizar

### 2026-08 / 2026-07
- [[2026-08-08-frecuencia-mantenimiento-libre]] — frecuencia de mantenimiento: valor libre + unidad
- [[2026-07-28-reset-datos-operativos]] — tercer reset del piloto; `photos` es compartida con mantenimiento de equipos
- [[2026-07-28-fix-cola-pesaje-ciclo-reabierto]] — la cola comparaba existencia y no fechas: 41 tachos invisibles
- [[2026-07-27-inventario-tachos-190-200]] — altas 190–200 y M16–M20
- [[2026-07-23-offline-sqlite-local-first]] — motor offline SQLite; reemplaza el outbox de IndexedDB
- [[2026-07-22-monorepo-hub-app-dashboard]] — separación en monorepo + dashboard renovado
- [[2026-07-20-reset-parcial-tachos]] — reset parcial hasta el 13-jul
- [[2026-07-17-finalizar-pesaje-sin-pendientes]] — finalizar pesaje sin resolver todos los pendientes
- [[2026-07-16-equipos-mantenimiento-preventivo]] — tab Equipos, seed de 60 equipos
- [[2026-07-08-fotos-opcionales-recorrido]] — las fotos dejan de bloquear el guardado de recorrido
- [[2026-07-06-reset-datos-piloto]] — reset total de datos operativos

### 2026-06
- [[2026-06-22-colores-historial-tachos-reportes]] — recolor de los 4 estados, tab de tachos, fotos de reportes
- [[2026-06-19-offline-outbox-campo]] — outbox de campo (reemplazado por SQLite en julio)
- [[2026-06-19-login-tarjetas-auto-logout-operador]] — login por tarjetas + auto-logout 1h
- [[2026-06-17-historial-editable-y-rediseno-estados-dashboard]] — historial editable y anulación lógica
- [[2026-06-16-fix-area-anden-y-activo-fantasma]] — área del andén no persistía; recorrido "activo" fantasma
- [[2026-06-16-firma-recorrido-saludo-dashboard-redaccion-pesaje]] — firma obligatoria por recorrido
- [[2026-06-10-recorrido-fotos-persistencia-traza]] — write-through e hidratación completas
- [[2026-06-10-empresa-por-registro-tacho-independiente]] — la empresa pasa al registro
- [[2026-06-10-sesion-no-persistente-cookies-de-sesion]] — cookies de sesión
- [[2026-06-03-deshacer-pesaje-vista-pendientes]] — deshacer pesaje (soft-delete) + vista de pendientes
- [[2026-06-03-tratamiento-confirmacion-refresco]] — confirmación de envío a tratamiento
- [[2026-06-03-fix-sesion-no-cargada-boton-iniciar]] — "Todavía no se cargó tu sesión"
- [[2026-06-03-contenedores-yaris-recorrido]] — tachos Yaris dedicados (**revertido** en 2026-09-07)
- [[2026-06-01-roles-coordinador-operador]] — roles en UI, middleware y RLS
- [[2026-06-01-tachos-metalicos]] — M1-M15 y tipo "Metálicos no reutilizables"
- [[2026-06-01-reporte-logos-riga-cpch]] — header del Registro Fotográfico
- [[2026-06-01-quitar-ubicacion-traslado-en-construccion]] — se quita el registro de Ubicación

### 2026-05
- [[2026-05-30-pesaje-tratamiento-rename-tacho]] — rename "envase → tacho"; empresa y tipo dinámicos
- [[2026-05-27-pesaje-login-recorridos-multianden]] — recorridos multi-andén
- [[2026-05-25-recorridos-supabase-writethrough]] — recorridos a Supabase
- [[2026-05-25-fotos-supabase-storage]] — fotos a Supabase Storage con URLs firmadas
- [[2026-05-25-pesaje-ux-yaris-recorridos-modal]] — ajustes UX post-piloto
- [[2026-05-21-supabase-bootstrap]] — bootstrap de Supabase para el piloto
- [[2026-05-18-reunion-ptdp-demo-piloto]] — demo 2 y plan de lanzamiento
- [[2026-05-18-historico-airkem-dashboard]] — histórico Airkem 2026 al dashboard
- [[2026-05-17-recorridos-pesaje-reportes-dashboard]] — rediseño operativo completo
- [[2026-05-12-rename-hospiwaste-cold-storage-auto-transfer-multi]] — rename Hospimed → Hospiwaste
- [[2026-05-05-dashboard-containers-polish]] — pulido de dashboard y contenedores
- [[2026-05-03-branding-system]] — implementación del branding system

---

## Inbox

Zona de aterrizaje para material crudo (transcripts, notas sueltas, dumps). El flujo de
procesamiento está en `CLAUDE.md`, en la raíz del repo.

**Pendiente de procesar:** *(vacío)*

**Procesado:**
- [[2026-05-18_PTDP_SoftwarePlanta3_ResumenReunion]] — reunión Software Planta 3
- [[2026-04-30-reunion-francesca-sebastian]] — transcript fundacional del proyecto
