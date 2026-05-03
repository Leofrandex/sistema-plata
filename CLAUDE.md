# Instrucciones para Claude — Hospimed: Sistema de Trazabilidad de Desechos Clínicos

## Qué es este proyecto

Sistema web para gestionar la trazabilidad completa del proceso de manejo de desechos clínicos de Hospimed. El detalle del negocio, los módulos y el modelo de datos viven en el vault.

## Base de conocimiento (Obsidian Vault)

Toda la memoria del proyecto vive en `vault/`. **Leer `vault/_index.md` antes de tocar código o responder preguntas de diseño.**

```
vault/
├── _index.md               ← LEER PRIMERO — tabla de contenidos + estado actual
├── inbox/                  ← zona de aterrizaje para información cruda
│   └── YYYY-MM-DD-nombre.md
├── project/
│   ├── Overview.md         ← descripción del negocio, objetivos, stakeholders
│   ├── Architecture.md     ← stack, patrones, convenciones, estructura de carpetas
│   ├── DataModel.md        ← modelo de datos central y relaciones
│   └── Roadmap.md          ← módulos pendientes y su estado
├── processes/              ← flujos de negocio: tipos de desecho, regulaciones, trazabilidad
├── modules/                ← un archivo por módulo funcional del sistema
├── types/                  ← interfaces y tipos documentados
├── components/             ← API de componentes compartidos
├── decisions/              ← ADRs: decisiones de diseño no obvias y su razón
└── logs/                   ← un archivo por feature/cambio mayor (YYYY-MM-DD-nombre.md)
```

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
| Se define un nuevo tipo o modelo de datos | Actualizar o crear en `types/` |
| Se especifica un módulo funcional | Actualizar o crear en `modules/` |
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
- **Rutas de código** con backticks: `src/modules/waste-tracking/`
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

Sin código aún. El vault se está construyendo antes que el código. Ver `vault/_index.md` para el estado actualizado.
