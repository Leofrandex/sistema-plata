---
title: Fotos opcionales al guardar recorrido (andén + morgue)
tags:
  - log
  - recorrido
  - validacion
fecha: 2026-07-08
---

# Fotos opcionales al guardar un recorrido

## Motivación

En campo aparecieron recorridos legítimos sin tachos de un tipo (p. ej. un día
sin tachos limpios que dejar). La validación exigía **foto de sucios Y foto de
limpios** siempre, así que el operador quedaba bloqueado sin poder guardar el
andén. El bloqueo real no eran los tachos (bastaba uno de cualquier tipo), sino
la foto de la categoría ausente.

## Decisión

Las fotos dejan de ser requisito para guardar. La regla queda idéntica en ambos
flujos de recorrido:

> **Empresa + al menos un tacho (sucio o limpio) + firma.**

Las fotos siguen disponibles y se suben si se capturan, pero ya no bloquean.

Esto **revierte parcialmente** el commit `f93a8bc` (que había hecho ambas fotos
obligatorias en el andén). La firma sí se mantiene obligatoria.

## Cambios

- `src/app/register/route/anden/[slot]/register-route-slot-client.tsx`:
  `canSaveAnden` ya no exige `hasDirtyPhoto`/`hasCleanPhoto`; `missingToSave`
  pierde las entradas de fotos.
- `src/app/register/route/morgue/page.tsx`: `canFinish` deja de exigir
  `dirtyPhotos.length > 0` (antes limpios ya era opcional; ahora sucios también).
- `src/components/register/route-form.tsx`: el asterisco de "requerido" de cada
  foto se vuelve configurable con dos props nuevas `dirtyPhotoRequired` /
  `cleanPhotoRequired` (default `true` para no alterar otros usos). Andén y
  morgue las pasan en `false` para no mentirle al operador.

## Verificación

- `jest`: 151/151.
- `next build`: OK.
- Pendiente: E2E manual en dispositivo (guardar andén sin tachos limpios).
