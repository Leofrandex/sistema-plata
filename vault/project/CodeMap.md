---
title: Mapa del código (graphify)
tags:
  - project
  - meta
  - tooling
updated: 2026-09-14
---

# Mapa del código

La estructura del código **no se documenta en el vault**. Se deriva del código con
[graphify](https://github.com/Graphify-Labs/graphify) y vive en `graphify-out/`, fuera
del vault y fuera de git.

Esta nota explica dónde está y cómo consultarlo. Es el único puente entre el vault y el
grafo; ver [[2026-09-14-vault-solo-md-y-grafo-de-codigo]] para el porqué.

## Regenerar

```bash
python -m graphify update .        # ~40 s, sin LLM, sin API key, costo cero
```

Extracción puramente estructural (tree-sitter sobre el AST). El reporte anota el commit
desde el que se construyó; si `git rev-parse HEAD` no coincide, el grafo está viejo.

## Qué cubre

Un solo grafo con los tres workspaces unidos, así que las aristas `app → shared` y
`hub → shared` son visibles. Alcance definido en `.graphifyignore` (raíz del repo):
entra `hub/`, `app/` (incluido el Kotlin de `android/`), `shared/`, `supabase/` y
`scripts/`; quedan fuera el vault, `docs/`, los assets y los artefactos de build.

## Cómo consultarlo

| Para | Comando o archivo |
|---|---|
| Entender un símbolo y sus vecinos | `python -m graphify explain "getLocalStore()"` |
| Trazar cómo se conectan dos cosas | `python -m graphify path "SyncEngine" "LocalStore"` |
| Preguntar en lenguaje natural | `python -m graphify query "¿cómo drena el outbox?"` |
| Panorama escrito | `graphify-out/GRAPH_REPORT.md` |
| Explorar visualmente | `graphify-out/graph.html` |
| Artículos por comunidad | `graphify-out/wiki/index.md` |

`query` recorre el grafo y devuelve solo los nodos relevantes en vez de leer los archivos
crudos — es la razón principal de tenerlo.

## Qué NO hace

- **No reemplaza al vault.** El grafo dice qué llama a qué; no dice por qué se decidió así.
  Ese *por qué* vive en `decisions/` y en `logs/`, y no es derivable del código.
- **No se versiona.** Es derivado. Si alguien clona el repo, lo regenera.
- **No entra al vault como notas.** El export a vault de Obsidian existe
  (`export obsidian`), pero produce ~1750 notas contra las 71 escritas a mano: ahogaría
  la búsqueda y el grafo de Obsidian. Se descartó a propósito.

## Limitaciones conocidas

- Los tres `build.gradle` de `app/android/` no se extraen (el parser de Groovy falla en
  la sintaxis que genera Capacitor). No importa: son generados, no se editan a mano.
- `shared/src/styles/tokens.css` se omite porque el filtro de secretos de graphify ve la
  palabra "token". Falso positivo; son tokens de diseño, y graphify no extrae CSS igual.
- 25 archivos sin extractor (XML de Android, `.env.example`) no aparecen en el grafo.
