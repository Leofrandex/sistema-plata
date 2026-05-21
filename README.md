# Hospiwaste — Sistema de Trazabilidad de Desechos Clínicos

Aplicación web para gestionar el ciclo completo de manejo de desechos clínicos:
recorridos en planta del cliente, pesaje, almacenamiento, tratamiento y
traslado externo.

> **Estado:** preparación piloto 2026-05-21, lanzamiento 2026-06-01.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind 3** + shadcn (CSS variables) + @base-ui/react
- **Zustand** para estado local; mocks como capa de transición
- **Supabase** (Postgres 17, Auth, Storage) — `@supabase/ssr`
- **PWA** vía `next-pwa`
- **PDF** vía `@react-pdf/renderer`
- **Tests:** Vitest (design system) + Jest (lógica)

Más detalle en [`vault/project/Architecture.md`](vault/project/Architecture.md).

## Desarrollo local

```bash
cp .env.local.example .env.local   # rellenar con tus keys de Supabase
npm install
npm run dev
```

Abre <http://localhost:3000>. Sin sesión, el middleware redirige a `/login`.

### Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server con HMR |
| `npm run build` | Build de producción (Webpack) |
| `npm run start` | Servir el build |
| `npm run lint` | ESLint |
| `npm run test:run` | Vitest (one-shot, design system) |
| `npm run test:jest` | Jest (lógica de negocio) |

## Variables de entorno

Ver [`.env.local.example`](.env.local.example). Las dos requeridas:

| Variable | Origen |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → publishable (`sb_publishable_...`) |

> El `service_role` key **nunca** se pone en `NEXT_PUBLIC_*`.

## Deploy en Vercel

1. **Importar el repo** en <https://vercel.com/new> (selecciona este repositorio de GitHub).
2. **Framework Preset:** Next.js (autodetecta).
3. **Environment Variables** (Production + Preview + Development):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
4. **Deploy**. La primera build tarda ~2 min.
5. **Supabase → Authentication → URL Configuration:** agregar el dominio de
   Vercel (`https://<tu-app>.vercel.app`) a:
   - **Site URL**
   - **Redirect URLs** (`https://<tu-app>.vercel.app/**`)

   Sin esto, los emails de recuperación/confirmación rebotan.

## Base de datos (Supabase)

Schema y RLS viven en [`supabase/migrations/`](supabase/migrations/) — orden
cronológico por nombre. Para reset local con el CLI:

```bash
supabase db reset
```

Decisiones de diseño: [`vault/decisions/2026-05-21-supabase-integracion.md`](vault/decisions/2026-05-21-supabase-integracion.md).

## Estructura

```
src/
  app/                Next.js App Router (pages + route handlers)
  components/
    ui/               primitivos shadcn (button, card, table, …)
    layout/           sidebar, mobile-header, bottom-nav, sync-indicator
    register/         forms de recorrido / pesaje
  hooks/              custom hooks (useElapsed, etc.)
  lib/
    supabase/         clients browser + server + middleware + queries tipadas
    data/             helpers de derivación (computeContainerPhase, …)
    types.ts          interfaces de dominio
    store.ts          Zustand store (transicionando a Supabase)
    mock-data.ts      datos de prueba (transicionando)
supabase/migrations/  SQL versionado
vault/                conocimiento del proyecto (Obsidian)
docs/superpowers/     planes de implementación
scripts/              extractores y seeds (Python)
```

## Documentación viva

El **vault** (`vault/`) es la fuente de verdad sobre negocio, decisiones y
estado del proyecto. Empezar por [`vault/_index.md`](vault/_index.md).
