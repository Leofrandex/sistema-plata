---
title: IDs de tachos — Supabase (numérico) vs mock offline (prefijo A-)
tags:
  - decision
  - adr
  - tachos
  - supabase
  - datos
updated: 2026-06-01
---

# ADR 2026-06-01 — Convención de IDs de tachos: Supabase ≠ mock offline

> [!warning] INCOHERENCIA DETECTADA Y RESUELTA
> **Fecha:** 2026-06-01
> **Problema:** la migración de seed `20260601000100_seed_yaris_metallic_containers.sql`
> marcaba los Yaris usando IDs con prefijo `A-` (`A-020`…`A-187`), pero la base de
> datos de Supabase del piloto guarda los tachos con **IDs numéricos zero-padded sin
> prefijo** (`020`, `042`, …). Resultado: el `update` de Yaris afectó **0 filas** al
> correr contra Supabase, y los 17 Yaris quedaron sin marcar.
> **Acción tomada:** se corrigió el seed para usar los IDs sin prefijo y se marcaron
> los 17 Yaris en la DB. Migración corregida en el commit `8259af6`.

## Contexto

Existen **dos fuentes de datos de tachos con convenciones de ID distintas**:

| Fuente | Convención de ID | Ejemplo |
|--------|------------------|---------|
| **Supabase** (DB del piloto, `xqqnthyipkdkwyknbtnw`) | numérico zero-padded, **sin prefijo** | `001`, `020`, `187`, `M1`…`M15` |
| **Mock offline** (`src/lib/mock-data.ts`, `src/lib/data/containers.ts`) | con **prefijo de empresa** | `A-001`, `A-020`, `I-001` |

El `Roadmap` documentaba la intención de numerar con prefijo de empresa (`I-001`, `A-001`),
pero la carga real de los 189 tachos Airkem en Supabase se hizo con IDs numéricos pelados.

## Decisión

- **Las migraciones y cualquier SQL que referencie IDs de tachos deben usar la convención
  de Supabase: numérico zero-padded sin prefijo** (`020`, no `A-020`).
- El prefijo `A-`/`I-` es solo una convención de presentación/mock; **no** existe en la DB.
- Yaris dedicados (17): `020, 042, 044, 046, 048, 051, 064, 065, 068, 069, 072, 076, 078,
  105, 154, 175, 187`.
- Tachos metálicos (15): `M1`…`M15` (esos sí conservan su ID literal en ambas fuentes).

## Cómo evitar que se repita

Antes de escribir un seed/update por ID contra Supabase, verificar el formato real:
```sql
select id from public.containers where id not like 'M%' order by id limit 5;
-- debe devolver '001','002',... (sin prefijo)
```

Relacionado: [[2026-06-01-tachos-metalicos]], [[DataModel]].
