# Diseño — Firma por recorrido + saludo con nombre en dashboard + redacción en pesaje

**Fecha:** 2026-06-15
**Rama:** `feat/lote-fotos-persistencia-traza` (o rama nueva derivada)
**Estado:** Aprobado para implementación

## Contexto

Tres ajustes solicitados tras el lanzamiento del PTDP:

1. Cada **registro de recorrido** (andén y morgue) debe capturar una **firma dibujada**, distinta por registro.
2. El **dashboard** debe saludar por nombre al usuario logueado (p. ej. "Buenos días, Karolyne").
3. Mejorar la **redacción** de la opción "Tratar inmediatamente" en pesaje.

## Decisiones tomadas

| Decisión | Valor |
|----------|-------|
| Firma obligatoria u opcional | **Obligatoria** (validada en UI, igual que las fotos) |
| Alcance de la firma | **Andén y Morgue** (ambos usan `RouteForm`) |
| Firma en el reporte PDF | **No** por ahora — solo capturar y persistir |

---

## 1. Firma por registro de recorrido

### Almacenamiento (sin migración)

`photos.role` ya es `string | null`, así que la firma se guarda como una fila en
`public.photos` con `role='signature'`, vinculada al `route_event` vía `event_id`
(`event_type='route'`). **Una firma por registro.** Reutiliza el pipeline existente:

- Subida: `uploadEventPhotos(...)` con `role: 'signature'`.
- Hidratación: `groupRoutePhotosByRole` (extendido) reconstruye la firma por evento.

No se requiere migración de Supabase.

### Componente nuevo `SignaturePad`

Ruta: `src/components/register/signature-pad.tsx`. Sin librerías externas (canvas +
pointer events nativos, consistente con el resto del código).

**Estados:**
- **Colapsado:** tarjeta/botón "Firma del recorrido *". Muestra placeholder
  ("Tocá para firmar") o, si ya hay firma, la miniatura.
- **Expandido:** overlay full-screen con `<canvas>` amplio para dibujar con
  dedo/puntero. Botones **Borrar** (limpia el canvas) y **Listo** (exporta a PNG
  data URL, cierra el overlay y vuelve al estado colapsado con la miniatura).

**Props (contrato):**
- `value: string | null` — data URL de la firma nueva (no subida aún).
- `existing?: { id: string; url: string } | null` — firma ya subida (modo edición).
- `onChange(dataUrl: string | null)` — al confirmar/borrar una firma nueva.
- `onRemoveExisting?()` — quita la firma existente para permitir re-firmar.
- `disabled?: boolean` — respeta el patrón `locked` del formulario.

### Integración en `RouteForm`

Extender `RouteFormState`:
- `signature: string | null` — firma nueva (data URL) a subir.

Nuevas props de `RouteForm`:
- `existingSignature?: { id: string; url: string } | null`
- `onRemoveExistingSignature?: () => void`

El campo de firma se renderiza como una nueva `section` dentro de `RouteForm`,
sujeta al mismo wrapper `locked`.

### Wiring por pantalla

**Andén** (`src/app/register/route/anden/[slot]/page.tsx`):
- `EMPTY_FORM` incluye `signature: null`.
- `handleCreateAnden` / `handleUpdateAnden`: subir `formState.signature` con
  `role: 'signature'` vía `uploadEventPhotos`; agregar el `Photo` resultante al
  store con `addPhoto`. Guardar el id en `signature_photo_id` del route_event.
- `handleSelectAnden`: reconstruir `existingSignature` desde `ev.signature_photo_id`
  (buscar en `photos`). Resetear en `resetForm`.
- `removeExistingSignature`: limpia `existingSignature` (misma semántica que
  `removeExistingDirty/Clean`; deja huérfana la fila/archivo — pendiente conocido).
- `canSaveAnden`: añadir `hasSignature = !!formState.signature || !!existingSignature`.

**Morgue** (`src/app/register/route/morgue/page.tsx`):
- `formState` inicial incluye `signature: null`.
- `handleFinish`: subir la firma con `role: 'signature'` junto a las fotos;
  guardar `signature_photo_id` en el patch del route_event.
- `canFinish`: exigir firma además de la foto de sucios.
- Morgue no tiene modo edición de firma existente (un solo registro que se
  finaliza); `existingSignature` no aplica.

### Tipos

`src/lib/types.ts` — `RouteEvent`:
- `signature_photo_id?: string | null` (opcional; los mocks/literales lo dejan undefined).

### Hidratación

`src/components/supabase-hydrator.tsx`:
- `groupRoutePhotosByRole` devuelve también `signatureByEvent: Map<string, string>`
  (event_id → photo_id de la firma; última gana si hubiera más de una).
- Al mapear route_events, poblar `signature_photo_id` desde ese map.
- La URL firmada de la firma ya queda disponible vía la tabla `photos` hidratada
  (mismo mecanismo que dirty/clean), así que `handleSelectAnden` puede resolver
  `existingSignature` buscando el `Photo` por id.

### Validación de obligatoriedad

En la UI (`canSaveAnden` / `canFinish`), igual que las fotos hoy. No se agrega
constraint en DB (consistente con el patrón actual).

---

## 2. Saludo con nombre en el dashboard

`src/components/dashboard/dashboard-hero.tsx`:
- Acepta prop `name?: string`.
- Render: `{greeting}{name ? `, ${name}` : ''}` → "Buenos días, Karolyne".

`src/app/dashboard/page.tsx`:
- Resolver el nombre desde el store: `users.find(u => u.id === currentProfileId)?.name`.
- Tomar el **primer nombre** (`name.split(' ')[0]`).
- Pasarlo como `name` a `DashboardHero`. Si no hay nombre hidratado, no pasa nada
  y el saludo queda sin nombre (fallback elegante).

---

## 3. Redacción de "Tratar inmediatamente"

`src/components/register/weighing-form.tsx`:
- Mantener el título "Tratar inmediatamente".
- Reemplazar el texto descriptivo
  `"Al finalizar el pesaje, este tacho salta cámara fría y queda disponible."`
  por **"Marcar para enviar el tacho directamente a tratamiento"**.

---

## Testing

- Extender el unit test de `groupRoutePhotosByRole` para cubrir el rol `signature`.
- `npm run test:jest` y `next build` verdes.
- E2E manual de la firma (dibujar, guardar, editar, re-firmar) queda para el usuario.

## Fuera de alcance

- Inclusión de la firma en el reporte fotográfico PDF.
- Limpieza de filas/archivos de firmas huérfanas al re-firmar (pendiente conocido,
  igual que con fotos).
- Constraint de obligatoriedad en DB.
