# Reactivación del módulo de tratamiento de tachos

**Fecha:** 2026-09-18
**Estado:** diseño aprobado, pendiente de plan de implementación
**Alcance:** APK de operadores (`app/`), lógica compartida (`shared/`), un ajuste de métrica en el hub

---

## Por qué

El módulo de tratamiento se deshabilitó en el código el 2026-09-15 (commit `5fd0575`):
tile del Home en `disabled: true`, guard permanente en el layout de la ruta, entrada
quitada del bottom nav y checkbox "tratar inmediatamente" removido del formulario de
pesaje. El apagado no se documentó en el vault.

Los teléfonos de planta corren el APK v1.5, anterior a ese commit, así que **la pantalla
sigue habilitada en producción**: el 2026-09-18 se registraron 22 tratamientos desde ella.
Esa versión escribe directo a Supabase sin pasar por el outbox, de modo que planta hoy
opera con un camino que pierde registros en silencio cuando no hay red.

Este trabajo no entrega una función nueva. Arregla la que ya se está usando a ciegas y la
reactiva en el código.

## Objetivo

Trazabilidad regulatoria del eslabón "tratado", registrada por el operador que trata, con
garantía de que ningún registro se pierde por falta de conexión.

> **Consecuencia asumida:** la evidencia fotográfica queda fuera de esta etapa (ver
> *Fuera de alcance*). `vault/project/Overview.md:66` exige que la memoria fotográfica
> cubra cada contenedor "recibido, pesado y tratado". Al terminar este trabajo, el informe
> sigue sin cubrir la etapa de tratamiento. Es una decisión de secuencia, no un olvido.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | El operador registra desde el APK | Es quien trata; única fuente posible de evidencia en el momento |
| 2 | Toda escritura pasa por el outbox local | El operador trabaja sin red; hoy los fallos se pierden en un `console.error` |
| 3 | Una sola puerta de entrada: la pantalla de Tratamiento | El atajo "tratar inmediatamente" del pesaje **no** vuelve; un solo camino de escritura que mantener correcto |
| 4 | El tratamiento cierra el `exit_at` de la cámara fría | Es el evento que saca el tacho de ahí; sin esto la métrica de tiempo en cámara fría nunca existe |
| 5 | La cola arranca con los 151 tachos acumulados, sin backfill | Rellenar tratamientos que no sabemos si ocurrieron es fabricar evidencia regulatoria |
| 6 | El id del `treatment_run` es determinista | Colapsa doble tap, dos teléfonos y reenvíos del outbox en una sola fila |
| 7 | Sin conexión, el operador ve la confirmación normal | Coherente con el pesaje; no se le pide pensar en la red |
| 8 | El lavado no se modela | Tratar deja el tacho listo para salir |

## Diseño

### Reparto por capas

Respeta la frontera existente: `shared/src/lib/data/` es lógica pura sin IO;
`app/src/lib/data/field-writes.ts` es escritura al outbox y vive en `app/` porque sólo el
APK escribe en campo. Subir la orquestación a `shared/` le impondría al hub una
dependencia del outbox que no necesita.

| Pieza | Ubicación | Responsabilidad |
|---|---|---|
| `listTreatmentCandidates(slice)` | **nuevo** `shared/src/lib/data/treatment.ts` | Puro. Candidatos ordenados por antigüedad, cada uno con `coldStorageSinceMs` |
| `treatmentRunId(containerId, receptionId)` | **nuevo**, mismo archivo | UUID v5 determinista |
| `submitStorageExit(...)` | `app/src/lib/data/field-writes.ts` | Re-escribe la fila de `storage_events` con `exit_at` |
| `treatContainers(...)` | **nuevo** `app/src/lib/data/treat-containers.ts` | Orquesta las tres escrituras por tacho |
| `updateStorageEvent(...)` | `shared/src/lib/store.ts` | No existe hoy; refleja el `exit_at` en memoria |
| Pantalla | `app/src/app/register/treatment/page.tsx` | Sólo presentación tras la extracción |

### Regla de candidatos

Se conserva la regla vigente y se le agrega orden:

1. `status === 'active'`
2. La última recepción vigente (`voided_at` null) es de tipo `infectious` — los
   anatomopatológicos salen por traslado externo (`vault/processes/WasteTypes.md:16`)
3. No existe `treatment_run` ni `external_transfer` **posterior a esa recepción**,
   comparando fechas y no existencia
4. Existe un `storage_event` posterior a la recepción

**Nuevo:** orden por `entry_at` ascendente y días en cámara fría visibles por fila. Es la
mitigación para la cola inicial de 151: lo que lleva once días parado se distingue de lo
que entró esta mañana.

### Escrituras por tacho confirmado

En orden, todo al SQLite local antes de que salga nada a la red:

| # | Tabla | Contenido |
|---|---|---|
| 1 | `treatment_runs` | `started_at = completed_at = now`, `operator_id`, id determinista |
| 2 | `storage_events` | la fila **existente** más reciente con `exit_at = now`, sólo si estaba en null |
| 3 | `container_locations` | `location_type: 'treatment'`, nota `'Tratamiento'` |

**No es atómico y no puede serlo:** el outbox es fila por fila, sin transacción entre las
tres. La garantía real es durabilidad local antes de red, y drenado posterior. Es
estrictamente mejor que el comportamiento actual, pero no es una transacción.

### Identidad determinista

```
treatment_run.id = uuidv5(NAMESPACE_HOSPIWASTE, `${container_id}:${reception_id}`)
```

`treatment_runs.id` es de tipo `uuid` en Postgres, así que el id debe ser un UUID válido —
no alcanza con una string compuesta. Se genera con `crypto.subtle` (SHA-1), disponible
porque Capacitor sirve en `https://localhost` al no fijarse `androidScheme`, que es secure
context; `crypto.randomUUID()` ya se usa en pesaje y exige lo mismo. Sin dependencia nueva.

Un tratamiento por recepción. Cuando el tacho vuelve sucio hay una recepción nueva y por
lo tanto un id nuevo: los ciclos no colisionan entre sí. Los `container_locations` se
derivan igual. El `storage_event` conserva su id original porque se actualiza, no se crea.

### Riesgo conocido: el payload de `storage_events`

`storage_events` tiene seis columnas: `id, container_id, entry_at, exit_at, operator_id,
created_at`. El `StorageEvent` del store carga además **`photo_ids`**, que no pertenece a
esa tabla. Si el cierre de `exit_at` re-escribe el objeto del store por spread, el upsert
falla con *column photo_ids does not exist* — en el drain, en segundo plano, sin nadie
mirando.

**El payload se construye campo por campo con las columnas reales. Nunca por spread.**
Hay un test dedicado a esto.

### Manejo de fallos

| Situación | Comportamiento |
|---|---|
| Sin red | Escribe local, confirma normal, drena después |
| App muere a mitad de la tanda | Lo escrito queda; el resto sigue en la cola, que es derivada |
| Falla la escritura local de un tacho | Se corta e informa cuántos entraron de verdad. Nunca "12" cuando entraron 9 |
| El servidor rechaza al drenar | **Fuera de alcance.** Problema general del outbox, no del tratamiento |

### Ajuste en el dashboard

`computeCirculationStatus` manda a `en_planta` tanto al tacho cuyo último evento es un
tratamiento completado como al que no tiene **ningún** evento
(`shared/src/lib/data/dashboard-metrics.ts:107`). Hoy son 22 tratados contra 73 sin
actividad, todos en verde.

Se agrega un quinto bucket `sin_actividad`, en gris, para el tacho sin eventos.
`en_planta` (verde) pasa a significar tratado y listo. Alcanza a `CirculationBucket`,
`BUCKET_DEFINITIONS`, `PHASE_OPTIONS` del filtro en el hub y sus tests.

## Pruebas

TDD. Los patrones ya existen en el repo:
`shared/src/__tests__/lib/containers.test.ts` para lógica pura,
`app/src/__tests__/lib/field-writes.test.ts` para outbox con store falso.

`listTreatmentCandidates`:
- Tacho tratado hoy tras recepción de ayer **no** reaparece (regresión del bug de julio)
- Tacho con recepción posterior a su último tratamiento **sí** reaparece
- Anatomopatológico en cámara fría no entra
- Recepción anulada se ignora
- Orden por antigüedad y `coldStorageSinceMs` correcto

`treatContainers`:
- Escribe las tres filas por tacho
- El payload de `storage_events` no lleva `photo_ids`
- No pisa un `exit_at` que ya tenía valor
- Mismo tacho y misma recepción dos veces producen un solo id
- Si falla el tacho 3 de 5, corta y reporta 2

Dashboard: un tacho sin eventos cae en `sin_actividad`, uno tratado en `en_planta`.

## Activación

Cuatro toques, todos de quitar:

- `app/src/app/page.tsx:17` — `disabled: true` → `false`
- `app/src/app/register/treatment/layout.tsx` — vuelve a renderizar `{children}`
- `app/src/components/layout/mobile-bottom-nav.tsx` — restituir la entrada
- `app/src/__tests__/components/home-actions.test.tsx` — hoy afirma que está deshabilitado

`INTERIM_MODE` no se toca: el tratamiento no depende de recorridos y convive con el modo
interino.

**La activación en el código no cambia nada en planta hasta desplegar el APK**, que es un
pendiente ya abierto. Hasta entonces los teléfonos siguen en v1.5, con la pantalla vieja
sin outbox.

## Fuera de alcance

| Qué | Por qué |
|---|---|
| Fotos de tratamiento | Decidido para una etapa posterior. El informe sigue sin cubrir "tratado" |
| Lavado como estado propio | Tratar deja el tacho listo |
| Duración y corridas de autoclave | Depende de una consulta abierta a Francesca (ver abajo) |
| Rechazo permanente del outbox | Problema general del outbox |
| Sanear los 641 `exit_at` abiertos | Requeriría inventar timestamps. La métrica es confiable desde la activación |
| Filtro de 120 L en `/containers` | Defecto real del hub, trabajo aparte |

## Consultas abiertas a planta

1. **¿El tratamiento es por carga de autoclave o tacho por tacho?** Define si más adelante
   hace falta una tabla de corridas con duración propia. No bloquea este trabajo: como la
   duración no se captura todavía (`started_at == completed_at`), el esquema actual
   sobrevive a cualquiera de las dos respuestas y una tabla padre sería aditiva.
2. Si es por carga, **¿la planta cronometra el ciclo?**
3. **¿Qué debería mostrar la foto de un tacho tratado** — el tacho, la carga, el equipo?
   Necesario antes de la etapa de evidencia fotográfica.
