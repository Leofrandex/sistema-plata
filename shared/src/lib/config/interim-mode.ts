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
 * Para revertir: poner en false y borrar los cuatro usos.
 */
export const INTERIM_MODE = true
