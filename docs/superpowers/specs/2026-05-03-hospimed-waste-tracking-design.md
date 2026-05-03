# Design Spec — Hospimed: Sistema de Trazabilidad de Desechos Clínicos

**Fecha:** 2026-05-03  
**Estado:** Aprobado — pendiente de implementación  
**Stack:** Next.js 14 App Router + Supabase (mock data en fase inicial)

---

## 1. Contexto del problema

Hospimed opera una planta de tratamiento de desechos clínicos peligrosos. Procesa ~300 contenedores por día para múltiples clientes (hospitales, clínicas). El proceso de trazabilidad actual es manual y fragmentado: Excel de balanza + fotos ensambladas a mano en PDF. El reporte regulatorio obligatorio (memoria fotográfica) toma horas en armar.

**Objetivo:** Reemplazar ese flujo con trazabilidad completa y generación automática de reportes con un solo clic.

---

## 2. Usuarios

Un único rol con acceso total a todas las funcionalidades. No hay distinción de permisos entre operadores de campo y supervisores (puede revisarse en el futuro).

Los operadores usan la app principalmente desde el celular en campo.

---

## 3. Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 14 App Router + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Estado global | Zustand |
| PWA / Service Worker | next-pwa + Workbox |
| Offline storage | idb (IndexedDB wrapper) |
| Generación de reportes | @react-pdf/renderer |
| Base de datos | Mock data (fase 1) → Supabase Postgres + Storage (fase 2) |

**Decisión de arquitectura:** PWA con soporte offline. Los operadores trabajan en campo con conectividad variable. Los eventos registrados sin conexión se guardan en IndexedDB y se sincronizan automáticamente cuando vuelve la conexión.

---

## 4. Modelo de datos

### Client
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| name | string | ej: "Ciudad de la Salud" |
| code_letter | string | Prefijo de contenedores (ej: `A`) |
| locations | Location[] | Pisos y áreas donde tiene contenedores |

### Container (Envase)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | Formato `{letra}-{número}` ej: `A-069` |
| client_id | FK → Client | Un contenedor pertenece a un solo cliente |
| size_liters | enum | `240` / `750` / `1100` |
| tare_weight_kg | decimal | Peso en vacío, se registra al dar de alta |
| waste_type | enum | Ver sección de tipos de desecho |
| status | enum | `active` / `decommissioned` |
| registered_at | datetime | |

> La numeración puede repetirse entre clientes distintos. El prefijo de letra del cliente garantiza unicidad global (ej: `A-069` ≠ `B-069`).

### Batch (Lote)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| client_id | FK → Client | |
| date | date | Día calendario del lote |
| status | enum | `active` / `completed` |
| container_ids | FK[] → Container | Contenedores del lote |

> **Pendiente de confirmar con Francesca (reunión 2026-05-08):** ¿Un lote = todos los contenedores de un cliente en un día (independientemente de cuántos viajes), o un lote = una visita específica? Asumido temporalmente: lote = día calendario por cliente.

### ExchangeEvent (Intercambio en punto de encuentro)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| batch_id | FK → Batch | |
| timestamp | datetime | |
| operator_id | FK → User | |
| clean_containers_given | FK[] → Container | Limpios entregados |
| dirty_containers_received | FK[] → Container | Sucios recibidos |
| location | string | Punto de encuentro |
| photos | FK[] → Photo | |

### ContainerReception (Pesaje en planta)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| batch_id | FK → Batch | |
| arrived_at | datetime | |
| gross_weight_kg | decimal | |
| net_weight_kg | decimal (computed) | `gross_weight - tare_weight` |
| operator_id | FK → User | |
| photos | FK[] → Photo | Foto del envase + foto de balanza |

### StorageEvent (Cámara fría)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| batch_id | FK → Batch | |
| entry_at | datetime | |
| exit_at | datetime | nullable |
| operator_id | FK → User | |
| photos | FK[] → Photo | Foto del envase en cámara fría |

### TreatmentRun (Tratamiento — solo tipo 1)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| batch_id | FK → Batch | |
| started_at | datetime | |
| completed_at | datetime | nullable |
| operator_id | FK → User | |

### ExternalTransfer (Traslado externo — tipos 2–5)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| batch_id | FK → Batch | |
| storage_started_at | datetime | |
| transferred_at | datetime | nullable |
| destination | string | Centro externo |
| operator_id | FK → User | |

### ContainerLocation (Ubicación reportada)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| container_id | FK → Container | |
| reported_at | datetime | |
| operator_id | FK → User | |
| location_type | enum | `client_site` / `plant_storage` / `cold_storage` / `treatment` |
| client_id | FK → Client | nullable — si está en una clínica/hospital |
| floor | string | nullable — ej: "3" |
| area | string | nullable — ej: "Pediatría", "UCI" |
| notes | string | nullable |

> La ubicación vigente de un envase es siempre el `ContainerLocation` más reciente. No hay GPS en tiempo real (decisión pendiente de cotización). La ubicación se actualiza cuando un operador la reporta.

### Photo
| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | |
| url | string | |
| event_type | enum | `exchange` / `weighing` / `storage` / `treatment` / `other` |
| event_id | string | FK polimórfica |
| taken_at | datetime | |
| label | string | Watermark automático: `PTDP [Cliente] [fecha] [hora]` |

### Tipos de desecho
| # | Nombre | Tratamiento |
|---|--------|-------------|
| 1 | Peligroso infeccioso | En planta (esterilización + trituración) |
| 2 | Anatomopatológico | Almacenaje → traslado a centro externo |
| 3 | Citotóxico | Almacenaje → traslado a centro externo |
| 4 | Líquidos | Almacenaje → traslado a centro externo |
| 5 | Morgue | Almacenaje → traslado a centro externo |

### Peso neto
`net_weight_kg = gross_weight_kg - container.tare_weight_kg`  
Este es el valor que se factura al cliente. Se calcula, no se almacena.

---

## 5. Navegación y pantallas

```
/login

/dashboard
  ├── Métricas globales (envases en circulación, en planta, en tratamiento)
  ├── Tab "Lotes activos"
  │     → lista: cliente, fecha, nº envases, próximo paso pendiente
  │       ("Próximo paso" = la fase más temprana que aún tiene envases sin completar en ese lote)
  └── Tab "Lotes completados"
        → filtros: cliente, tipo de desecho, rango de fechas
        → acción: "Generar reporte PDF"

/batches/[id]
  └── lista de envases del lote con su fase actual

/containers
  ├── buscador por número de envase
  ├── filtros: cliente, tipo de desecho, tamaño (240L / 750L / 1100L)
  └── columna: ubicación actual (último reporte)

/containers/[id]   ("CRM del envase")
  ├── Info básica: número, cliente, tipo de desecho, tara, tamaño
  ├── Barra de progreso con fases:
  │     Intercambio → Pesaje → Cámara fría → Tratamiento/Traslado → Limpio
  ├── Historial de ubicaciones
  ├── Tiempo en cada fase
  └── Registro fotográfico por fase

/register/exchange       ← mobile-first, cámara integrada
/register/weighing       ← mobile-first, cámara integrada
/register/storage        ← mobile-first, cámara integrada
/register/treatment      ← solo tipo 1
/register/transfer       ← tipos 2–5
/register/location       ← reporte manual de ubicación de un envase

/admin/containers        ← CRUD envases
/admin/clients           ← CRUD clientes
```

---

## 6. Flujo de registro (pantallas mobile)

Las pantallas `/register/*` son el flujo operativo central. Diseño:

1. **Selección de envase** — búsqueda por número, autocompletado
2. **Confirmación de datos** — muestra cliente, tipo de desecho, tara
3. **Captura de foto(s)** — cámara integrada (`<input capture="environment">`), mínimo de fotos requeridas según la etapa
4. **Registro de datos adicionales** — peso (pesaje), ubicación (intercambio), destino (traslado)
5. **Confirmación** — feedback visual claro; si no hay conexión, muestra "Guardado localmente — se sincronizará cuando haya conexión"

---

## 7. Generación de reportes

El reporte se genera desde `/dashboard` (tab lotes completados) con un clic por lote.

**Contenido del PDF:**
- Portada: logo, cliente, fecha, total de envases, peso total neto
- Una página por envase: número, cliente, fecha/hora, tara/bruto/neto, tipo de desecho, fotos de las tres fases
- Resumen final: tabla consolidada con todos los envases y sus pesos netos

**Nomenclatura de fotos:** `PTDP [Cliente] [fecha] [hora]`

> **Pendiente:** El usuario compartirá la plantilla visual del PDF actual de Hospimed. El diseño del reporte se adaptará a esa plantilla.

**Implementación:** `@react-pdf/renderer` — generación en browser, sin servidor adicional. El archivo se descarga directamente desde el celular o escritorio.

---

## 8. Soporte offline (PWA)

| Situación | Comportamiento |
|-----------|---------------|
| Sin conexión | App shell disponible (service worker) |
| Registro de evento | Se guarda en IndexedDB con cola de sync |
| Fotos | Se almacenan en IndexedDB en base64 |
| Vuelta de conexión | Cola se procesa automáticamente en background |
| Indicador visual | Contador de "X eventos pendientes de sincronizar" visible en la app |

**Fuera de alcance offline:** generación de reportes PDF y vista completa del inventario de envases (requieren datos frescos del servidor).

---

## 9. Pendientes y decisiones abiertas

| # | Pendiente | Acción |
|---|-----------|--------|
| 1 | Definición exacta de "lote" (día vs. visita) | Confirmar con Francesca — reunión 2026-05-08 |
| 2 | Plantilla visual del reporte PDF | Usuario compartirá el archivo |
| 3 | GPS en tiempo real | Cotización pendiente (~$2,000 + mantenimiento mensual por chip IoT) |
| 4 | Integración con Supabase | Fase 2, después de validar UI con mock data |
