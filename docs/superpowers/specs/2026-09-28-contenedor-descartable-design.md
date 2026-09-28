# Contenedor descartable para Citotóxico, Anatomopatológico y Morgue — diseño

**Fecha:** 2026-09-28
**Estado:** aprobado en chat, pendiente de revisión del spec escrito

## Problema

En el pesaje, cada recepción tiene que apuntar a un tacho registrado (`container_receptions.container_id`
es NOT NULL con FK a `containers`), y el peso neto se calcula como bruto menos la tara de ese tacho.

Citotóxico, anatomopatológico y morgue no se pesan en tachos: van en contenedores propios que se
desechan con el residuo. Para poder registrar esos pesajes, los operadores eligen un tacho rojo
cualquiera. Desde el 2026-09-07 hay 11 pesajes anatomopatológicos así (011, 067, 081, 086, 115, 119,
137, 156, 176, 182, Y2), lo que provoca dos cosas:

- **Neto incorrecto:** se resta la tara de un tacho que no se usó.
- **Circulación falsa:** esos tachos aparecen como "pendientes por tratar" en el dashboard.

## Decisiones del usuario

| Pregunta | Decisión |
|---|---|
| Tipos alcanzados | Citotóxico, Anatomopatológico, Morgue (**no** Líquidos) |
| Qué se pide | Foto de balanza + foto del contenedor + **número de contenedor escrito** (obligatorio) |
| Tara | No aplica: neto = bruto |
| Históricos (11 anatomopatológicos) | Se corrigen: sin tacho, neto = bruto |
| Enfoque | A: el tacho pasa a ser opcional y se agrega una columna `container_ref` (se descartó el "tacho ficticio con tara 0") |

Esto **corrige** `vault/processes/WasteTypes.md`, que decía que todos los tipos se casan a un
contenedor; se actualiza con un `[!warning]`.

## 1. Datos

Constante compartida, en `shared/src/lib/types.ts` o `constants`:

```ts
export const DISPOSABLE_CONTAINER_WASTE_TYPES = ['cytotoxic', 'anatomopathological', 'morgue'] as const
```

**Migración 1** — `supabase/migrations/20260928000000_contenedor_descartable.sql`:

```sql
alter table public.container_receptions alter column container_id drop not null;
alter table public.container_receptions add column container_ref text;
-- Históricos: los anatomopatológicos quedaron cargados contra un tacho cualquiera.
update public.container_receptions
   set container_id = null, container_ref = 'S/N (histórico)'
 where waste_type in ('cytotoxic', 'anatomopathological', 'morgue') and container_id is not null;
```

La FK a `containers` se mantiene: si hay tacho, tiene que existir.

**Migración 2** — `supabase/migrations/20260928000100_contenedor_descartable_check.sql`. Se aplica
**solo después** de que todos los teléfonos tengan v1.12; un APK viejo seguiría mandando tacho
para estos tipos y la regla rechazaría esos pesajes.

```sql
alter table public.container_receptions add constraint container_receptions_container_by_type check (
  case when waste_type in ('cytotoxic', 'anatomopathological', 'morgue')
       then container_id is null and coalesce(btrim(container_ref), '') <> ''
       else container_id is not null and container_ref is null end
);
```

Tipos:
- `ContainerReception.container_id: string | null`.
- `ContainerReception.container_ref?: string | null`.
- Se regenera `database.types.ts`. El hydrator y los adaptadores propagan `container_ref`.

## 2. Peso neto en un solo lugar

En `shared/src/lib/data/containers.ts`:

```ts
/** Neto de una recepción: sin tacho (contenedor descartable) no hay tara. */
export function receptionNetWeight(reception: Pick<ContainerReception, 'gross_weight_kg' | 'container_id'>, containers: Container[]): number
```

Reemplaza los cálculos `gross − tara` de estos archivos:
- `dashboard-analytics.ts`
- `dashboard-metrics.ts`
- `historical-kg.ts`
- `containers.ts`
- `weighing-history.tsx`
- `weighing-session-drawer.tsx`
- `weighing-form.tsx`

`computeNetWeight(gross, tare)` sigue existiendo como primitiva.

Todo código que busca el tacho de una recepción debe tolerar `container_id = null`, entre otros:
- la circulación de tachos;
- la cola de pesaje;
- `findTodayReceptionForContainer`;
- la empresa derivada del tacho;
- el informe fotográfico, que agrupa pares por `container_id`.

Las recepciones sin tacho **no** afectan el estado de ningún tacho.

## 3. APK — formulario de pesaje

- Con un tipo de `DISPOSABLE_CONTAINER_WASTE_TYPES`, el buscador y selector de tacho se reemplaza por
  **"N° de contenedor"**: texto obligatorio, sin espacios al inicio ni al final, hasta 30 caracteres.
- Cambiar hacia o desde uno de estos tipos limpia el tacho o el número elegido, igual que hoy
  pasa al cruzar a metálicos.
- Peso: el neto se muestra igual al bruto, con la leyenda "sin tara". La validación exige
  bruto > 0 (hoy exige bruto > tara).
- Fotos: siguen las dos obligatorias; la del tacho se titula "Foto del contenedor".
- No se muestra el aviso "este tacho ya se pesó hoy".
- `WeighingFormState` suma `container_ref: string`. El envío guarda `container_id: null` y
  `container_ref` con el texto limpio.
- La empresa la elige el operador (no hay tacho del cual heredarla).
- El borrador de pesaje (`weighing-draft`) guarda el campo nuevo sin cambios de lógica.

## 4. Hub

- **Historial de pesajes:** muestra "Contenedor {container_ref}" en lugar del tacho. En la edición,
  estos tipos editan el número en un campo de texto y no el selector de tacho.
- **Lista lateral del pesaje (APK):** misma etiqueta "Contenedor {n}".
- **Informe fotográfico:** los pares balanza/contenedor se arman igual. No muestra números, así que
  no cambia más allá de tolerar `container_id = null`.

## 5. Pruebas

- `receptionNetWeight`: con tacho resta la tara; sin tacho devuelve el bruto; tacho inexistente
  devuelve el bruto.
- Formulario:
  - con citotóxico, anatomopatológico o morgue se ve "N° de contenedor", no se ve el selector, y
    no se puede enviar sin número;
  - con infeccioso se ve el selector;
  - al cruzar de tipo se limpia el campo.
- La circulación ignora recepciones sin tacho.
- El informe fotográfico arma pares para recepciones sin tacho.
- Migración 1 contra el piloto:
  - los 11 quedan con `container_id` null y `container_ref = 'S/N (histórico)'`;
  - sus kg netos pasan a ser iguales al bruto;
  - ningún pesaje infeccioso cambia.

## Despliegue

1. Migración 1 + código + APK v1.12. El hub se despliega con el push.
2. Instalar v1.12 en los teléfonos de planta.
3. Aplicar la migración 2 (la regla).

Entre 1 y 3, un teléfono con APK viejo todavía puede cargar estos tipos contra un tacho. Cuando se
aplique la regla, esos pesajes se detectan con una consulta y se corrigen como los 11 históricos.

## Fuera de alcance

- Catálogo de contenedores descartables. El número es texto libre y no se valida contra una lista.
- Líquidos.
- Cambios en el flujo de almacenaje o traslado externo de estos tipos.
