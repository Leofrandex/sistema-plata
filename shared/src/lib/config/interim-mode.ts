/**
 * Modo interino (2026-09-01): el registro de recorridos está deshabilitado
 * mientras se rediseña su arquitectura offline. Ver
 * `docs/superpowers/specs/2026-09-01-modo-interino-solo-pesaje-design.md`.
 *
 * Mientras está en true:
 * - la cola de pesaje se abre a todos los tachos activos,
 * - el Home del APK muestra Recorrido gris ("En mantenimiento"),
 * - el subárbol /register/route no deja registrar,
 * - el dashboard del hub muestra un banner de aviso.
 *
 * Para revertir: poner en false. Eso devuelve la cola de pesaje cerrada y
 * restaura los tres puntos de UI de arriba (Home, guard de /register/route,
 * banner del hub) porque siguen condicionados al flag.
 *
 * Lo que NO vuelve solo: la tira "Pendientes por pesar", el botón "ausente"
 * (`markAbsent`) y el aviso de "quedan N pendientes" del diálogo de
 * finalizar de la pantalla de pesaje se eliminaron sin condicional en esta
 * rama — apagar el flag no los trae de vuelta. Para recuperarlos hay que
 * revertir los commits de `feat/modo-interino-solo-pesaje` que los tocaron
 * (ver el log de esta rama en el vault). `WeighingSessionContext.skipped`
 * (`app/src/lib/active-session.ts`) sigue declarado sin productor ni
 * consumidor justamente para ese regreso: es el campo que alimentaba el
 * botón "ausente" antes de que se borrara.
 */
export const INTERIM_MODE = true
