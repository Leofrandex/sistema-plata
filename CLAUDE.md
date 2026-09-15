# Instrucciones para Claude — Hospiwaste: Sistema de Trazabilidad de Desechos Clínicos

## Qué es este proyecto

Sistema web para gestionar la trazabilidad completa del proceso de manejo de desechos clínicos de Hospiwaste. El detalle del negocio, los módulos y el modelo de datos viven en el vault. (El proyecto se llamaba originalmente "Hospimed" — el vault conserva esa denominación como historial.)

## Dos memorias separadas

El proyecto tiene dos fuentes de contexto con vidas distintas. No mezclarlas.

| | Vault (`vault/`) | Grafo de código (`graphify-out/`) |
|---|---|---|
| Qué es | el **por qué**: decisiones, procesos, historia | el **qué llama a qué**: símbolos y aristas |
| Quién lo escribe | humano y Claude, a mano | derivado del AST, sin LLM |
| Formato | solo `.md` | `graph.json` + HTML + reporte |
| En git | sí | no — se regenera en ~40 s |

### Vault — la memoria escrita

**Leer `vault/_index.md` antes de tocar código o responder preguntas de diseño.**

```
vault/
├── _index.md               ← LEER PRIMERO — estado actual + pendientes abiertos
├── inbox/                  ← zona de aterrizaje para información cruda
│   └── procesado/          ← ya distribuido al vault
├── project/
│   ├── Overview.md         ← negocio, objetivos, stakeholders
│   ├── Architecture.md     ← stack, patrones, convenciones, integraciones
│   ├── DataModel.md        ← modelo de datos y relaciones
│   ├── Roadmap.md          ← módulos y su estado
│   ├── CodeMap.md          ← cómo consultar el grafo de código
│   └── Branding.md         ← colores, tipografía, tokens
├── processes/              ← flujos de negocio y reglas del dominio
├── decisions/              ← ADRs: decisiones no obvias y su razón
└── logs/                   ← uno por feature/cambio mayor (YYYY-MM-DD-nombre.md)
```

**El vault es solo markdown.** Sin binarios (van a `docs/fuentes/`), sin credenciales
(viven fuera del repo), sin estructura de código (la deriva graphify).

### Grafo de código — la estructura derivada

Antes de explorar el código a ciegas, preguntarle al grafo:

```bash
python -m graphify update .                          # regenerar (~40 s, costo cero)
python -m graphify explain "getLocalStore()"         # un símbolo y sus vecinos
python -m graphify path "SyncEngine" "LocalStore"    # cómo se conectan dos cosas
python -m graphify query "¿cómo drena el outbox?"    # traversal en lenguaje natural
```

El reporte anota el commit de construcción: si no coincide con `git rev-parse HEAD`, el
grafo está viejo — regenerarlo. Alcance en `.graphifyignore`. Detalle en
`vault/project/CodeMap.md`.

---

## Flujo del Inbox

El inbox es la zona de aterrizaje para información cruda: transcripts de reuniones, notas sueltas, dumps de contexto. El flujo es:

1. El usuario deposita un archivo en `vault/inbox/` (o pega el contenido directamente)
2. Claude lee el archivo, extrae la información relevante y la distribuye a los archivos del vault correspondientes
3. Claude actualiza `vault/_index.md` si el estado del proyecto cambia
4. Claude mueve el archivo procesado a `vault/inbox/procesado/` o lo elimina según indique el usuario
5. Claude reporta qué archivos actualizó y por qué

**Para transcripts de Fireflies:** usar el MCP de Fireflies disponible en el entorno para extraer el transcript directamente.

---

## Reglas de mantenimiento del vault

| Evento | Acción |
|--------|--------|
| Se define un nuevo tipo o modelo de datos | Actualizar `project/DataModel.md` **solo si cambia el negocio**; las interfaces TypeScript no se documentan a mano |
| Se especifica un flujo o regla de negocio | Actualizar o crear en `processes/` |
| Se instala una dependencia | Agregar entrada en `project/Architecture.md` |
| Se completa un feature o cambio estructural | Crear `logs/YYYY-MM-DD-nombre.md` |
| Se toma una decisión de diseño no obvia | Crear entrada en `decisions/` |
| Se define un flujo de negocio | Actualizar o crear en `processes/` |
| Se encuentra información contradictoria | Marcar con `[!warning]` (ver formato abajo) + resolver |

### Formato de incoherencia detectada

```markdown
> [!warning] INCOHERENCIA DETECTADA
> **Fecha:** YYYY-MM-DD
> **Problema:** <descripción del conflicto>
> **Acción requerida:** Actualizar X o verificar Y con el usuario
```

---

## Convenciones del vault

- **Wikilinks** para referencias internas: `[[Overview]]`, `[[DataModel]]`
- **Fechas ISO**: `2026-05-02`
- **Rutas de código** con backticks: `shared/src/lib/local-store/` — nunca como wikilink
- **Referencias a otras notas** con wikilinks: `[[DataModel]]`, `[[2026-09-07-yaris-pesaje-directo]]` — nunca como ruta en backticks
- **Frontmatter** en cada archivo (título, tags, fecha de última actualización)
- Los logs siguen el formato: `YYYY-MM-DD-nombre-del-feature.md`
- Documentar el **por qué** y las **decisiones**, no lo que ya se lee en el código

### Qué NO documentar en el vault

- Implementación obvia legible directamente en el código
- Estado temporal de una sesión de trabajo
- Información que ya vive en `package.json` o en los tipos de TypeScript

---

## Flujo de trabajo recomendado

1. **Al iniciar cualquier tarea** → leer `vault/_index.md` + el archivo de módulo o proceso relevante
2. **Al procesar el inbox** → distribuir info, actualizar vault, reportar cambios
3. **Al terminar un feature** → actualizar tipos, módulo y crear log
4. **Al encontrar una contradicción** → marcar con `[!warning]` y resolver antes de continuar

---

## Estado del proyecto

Sistema en producción (piloto PTDP). Ver `vault/_index.md` para el estado actualizado.

## Estructura del repo (monorepo, desde 2026-07-22)

npm workspaces con tres paquetes (ver ADR `vault/decisions/2026-07-22-separacion-hub-app.md`):

- **`hub/`** — Next.js web para **coordinadores**: Dashboard, Tachos, Equipos, Historial, Reportes, Admin. Sin registro de operaciones.
- **`app/`** — Next.js + Capacitor (APK Android) para **operadores**: Home, Recorrido, Pesaje, Tratamiento, Traslado. `android/` vive aquí.
- **`shared/`** — paquete fuente `@hospiwaste/shared`: store, types, Supabase, lógica de datos, offline/outbox, UI base.

Reglas: código de shared se importa siempre como `@hospiwaste/shared/...` (nunca `@/` dentro de shared); `@/*` es local de cada app. Build y dev con `--webpack`. Los gradle de `app/android/` generados por Capacitor se regeneran con `npx cap sync android` desde `app/` (no editar a mano).

Comandos desde el root: `npm run dev:hub` (:3000), `npm run dev:app` (:3001), `npm run build:hub`, `npm run build:app`, `npm test` (jest de los 3 workspaces), `npm run test:ui` (vitest de `shared/src/components/ui`).
