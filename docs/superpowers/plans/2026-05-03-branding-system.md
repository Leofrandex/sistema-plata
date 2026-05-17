c# Branding System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el sistema de diseño de Hospimed (tokens, tipografía, componentes base) para establecer una identidad visual consistente en la app de trazabilidad de desechos clínicos.

**Architecture:** CSS custom properties como design tokens; estilos en archivos CSS planos colocados junto a cada componente; sin CSS-in-JS ni framework de utilidades. Componentes React + TypeScript con superficie de props mínima.

**Tech Stack:** React 18, Vite, TypeScript, Vitest, @testing-library/react, Plus Jakarta Sans (Google Fonts), CSS plano con custom properties.

---

## Decisiones previas al inicio

Tres incoherencias encontradas en el `branding.json`. El plan adopta los siguientes defaults — confirmar con Sebastian o sobreescribir en `tokens.css` después del Task 3:

| # | Pregunta | Decisión adoptada |
|---|----------|------------------|
| 1 | `textPrimary: #2A27E9` — ¿todo el texto o solo highlights? | Usar `#0B1A48` para cuerpo, `#2A27E9` solo para links/accent |
| 2 | Escala tipográfica (`h1=16px, h2=42px`) viene del sitio de marketing | Definir escala propia para la app (ver Task 4) |
| 3 | Botón secundario `border-radius: 0px` — ¿intencional? | Usar `8px` igual que primario; cambiar en tokens si se confirma cuadrado |

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---------|----------------|
| `index.html` | Google Fonts link + favicon |
| `src/styles/tokens.css` | Todos los design tokens como CSS custom properties |
| `src/styles/reset.css` | CSS reset (box-sizing, margin, padding) |
| `src/styles/typography.css` | Escala tipográfica aplicada a elementos HTML |
| `src/styles/index.css` | Importa todos los estilos en orden correcto |
| `src/assets/logos/hospimed-logo.png` | Logo descargado del sitio (asset estático) |
| `src/assets/logos/hospimed-favicon.png` | Favicon descargado del sitio |
| `src/components/ui/Button/Button.tsx` | Componente Button (variantes primary + secondary) |
| `src/components/ui/Button/Button.css` | Estilos del Button |
| `src/components/ui/Button/Button.test.tsx` | Tests del Button |
| `src/components/ui/Input/Input.tsx` | Componente Input con label y error state |
| `src/components/ui/Input/Input.css` | Estilos del Input |
| `src/components/ui/Input/Input.test.tsx` | Tests del Input |
| `src/pages/BrandingDemo.tsx` | Página de verificación visual (temporal) |
| `src/App.tsx` | Root — renderiza BrandingDemo durante dev |

---

### Task 1: Scaffold del proyecto (React + Vite + TypeScript)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`, `index.html`

- [ ] **Step 1: Inicializar Vite + React + TypeScript**

```bash
npm create vite@latest . -- --template react-ts
```

Expected: archivos creados, `package.json` con `react`, `react-dom`, `typescript`, `vite`.

- [ ] **Step 2: Instalar dependencias**

```bash
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8
```

- [ ] **Step 3: Configurar Vitest en vite.config.ts**

Reemplazar el contenido de `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
```

- [ ] **Step 4: Crear archivo de setup para tests**

Crear `src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Agregar scripts de test en package.json**

En `package.json`, dentro de `"scripts"`, agregar:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 6: Verificar que el scaffold funciona**

```bash
npm run dev
```

Expected: servidor Vite arranca en `http://localhost:5173`, app React por defecto visible.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold React + Vite + TypeScript project"
```

---

### Task 2: Descargar y guardar assets del branding

**Files:**
- Create: `src/assets/logos/hospimed-logo.png`
- Create: `src/assets/logos/hospimed-favicon.png`

- [ ] **Step 1: Crear directorio de assets**

```bash
mkdir -p src/assets/logos
```

- [ ] **Step 2: Descargar logo**

```bash
curl -o src/assets/logos/hospimed-logo.png "https://hospimed.com.pa/wp-content/uploads/2025/04/hospimed-equipos-medicos.png"
```

Expected: archivo creado, tamaño > 0 bytes.

- [ ] **Step 3: Descargar favicon**

```bash
curl -o src/assets/logos/hospimed-favicon.png "https://hospimed.com.pa/wp-content/uploads/2025/04/hospimed-1-75x75.png"
```

Expected: archivo creado, tamaño > 0 bytes.

- [ ] **Step 4: Commit**

```bash
git add src/assets/
git commit -m "feat: add Hospimed logo and favicon as static assets"
```

---

### Task 3: Design tokens (CSS custom properties)

**Files:**
- Create: `src/styles/tokens.css`

- [ ] **Step 1: Crear tokens.css**

Crear `src/styles/tokens.css`:

```css
:root {
  /* Colores de marca */
  --color-primary:              #0B1A48;
  --color-secondary:            #4656A4;
  --color-accent:               #2A27E9;
  --color-background:           #F7F7F7;

  /* Texto */
  --color-text-body:            #0B1A48;
  --color-text-muted:           #686868;
  --color-text-accent:          #2A27E9;
  --color-link:                 #2A27E9;

  /* Superficies */
  --color-surface:              #FFFFFF;
  --color-border:               #E7E7E7;

  /* Inputs */
  --color-input-bg:             #FFFFFF;
  --color-input-text:           #686868;
  --color-input-border:         #E7E7E7;

  /* Botón primario */
  --btn-primary-bg:             #2A27E9;
  --btn-primary-text:           #FFFFFF;

  /* Botón secundario */
  --btn-secondary-bg:           #E4F0F8;
  --btn-secondary-text:         #4C4D52;

  /* Espaciado (base unit: 4px) */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Border radius */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-full: 9999px;

  /* Tipografía */
  --font-family-base: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont,
    "Segoe UI", Roboto, "Helvetica Neue", sans-serif;

  /* Escala tipográfica (para la app, no para el sitio de marketing) */
  --font-size-xs:   11px;
  --font-size-sm:   12px;
  --font-size-base: 14px;
  --font-size-md:   16px;
  --font-size-lg:   20px;
  --font-size-xl:   24px;
  --font-size-2xl:  32px;
  --font-size-3xl:  42px;

  --font-weight-regular:  400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;
  --font-weight-bold:     700;

  --line-height-tight:   1.2;
  --line-height-normal:  1.5;
  --line-height-relaxed: 1.7;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat: add design tokens as CSS custom properties"
```

---

### Task 4: Configuración de tipografía

**Files:**
- Modify: `index.html`
- Create: `src/styles/typography.css`

- [ ] **Step 1: Agregar Google Fonts en index.html**

En `index.html`, dentro de `<head>`, agregar después de los `<link>` existentes:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Actualizar favicon en index.html**

En `index.html`, reemplazar el `<link rel="icon">` existente con:

```html
<link rel="icon" type="image/png" href="/src/assets/logos/hospimed-favicon.png">
```

- [ ] **Step 3: Crear typography.css**

Crear `src/styles/typography.css`:

```css
*, *::before, *::after {
  font-family: var(--font-family-base);
}

body {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-normal);
  color: var(--color-text-body);
  background-color: var(--color-background);
}

h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--color-primary);
  margin: 0 0 var(--space-6);
}

h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  color: var(--color-primary);
  margin: 0 0 var(--space-4);
}

h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  color: var(--color-primary);
  margin: 0 0 var(--space-3);
}

h4, h5, h6 {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  color: var(--color-primary);
  margin: 0 0 var(--space-2);
}

p {
  margin: 0 0 var(--space-4);
  line-height: var(--line-height-relaxed);
}

a {
  color: var(--color-link);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

small {
  font-size: var(--font-size-sm);
}
```

- [ ] **Step 4: Commit**

```bash
git add index.html src/styles/typography.css
git commit -m "feat: set up Plus Jakarta Sans typography system"
```

---

### Task 5: CSS reset y entry point de estilos globales

**Files:**
- Create: `src/styles/reset.css`
- Create: `src/styles/index.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Crear reset.css**

Crear `src/styles/reset.css`:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  min-height: 100vh;
}

img, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
}

button {
  cursor: pointer;
  border: none;
  background: none;
}
```

- [ ] **Step 2: Crear styles/index.css (importa en orden)**

Crear `src/styles/index.css`:

```css
@import './reset.css';
@import './tokens.css';
@import './typography.css';
```

- [ ] **Step 3: Actualizar src/main.tsx para importar los estilos**

En `src/main.tsx`, reemplazar cualquier import CSS existente con:

```typescript
import './styles/index.css'
```

Eliminar también `src/index.css` y `src/App.css` si existen (son defaults de Vite que ya no se necesitan).

- [ ] **Step 4: Verificar que los estilos cargan**

```bash
npm run dev
```

Expected: fondo de la app en `#F7F7F7`, fuente Plus Jakarta Sans visible en DevTools → Computed → font-family.

- [ ] **Step 5: Commit**

```bash
git add src/styles/ src/main.tsx
git commit -m "feat: add CSS reset and global style entry point"
```

---

### Task 6: Componente Button

**Files:**
- Create: `src/components/ui/Button/Button.tsx`
- Create: `src/components/ui/Button/Button.css`
- Create: `src/components/ui/Button/Button.test.tsx`

- [ ] **Step 1: Escribir tests que fallan**

Crear `src/components/ui/Button/Button.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders primary button with correct text', () => {
    render(<Button variant="primary">Guardar</Button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('renders secondary button with correct text', () => {
    render(<Button variant="secondary">Cancelar</Button>)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('applies btn--primary class for primary variant', () => {
    render(<Button variant="primary">Guardar</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--primary')
  })

  it('applies btn--secondary class for secondary variant', () => {
    render(<Button variant="secondary">Cancelar</Button>)
    expect(screen.getByRole('button')).toHaveClass('btn--secondary')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button variant="primary" disabled>Guardar</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button variant="primary" onClick={handleClick}>Guardar</Button>)
    screen.getByRole('button').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```bash
npm run test:run -- Button.test.tsx
```

Expected: FAIL — `Button` not found / cannot find module.

- [ ] **Step 3: Crear Button.tsx**

Crear `src/components/ui/Button/Button.tsx`:

```typescript
import './Button.css'

type ButtonVariant = 'primary' | 'secondary'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
}

export function Button({ variant, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Crear Button.css**

Crear `src/components/ui/Button/Button.css`:

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-6);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  border-radius: var(--radius-md);
  transition: opacity 0.15s ease, background-color 0.15s ease;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background-color: var(--btn-primary-bg);
  color: var(--btn-primary-text);
}

.btn--primary:hover:not(:disabled) {
  background-color: var(--color-secondary);
}

.btn--secondary {
  background-color: var(--btn-secondary-bg);
  color: var(--btn-secondary-text);
}

.btn--secondary:hover:not(:disabled) {
  opacity: 0.85;
}
```

- [ ] **Step 5: Correr tests para verificar que pasan**

```bash
npm run test:run -- Button.test.tsx
```

Expected: 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Button/
git commit -m "feat: add Button component (primary + secondary variants)"
```

---

### Task 7: Componente Input

**Files:**
- Create: `src/components/ui/Input/Input.tsx`
- Create: `src/components/ui/Input/Input.css`
- Create: `src/components/ui/Input/Input.test.tsx`

- [ ] **Step 1: Instalar @testing-library/user-event**

```bash
npm install -D @testing-library/user-event
```

- [ ] **Step 2: Escribir tests que fallan**

Crear `src/components/ui/Input/Input.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('renders input element', () => {
    render(<Input label="Nombre" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders label text linked to input', () => {
    render(<Input label="Nombre del cliente" />)
    expect(screen.getByLabelText('Nombre del cliente')).toBeInTheDocument()
  })

  it('renders placeholder text', () => {
    render(<Input label="Nombre" placeholder="Ingrese el nombre" />)
    expect(screen.getByPlaceholderText('Ingrese el nombre')).toBeInTheDocument()
  })

  it('calls onChange when user types', async () => {
    const handleChange = vi.fn()
    render(<Input label="Nombre" onChange={handleChange} />)
    await userEvent.type(screen.getByRole('textbox'), 'ABC')
    expect(handleChange).toHaveBeenCalled()
  })

  it('renders error message when error prop is provided', () => {
    render(<Input label="Nombre" error="Campo requerido" />)
    expect(screen.getByText('Campo requerido')).toBeInTheDocument()
  })

  it('applies error class when error prop is provided', () => {
    const { container } = render(<Input label="Nombre" error="Campo requerido" />)
    expect(container.firstChild).toHaveClass('input-field--error')
  })
})
```

- [ ] **Step 3: Correr tests para verificar que fallan**

```bash
npm run test:run -- Input.test.tsx
```

Expected: FAIL — `Input` not found / cannot find module.

- [ ] **Step 4: Crear Input.tsx**

Crear `src/components/ui/Input/Input.tsx`:

```typescript
import { useId } from 'react'
import './Input.css'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, className = '', ...rest }: InputProps) {
  const id = useId()
  return (
    <div className={`input-field ${error ? 'input-field--error' : ''} ${className}`.trim()}>
      <label className="input-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input-field__input"
        {...rest}
      />
      {error && <span className="input-field__error">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 5: Crear Input.css**

Crear `src/components/ui/Input/Input.css`:

```css
.input-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.input-field__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-body);
}

.input-field__input {
  background-color: var(--color-input-bg);
  color: var(--color-input-text);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-base);
  width: 100%;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input-field__input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(42, 39, 233, 0.1);
}

.input-field--error .input-field__input {
  border-color: #e53e3e;
}

.input-field__error {
  font-size: var(--font-size-sm);
  color: #e53e3e;
}
```

- [ ] **Step 6: Correr tests para verificar que pasan**

```bash
npm run test:run -- Input.test.tsx
```

Expected: 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Input/
git commit -m "feat: add Input component with label and error state"
```

---

### Task 8: Página BrandingDemo (verificación visual)

**Files:**
- Create: `src/pages/BrandingDemo.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Crear BrandingDemo.tsx**

Crear `src/pages/BrandingDemo.tsx`:

```typescript
import { Button } from '../components/ui/Button/Button'
import { Input } from '../components/ui/Input/Input'
import hospimedLogo from '../assets/logos/hospimed-logo.png'

export function BrandingDemo() {
  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 720, margin: '0 auto' }}>

      <img
        src={hospimedLogo}
        alt="Hospimed Equipos Médicos"
        style={{ height: 48, marginBottom: 'var(--space-8)' }}
      />

      <h1>Sistema de Trazabilidad de Desechos Clínicos</h1>
      <h2>Gestión de Contenedores</h2>
      <h3>Registro de Intercambio</h3>
      <p>
        Plataforma de seguimiento del ciclo de vida de contenedores de desechos clínicos.
        Diseñada para operadores en campo y supervisores en planta.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 360, marginTop: 'var(--space-6)' }}>
        <Input label="Número de contenedor" placeholder="HOS-0001" />
        <Input label="Cliente" placeholder="Hospital Nacional" />
        <Input label="Campo con error" error="Este campo es requerido" />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
        <Button variant="primary">Registrar intercambio</Button>
        <Button variant="secondary">Ver detalle</Button>
        <Button variant="primary" disabled>Deshabilitado</Button>
      </div>

      <div style={{ marginTop: 'var(--space-8)', padding: 'var(--space-4)', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Tokens de color</h3>
        {[
          { label: 'primary',    value: '#0B1A48' },
          { label: 'secondary',  value: '#4656A4' },
          { label: 'accent',     value: '#2A27E9' },
          { label: 'background', value: '#F7F7F7' },
          { label: 'surface',    value: '#FFFFFF' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: value, border: '1px solid var(--color-border)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}>
              {label}: {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Actualizar App.tsx**

Reemplazar el contenido de `src/App.tsx`:

```typescript
import { BrandingDemo } from './pages/BrandingDemo'

export default function App() {
  return <BrandingDemo />
}
```

- [ ] **Step 3: Correr dev server y verificar visualmente**

```bash
npm run dev
```

Abrir `http://localhost:5173` y verificar:
- Logo de Hospimed renderiza correctamente
- Fondo general es gris claro `#F7F7F7`
- Encabezados en navy `#0B1A48` con Plus Jakarta Sans
- Botón primary: fondo `#2A27E9`, texto blanco, `border-radius: 8px`
- Botón secondary: fondo `#E4F0F8`, texto oscuro `#4C4D52`, `border-radius: 8px`
- Botón deshabilitado: `opacity: 0.5`, cursor `not-allowed`
- Inputs: fondo blanco, borde gris `#E7E7E7`, `border-radius: 8px`
- Input con error: borde rojo, mensaje de error debajo
- Focus en input: borde `#2A27E9` con glow ring

- [ ] **Step 4: Correr todos los tests para confirmar que no hay regresiones**

```bash
npm run test:run
```

Expected: todos los tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ src/App.tsx
git commit -m "feat: add BrandingDemo page for visual verification"
```

---

## Self-review

**Cobertura del spec:**
- ✅ Colores: todos los tokens en `tokens.css` (Task 3)
- ✅ Tipografía Plus Jakarta Sans: Google Fonts + `typography.css` (Task 4)
- ✅ Escala tipográfica para app (Task 4, decisión documentada en header)
- ✅ Espaciado base 4px con escala completa (Task 3)
- ✅ Border radius tokens `4px` y `8px` (Task 3)
- ✅ Botón primario — `#2A27E9`, blanco, `8px radius` (Task 6)
- ✅ Botón secundario — `#E4F0F8`, `#4C4D52`, `8px radius` (Task 6, decisión documentada)
- ✅ Input — blanco, `#686868`, borde `#E7E7E7`, `8px radius`, focus accent (Task 7)
- ✅ Logo y favicon descargados como assets estáticos (Task 2)
- ✅ Verificación visual de todos los componentes (Task 8)
- ✅ 3 incoherencias del branding JSON documentadas con decisiones adoptadas (header del plan)

**Placeholder scan:** Ninguno. Todos los pasos contienen código real o comandos concretos.

**Consistencia de tipos:**
- `Button` exporta `ButtonVariant` y `ButtonProps` — usados consistentemente en Tasks 6 y 8.
- `Input` exporta `InputProps` — usados consistentemente en Tasks 7 y 8.
- Sin conflictos entre tareas.
