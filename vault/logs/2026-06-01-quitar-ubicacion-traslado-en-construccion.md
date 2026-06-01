---
title: Quitar registro de Ubicación + Traslado externo "en construcción"
tags:
  - log
  - registro
  - navegacion
updated: 2026-06-01
---

# 2026-06-01 — Quitar Ubicación + Traslado externo en construcción

## Qué cambió

1. **Eliminado el registro de Ubicación** (`/register/location`): no es necesario.
   - Borrada la página `src/app/register/location/page.tsx`.
   - Quitado de los navs: `sidebar.tsx` (`REGISTER_LINKS`), `mobile-bottom-nav.tsx`
     (`MORE_LINKS` + import `MapPin`) y del título en `mobile-header.tsx`.
   - Se conserva el historial de ubicaciones en el detalle del tacho
     (`LocationHistory` en `containers/[id]`), que solo **lee** datos existentes.

2. **Traslado externo en construcción** (`/register/transfer`): por ahora no se usa.
   - La página se reemplazó por un aviso "Sección en construcción" (ícono `Construction`,
     card ámbar). Se conserva la ruta y el enlace en la navegación.
   - La lógica anterior (selección de tachos + destino + `addExternalTransfer`) quedó
     fuera; si se reactiva, recuperar del historial git.

## Por qué

Decisión operativa: la trazabilidad no requiere capturar ubicación manual, y el flujo de
traslado externo no estará en uso para el lanzamiento. Se deja el traslado visible pero
bloqueado en vez de eliminarlo, para reincorporarlo sin rehacer la navegación.

## Verificación

`next build` OK (19 rutas; `/register/location` ya no aparece, `/register/transfer` sí).
