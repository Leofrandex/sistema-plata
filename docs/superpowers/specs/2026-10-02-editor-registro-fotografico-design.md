# Diseño — Editor del Registro Fotográfico

**Fecha:** 2026-10-02
**Relacionado:** `2026-05-27-reporte-fotografico-rediseno-design.md` (layout actual del PDF)

---

## Objetivo

Que el equipo de coordinación pueda **ajustar a mano** el registro fotográfico antes
de descargarlo: reordenar cuadros, cambiar fotos de lugar y elegir qué foto va en cada
recuadro, arrastrando y soltando. Es una herramienta opcional: el equipo decide si le
sirve. El reporte automático sigue existiendo tal cual.

**Éxito:** desde `/reports` se abre el editor con el reporte automático ya armado, se
edita de forma fluida, y "Descargar" produce un PDF con el mismo diseño que el
automático (logos, barra de datos, comentario) pero con la disposición editada.

## Decisiones tomadas con el usuario

| Tema | Decisión |
|------|----------|
| Punto de partida | El editor arranca con el reporte automático ya armado, no en blanco |
| Filtros | Exactamente los de `/reports`: la empresa y el rango elegidos ahí. Mismas exclusiones (sin anatomopatológicos ni citotóxicos) |
| Persistencia | **Ninguna.** Editan, descargan y listo. Cerrar la pestaña pierde la edición |
| Buscador | Solo **pesajes**: día → sesión de pesaje → tacho/contenedor → miniaturas balanza y tacho |
| Recorrido | Los cuadros de recorrido están en el canvas y se mueven enteros; sus fotos no aparecen en el buscador |
| Acciones | Mover cuadros · soltar/reemplazar/intercambiar fotos · vaciar recuadro · editar comentario · agregar cuadro vacío · eliminar cuadro |
| Páginas | Automáticas: 4 cuadros por hoja. No se agregan ni borran a mano |
| Días | Secciones por día. Un cuadro solo se mueve dentro de su día; cada día empieza en hoja nueva con su fecha. Las fotos del buscador se pueden soltar en cualquier cuadro |
| Arrastre | `@dnd-kit` (nueva dependencia del hub) |

## Botones en `/reports`

- **Descargar reporte** — sin cambios de comportamiento: baja el PDF automático.
- **Editar reporte** — nuevo. Navega a `/reports/editor?company=<id>&start=<YYYY-MM-DD>&end=<YYYY-MM-DD>`.

El editor es una página propia del hub (export estático: los parámetros van por query
string). Ocupa toda la ventana: el menú lateral, el header y la barra móvil del hub se
ocultan en esa ruta, igual que hoy se ocultan en `/login`.

## Arquitectura: una maqueta, un solo PDF

Hoy `PhotographicReportDocument` convierte `PhotographicReportData` en cuadros
internamente (`buildCuadros`). Eso se separa en dos pasos:

```
PhotographicReportData ──buildReportLayout()──▶ ReportLayout ──▶ PhotographicReportDocument ──▶ PDF
                                                     ▲
                                        editor (acciones puras)
```

- **`ReportLayout`** (la "maqueta") es la única entrada del PDF:

  ```ts
  interface LayoutCuadro {
    id: string              // estable, para dnd-kit
    label: string           // encabezado del cuadro
    comment: string         // texto de "Comentario:" (inicial = label, como hoy)
    slots: (string | null)[] // 8 photo ids; [0..3] fila de arriba, [4..7] fila de abajo
  }
  interface ReportLayout {
    days: { date: string; cuadros: LayoutCuadro[] }[]
  }
  ```

- **Grilla única 4×2.** Recorrido: las 8 fotos en orden, fila por fila. Pesaje: el par
  *i* va en la columna *i*, balanza en `slots[i]` y tacho en `slots[4 + i]`. Así cada
  cuadro, automático o nuevo, es la misma grilla y cualquier foto entra en cualquier
  recuadro. El reparto en cuadros (8 fotos / 4 pares, "(cont.)") es el de hoy.
- **Descargar reporte** = `buildReportLayout(data)` → PDF. Mismas fotos en las mismas
  posiciones que hoy; el espaciado entre recuadros puede variar ~1 pt al unificar la
  grilla.
- **Descargar del editor** = la maqueta editada → el mismo componente PDF. Reutiliza
  `prepareReportImages` (reintentos, reducción) y el aviso de fotos faltantes.
- El componente PDF recibe además un mapa `photoId → Photo` para resolver las URLs.
- Paginado: `chunk(cuadros_del_día, 4)` por día, como hoy.

## Acciones del editor

Funciones puras sobre `ReportLayout` (en `hub/src/lib/data/report-layout.ts`), cada
una devuelve una maqueta nueva. La UI solo las llama.

| Acción | Regla |
|--------|-------|
| `moveCuadro(day, from, to)` | Solo dentro del mismo día |
| `dropPhoto(cuadroId, slot, photoId)` | Desde el buscador: reemplaza lo que hubiera |
| `swapSlots(a, b)` | Foto del canvas soltada sobre otro recuadro: intercambian (si el destino está vacío, se mueve) |
| `clearSlot(cuadroId, slot)` | Deja el recuadro vacío |
| `setComment(cuadroId, text)` | — |
| `addCuadro(day)` | Al final del día; 8 recuadros vacíos, label "Pesaje", comentario "Pesaje" |
| `removeCuadro(cuadroId)` | — |

La misma foto puede estar en más de un recuadro: no se bloquea, la marca "en uso" del
buscador lo hace visible.

## Pantalla

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Volver   Editar reporte · ION · 2026-09-28 → 2026-10-02 [Descargar]│
├───────────────────┬──────────────────────────────────────────────┤
│ BUSCADOR          │  ── 2026-10-01 ──────────────────────────    │
│ ▾ 2026-10-01      │  ┌─ hoja A4 ───────────────────────────┐    │
│   ▾ Sesión 1      │  │ [logo] REGISTRO FOTOGRÁFICO [logo] │    │
│     03:05 p. m.   │  │ Edificio 4E | PTDP | ION | fecha    │    │
│     ▾ Tacho 173   │  │ ┌⠿ Pesaje 1ª ruta 🗑┐ ┌⠿ ...    ┐   │    │
│       [img][img]  │  │ │ ▢ ▢ ▢ ▢          │ │          │   │    │
│      Balanza Tacho│  │ │ ▢ ▢ ▢ ▢          │ │          │   │    │
│        ✓ en uso   │  │ │ Comentario: ✎    │ │          │   │    │
│     ▸ Cont. 5501  │  │ └──────────────────┘ └──────────┘   │    │
│ ▸ 2026-10-02      │  └─────────────────────────────────────┘    │
│                   │        [ + Agregar cuadro a este día ]       │
└───────────────────┴──────────────────────────────────────────────┘
```

### Buscador (panel izquierdo)

- Árbol: **día** (fecha de pesaje) → **sesión de pesaje** (hora de inicio; las
  recepciones sin sesión van a "Sin sesión") → **tacho** (`Tacho 173`) o **contenedor
  descartable** (`Contenedor 5501 (morgue)`) → dos miniaturas.
- Mismo universo que el reporte: recepciones no anuladas, de la empresa, en el rango,
  sin anato ni cito. Se arma con una función pura `buildPhotoBrowserTree(...)`.
- Miniaturas de ~64 px con la etiqueta **Balanza** / **Tacho** debajo
  (`photo_ids[1]` / `photo_ids[0]`, la convención actual). Carpetas cerradas al
  inicio; las miniaturas se piden recién al abrir la carpeta (`loading="lazy"`).
- Marca **✓ en uso** en las fotos presentes en algún recuadro del canvas.
- Una miniatura que no carga muestra un ícono de foto rota y sigue siendo arrastrable.

### Canvas (centro)

- Secciones por día; dentro, hojas A4 apaisadas imitadas en HTML con el header (logos,
  título), la barra de datos y 4 cuadros en 2×2. No es el PDF: es una vista editable
  que lo imita.
- Cuadro: manija ⠿ en el encabezado para arrastrarlo (los demás se corren con
  animación, `@dnd-kit/sortable`); 🗑 con confirmación dentro del cuadro
  ("¿Eliminar? Sí / No").
- Recuadro: foto con `object-fit: contain` (igual que el PDF); ✕ al pasar el mouse
  para vaciarlo; acepta fotos del buscador y del canvas.
- Comentario: clic para editar en línea.
- "+ Agregar cuadro" al final de cada día.
- Si hay cambios sin descargar, `beforeunload` avisa antes de cerrar o recargar.

### Descarga

Mismo flujo que el botón actual: progreso "Preparando fotos X de Y", generación, aviso
si alguna foto salió como "Foto no disponible". Los recuadros vacíos salen en blanco.
Nombre de archivo: el actual con sufijo `_editado`.

## Pruebas

Jest, sobre la lógica pura (no el arrastre visual):

1. `buildReportLayout` reproduce los cuadros del reporte actual: mismos labels, mismas
   fotos en las mismas posiciones (pares de pesaje en columnas), mismos cortes "(cont.)".
2. Cada acción de `report-layout.ts`, incluido que `moveCuadro` no cruza días.
3. Paginado: 4 cuadros por hoja, cada día en hoja nueva.
4. `buildPhotoBrowserTree`: jerarquía día → sesión → tacho/contenedor, balanza y tacho
   bien asignados, "Sin sesión", sin anato ni cito.
5. Fotos en uso: el conjunto de photo ids presentes en la maqueta.

Verificación manual: generar un PDF editado de prueba y revisar las hojas.

## Fuera de alcance

- Guardar ediciones, retomar, edición simultánea.
- Fotos de recorrido en el buscador.
- Agregar o borrar páginas a mano; mover cuadros entre días.
- Editar el encabezado del cuadro o la barra de datos.
- Deshacer (Ctrl+Z).
- Uso en celular: el editor es para escritorio.
