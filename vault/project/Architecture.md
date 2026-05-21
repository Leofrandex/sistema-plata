---
title: Architecture
tags:
  - project
  - architecture
  - tech
updated: 2026-05-21
---

# Arquitectura del Sistema

## Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.4 |
| UI runtime | React | 19.2.4 |
| Estilos | Tailwind CSS | 3.x |
| Sistema de diseño | shadcn (CSS variables) + @base-ui/react | — |
| Variants | class-variance-authority (CVA) | 0.7.x |
| Utils CSS | clsx + tailwind-merge | — |
| Estado global | Zustand | 5.x |
| PDF | @react-pdf/renderer | 4.x |
| PWA | next-pwa | 5.x |
| Íconos | lucide-react | 1.x |
| Tests | Vitest (design system) + Jest (lógica) | — |
| Backend / BD | Supabase (Postgres 17) | — |
| Auth | Supabase Auth (email/password) | — |
| Storage | Supabase Storage (bucket `photos`, privado) | — |
| Cliente Supabase | @supabase/supabase-js + @supabase/ssr | — |

## Estructura de carpetas

```
src/
  app/                 ← App Router — páginas y layout raíz
    globals.css        ← CSS variables del design system (colores, radius, fuente)
    layout.tsx         ← Layout raíz con fuente y componentes shell
    [módulos]/         ← containers, batches, dashboard, admin, login, register
  components/
    ui/                ← Componentes base (button, input, card, table, etc.)
    layout/            ← sidebar, mobile-header, sync-indicator
  hooks/               ← Custom hooks
  lib/                 ← Utilidades (cn, etc.)
  __tests__/           ← Tests Jest de lógica de negocio
```

## Patrones y convenciones

- **CSS variables en `globals.css`** — todos los tokens de color/radio siguen el patrón shadcn (`--primary`, `--background`, etc.)
- **Tailwind** para estilos de componentes — no CSS plano
- **CVA** para variantes de componentes (`buttonVariants`, etc.)
- **`cn()`** de `@/lib/utils` para combinar clases con tailwind-merge
- **App Router** — rutas como carpetas en `src/app/`
- **`next/font/google`** para fuentes — se declaran en `layout.tsx`

## Integraciones externas

### Supabase

- **Proyecto:** `hospiwaste` (org Oito) — ref `xqqnthyipkdkwyknbtnw`
- **URL:** `https://xqqnthyipkdkwyknbtnw.supabase.co`
- **Región:** us-east-2
- **Plan:** Free
- **Migrations locales:** `supabase/migrations/`
- **Tipos generados:** `src/lib/supabase/database.types.ts`
- **Clientes:** `src/lib/supabase/{client,server,middleware}.ts`
- **Middleware Next.js:** `src/middleware.ts` refresca cookies de sesión en cada request.
- **Variables de entorno:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ver `.env.local.example`).

**Decisiones clave:** ver `decisions/2026-05-21-supabase-integracion.md`.

## Dependencias principales

Ver `package.json` en la raíz del proyecto.
