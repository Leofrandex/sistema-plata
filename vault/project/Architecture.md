---
title: Architecture
tags:
  - project
  - architecture
  - tech
updated: 2026-09-14
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

Monorepo de npm workspaces desde el 2026-07-22 — ver [[2026-07-22-separacion-hub-app]]:

| Paquete | Para quién | Qué contiene |
|---|---|---|
| `hub/` | coordinadores (web) | Dashboard, Tachos, Equipos, Historial, Reportes, Admin |
| `app/` | operadores (APK Android) | Home, Recorrido, Pesaje, Tratamiento, Traslado. `android/` vive acá |
| `shared/` | ambos | `@hospiwaste/shared`: store, types, Supabase, offline/outbox, UI base |

> [!info] El árbol de carpetas no se documenta acá
> Se deriva del código con graphify — ver [[CodeMap]]. Esta tabla existe solo para
> explicar **por qué** hay tres paquetes y quién usa cada uno; la estructura interna
> cambia sola y documentarla la deja mintiendo.

## Patrones y convenciones

- **CSS variables en `globals.css`** — todos los tokens de color/radio siguen el patrón shadcn (`--primary`, `--background`, etc.)
- **Tailwind** para estilos de componentes — no CSS plano
- **CVA** para variantes de componentes (`buttonVariants`, etc.)
- **`cn()`** de `@/lib/utils` para combinar clases con tailwind-merge
- **App Router** — rutas como carpetas en `src/app/`
- **`next/font/google`** para fuentes — se declaran en `layout.tsx`
- **Plugins de Capacitor: nunca devolverlos desde una función `async`** — el proxy del
  plugin responde con una función a cualquier propiedad, `then` incluida, así que el
  objeto es *thenable* y el `await` no resuelve jamás. Envolverlo siempre
  (`return { p: Plugin }`). Los mocks de plugins en tests deben ser `Proxy`, no objetos
  literales: un mock plano no reproduce el fallo. Ver [[2026-08-25-fix-sesion-apk-preferences-sqlite]]
- **SQLite nativo: `query()` para toda sentencia que devuelva filas** — incluidos los
  PRAGMA con valor de retorno. `execute()` va a `execSQL()` de Android, que las rechaza
- **Distribución del APK: siempre el build de `release/`** — el de `debug/` lleva la llave
  genérica de Android y cambiar de llave impide actualizar sobre lo instalado. Subir
  `versionCode` en cada build. Ver [[2026-08-25-instalacion-apk-firma-debug-vs-release]]

## Integraciones externas

### Supabase

- **Proyecto:** `hospiwaste` (org Oito) — ref `xqqnthyipkdkwyknbtnw`
- **URL:** `https://xqqnthyipkdkwyknbtnw.supabase.co`
- **Región:** us-east-2
- **Plan:** Free
- **Migrations locales:** `supabase/migrations/`
- **Tipos generados:** `shared/src/lib/supabase/database.types.ts`
- **Clientes:** `shared/src/lib/supabase/{client,server,middleware}.ts`
- **Middleware Next.js:** cada app tiene el suyo; refresca cookies de sesión en cada request.
- **Variables de entorno:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ver `.env.local.example`).

**Decisiones clave:** ver [[2026-05-21-supabase-integracion]].

## Dependencias principales

Ver `package.json` en la raíz del proyecto.
