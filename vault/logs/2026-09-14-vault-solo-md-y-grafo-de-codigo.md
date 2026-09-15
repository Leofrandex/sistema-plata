---
title: Vault solo-markdown + grafo de código con graphify
tags:
  - log
  - vault
  - tooling
date: 2026-09-14
---

# 2026-09-14 — El vault se queda con la memoria, el código se mapea aparte

Dos cambios que van juntos: el vault se limpia hasta quedar 100 % markdown escrito a mano,
y todo lo que era estructura de código sale de él hacia un grafo derivado.

## El problema

El vault mezclaba dos cosas con vidas distintas. Por un lado memoria real —12 ADRs,
46 logs, los procesos de negocio— que no se puede regenerar. Por otro, descripciones de
estructura de código que se pudren solas: el árbol de carpetas de [[Architecture]] seguía
mostrando el `src/` anterior al monorepo, obsoleto desde el 2026-07-22, y las carpetas
`types/` y `components/` llevaban desde mayo existiendo vacías porque documentar tipos a
mano nunca se sostuvo.

Síntoma medible: 53 wikilinks repartidos en 76 notas, y 38 notas sin un solo enlace.
El grafo de Obsidian era una nube de puntos aislados. Las referencias entre notas estaban
escritas como texto con backticks (`` `logs/2026-xx.md` ``), que no enlaza nada.

## Qué se hizo en el vault

- **Credenciales fuera del repo.** `credenciales/` y `secrets/` a
  `Documents\Hospitalar\_hospiwaste-secretos\`. Ya estaban en `.gitignore` y nunca
  llegaron al historial de git — se verificó antes de mover.
- **Carpetas eliminadas:** `types/` y `components/` (vacías), `modules/`
  (`EquipmentMaintenance` pasó a `processes/`, que es donde vive una regla de negocio),
  y dos README que duplicaban `CLAUDE.md` o se contradecían con su propio contenido.
- **Binarios a `docs/fuentes/`:** los dos Excel y el JSON de branding. El vault quedó en
  71 archivos, todos `.md`.
- **78 referencias de texto convertidas a wikilinks.** Las rutas de código siguen como
  backticks, según la convención de `CLAUDE.md`. Resultado: 203 wikilinks, 0 muertos,
  0 notas huérfanas.
- **`_index.md` de 373 a 158 líneas.** Se eliminó "Notas del último procesamiento", unas
  200 líneas que repetían palabra por palabra lo que ya decían los logs. Quedó una tabla
  de pendientes abiertos con su origen enlazado.

Hallazgos al limpiar: el índice decía APK v1.5 cuando los logs ya decían v1.6 compilado;
el Roadmap daba por abierto el P1 de la cola de pesaje, resuelto el 2026-07-28; y
[[Overview]] listaba "próximas reuniones" de mayo y decía que los cronómetros persisten en
IndexedDB, superado por SQLite desde [[2026-07-23-offline-sqlite-local-first]].

## Qué se hizo con el código

[graphify](https://github.com/Graphify-Labs/graphify) construye el grafo por AST con
tree-sitter: sin LLM, sin API key, ~40 s. Un solo grafo con los tres workspaces unidos,
para que las aristas `app → shared` y `hub → shared` sean visibles.

**1750 nodos · 4059 aristas · 158 comunidades · 99 % EXTRACTED · 0 ciclos de import.**
God nodes: `cn()` 90, `createClient()` 69, `unwrap()` 62, `useStore` 49,
`getLocalStore()` 40.

Alcance en `.graphifyignore`. Salida en `graphify-out/`, ignorada por git: pesa 2,3 MB
solo `graph.json`, cambia en cada commit y se regenera gratis. Uso y limitaciones en
[[CodeMap]].

## Decisiones

- **El export a vault de Obsidian se descartó.** Funciona y respeta las notas propias
  (lleva manifiesto), pero produce ~1750 notas contra las 71 escritas a mano: el vault
  quedaría 96 % generado y la búsqueda inservible. El puente es [[CodeMap]], una nota, no
  un volcado.
- **El grafo no se versiona.** Es derivado del código; committearlo es guardar el mismo
  dato dos veces y garantizar que una copia mienta.
- **Las migraciones SQL sí entran.** La primera pasada las ignoró en silencio por falta
  de `tree-sitter-sql`; con el extractor instalado el esquema inicial aparece como
  comunidad propia (35 nodos). Sin él se perdía el modelo de datos entero.

## Pendiente

- Correr `graphify install` para exponerlo como skill `/graphify` en Claude Code.
- Evaluar el hook de git que regenera el grafo en cada commit.
