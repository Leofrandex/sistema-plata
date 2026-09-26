import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InAppCamera, captureSize } from '@/components/register/in-app-camera'

function fakeStream() {
  const track = { stop: jest.fn() }
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track }
}

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  const getUserMedia = jest.fn(impl)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })
  return getUserMedia
}

beforeAll(() => {
  // jsdom no reproduce video: play() no existe.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    value: jest.fn().mockResolvedValue(undefined),
    configurable: true,
  })
})

describe('captureSize', () => {
  it('limita el lado mayor a 1280 px y conserva la proporción', () => {
    expect(captureSize(1920, 1080)).toEqual({ width: 1280, height: 720 })
    expect(captureSize(1080, 1920)).toEqual({ width: 720, height: 1280 })
  })

  it('no agranda un video más chico', () => {
    expect(captureSize(640, 480)).toEqual({ width: 640, height: 480 })
  })
})

describe('InAppCamera', () => {
  it('pide la cámara trasera sin audio', async () => {
    const { stream } = fakeStream()
    const getUserMedia = mockGetUserMedia(async () => stream)
    render(<InAppCamera onCapture={jest.fn()} onCancel={jest.fn()} onUnavailable={jest.fn()} />)
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    const constraints = getUserMedia.mock.calls[0][0] as MediaStreamConstraints
    expect(constraints.audio).toBe(false)
    expect((constraints.video as MediaTrackConstraints).facingMode).toEqual({ ideal: 'environment' })
  })

  it('si la cámara no se puede abrir, avisa para usar la cámara del sistema', async () => {
    mockGetUserMedia(async () => { throw new Error('NotAllowedError') })
    const onUnavailable = jest.fn()
    render(<InAppCamera onCapture={jest.fn()} onCancel={jest.fn()} onUnavailable={onUnavailable} />)
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1))
  })

  it('si el WebView no tiene getUserMedia, avisa sin intentar', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    const onUnavailable = jest.fn()
    render(<InAppCamera onCapture={jest.fn()} onCancel={jest.fn()} onUnavailable={onUnavailable} />)
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1))
  })

  it('al cancelar apaga la cámara', async () => {
    const { stream, track } = fakeStream()
    mockGetUserMedia(async () => stream)
    const onCancel = jest.fn()
    render(<InAppCamera onCapture={jest.fn()} onCancel={onCancel} onUnavailable={jest.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /cancelar/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(track.stop).toHaveBeenCalled())
  })

  it('al desmontarse apaga la cámara', async () => {
    const { stream, track } = fakeStream()
    const getUserMedia = mockGetUserMedia(async () => stream)
    const { unmount } = render(<InAppCamera onCapture={jest.fn()} onCancel={jest.fn()} onUnavailable={jest.fn()} />)
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    unmount()
    await waitFor(() => expect(track.stop).toHaveBeenCalled())
  })
})
