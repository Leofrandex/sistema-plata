import { weighingSessionControls } from '@/lib/weighing-session-rules'

describe('weighingSessionControls', () => {
  it('sesión propia sin pesajes: se puede cancelar y registrar, no finalizar', () => {
    expect(weighingSessionControls({ sessionOperatorId: 'op-a', currentProfileId: 'op-a', receptionCount: 0 }))
      .toEqual({ ownerIsOther: false, canCancel: true, canRegister: true, canFinish: false })
  })

  it('sesión propia con pesajes: no se puede cancelar (borraría los pesajes), sí finalizar', () => {
    expect(weighingSessionControls({ sessionOperatorId: 'op-a', currentProfileId: 'op-a', receptionCount: 8 }))
      .toEqual({ ownerIsOther: false, canCancel: false, canRegister: true, canFinish: true })
  })

  it('sesión de otro operador con pesajes: solo se puede finalizar, sin registrar ni cancelar', () => {
    expect(weighingSessionControls({ sessionOperatorId: 'op-a', currentProfileId: 'op-b', receptionCount: 8 }))
      .toEqual({ ownerIsOther: true, canCancel: false, canRegister: false, canFinish: true })
  })

  it('sesión de otro operador vacía: se puede cancelar (no hay nada que perder)', () => {
    expect(weighingSessionControls({ sessionOperatorId: 'op-a', currentProfileId: 'op-b', receptionCount: 0 }))
      .toEqual({ ownerIsOther: true, canCancel: true, canRegister: false, canFinish: false })
  })

  it('sin operador autenticado todavía: no se registra ni se toma la sesión como ajena', () => {
    expect(weighingSessionControls({ sessionOperatorId: 'op-a', currentProfileId: null, receptionCount: 3 }))
      .toEqual({ ownerIsOther: false, canCancel: false, canRegister: false, canFinish: true })
  })
})
