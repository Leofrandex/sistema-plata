# Diseño — Modo interino solo-pesaje (recorridos deshabilitados)

**Fecha:** 2026-09-01
**Estado:** Propuesto — pendiente de plan de implementación
**Alcance:** Dejar la app de campo operativa **solo para Pesaje** (más Tratamiento y Traslado,
que se mantienen intactos) mientras se rediseña la arquitectura offline de recorridos. Implica
abrir la cola de pesaje a todos los tachos, pedir la empresa en el formulario, deshabilitar el
registro de recorridos en el APK, avisar en el hub y resetear los datos operativos a cero.

**Fuera de alcance:** la re-arquitectura offline de recorridos (proyecto B, spec aparte), la
trazabilidad en papel del periodo interino y la limpieza del bucket de fotos.

---

## 1. Contexto

Los recorridos se registran **fuera de la planta**, sin WiFi y con cobertura móvil pobre. La
capa offline actual (`logs/2026-07-23-offline-sqlite-local-first.md`) no está aguantando ese
escenario y se pierde mucho tiempo operativo. La decisión del negocio es **congelar el registro
de recorridos** y rediseñar cómo se guardan y se suben, manteniendo mientras tanto la app viva
para la parte que sí ocurre dentro de planta: el pesaje.

Consecuencia directa: si no hay recorridos, la cola de pesaje —que hoy se deriva de ellos— queda
vacía y la app queda inservible. De ahí el resto del diseño.

---

## 2. El interruptor

Todo el modo cuelga de una constante única:

```ts
// shared/src/lib/config/interim-mode.ts
export const INTERIM_MODE = true
```

La leen exactamente cuatro puntos: la cola de pesaje, el Home del APK, el guard de las rutas de
recorrido y el banner del hub. Revertir cuando llegue B es apagar el flag y borrar esos cuatro
usos.

**Criterio explícito:** no se modifica `getPendingWeighingContainerIds`
(`shared/src/lib/data/containers.ts:112`) ni se revoca el ADR
`decisions/2026-07-28-cola-pesaje-por-fecha.md`. Esa función solo la consume la pantalla de
pesaje del APK, y B la va a necesitar de vuelta tal cual. Se agrega una función hermana y la
pantalla elige entre las dos según el flag.

---

## 3. Cola de pesaje abierta

Nueva función en `shared/src/lib/data/containers.ts`:

```ts
export function getWeighableContainerIds(containers: Container[]): string[]
```

Devuelve todos los tachos con `status === 'active'`, excluyendo `is_yaris_container`
(igual que la función existente, que ya los excluye). Los dedicados Yaris y metálicos siguen
filtrándose en la pantalla como hoy, porque tienen su propio selector.

En `app/src/app/register/weighing/page.tsx:92-94`, `availableContainers` pasa a alimentarse de
esta función cuando `INTERIM_MODE` está encendido.

**Se elimina bajo flag** todo lo que solo tenía sentido con una cola cerrada:

| Elemento | Ubicación |
|---|---|
| Tira "Pendientes por pesar (n)" | `weighing/page.tsx:416` |
| Botón "ausente" y `markAbsent` | `weighing/page.tsx:124,421` |
| `skipped` / `skippedIds` / `pendingNotSkipped` | `weighing/page.tsx:106-113` |
| `pendingCount` en el diálogo de finalizar | `weighing/page.tsx:503,542,618-621` |

El campo `skipped?: { container_id, note }[]` de `ActiveSession`
(`app/src/lib/active-session.ts:41`) se deja declarado —es opcional y B lo reusa—, pero deja de
escribirse. Las sesiones activas ya persistidas en IndexedDB que traigan `skipped` se ignoran sin
error.

---

## 4. Empresa en el pesaje

Hoy la empresa de la recepción se hereda del último recorrido vía
`getContainerCurrentCompanyId` (`containers.ts:164`). Sin recorridos, `inheritedCompanyId` es
siempre `null` y toda la data interina nacería como "Sin empresa" en dashboard y reportes.

**Cambio:** `Select` de empresa en `app/src/components/register/weighing-form.tsx`, **obligatorio**
(entra en la condición de validación de la línea 110), precargado con la empresa heredada cuando
exista. En el interino nunca existirá, pero el campo queda listo para B, donde el operador podrá
corregir una herencia equivocada.

- `container_receptions.company_id` ya existe y `submitReception` ya lo recibe → **sin migración**.
- `deriveContainerCompanyId` ya cae a las recepciones como fallback, así que dashboard, reportes y
  kg-por-empresa siguen atribuyendo correctamente sin tocar analítica.
- Hay 2 empresas en la base, así que el selector es barato en toques.

---

## 5. Selección de tacho

El control actual (`weighing-form.tsx:151`) es un `Select` plano. Con ~246 tachos activos en la
lista deja de ser usable.

**Cambio:** combobox con filtro numérico — un input que filtra por número de tacho y muestra las
coincidencias como opciones seleccionables. Se mantiene el formato de display actual
(`formatTachoNumber(c.id) · {size_liters} L`). Los selectores de Yaris y metálicos **no se tocan**:
sus catálogos son cortos y ya funcionan.

---

## 6. Aviso de duplicado

Al quitar la cola desaparece la única protección contra pesar dos veces el mismo tacho. Se agrega
un aviso **suave, no bloqueante**: si el tacho seleccionado ya tiene una recepción vigente
(`voided_at is null`) con `arrived_at` dentro del día local en curso, el formulario muestra
"este tacho ya se pesó hoy a las HH:MM". El operador puede continuar — hay casos legítimos de
doble pesaje en el mismo día.

---

## 7. APK

En `app/src/app/page.tsx`:

- La entrada **Recorrido** (`ACTIONS`, línea 14) se renderiza gris, con etiqueta "En mantenimiento"
  y sin navegación. Se mantiene visible a propósito: el operador debe entender por qué no está,
  en vez de creer que la app se rompió.
- El bloque "Recorridos de hoy" (línea 89) se oculta.
- Tratamiento y Traslado externo quedan **intactos**.

Guard en las rutas `/register/route/**` (`page.tsx`, `anden/`, `morgue/`): si `INTERIM_MODE` está
encendido, redirigen a Home. Cubre deep links y pestañas que quedaran abiertas de una sesión
anterior.

---

## 8. Hub

Banner en `hub/src/app/dashboard/page.tsx`:

> Modo interino: el registro de recorridos está deshabilitado. Los estados de circulación y el
> historial de recorridos no son representativos.

**Cero cambios en los cálculos.** Tras el reset, con la tabla de eventos vacía, los 246 tachos
aparecerán como "En planta" y luego irán pasando a "Pendiente por tratar" a medida que se pesen;
es un artefacto conocido del modo y el banner lo explica. Mantener la lógica intacta es lo que
hace la reversión trivial.

---

## 9. Reset de datos operativos

Espejo del procedimiento del `logs/2026-07-28-reset-datos-operativos.md`:

1. Respaldo a `backups/2026-09-01-reset/` (gitignored), con conteos validados 1:1 antes de borrar.
2. `TRUNCATE ... RESTART IDENTITY` de las 10 tablas operativas: `route_events`,
   `route_event_containers_dirty`, `route_event_containers_clean`, `weighing_sessions`,
   `container_receptions`, `storage_events`, `treatment_runs`, `container_locations`,
   `external_transfers`, `photos`.
3. Se conservan `containers` (246), `equipment`, `profiles`, `clients`, `companies`.

**Orden de ejecución:** el reset va **después** de desplegar el APK interino a los teléfonos, para
que ningún dispositivo con la versión anterior drene su outbox encima de la base ya vaciada.

> [!warning] Bucket de fotos sin limpiar (riesgo aceptado)
> **Fecha:** 2026-09-01
> **Problema:** el bucket `photos` arrastra 943 objetos huérfanos / 259 MB de tres resets previos;
> tras este cuarto reset ronda los ~1.200 objetos y se acerca al límite de 1 GB del plan Free.
> **Acción requerida:** decidido conscientemente no atacarlo en este ciclo. Vaciarlo vía Storage
> API o dashboard antes del próximo reset.

---

## 10. Verificación

**Jest (shared + app):**
- `getWeighableContainerIds`: incluye activos, excluye `status !== 'active'` y `is_yaris_container`.
- Empresa obligatoria: el formulario no valida sin `company_id`.
- Duplicado del día: detecta recepción vigente de hoy; ignora recepciones anuladas y de días
  anteriores.
- Los tests existentes de `getPendingWeighingContainerIds`
  (`shared/src/__tests__/lib/containers.test.ts:234`) siguen verdes **sin modificarse** — es la
  señal de que B podrá volver sin arqueología.

**Manual / build:**
- `npm run build:hub` y `npm run build:app` verdes.
- `npx cap sync android` desde `app/`, APK release firmado con la misma llave que v1.2
  (no requiere desinstalar en los teléfonos ya migrados).
- E2E en dispositivo: pesar un tacho cualquiera sin recorrido previo, con empresa elegida, y
  verificar que llega a Supabase con `company_id` y aparece en el historial del hub.

---

## 11. Nota permanente

Los pesajes registrados durante el interino quedan **sin recorrido asociado para siempre**. Cuando
llegue la arquitectura B ese hueco no se rellena: no hay registro de qué se recogió sucio, qué se
entregó limpio ni firma del cliente en andén/morgue durante el periodo. La trazabilidad regulatoria
de esos días depende del respaldo en papel, que queda fuera de este spec.
