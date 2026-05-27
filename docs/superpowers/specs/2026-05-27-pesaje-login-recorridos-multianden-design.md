# Diseño — Ajustes Pesaje / Login / Recorridos multi-andén

**Fecha:** 2026-05-27
**Alcance:** Tareas 1-4 de un lote de 5. La tarea 5 (rediseño del reporte fotográfico)
se diseña por separado cuando exista la imagen de ejemplo de referencia.

---

## Contexto

Lote de ajustes post-piloto sobre el sistema Hospiwaste. Las tareas 1-3 son cambios
prescriptivos puntuales; la tarea 4 es una feature que replica en recorridos el
patrón multi-registro ya probado en pesaje (sesión → varios registros editables).

Archivos de referencia:
- `src/components/register/weighing-form.tsx` — formulario de pesaje (tareas 1, 3)
- `src/app/login/page.tsx` — login (tarea 2)
- `src/app/register/weighing/page.tsx` + `weighing-session-drawer.tsx` — patrón sesión (referencia tarea 4)
- `src/app/register/route/anden/[slot]/page.tsx` — recorrido de andén (tarea 4)
- `src/lib/active-session.ts` — sesiones persistidas en IndexedDB

---

## Tarea 1 — Yaris: "vehículo" → "tacho" + quitar ícono del carro

En `src/components/register/weighing-form.tsx`:
- Eliminar el ícono `Car` del label "Envase Yaris" y del badge "Dedicado a Yaris".
  **Sin ícono de reemplazo.**
- Texto del toggle "¿Es un pesaje de Yaris?": "…la carga viene de un **vehículo**
  Yaris/Picanto." → "…la carga viene de un **tacho** Yaris."
- Quitar el import de `Car` de lucide-react.

---

## Tarea 2 — Ver/ocultar contraseña en login

En `src/app/login/page.tsx`:
- Nuevo estado `showPassword: boolean` (default `false`).
- Envolver el `Input` de contraseña en un contenedor `relative`; agregar un botón
  ícono (`Eye` / `EyeOff` de lucide-react) posicionado a la derecha dentro del campo.
- Click alterna `showPassword`; el `type` del input pasa de `password` a `text` y
  viceversa. El ícono refleja el estado (ojo abierto / cerrado).
- El campo de correo no cambia. Accesible: `aria-label` "Mostrar/Ocultar contraseña".

---

## Tarea 3 — Reordenar fotos de pesaje (balanza arriba, tacho abajo)

En `src/components/register/weighing-form.tsx`, bloque de fotos:
- Cambiar el grid de 2 columnas (`grid-cols-1 sm:grid-cols-2`) a **una sola columna
  apilada**.
- Orden: "Foto de la balanza" **arriba**, "Foto del envase" **abajo**.
- **Restricción:** solo cambia el orden visual del JSX. Los campos
  `photo_container` / `photo_scale` y el orden con que se suben (`[photo_container,
  photo_scale]`) NO cambian, para no romper el mapeo del reporte (idx 0 = Envase,
  idx 1 = Balanza).

---

## Tarea 4 — Recorridos multi-andén dentro de cada horario

### Objetivo

Hoy cada horario fijo (slot) admite **un solo** registro de recorrido (un andén).
Se quiere que, dentro de un mismo horario, el operador registre **varios andenes**
—cada uno con sus envases, ubicación y fotos— como registros independientes que
pertenecen a la misma "sesión" del horario, replicando el patrón de pesaje. El
operador puede revisitar y editar un andén anterior **sin perder datos ni fotos**.

### Decisiones tomadas

- Se mantienen los 6 horarios fijos; el multi-andén ocurre **dentro** de cada horario.
- **Recorrido completo primero:** los envases se consolidan al finalizar el recorrido
  completo, no por andén.
- **No se agrega tabla nueva.** Cada andén = un `route_event` existente. La "sesión"
  del horario se identifica por `(date, slot, kind='anden')` y su estado abierto/cerrado
  vive en la `ActiveSession` de IndexedDB + el `status` de los `route_events`.

### Esquema (1 migración)

- Eliminar el índice único parcial `route_events_anden_unique_date_slot`
  (`ON route_events (date, slot) WHERE kind='anden'`) para permitir varios andenes
  por horario/día.
- Sin columnas nuevas.

### Modelo de estados

- Andén guardado durante una sesión abierta → `route_event` con `status='in_progress'`.
- Al finalizar el recorrido → todos los andenes `in_progress` del horario pasan a
  `status='completed'` con `ended_at`.

### Flujo en `anden/[slot]/page.tsx` (reescrito al estilo de `weighing/page.tsx`)

- **Iniciar recorrido:** crea solo la `ActiveSession` (IndexedDB) con el cronómetro.
  Aún sin `route_event`.
- **Guardar andén y agregar otro:** crea un `route_event` (`in_progress`) con los
  envases sucios/limpios + piso/área/andén del formulario, y **sube sus fotos en ese
  momento** (resuelve la pérdida de fotos). Limpia el formulario para el siguiente andén.
- **Drawer lateral** (`RouteSessionDrawer`, espejo de `WeighingSessionDrawer`): lista
  los andenes guardados del horario (ubicación, conteo de envases, conteo de fotos).
  Click → carga ese andén al formulario en modo edición.
- **Editar andén:** carga datos + fotos existentes (URLs firmadas del store) al
  formulario. Al guardar: actualiza datos, **sube solo las fotos nuevas** y preserva
  las existentes por su `photo_id`. Las fotos existentes nunca se re-suben ni se pierden.
- **Finalizar recorrido:** marca todos los andenes `in_progress` del horario como
  `completed` + `ended_at`, borra la `ActiveSession`, vuelve al listado.
- **Cancelar recorrido:** borra todos los andenes `in_progress` del horario y la
  `ActiveSession`.

### Manejo de fotos en edición (sin pérdida)

El `RouteForm` maneja `photos: string[]` (dataURLs). Para edición, la página separa:
- `existingPhotoIds: string[]` — fotos ya subidas (se conservan).
- `state.photos` — solo dataURLs nuevas a subir.
Las fotos existentes se muestran como preview (URL firmada) pero no van en `state.photos`,
de modo que `uploadEventPhotos` (que espera dataURLs) solo procesa las nuevas. El
`photo_ids` final del andén = `existingPhotoIds` (menos las removidas) + ids de las nuevas.

### Re-entrada / recuperación

- Hay `ActiveSession` → reanuda sesión abierta (lista de andenes + formulario en blanco).
- No hay sesión, pero hay andenes `in_progress` del horario (app cerrada a mitad) →
  reconstruye la `ActiveSession` y reanuda (sin pérdida de datos).
- Hay andenes `completed` y ninguno `in_progress` → vista read-only "Recorrido
  completado" (no se reinicia el horario hoy; misma regla actual).

### Ajustes colaterales

- `findAndenInProgress` (`queries/route-events.ts`) pasa a devolver **lista** de
  `route_events` in_progress del horario (no `maybeSingle`).
- La lógica de recuperación por 409 en el `handleStart` actual se elimina (ya no hay
  constraint único que la dispare).
- `anden/page.tsx` (listado): el cálculo de estado por slot se actualiza a la nueva
  semántica (in_progress si hay sesión o andenes in_progress; completed si hay
  completados y ninguno in_progress).
- Reportes: una "ruta" en el reporte = agrupación de `route_events` por `(date, slot)`.
  (El detalle de layout es parte del diseño de la tarea 5.)

---

## Fuera de alcance

- Tarea 5 (rediseño del reporte fotográfico): orden por día→ruta→recorrido+pesaje,
  cuadros por tacho, 8 fotos por cuadro, 4 cuadros por página, salto de página por día,
  selector de rango de fechas. Se diseña por separado al disponer de la imagen de ejemplo.
- Recorridos de Morgue: sin cambios (no usan horarios fijos ni multi-andén).
