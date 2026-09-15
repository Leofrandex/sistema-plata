---
title: Pesaje directo de la flota Yaris — fin del modo Yaris
tags:
  - log
  - pesaje
  - yaris
  - dashboard
  - admin
updated: 2026-09-07
---

# 2026-09-07 — La flota Yaris se pesa directamente

Operaciones informó que los contenedores Yaris (`Y1`…`Y26`) ya tienen **pesa dedicada**, así
que se pesan tal cual y desaparecen los tachos alternativos sobre los que se volcaba su carga.
ADR: [[2026-09-07-yaris-pesaje-directo]].

## Cambios

### Cola de pesaje (`shared`)
- `getPendingWeighingContainerIds` y `getWeighableContainerIds` (`lib/data/containers.ts`)
  dejan de excluir `is_yaris_container`.
- Migración `20260907000000_yaris_pesaje_directo.sql`: rehace
  `v_containers_pending_weighing` sin la exclusión (revierte `20260603010200`).

### Taras reales
Las 26 taras estaban en `0`. Cargadas en la misma migración y en `MOCK_CONTAINERS`
(`YARIS_TARES`, espejo de `METALLIC_TARES`): 50.9–52.6 kg, promedio ~51.6.

### Formulario de pesaje (`app`)
- Se eliminan el toggle "¿Es un pesaje de Yaris?", el `<Select>` "Tacho Yaris" y el campo de
  estado `is_yaris_weighing` (era estado de UI, nunca se persistió). El grid de dos columnas
  pasa a un único buscador a ancho completo.
- El buscador pasa de `inputMode="numeric"` a `"text"`: con teclado numérico no se podía
  escribir la `Y` de `Y3`. Placeholder → "Número de tacho (ej: 145 o Y3)".
- El badge "Dedicado a Yaris" se reemplaza por **"Flota Yaris"** (`is_yaris_container`), útil
  para que el operador confirme que el tacho elegido lleva ~51 kg de tara.

### Dashboard (`shared` + `hub`)
Los Yaris entran al pool activo: `computeCirculationBreakdown`, `computeStagnantContainers`,
`computeFleetBreakdown` y `metrics-cards.tsx` pierden el filtro. El pool mock pasa de 204 a
230 tachos activos.

### Admin → Tachos (`hub`)
Fuera la columna "Yaris" con su toggle y el checkbox del alta. Queda "Contenedor Yaris"
(`is_yaris_container`) y "Metálico". La migración pone `is_yaris_dedicated = false` en toda
la flota; la columna queda deprecada, no dropeada.

## Verificación

`npm test` 264/264 (185 shared + 37 hub + 42 app), `build:hub` y `build:app` verdes.

**Migración aplicada al piloto** el 2026-09-07 vía MCP de Supabase (versión remota
`20260907171846`, `yaris_pesaje_directo`). Estado antes → después:

| Métrica | Antes | Después |
|---------|-------|---------|
| Yaris con tara 0 | 26 | 0 |
| Tachos `is_yaris_dedicated` | 17 | 0 |
| Rango de taras Yaris | — | 50.9 – 52.6 kg (prom. 51.62) |

`v_containers_pending_weighing` responde sin error (21 filas). Los 17 tachos que estaban
marcados como dedicados vuelven al pool normal de 246 activos.

**APK v1.6 compilado y firmado** (`versionCode` 7 / `versionName` 1.6, 29.4 MB) con la llave
real — `CN=Sebastian Castro, OU=oito`, SHA-256 `d4de0f31…`, la misma de v1.2 en adelante, así
que instala encima sin desinstalar. JDK: Temurin 21.0.12.1 de la extensión Red Hat Java de
Antigravity (la extensión subió a `redhat.java-1.56.0`; el número de versión del directorio
cambia con cada actualización).

## Pendiente

- Desplegar el APK v1.6 en los teléfonos de planta (instalación encima, sin desinstalar).
- E2E manual: pesar un `Y*` de punta a punta y confirmar el neto contra la balanza nueva.

> [!warning] Ventana abierta hasta el despliegue
> La migración ya está aplicada y el v1.6 está compilado, pero los teléfonos de planta siguen
> con el v1.5. Hasta que se instale el nuevo, esos equipos ven los 17 ex-dedicados en el
> buscador normal y los `Y1`…`Y26` con tara real pero sin poder pesarlos (la app vieja los
> sigue excluyendo de la cola). No rompe nada ni corrompe datos.

## Nota sobre el modo interino

Con recorridos congelados, los 26 Yaris ahora cuentan en el dashboard y tienden a quedarse en
*Pendiente por tratar* tras cada pesaje, igual que el resto de la flota. Se decidió aceptarlo:
es consistente con lo que ya pasa hoy y se resuelve cuando vuelvan los recorridos.
Ver [[2026-09-01-modo-interino-solo-pesaje]].
