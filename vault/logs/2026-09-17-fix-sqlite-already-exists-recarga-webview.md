---
title: Fix — "CreateConexion: Conexion Hospiwaste already exists" tras tomar fotos en pesaje
tags:
  - log
  - fix
  - sqlite
  - apk
  - offline
  - camera
updated: 2026-09-17
---

# 2026-09-17 — Fix: SQLite "Connection already exists" por desincronización tras fotos de pesaje

## Cómo se detectó

En producción, un operador intentó registrar un lote de 4 tachos y 2 Yaris (`178`, `191`, `029`, `131`, `Y17`, `Y13`). Tras tomar las fotos del último tacho:
1. En pantalla desaparecieron los primeros 5 tachos y solo se mostraba el último (`Y13`).
2. Apareció el banner ámbar: *"Sin conexión con el servidor: CreateConexion: Conexion Hospiwaste already exists"*.
3. La lista mostraba una píldora roja: *"9 elementos rechazados — revisar"*.
4. A pesar del mensaje en pantalla, los 6 pesajes sí llegaron completos a Supabase con sus 12 fotos.

## Diagnóstico

### Causa raíz — Presión de RAM por la cámara y desincronización de CapacitorSQLite

1. **Recarga del WebView por memoria:** Al abrir la cámara nativa para fotografiar los tachos, el sistema operativo Android sufre presión de memoria RAM y recarga la capa web (WebView). El proceso nativo de Android permanece vivo.
2. **Desincronización JS vs Nativo:** En `@capacitor-community/sqlite`, el método `isConnection()` solo inspecciona un diccionario interno en memoria JavaScript (`this._connectionDict`). Al recargar el WebView, ese diccionario se inicializa vacío, por lo que `isConnection(DB_FILE, false)` devuelve `false`.
3. **Colisión en Java:** En el proceso nativo de Java (`CapacitorSQLite.java`), la base de datos `RW_hospiwaste` seguía abierta en `dbDict`. Cuando JS intentó ejecutar `createConnection(DB_FILE, ...)`, Java lanzó la excepción:
   `CreateConexion: Conexion Hospiwaste already exists`.
4. **Efecto dominó en SupabaseHydrator:**
   * `SupabaseHydrator` invoca `getLocalStore()` durante el arranque/reintento.
   * La promesa de `getLocalStore()` fue rechazada con el error de conexión.
   * `SupabaseHydrator` capturó el error y marcó `connectionStatus: 'error'`.
   * El banner hardcodeado `ConnectionBanner` mostró *"Sin conexión con el servidor"* y abajo el error real `CreateConexion: Conexion Hospiwaste already exists`.
   * La app quedó sin acceso al almacén local SQLite, por lo que no pudo recuperar los tachos guardados localmente; solo mantenía en memoria el tacho recién manipulado (`Y13`).
   * Los reintentos del outbox fallaron contra el store caído, marcando localmente los registros con error.

## Solución implementada

En `shared/src/lib/local-store/sqlite-store.ts` (commit `e88f2c4`):
1. **Reconciliación nativa:** Se invoca `sqlite.checkConnectionsConsistency()` antes de evaluar la existencia de la conexión para sincronizar el estado entre Java y JS.
2. **Manejo de desconexión huérfana:** Si `createConnection()` lanza un error con `/already exists/i`, se captura, se fuerza el cierre nativo con `sqlite.closeConnection(DB_FILE, false)` y se vuelve a crear la conexión limpiamente de inmediato.
3. **Mutex de inicialización:** Se encapsuló la apertura en `initPromise` para serializar llamadas concurrentes a `db()` y evitar carreras de apertura.

## Verificación

* Test unitario agregado en `shared/src/__tests__/lib/local-store/get-local-store-native.test.ts`: simula que el JS no detecta la conexión pero el nativo lanza `already exists`, verificando que el store cierra la conexión y la recrea con éxito.
* 32 suites pasadas en `@hospiwaste/shared` (218 tests).
* 13 suites pasadas en `@hospiwaste/app` (42 tests).
