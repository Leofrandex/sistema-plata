---
title: Lote post-lanzamiento — fotos de recorrido, persistencia cross-device, traza de usuario
tags:
  - log
  - recorrido
  - pesaje
  - supabase
  - fotos
  - hidratacion
  - traza
fecha: 2026-06-10
updated: 2026-06-11
---

# Log 2026-06-10/11 — Fotos de recorrido + persistencia cross-device + traza

Lote de correcciones y mejoras detectadas en operación real tras el lanzamiento
(2026-06-01). Spec: `docs/superpowers/specs/2026-06-10-recorrido-fotos-persistencia-traza-design.md`.
Plan: `docs/superpowers/plans/2026-06-10-recorrido-fotos-persistencia-traza.md`.
Rama: `feat/lote-fotos-persistencia-traza`.

## Causa raíz común (lo más importante)

Varios síntomas (tratamiento invisible en otro dispositivo, gráfico "kg del día" sin
actualizar) tenían **la misma causa**: el store solo hidrataba desde Supabase
`{containers, weighingSessions, receptions, routeEvents, photos}`. `storageEvents`,
`treatmentRuns`, `externalTransfers` y `locations` **se quedaban en datos MOCK** y nunca
se refrescaban. Además, al finalizar pesaje, el `StorageEvent` y la `ContainerLocation`
se escribían **solo al store local** (`addStorageEvent`/`addLocation` con ids falsos),
nunca a Supabase — por eso `storage_events` y `container_locations` tenían 0 filas.

Resultado: el dispositivo que pesaba veía el tacho en `cold_storage` (evento local), pero
cualquier otro dispositivo (o el mismo tras refrescar) re-hidrataba sin esos eventos → el
tacho quedaba atascado en `weighing` y nunca aparecía en tratamiento.

## Cambios por grupo

1. **Persistencia + hidratación completas (backbone).**
   - Nuevas queries `createStorageEvent`, `listStorageEvents`, `createContainerLocation`,
     `listContainerLocations`, `listExternalTransfers` (`queries/storage.ts`) y
     `listTreatmentRuns` (`queries/treatment.ts`).
   - `SupabaseHydrator` ahora carga y mapea `storage_events`, `treatment_runs`,
     `external_transfers`, `container_locations` (adaptadores `rowTo*` exportados +
     testeados). El `hydrate()` ya las reemplaza.
   - Pesaje (`handleFinish`) y Tratamiento (`handleSubmit`) ahora **persisten** los
     storage_events / container_locations a Supabase con su id real (write-through).
   - Esto arregla tratamiento cross-device **y** el gráfico kg/día (procesado venía de
     `treatmentRuns` no hidratados).

2. **Fotos de recorrido por categoría.**
   - Migración `photos.role text` (dirty|clean; null para pesaje y resto). Aditiva.
   - `RouteForm`: dos secciones, **sucios primero, limpios después**, varias fotos por
     categoría. Al editar un andén se muestran las fotos ya cargadas (antes parecían
     perderse: el form ponía `photos: []` y no las mostraba) y se pueden quitar.
   - Andén: exige **al menos una foto de sucios y una de limpios** para guardar.
   - Hidratación reconstruye `dirty_photo_ids`/`clean_photo_ids` por `role`; `photo_ids`
     queda como la unión (lo usan los reportes).
   - Morgue: alineada al nuevo estado; **exige foto de sucios**, limpios opcional
     (divergencia documentada — morgue recoge sucios).

3. **Anti doble-submit en andén.** El botón "Guardar andén" no se bloqueaba durante el
   guardado async → un doble-tap creaba dos `route_events` idénticos (caso real:
   001/055/185 duplicados con 2.6 s de diferencia el 2026-06-10). Se agregó guard `saving`.
   Se **borró** el duplicado existente en producción (`a9c4e57a`).

4. **Traza de usuario en tachos.** Migración `containers.created_by uuid` (nullable;
   históricos quedan null). Se puebla al crear un tacho y se muestra "Registrado por" en
   el admin. Los perfiles se hidratan a `store.users` para resolver el nombre.

5. **Limpieza de schema.** Drop de `route_events.floor` y `route_events.dock` (columnas
   muertas, siempre `""`). La ubicación del recorrido vive en `area`. Se quitaron de
   tipos, hydrator, form, páginas, tests y mocks.

## Migraciones aplicadas (producción piloto `xqqnthyipkdkwyknbtnw`)

- `20260610010000_photos_role.sql` — add `photos.role`.
- `20260610020000_containers_created_by.sql` — add `containers.created_by`.
- `20260610030000_route_events_drop_floor_dock.sql` — drop floor/dock.

## Decisión de fase reafirmada

Los **eventos siguen siendo la fuente de verdad** (no se agregó columna `current_phase`).
El bug cross-device NO era del modelo derivado sino de persistencia/hidratación incompleta.
Próximo paso de escala = **vista de Postgres** (no la columna cacheada). Ver ADR
`decisions/2026-05-21-estado-envase-derivado.md`.

## Estado de tablas

- `storage_events`, `container_locations`: **ahora se persisten** (antes 0 filas por el bug).
- `client_locations`, `external_transfers`: siguen **sin cablear** (no obsoletas:
  `external_transfers` espera la pantalla de traslado "en construcción").

## Verificación

- `npm run test:jest`: 17 suites / 81 tests verdes.
- `npm run build`: OK.
- Pendiente E2E manual cross-device (pesar en A → ver tratamiento en B; editar andén y
  ver fotos; crear tacho y ver "registrado por").
