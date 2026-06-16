no# Diseño — Pesaje (pendientes + cliente + tratamiento inmediato), activación de Tratamiento y rename "envase → tacho"

**Fecha:** 2026-05-29
**Estado:** Aprobado para planificación
**Branch:** `feat/recorridos-pesaje-reportes-dashboard`

## Contexto

Lote de cambios post-piloto sobre el flujo de pesaje y tratamiento, más un rename global de
terminología. Surge de una sesión de trabajo con el usuario. El sistema hoy:

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
- Existe **un solo cliente** (Centro de la Salud, empresas ION + Airkem); el modelo soporta más.

## Decisiones tomadas (con el usuario)

1. **Tratamiento inmediato → completado.** El tacho salta cámara fría y queda `clean` (disponible
   para recorrido) de inmediato.
2. **Cliente en pesaje:** se selecciona **por tacho** (por recepción), para efectos del reporte.
   Los tachos **no** están permanentemente atados a un cliente. *(Futuro posible: por sesión —
   se deja preparado, no se implementa.)*
3. **Tipo de desecho en pesaje:** solo informativo, derivado del tacho (no es input).
4. **Bloqueo de finalizar con escape:** no se puede finalizar mientras queden pendientes, pero
   se puede marcar un tacho como **ausente** (con nota opcional) para cerrar. El tacho ausente
   **sigue en la cola** y reaparece en la próxima sesión.
5. **Cliente en recorrido:** se incluye en este lote (andén + morgue). El reporte pasa a
   agruparse por el cliente **registrado** en cada evento.
6. **Tratamiento (página):** completado de una vez (un solo paso) → tacho `clean`. Con
   multi-selección.
7. **Rename:** "envase → tacho" en app **y** vault/docs. Código en inglés (`Container`) se mantiene.

## Diseño por feature

### F1 — Pendientes por pesar visibles en la sesión

En el banner de sesión activa (`weighing/page.tsx`), bajo el contador de registros, mostrar:

> **Pendientes por pesar (N):** `I-001`, `I-006`, `A-135`

- Fuente: `getPendingWeighingContainerIds(containers, routeEvents, receptions)` (ya existe).
- Se muestra el **id completo con letra de empresa** (`I-001`), no el número pelado, para evitar
  ambigüedad entre empresas (`I-001` vs `A-001`).
- Se excluyen los tachos marcados como ausentes en la sesión actual (ver F2) del conteo de
  "bloqueo", pero pueden seguir listándose como "ausentes" de forma diferenciada.
- La lista se recalcula al crear/editar/borrar cada recepción.

### F2 — Bloqueo de finalizar hasta pesar todos (con escape)

- "Finalizar pesaje" se **deshabilita** mientras `pendientesNoAusentes.length > 0`.
  (Hoy solo se deshabilita con 0 recepciones; se reemplaza por esta condición, manteniendo
  además que haya ≥1 recepción.)
- Cada tacho pendiente listado tiene acción **"Marcar como ausente"** que abre un mini-prompt de
  nota opcional. Los ids ausentes se guardan en el contexto de la `ActiveSession` (IndexedDB),
  campo nuevo `skipped: { container_id: string; note: string }[]`. **No** se crea tabla ni
  recepción; es transitorio (el tacho reaparece en la cola la próxima sesión).
- El texto del diálogo de finalización refleja si hubo ausentes ("N tachos quedaron pendientes
  para la próxima sesión").
- Razón del enfoque transitorio: la decisión es que el tacho ausente **sigue pendiente**; como
  reaparece en la cola, no requiere persistencia. La nota es de ayuda operativa en la sesión.

### F3 — Campos nuevos en el formulario de pesaje

`src/components/register/weighing-form.tsx` + estado `WeighingFormState`:

- **Cliente** (`client_id`): selector. Si hay un solo cliente, se autoselecciona. Se persiste en
  la recepción.
- **Tipo de desecho**: campo de solo lectura que muestra `wasteTypeLabel(container.waste_type)`
  del tacho seleccionado. Se actualiza al elegir el tacho.

**Modelo de datos:**
- `ContainerReception` (TS, `src/lib/types.ts`): agregar `client_id: string | null`.
- Migración Supabase: `ALTER TABLE container_receptions ADD COLUMN client_id uuid REFERENCES
  clients(id)` (nullable para compat con histórico). Regenerar `database.types.ts`.
- Queries `createReception` / `updateReception`: incluir `client_id`.
- Hydrator: mapear `client_id`.

### F4 — Check "tratado inmediatamente" (por tacho)

- Checkbox al final del formulario de pesaje: "Tratar inmediatamente (salta cámara fría)".
  Estado `treat_immediately` en `WeighingFormState`, persistido en la recepción.
- **Modelo:** `ContainerReception.treat_immediately: boolean` (default `false`). Migración:
  `ADD COLUMN treat_immediately boolean NOT NULL DEFAULT false`.
- **Al finalizar la sesión** (`handleFinish`):
  - Recepciones con `treat_immediately = true`: **no** crean StorageEvent de cámara fría; en su
    lugar se crea un `TreatmentRun` **completado** (`started_at = completed_at = now`) en Supabase
    + store. La ubicación se registra como `treatment` (sin pasar por `cold_storage`).
  - Recepciones normales: StorageEvent abierto + ubicación `cold_storage`, como hoy.
- **Ajuste a `computeContainerPhase`** (`src/lib/data/containers.ts`): un `TreatmentRun`/
  `ExternalTransfer` **completado** debe dar `clean` aunque no haya StorageEvent con `exit_at`.
  Reordenar la lógica para evaluar el tratamiento/traslado completado antes de exigir el storage.
  Esto avanza el pendiente **P1** del ADR `decisions/2026-05-21-estado-envase-derivado.md`.
  Mantener la cobertura de tests existente y agregar casos: tratado inmediato sin storage → `clean`.

### F5 — Activar página de Tratamiento (`/register/treatment`)

- Reescribir para usar Supabase y `currentProfileId` (eliminar `user-1` mock).
- **Candidatos:** tachos **infecciosos** cuya fase computada sea `cold_storage` (no todos los
  infecciosos). Reusar el cómputo de fase del store/helper.
- **Multi-selección:** permitir seleccionar varios tachos y mandarlos a tratamiento en una acción.
- **Cierre en un paso:** cada tacho seleccionado genera un `TreatmentRun` completado
  (`started_at = completed_at = now`) → fase `clean`. Cierra el StorageEvent de cámara fría
  correspondiente (`exit_at = now`) si está abierto.
- **Queries nuevas** en `src/lib/supabase/queries/` (no existen): `createTreatmentRun`, y al
  hidratar incluir `treatment_runs` si aún no se hidratan. La tabla `treatment_runs` ya existe
  (bootstrap Supabase).

### F6 — Cliente en recorrido (andén + morgue)

- `route-form.tsx` / páginas `anden/[slot]` y `morgue`: selector de cliente (hoy `clients[0]`).
  Se persiste en `route_events.client_id` (la columna ya existe; hoy se llena con `clients[0]`).
- **Reportes** (`src/lib/data/reports.ts`): dejar de derivar el cliente desde
  `container → company → client`; agrupar/filtrar por el cliente **registrado** en las recepciones
  (`reception.client_id`) y en los recorridos (`routeEvent.client_id`). Con un solo cliente el
  resultado es idéntico hoy, pero queda correcto para multi-cliente.
- Fallback: recepciones históricas sin `client_id` se atribuyen al cliente derivado del tacho
  (compat con el histórico de Airkem), para no romper el reporte existente.

### F7 — Rename "envase → tacho"

- **App (`src/`):** reemplazar todos los strings en español visibles "envase(s)" → "tacho(s)"
  (~126 ocurrencias en ~36 archivos): labels, botones, mensajes, títulos, diálogos, textos del
  reporte PDF. Cuidar concordancia (artículos ya son masculinos: "el envase" → "el tacho").
- **Vault/docs:** actualizar la documentación donde diga "envase" como término de UI/negocio
  (p. ej. `processes/ContainerLifecycle.md` título "Ciclo de Vida del Contenedor (Envase/Tacho)").
  Mantener menciones históricas en logs si cambiarlas falsea el registro.
- **Código en inglés (`Container`, `container_id`, etc.): NO se toca.**
- Verificación: `grep -i "envase" src` → 0 en strings de UI tras el cambio.

## Resumen de cambios al modelo de datos

| Entidad | Cambio | Migración |
|---------|--------|-----------|
| `container_receptions` | `+ client_id uuid NULL FK clients` | sí |
| `container_receptions` | `+ treat_immediately boolean NOT NULL DEFAULT false` | sí |
| `route_events.client_id` | ya existe; pasa a poblarse por selección real | no |
| `treatment_runs` | ya existe; se empieza a usar (queries nuevas) | no |

`computeContainerPhase`: cambio de lógica (no de esquema) para que tratamiento/traslado
completado → `clean`.

## Testing

- **Unit (`src/lib/data/`):** `computeContainerPhase` con tratamiento inmediato completado sin
  storage → `clean`; pendientes excluyendo ausentes; reportes agrupando por `client_id` registrado
  con fallback al derivado.
- **Componentes:** `weighing-form` muestra tipo de desecho derivado y persiste cliente +
  `treat_immediately`.
- **E2E manual (dispositivo real):** sesión de pesaje con pendientes listados, bloqueo + escape
  por ausente, tratado inmediato → tacho vuelve disponible; página de tratamiento multi-select;
  cliente en recorrido reflejado en el reporte. (Se suma al E2E manual ya pendiente de lotes
  anteriores.)

## Fuera de alcance

- Selección de cliente **por sesión** de pesaje (solo se deja preparado el modelo).
- Flujo de tratamiento en dos pasos / medición de duración.
- Persistencia de tachos ausentes en BD (es transitorio por decisión).
- Reportes por rango / Excel / logos y dashboard anual / consolidado (otros pendientes del backlog).

## Logs / vault a actualizar al cerrar

- `logs/2026-05-29-pesaje-tratamiento-rename-tacho.md` (nuevo).
- `processes/ContainerLifecycle.md` (tratamiento inmediato; rename).
- `decisions/2026-05-21-estado-envase-derivado.md` (P1 resuelto parcialmente).
- `_index.md` (estado + última actualización; hoy está desactualizado al 2026-05-21).
