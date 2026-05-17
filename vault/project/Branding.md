---
title: Branding — Sistema de Diseño Hospimed
tags:
  - project
  - branding
  - design-system
updated: 2026-05-03
---

# Branding — Sistema de Diseño Hospimed

Fuente: `vault/inbox/branding.json` extraído del sitio hospimed.com.pa (confianza 0.925).  
**Personalidad:** profesional, energía media, audiencia: profesionales médicos e instituciones de salud.

---

## Colores

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-primary` | `#0B1A48` | Azul navy oscuro — identidad principal, fondos de encabezados |
| `--color-secondary` | `#4656A4` | Azul medio — elementos secundarios, hover states |
| `--color-accent` | `#2A27E9` | Azul/violeta vibrante — CTAs, links, texto destacado |
| `--color-background` | `#F7F7F7` | Fondo general de la app |
| `--color-text-primary` | `#2A27E9` | Color de texto principal (mismo que accent) |
| `--color-link` | `#2A27E9` | Links |

### Colores de componentes adicionales

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-input-bg` | `#FFFFFF` | Fondo de inputs |
| `--color-input-text` | `#686868` | Texto placeholder/valor en inputs |
| `--color-input-border` | `#E7E7E7` | Borde de inputs |
| `--color-btn-secondary-bg` | `#E4F0F8` | Fondo botón secundario |
| `--color-btn-secondary-text` | `#4C4D52` | Texto botón secundario |

### Modo de color

Esquema **light** únicamente (dark mode no definido).

> **Confirmado 2026-05-03:** `#2A27E9` aplica solo a elementos de acento (links, labels destacados). El cuerpo de texto usa `#0B1A48` (primary navy).

---

## Tipografía

**Fuente principal:** Plus Jakarta Sans (heading + body)  
**Fallback stack:** `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen-Sans, Ubuntu, Cantarell, Helvetica Neue, sans-serif`

| Rol | Familia |
|-----|---------|
| Heading | Plus Jakarta Sans |
| Body | Plus Jakarta Sans |
| Párrafo | Plus Jakarta Sans |

### Escalas tipográficas (origen: sitio web de marketing)

| Elemento | Tamaño |
|----------|--------|
| h1 | 16px |
| h2 | 42px |
| body | 14px |

> [!warning] ESCALA TIPOGRÁFICA IRREGULAR
> **Fecha:** 2026-05-03
> **Problema:** `h1 = 16px` y `h2 = 42px` proviene del sitio de marketing donde `<h1>` puede ser un label pequeño (SEO/accesibilidad semántica) mientras `<h2>` es el título visual grande. Para una app web interna esta escala no aplica directamente.
> **Acción requerida:** Definir escala tipográfica apropiada para la interfaz del sistema. Sugerencia: usar `h2 = 42px` como referencia para títulos de página hero, y construir la escala hacia abajo (32, 24, 20, 16, 14, 12).

---

## Espaciado y forma

| Token | Valor |
|-------|-------|
| `--spacing-unit` | 4px |
| `--border-radius` | 4px |

---

## Componentes base

### Input

```
background:    #FFFFFF
text:          #686868
border:        1px solid #E7E7E7
border-radius: 8px
box-shadow:    none
```

### Botón primario

```
background:    #2A27E9
text:          #FFFFFF
border-radius: 8px
box-shadow:    none
```

### Botón secundario

```
background:    #E4F0F8
text:          #4C4D52
border-radius: 0px   ← sin redondeo
box-shadow:    none
```

> **Confirmado 2026-05-03:** Ambos botones (primary y secondary) usan `border-radius: 8px`.

---

## Imágenes y assets

| Asset | URL |
|-------|-----|
| Logo | `https://hospimed.com.pa/wp-content/uploads/2025/04/hospimed-equipos-medicos.png` |
| Favicon | `https://hospimed.com.pa/wp-content/uploads/2025/04/hospimed-1-75x75.png` |
| Logo alt text | "Hospimed Equipos Médicos" |
| Logo href | `https://hospimed.com.pa` |

> [!warning] LOGO PENDIENTE
> **Fecha:** 2026-05-03
> **Problema:** Sebastian no tiene el archivo de logo en alta resolución aún. El favicon está disponible en la URL del sitio.
> **Acción requerida:** Sebastian debe proveer el archivo de logo (PNG o SVG). Mientras tanto, el Task 2 del plan descarga la versión del sitio web como placeholder.

---

## Sistema de diseño

- **Framework:** Custom (no se usa una librería de componentes predefinida como Material UI o Ant Design)
- **Librería de componentes:** Por definir

---

## Tokens CSS sugeridos (implementación)

```css
:root {
  /* Colores */
  --color-primary:          #0B1A48;
  --color-secondary:        #4656A4;
  --color-accent:           #2A27E9;
  --color-background:       #F7F7F7;
  --color-text-primary:     #2A27E9;  /* ⚠️ pendiente de confirmar */
  --color-link:             #2A27E9;
  --color-input-bg:         #FFFFFF;
  --color-input-text:       #686868;
  --color-input-border:     #E7E7E7;
  --color-btn-secondary-bg: #E4F0F8;
  --color-btn-secondary-text: #4C4D52;

  /* Tipografía */
  --font-family-base: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont,
    "Segoe UI", Roboto, "Helvetica Neue", sans-serif;

  /* Espaciado */
  --spacing-unit:    4px;
  --border-radius:   4px;
  --border-radius-component: 8px;
}
```
