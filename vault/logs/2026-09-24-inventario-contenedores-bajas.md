---
title: Inventario de contenedores 2026-09-24 — cruce con Supabase y bajas
tags:
  - log
  - tachos
  - datos
  - inventario
date: 2026-09-24
updated: 2026-09-24
---

# 2026-09-24 — Inventario de contenedores: cruce con Supabase y bajas

El usuario entregó "Inventario de Contenedores en Proceso" (240 L, 1100 L y taras).
Se cruzó contra `public.containers` del piloto.

## Qué coincidía

- Las taras de los tachos 240 L `001`–`199` coinciden exactamente con la hoja "Tara".
- `52.1` y `76.1` de la hoja Tara son las unidades originales **perdidas**; los tachos 52 y 76
  en uso son las unidades nuevas. No van al sistema (mismo criterio que
  [[2026-07-27-inventario-tachos-190-200]]).

## Qué significa cada estado del Excel

- **"Sin llantas y en proceso" siguen activos.** Son tachos en uso, no fuera de servicio. Que no
  tengan pesajes desde el 2026-09-07 no significa que estén de baja.
- **Los metálicos `M1`–`M20` siguen activos**, aunque este Excel no los incluya: el inventario
  cubre solo 240 L y 1100 L.

> [!warning] Corrección del mismo día
> En una primera pasada se dieron de baja los 31 tachos sin llantas y `M1`–`M20` por un malentendido.
> El usuario lo corrigió y los 51 contenedores se reactivaron el mismo día. Una baja lógica se revierte sin
> perder datos (`status = 'active'`).

## Baja aplicada (`status = 'decommissioned'`)

- Tacho `200`: no está en el inventario y nunca se pesó. Es el único contenedor de baja.
  Quedan activos 245: 199 tachos de 240 L, `Y1`–`Y26` y `M1`–`M20`.

## Pendiente

- **`Y26`:** no está en el Excel (Yaris rojos 1–25), pero se pesa con regularidad (último pesaje
  el 2026-09-23). No se dio de baja; hay que confirmar con planta qué contenedor se está pesando como Y26.
- **Yaris verdes (8, sin número):** no existen en el sistema. Falta definir si se registran y con qué ID.
- **Sin botón para reactivar:** `hub/src/app/admin/containers/page.tsx` solo da de baja. Cuando un
  tacho vuelva de reparación, hoy hay que reactivarlo por SQL.
