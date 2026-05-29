# Diseño — Pesaje (pendientes + empresa/tipo dinámicos + tratamiento inmediato), activación de Tratamiento y rename "envase → tacho"

**Fecha:** 2026-05-29
**Estado:** Aprobado para planificación
**Branch:** `feat/recorridos-pesaje-reportes-dashboard`

## Contexto

Lote de cambios post-piloto sobre el flujo de pesaje y tratamiento, más un rename global de
terminología y una corrección del modelo: **empresa y tipo de desecho dejan de ser propiedades
permanentes del tacho**. El sistema hoy:

- **Pesaje** (`src/app/register/weighing/page.tsx`): sesión con cronómetro y múltiples
  recepciones; la cola de pendientes (`getPendingWeighingContainerIds`) son los tachos sucios
  recogidos en recorridos sin recepción. Al finalizar, todos pasan a cámara fría. Cliente fijo
  (`clients[0]`).
- **Tratamiento** (`src/app/register/treatment/page.tsx`): 100% mock — `operator_id: 'user-1'`,
  no escribe a Supabase, lista todos los infecciosos (`container.waste_type === 'infectious'`).
- **Traslado externo** (`src/app/register/transfer/`): para tipos 2–5, hoy ruteado por
  `container.waste_type`.
- **Fase del tacho** (`computeContainerPhase` en `src/lib/data/containers.ts`): derivada de
  eventos. El caller elige el camino tratamiento (tipo 1) vs traslado (tipos 2–5) según
  `container.waste_type`. Para llegar a `treatment`/`clean` exige storage con `exit_at` +
  `TreatmentRun`.
- **Reportes** (`src/lib/data/reports.ts`): el cliente se **deriva** del tacho
  (`container → company → client`).
- `Container` (TS + tabla Supabase) tiene `waste_type` asignado al alta.

### Modelo real de tachos, empresas y tipo de desecho (corregido en esta sesión)

- Existen **189 tachos reales** (del Excel oficial), hoy almacenados como `A-001`..`A-189`. El
  prefijo `A-` fue un **artefacto de importación**; los números reales son **001..189, únicos**.
- Los **10 tachos ION (`I-001`..`I-010`) eran mock de demo** y se eliminan.
- Los tachos son **propiedad de Hospiwaste** (pool compartido), **sin empresa ni tipo de desecho
  permanentes**.
- **ION y Airkem son empresas** bajo un **cliente-institución** (Centro de la Salud). El reporte
  se consolida por **institución**.
- La **empresa de un tacho es dinámica**: se asigna al seleccionarla en el recorrido, se hereda en
  pesaje, y **vuelve a null al tratarse**.
- El **tipo de desecho también es dinámico**: lo **ingresa el operador en cada pesaje** y se
  guarda en la recepción.

## Decisiones tomadas (con el usuario)

1. **Tratamiento inmediato → completado.** El tacho salta cámara fría y queda `clean` (disponible
   para recorrido) de inmediato.
2. **Empresa del tacho = dinámica y derivada del recorrido abierto.** No se selecciona en pesaje:
   el tacho llega con la empresa del recorrido que lo recogió. Reset a null al completarse
   tratamiento/traslado.
3. **Tipo de desecho = dinámico, INPUT en pesaje.** Selector que elige el operador por tacho,
   guardado en la recepción. Se **elimina** `waste_type` del tacho. Selector **pre-cargado**
   (default `infeccioso`) y **editable**.
4. **Bloqueo de finalizar con escape:** no se puede finalizar mientras queden pendientes, pero
   se puede marcar un tacho como **ausente** (con nota opcional) para cerrar. El ausente **sigue
   en la cola** y reaparece en la próxima sesión.
5. **Empresa seleccionable en recorrido** (andén + morgue). El reporte se agrupa por la
   **institución** de la empresa registrada en cada evento.
6. **Tratamiento (página):** completado de una vez (un solo paso) → tacho `clean`. Con
   multi-selección.
7. **Display:** mostrar el tacho por su **número pelado** (`001`), sin prefijo. Id interno
   (`A-001`) intacto — **cero migración de ids**.
8. **Eliminar los 10 tachos ION mock.**
9. **Rename:** "envase → tacho" en app **y** vault/docs. Código en inglés (`Container`) se mantiene.

## Diseño por feature

### F1 — Pendientes por pesar visibles en la sesión

En el banner de sesión activa (`weighing/page.tsx`), bajo el contador de registros, mostrar:

> **Pendientes por pesar (N):** `001`, `006`, `135`

- Fuente: `getPendingWeighingContainerIds(containers, routeEvents, receptions)` (ya existe).
- Se muestra el **número pelado** vía helper nuevo `formatTachoNumber(id)` (ver F7). El pool real
  es 001..189 único → sin ambigüedad.
- Los tachos marcados ausentes en la sesión (F2) se listan diferenciados y no cuentan para el
  bloqueo. La lista se recalcula al crear/editar/borrar cada recepción.

### F2 — Bloqueo de finalizar hasta pesar todos (con escape)

- "Finalizar pesaje" se **deshabilita** mientras `pendientesNoAusentes.length > 0` (y debe haber
  ≥1 recepción). Reemplaza la condición actual (solo 0 recepciones).
- Cada pendiente listado tiene acción **"Marcar como ausente"** con nota opcional. Los ids
  ausentes se guardan en el contexto de la `ActiveSession` (IndexedDB), campo nuevo
  `skipped: { container_id: string; note: string }[]`. **No** crea tabla ni recepción; es
  transitorio (el tacho reaparece la próxima sesión).
- El diálogo de finalización refleja si hubo ausentes ("N tachos quedaron pendientes para la
  próxima sesión").

### F3 — Pesaje: empresa heredada + tipo de desecho como INPUT

Formulario de pesaje (`weighing-form.tsx`, `WeighingFormState`):

- **Empresa:** sin selector. Al crear la recepción se **snapshot** la empresa actual del tacho
  (derivada del recorrido abierto, helper en F6) en `reception.company_id`. Se muestra informativa
  ("Empresa: ION").
- **Tipo de desecho:** **selector (input)** entre los 5 tipos. Default `infeccioso`, editable.
  Obligatorio para guardar. Se persiste en `reception.waste_type`.

**Modelo de datos:**
- `ContainerReception` (TS): agregar `company_id: string | null`, `waste_type: WasteType` y
  `treat_immediately: boolean`.
- Migración Supabase `container_receptions`:
  `+ company_id uuid NULL REFERENCES companies(id)`,
  `+ waste_type waste_type_enum NOT NULL DEFAULT 'infectious'`,
  `+ treat_immediately boolean NOT NULL DEFAULT false`. Regenerar `database.types.ts`.
- Queries `createReception`/`updateReception` y el hydrator: incluir los campos nuevos.

### F4 — Check "tratado inmediatamente" (por tacho)

- Checkbox al final del formulario: "Tratar inmediatamente (salta cámara fría)". Estado
  `treat_immediately` en `WeighingFormState`, persistido en la recepción.
- **Al finalizar la sesión** (`handleFinish`):
  - Recepciones con `treat_immediately = true`: **no** crean StorageEvent de cámara fría; se crea
    un `TreatmentRun` **completado** (`started_at = completed_at = now`) en Supabase + store;
    ubicación `treatment`.
  - Recepciones normales: StorageEvent abierto + ubicación `cold_storage`, como hoy.
- **Ajuste a `computeContainerPhase`**: un `TreatmentRun`/`ExternalTransfer` **completado** da
  `clean` aunque no haya StorageEvent con `exit_at`. Avanza el **P1** del ADR
  `decisions/2026-05-21-estado-envase-derivado.md`.
- Solo aplica a tratamiento on-site (tipo 1). Si el tipo de la recepción **no** es `infectious`,
  el check no aplica (se oculta/deshabilita): tipos 2–5 van a traslado externo, no a tratamiento.
- Efecto buscado: al completarse el tratamiento, la empresa derivada del tacho vuelve a null. Ver F6.

### F5 — Activar página de Tratamiento (`/register/treatment`)

- Reescribir para usar Supabase y `currentProfileId` (eliminar `user-1` mock).
- **Candidatos:** tachos en fase `cold_storage` cuya **última recepción** sea `waste_type ===
  'infectious'` (ya no `container.waste_type`).
- **Multi-selección:** mandar varios tachos a tratamiento en una acción.
- **Cierre en un paso:** cada tacho genera un `TreatmentRun` completado
  (`started_at = completed_at = now`) → fase `clean`; cierra su StorageEvent de cámara fría si
  está abierto (`exit_at = now`).
- **Queries nuevas** en `src/lib/supabase/queries/`: `createTreatmentRun`; hidratar
  `treatment_runs` si aún no se hidrata. Tabla ya existe (bootstrap).

### F6 — Empresa seleccionable en recorrido + empresa/tipo dinámicos derivados

- `route-form.tsx` / páginas `anden/[slot]` y `morgue`: **selector de empresa** (ION/Airkem),
  hoy `clients[0]` fijo. El `route_event` guarda la empresa elegida.
- **Modelo:** `RouteEvent.company_id: string | null`. Migración `route_events`:
  `+ company_id uuid NULL REFERENCES companies(id)`. Se sigue poblando `client_id` (institución)
  desde `company.client_id`.
- **Helper `getContainerCurrentCompanyId(containerId, routeEvents, treatmentRuns, transfers)`** en
  `src/lib/data/containers.ts`: empresa actual del tacho = `company_id` del recorrido más reciente
  que lo recogió sucio **dentro del ciclo abierto** (posterior al último tratamiento/traslado
  completado). Si no hay recorrido abierto → `null`. Implementa la herencia en pesaje y el reset al
  tratar.
- **Tipo de desecho actual** del tacho (para vistas/derivaciones, p. ej. tratamiento vs traslado)
  = `waste_type` de la **última recepción** del ciclo abierto. Si no hay recepción aún → indefinido
  (se decide al pesar).
- **Reportes** (`reports.ts`): agrupar por **institución** usando la empresa **registrada**
  (`reception.company_id`, `routeEvent.company_id`); institución = `company.client_id`.
- **Fallback histórico:** eventos sin `company_id` (14,375 recepciones + recorridos históricos) se
  atribuyen a Airkem vía `container.company_id` **(este campo se conserva solo como fallback de
  atribución histórica, no como empresa operativa)**.

### F7 — Desvincular `waste_type` del tacho (cascada)

Eliminar `waste_type` como propiedad del tacho; el único tipo de desecho operativo es el de la
recepción (F3). Cambios:

- **`Container` (TS):** quitar `waste_type`. **Migración Supabase (orden importa):** (1) agregar
  `container_receptions.waste_type` con `DEFAULT 'infectious'`; (2) **backfill**:
  `UPDATE container_receptions r SET waste_type = c.waste_type FROM containers c WHERE
  r.container_id = c.id` (copia el tipo real del tacho a sus recepciones, preservando el desglose
  por tipo del histórico); (3) `DROP COLUMN containers.waste_type`. El mismo backfill se replica en
  `historical-data.json`/mock (mover `waste_type` de containers a sus receptions).
- **Alta/admin de tachos** (`container-form.tsx`, `admin/containers`): quitar el selector de tipo
  de desecho.
- **Tratamiento (F5)** y **traslado externo** (`register/transfer`): rutear por el tipo de la
  **última recepción**, no por `container.waste_type`.
- **`computeContainerPhase`** y su caller: elegir camino tratamiento (tipo 1) vs traslado (2–5)
  según la última recepción.
- **mock-data / historical-data.json:** quitar `waste_type` de los containers; los datos de tipo
  pasan a vivir en las recepciones (backfill).

### F8 — Display por número + rename "envase → tacho" + limpieza de mocks

- **Helper `formatTachoNumber(id: string): string`**: quita el prefijo `letra-` (`'A-001' →
  '001'`). Se usa en TODA visualización de tachos. El id interno no cambia.
- **Rename app (`src/`):** strings "envase(s)" → "tacho(s)" (~126 en ~36 archivos): labels,
  botones, mensajes, títulos, diálogos, texto del reporte PDF. Cuidar concordancia.
- **Rename vault/docs:** documentación donde "envase" sea término de UI/negocio (p. ej.
  `processes/ContainerLifecycle.md`). Mantener menciones históricas en logs.
- **Código en inglés (`Container`, `container_id`): NO se toca.**
- **Eliminar los 10 tachos ION mock** (`I-001`..`I-010`) de `mock-data.ts`; mantener ION + Airkem
  como empresas. Ajustar fixtures/tests que los referencien.
- Verificación: `grep -i "envase" src` → 0 en strings de UI.

## Resumen de cambios al modelo de datos

| Entidad | Cambio | Migración |
|---------|--------|-----------|
| `container_receptions` | `+ company_id uuid NULL FK companies` (snapshot empresa) | sí |
| `container_receptions` | `+ waste_type enum NOT NULL DEFAULT 'infectious'` (input pesaje) | sí |
| `container_receptions` | `+ treat_immediately boolean NOT NULL DEFAULT false` | sí |
| `route_events` | `+ company_id uuid NULL FK companies` (empresa del recorrido) | sí |
| `containers` | **backfill `waste_type` → recepciones, luego DROP COLUMN** | sí |
| `treatment_runs` | ya existe; se empieza a usar (queries nuevas) | no |
| Container (id) | **sin cambio** — solo display pelado vía helper | no |

`computeContainerPhase`: lógica → tratamiento/traslado completado da `clean`, y el ruteo
tratamiento/traslado usa la última recepción. Helpers nuevos: `getContainerCurrentCompanyId`,
`formatTachoNumber`.

## Testing

- **Unit (`src/lib/data/`):**
  - `computeContainerPhase`: tratamiento inmediato completado sin storage → `clean`.
  - `getContainerCurrentCompanyId`: empresa del recorrido abierto; null tras tratamiento; cambia
    ION→Airkem en ciclos sucesivos.
  - `formatTachoNumber`: `'A-001' → '001'`; ids sin prefijo intactos.
  - Reportes agrupando por institución vía empresa registrada, con fallback histórico a Airkem.
  - Ruteo tratamiento vs traslado según última recepción (`waste_type`).
  - Pendientes excluyendo ausentes.
- **Componentes:** `weighing-form` con selector de tipo (default infeccioso, obligatorio),
  empresa heredada informativa, persiste `treat_immediately`; sin selector de cliente.
  `container-form` sin selector de tipo de desecho.
- **E2E manual (dispositivo real):** sesión con pendientes por número, bloqueo + escape por
  ausente, tipo elegido en pesaje, tratado inmediato → tacho vuelve disponible y sin empresa;
  tratamiento multi-select; empresa en recorrido reflejada en el reporte.

## Fuera de alcance

- Renumerado del id canónico (id `A-001` interno; solo display pelado).
- Fijar empresa por sesión de pesaje (el modelo de snapshot lo permite a futuro).
- Tratamiento en dos pasos / medición de duración.
- Persistencia de tachos ausentes en BD (transitorio por decisión).
- Reportes por rango/Excel/logos y dashboard anual/consolidado (otros pendientes del backlog).

## Logs / vault a actualizar al cerrar

- `logs/2026-05-29-pesaje-tratamiento-rename-tacho.md` (nuevo).
- `processes/ContainerLifecycle.md` y `processes/WasteTypes.md` (empresa y tipo dinámicos,
  tratamiento inmediato, rename).
- `decisions/` nuevo ADR: empresa y tipo de desecho dinámicos del tacho (derivados de
  recorrido/recepción, reset al tratar).
- `decisions/2026-05-21-estado-envase-derivado.md` (P1 resuelto parcialmente).
- `_index.md` (estado + última actualización; hoy al 2026-05-21, desactualizado).
