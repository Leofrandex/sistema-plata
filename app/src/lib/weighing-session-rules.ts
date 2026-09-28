/**
 * Qué se puede hacer con la sesión de pesaje abierta en este teléfono.
 *
 * Por qué existe: la sesión activa se guarda por día y por teléfono, no por
 * operador. En los teléfonos compartidos, el operador del turno siguiente veía
 * la sesión abierta de otro como propia y la cancelaba; "Cancelar" borra la
 * sesión y sus pesajes del servidor. Así se perdieron 35 pesajes entre el 16 y
 * el 26-09 (ver log 2026-09-28-cancelar-pesaje-borraba-registros).
 *
 * Reglas:
 * - Cancelar solo una sesión vacía: con pesajes, lo único posible es finalizar.
 * - Registrar pesajes solo en la sesión propia.
 * - Cualquiera puede finalizar una sesión con pesajes (cierra la de otro turno).
 */
export interface SessionControls {
  ownerIsOther: boolean
  canCancel: boolean
  canRegister: boolean
  canFinish: boolean
}

export function weighingSessionControls({
  sessionOperatorId,
  currentProfileId,
  receptionCount,
}: {
  sessionOperatorId: string
  currentProfileId: string | null
  receptionCount: number
}): SessionControls {
  const ownerIsOther = currentProfileId != null && sessionOperatorId !== currentProfileId
  const isOwn = currentProfileId != null && sessionOperatorId === currentProfileId
  return {
    ownerIsOther,
    canCancel: receptionCount === 0 && currentProfileId != null,
    canRegister: isOwn,
    canFinish: receptionCount > 0,
  }
}
