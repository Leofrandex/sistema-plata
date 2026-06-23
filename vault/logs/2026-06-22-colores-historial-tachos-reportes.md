---
title: Colores de estados, historial de recorridos, tab de tachos y fotos de reportes
tags:
  - log
  - dashboard
  - tachos
  - recorridos
  - reportes
fecha: 2026-06-22
updated: 2026-06-22
---

# 2026-06-22 — Colores de estados, historial, tab de tachos y reportes

Lote de cuatro ajustes de UI post-lanzamiento. Rama
`feat/colores-estados-historial-tachos-reportes`. Sin migraciones. `jest` 138/138,
`next build` OK. Spec y plan en `docs/superpowers/{specs,plans}/2026-06-22-colores-estados-historial-tachos-reportes*`.

## Qué cambió y por qué

### 1. Recolor de los 4 estados de circulación
Nuevo mapeo en `BUCKET_DEFINITIONS` (`src/lib/data/dashboard-metrics.ts`), única fuente
de verdad: **En planta → verde** (`#16A34A`), **En cliente → naranja** (`#F97316`),
**Pendiente por pesar → gris** (`#94A3B8`), **Pendiente por tratar → rojo** (`#DC2626`).
Se invirtió el significado de verde/naranja respecto al esquema anterior por pedido
operativo (verde = "en casa/limpio en planta", naranja = "afuera en cliente", rojo = lo
urgente por tratar, gris = lo neutro por pesar). El pie del dashboard y el badge de fase
del tab de Tachos leen el mismo `BUCKET_DEFINITIONS`, así que no hay drift de color.

### 2. Historial de recorridos más legible
`route-history.tsx`: la línea única "Sucios … · Limpios …" se separó en dos líneas con
contador por tarjeta — **Limpios (N)** en verde arriba, **Sucios (N)** en rojo abajo.
Contador por recorrido (no resumen global), por decisión del usuario.

### 3. Tab de Tachos: filtros + fase del dashboard + tiempo en fase
- Filtros nuevos: **Empresa** y **Fase**, además de búsqueda y tamaño.
- La columna de fase dejó de mostrar las **6 fases internas** (`ContainerPhase`:
  Recorrido/Pesaje/Cámara fría/Tratamiento/Traslado/Limpio) y ahora muestra los **4 estados
  de circulación del dashboard** (ver decisión abajo).
- "Ubicación actual" se reemplazó por **"Tiempo en fase"** = tiempo desde que el tacho entró
  a su estado actual, con `computeCirculationStatus` (devuelve `sinceMs`) + `formatDuration`
  (`Xd Yh` / `Xh Ym` / `Xm`). `now` se refresca cada 60s.
- La empresa para el filtro se deriva con `deriveContainerCompanyId`: el `company_id` del
  registro NO anulado más reciente (recepción por `arrived_at` o recorrido por `started_at`)
  que referencia al tacho y tiene empresa. Coherente con
  `decisions/2026-06-10-empresa-por-registro.md` (la empresa es del registro, no del tacho).

### 4. Reportes: sin firmas, peso arriba / tacho abajo
- Se excluyen las fotos de **firma** del recorrido. Como el tipo `Photo` del app no expone
  `role`, se filtra por `RouteEvent.signature_photo_id` (robusto, sin tocar esquema).
- Cada pesaje se renderiza como una **columna**: foto del **peso/balanza arriba**, foto del
  **tacho abajo**, 4 pesajes por bloque. Se apoya en el orden determinista de
  `ContainerReception.photo_ids` (índice 0 = tacho, índice 1 = balanza); el grupo de pesaje
  ahora lleva `pairs: WeighingPair[]` además de la lista plana `photos` (que mantiene correcto
  el conteo `weighingPhotoCount`). Los cuadros de recorrido siguen con la grilla de 8 fotos.

## Decisión de diseño no obvia

**El tab de Tachos usa los 4 estados de circulación del dashboard, no las 6 fases internas
(`ContainerPhase`).** Las 6 fases siguen vivas y sin cambios en la **página de detalle** del
tacho (`/containers/[id]`) y su lifeline. La vista de inventario se alineó con el lenguaje del
dashboard para que coordinador y operador hablen de los mismos 4 estados.

**Dos derivaciones de empresa conviven a propósito** en `containers.ts`:
`getContainerCurrentCompanyId` (dueño del **ciclo abierto**: solo dirty-received posteriores al
último tratamiento/traslado, para herencia en pesaje) y `deriveContainerCompanyId` (registro
más reciente de **cualquier** tipo, respetando anulados, para **filtrar inventario**). No es
duplicación: difieren en inclusión de clean-delivered, manejo de `voided_at` y reset por
tratamiento. (Reco menor del review: comentario cruzado entre ambas.)
