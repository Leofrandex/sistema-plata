# Diseño — Pesaje (pendientes + empresa dinámica + tratamiento inmediato), activación de Tratamiento y rename "envase → tacho"

**Fecha:** 2026-05-29
**Estado:** Aprobado para planificación
**Branch:** `feat/recorridos-pesaje-reportes-dashboard`

## Contexto

Lote de cambios post-piloto sobre el flujo de pesaje y tratamiento, más un rename global de
terminología y una corrección del modelo de relación tacho↔empresa. El sistema hoy:

- **Pesaje** (`src/app/register/weighing/page.tsx`): sesión con cronómetro y múltiples
  recepciones; la cola de pendientes (`getPendingWeighingContainerIds`) son los tachos sucios
  recogidos en recorridos sin recepción. Al finalizar, todos pasan a cámara fría. Cliente fijo
  (`clients[0]`).
- **Tratamiento** (`src/app/register/treatment/page.tsx`): 100% mock — `operator_id: 'user-1'`,
  no escribe a Supabase, lista todos los infecciosos (no solo los de cámara fría).
- **Fase del tacho** (`computeContainerPhase` en `src/lib/data/containers.ts`): derivada de
  eventos. Para llegar a `treatment`/`clean` exige storage con `exit_at` + `TreatmentRun`.
- **Reportes** (`src/lib/data/reports.ts`): el cliente se **deriva** del tacho
  (`container → company → client`).

### Modelo real de tachos y empresas (corregido en esta sesión)

- Existen **189 tachos reales** (del Excel oficial), hoy almacenados como `A-001`..`A-189`. El
  prefijo `A-` fue un **artefacto de importación**; los números reales son **001..189, únicos**.
- Los **10 tachos ION (`I-001`..`I-010`) eran mock de demo** y se eliminan.
- Los tachos son **propiedad de Hospiwaste** (pool compartido), **no** de una empresa.
- **ION y Airkem son empresas** bajo un **cliente-institución** (Centro de la Salud). El reporte
  se consolida por **institución**.
- La **empresa de un tacho es dinámica**: se asigna al seleccionarla en el recorrido, se hereda en
  pesaje, y **vuelve a null al tratarse** (el tacho queda libre para el próximo recorrido).

## Decisiones tomadas (con el usuario)

1. **Tratamiento inmediato → completado.** El tacho salta cámara fría y queda `clean` (disponible
   para recorrido) de inmediato.
2. **Empresa del tacho = dinámica y derivada del recorrido abierto.** No se selecciona en pesaje
   (sería trabajo doble): el tacho llega a pesaje con la empresa del recorrido que lo recogió.
   Reset a null al completarse su tratamiento/traslado.
3. **Tipo de desecho en pesaje:** solo informativo, derivado del tacho (no es input).
4. **Bloqueo de finalizar con escape:** no se puede finalizar mientras queden pendientes, pero
   se puede marcar un tacho como **ausente** (con nota opcional) para cerrar. El tacho ausente
   **sigue en la cola** y reaparece en la próxima sesión.
5. **Empresa seleccionable en recorrido** (andén + morgue). El reporte se agrupa por la
   **institución** de la empresa registrada en cada evento.
6. **Tratamiento (página):** completado de una vez (un solo paso) → tacho `clean`. Con
   multi-selección.
7. **Display:** mostrar el tacho por su **número pelado** (`001`), sin prefijo. El id interno
   (`A-001`) se mantiene opaco — **cero migración de ids**.
8. **Eliminar los 10 tachos ION mock.**
9. **Rename:** "envase → tacho" en app **y** vault/docs. Código en inglés (`Container`) se mantiene.

## Diseño por feature

### F1 — Pendientes por pesar visibles en la sesión

En el banner de sesión activa (`weighing/page.tsx`), bajo el contador de registros, mostrar:

> **Pendientes por pesar (N):** `001`, `006`, `135`

- Fuente: `getPendingWeighingContainerIds(containers, routeEvents, receptions)` (ya existe).
- Se muestra el **número pelado** vía un helper nuevo `formatTachoNumber(id)` (ver F7). Como el
  pool real es 001..189 único, no hay ambigüedad.
- Los tachos marcados como ausentes en la sesión actual (F2) se listan diferenciados y no cuentan
  para el bloqueo.
- La lista se recalcula al crear/editar/borrar cada recepción.

### F2 — Bloqueo de finalizar hasta pesar todos (con escape)

- "Finalizar pesaje" se **deshabilita** mientras `pendientesNoAusentes.length > 0` (y debe haber
  ≥1 recepción). Reemplaza la condición actual (solo 0 recepciones).
- Cada tacho pendiente listado tiene acción **"Marcar como ausente"** con nota opcional. Los ids
  ausentes se guardan en el contexto de la `ActiveSession` (IndexedDB), campo nuevo
  `skipped: { container_id: string; note: string }[]`. **No** se crea tabla ni recepción; es
  transitorio (el tacho reaparece en la cola la próxima sesión).
- El diálogo de finalización refleja si hubo ausentes ("N tachos quedaron pendientes para la
  próxima sesión").

### F3 — Pesaje: empresa heredada (sin selector) + tipo de desecho informativo

Se **quita** cualquier selección de cliente/empresa del formulario de pesaje. En su lugar:

- Al crear la recepción, se **snapshot** la empresa actual del tacho (derivada del recorrido
  abierto, ver helper en F6) en `reception.company_id`. Sin input del operador.
- **Tipo de desecho:** campo de solo lectura que muestra `wasteTypeLabel(container.waste_type)`
  del tacho seleccionado.
- En la UI de pesaje se muestra, informativo, la empresa heredada del tacho (ej. "Empresa: ION").

**Modelo de datos:**
- `ContainerReception` (TS): agregar `company_id: string | null` (snapshot de empresa) y
  `treat_immediately: boolean` (ver F4).
- Migración Supabase `container_receptions`:
  `+ company_id uuid NULL REFERENCES companies(id)`,
  `+ treat_immediately boolean NOT NULL DEFAULT false`. Regenerar `database.types.ts`.
- Queries `createReception`/`updateReception` y el hydrator: incluir los campos nuevos.
- *(Futuro posible: fijar empresa por sesión de pesaje — no se implementa; el modelo de snapshot
  por recepción lo permite.)*

### F4 — Check "tratado inmediatamente" (por tacho)

- Checkbox al final del formulario de pesaje: "Tratar inmediatamente (salta cámara fría)".
  Estado `treat_immediately` en `WeighingFormState`, persistido en la recepción.
- **Al finalizar la sesión** (`handleFinish`):
  - Recepciones con `treat_immediately = true`: **no** crean StorageEvent de cámara fría; se crea
    un `TreatmentRun` **completado** (`started_at = completed_at = now`) en Supabase + store; la
    ubicación se registra como `treatment` (sin pasar por `cold_storage`).
  - Recepciones normales: StorageEvent abierto + ubicación `cold_storage`, como hoy.
- **Ajuste a `computeContainerPhase`** (`src/lib/data/containers.ts`): un `TreatmentRun`/
  `ExternalTransfer` **completado** da `clean` aunque no haya StorageEvent con `exit_at`.
  Reordenar para evaluar el tratamiento/traslado completado antes de exigir el storage. Avanza el
  pendiente **P1** del ADR `decisions/2026-05-21-estado-envase-derivado.md`.
- Efecto colateral buscado: al completarse el tratamiento, la empresa derivada del tacho vuelve a
  null (no hay recorrido abierto en el nuevo ciclo). Ver F6.

### F5 — Activar página de Tratamiento (`/register/treatment`)

- Reescribir para usar Supabase y `currentProfileId` (eliminar `user-1` mock).
- **Candidatos:** tachos **infecciosos** cuya fase computada sea `cold_storage` (no todos los
  infecciosos).
- **Multi-selección:** seleccionar varios tachos y mandarlos a tratamiento en una acción.
- **Cierre en un paso:** cada tacho genera un `TreatmentRun` completado
  (`started_at = completed_at = now`) → fase `clean`. Si su StorageEvent de cámara fría está
  abierto, se cierra (`exit_at = now`).
- **Queries nuevas** en `src/lib/supabase/queries/` (no existen): `createTreatmentRun`; hidratar
  `treatment_runs` si aún no se hidrata. La tabla ya existe (bootstrap Supabase).

### F6 — Empresa seleccionable en recorrido + empresa dinámica derivada

- `route-form.tsx` / páginas `anden/[slot]` y `morgue`: **selector de empresa** (ION/Airkem),
  hoy `clients[0]` fijo. El `route_event` guarda la empresa elegida.
- **Modelo:** `RouteEvent.company_id: string | null` (empresa del recorrido). Migración
  `route_events`: `+ company_id uuid NULL REFERENCES companies(id)`. Se sigue poblando
  `client_id` (institución) desde `company.client_id` para compat y consolidación.
- **Helper nuevo `getContainerCurrentCompanyId(containerId, routeEvents, treatmentRuns, transfers)`**
  en `src/lib/data/containers.ts`: empresa actual del tacho = `company_id` del recorrido más
  reciente que lo recogió sucio **dentro del ciclo abierto** (posterior al último
  tratamiento/traslado completado). Si no hay recorrido abierto → `null`. Esto implementa la
  herencia en pesaje y el reset automático al tratar.
- **Reportes** (`src/lib/data/reports.ts`): agrupar por **institución** usando la empresa
  **registrada** — `reception.company_id` (snapshot) y `routeEvent.company_id` —, no la derivada
  del tacho. Institución = `company.client_id`.
- **Fallback histórico:** eventos sin `company_id` (las 14,375 recepciones y recorridos
  históricos) se atribuyen a Airkem vía `container.company_id`, preservando el histórico
  (253,889 kg) sin tocarlo.

### F7 — Display por número + rename "envase → tacho" + limpieza de mocks

- **Helper `formatTachoNumber(id: string): string`**: quita el prefijo `letra-` del id
  (`'A-001' → '001'`). Se usa en TODA visualización de tachos (pendientes, selectores, drawers,
  reporte PDF, dashboard, admin). El id interno no cambia.
- **Rename app (`src/`):** todos los strings en español "envase(s)" → "tacho(s)" (~126
  ocurrencias en ~36 archivos): labels, botones, mensajes, títulos, diálogos, texto del reporte
  PDF. Cuidar concordancia (artículos ya masculinos).
- **Rename vault/docs:** actualizar la documentación donde "envase" sea término de UI/negocio
  (p. ej. `processes/ContainerLifecycle.md`). Mantener menciones históricas en logs.
- **Código en inglés (`Container`, `container_id`, etc.): NO se toca.**
- **Eliminar los 10 tachos ION mock** (`I-001`..`I-010`) de `src/lib/mock-data.ts`. Las empresas
  ION + Airkem se mantienen como seleccionables. Ajustar fixtures/tests que los referencien.
- Verificación: `grep -i "envase" src` → 0 en strings de UI.

## Resumen de cambios al modelo de datos

| Entidad | Cambio | Migración |
|---------|--------|-----------|
| `container_receptions` | `+ company_id uuid NULL FK companies` (snapshot empresa) | sí |
| `container_receptions` | `+ treat_immediately boolean NOT NULL DEFAULT false` | sí |
| `route_events` | `+ company_id uuid NULL FK companies` (empresa del recorrido) | sí |
| `treatment_runs` | ya existe; se empieza a usar (queries nuevas) | no |
| Container (id) | **sin cambio** — solo display pelado vía helper | no |

`computeContainerPhase`: cambio de lógica (no de esquema) → tratamiento/traslado completado da
`clean`. `getContainerCurrentCompanyId`: helper nuevo de derivación.

## Testing

- **Unit (`src/lib/data/`):**
  - `computeContainerPhase`: tratamiento inmediato completado sin storage → `clean`.
  - `getContainerCurrentCompanyId`: empresa del recorrido abierto; null tras tratamiento;
    cambia de ION→Airkem en ciclos sucesivos.
  - `formatTachoNumber`: `'A-001' → '001'`, ids sin prefijo intactos.
  - Reportes agrupando por institución vía empresa registrada, con fallback histórico a Airkem.
  - Pendientes excluyendo ausentes.
- **Componentes:** `weighing-form` muestra tipo de desecho + empresa heredada y persiste
  `treat_immediately`; ya no hay selector de cliente.
- **E2E manual (dispositivo real):** sesión con pendientes por número, bloqueo + escape por
  ausente, tratado inmediato → tacho vuelve disponible y sin empresa; página de tratamiento
  multi-select; empresa en recorrido reflejada en el reporte. (Se suma al E2E manual pendiente de
  lotes anteriores.)

## Fuera de alcance

- Renumerado del id canónico (se mantiene `A-001` interno; solo display pelado).
- Fijar empresa por sesión de pesaje (el modelo de snapshot lo permite a futuro).
- Flujo de tratamiento en dos pasos / medición de duración.
- Persistencia de tachos ausentes en BD (es transitorio por decisión).
- Reportes por rango/Excel/logos y dashboard anual/consolidado (otros pendientes del backlog).

## Logs / vault a actualizar al cerrar

- `logs/2026-05-29-pesaje-tratamiento-rename-tacho.md` (nuevo).
- `processes/ContainerLifecycle.md` (empresa dinámica, tratamiento inmediato, rename).
- `decisions/` nuevo ADR: empresa dinámica del tacho (derivada del recorrido, reset al tratar).
- `decisions/2026-05-21-estado-envase-derivado.md` (P1 resuelto parcialmente).
- `_index.md` (estado + última actualización; hoy está al 2026-05-21, desactualizado).
