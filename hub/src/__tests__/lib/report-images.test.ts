import { prepareReportImages, fitWithin } from '@/lib/report-images'

describe('fitWithin', () => {
  it('reduce el lado mayor al máximo y conserva la proporción', () => {
    expect(fitWithin(1920, 1440, 480)).toEqual({ width: 480, height: 360 })
    expect(fitWithin(1080, 1920, 480)).toEqual({ width: 270, height: 480 })
  })

  it('no agranda una imagen que ya es chica', () => {
    expect(fitWithin(300, 200, 480)).toEqual({ width: 300, height: 200 })
  })
})

describe('prepareReportImages', () => {
  it('devuelve la versión reducida de cada url', async () => {
    const loader = jest.fn(async (url: string) => `data:${url}`)
    const out = await prepareReportImages(['a', 'b'], { loader })
    expect(out.get('a')).toBe('data:a')
    expect(out.get('b')).toBe('data:b')
  })

  it('descarga una sola vez las urls repetidas', async () => {
    const loader = jest.fn(async (url: string) => `data:${url}`)
    await prepareReportImages(['a', 'a', 'b'], { loader })
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('reintenta una descarga que falla y se queda con el primer éxito', async () => {
    let calls = 0
    const loader = jest.fn(async () => {
      calls += 1
      if (calls < 3) throw new Error('red')
      return 'data:ok'
    })
    const out = await prepareReportImages(['a'], { loader, retries: 3, retryDelayMs: 0 })
    expect(out.get('a')).toBe('data:ok')
    expect(loader).toHaveBeenCalledTimes(3)
  })

  it('marca como null la foto que falla en todos los intentos, sin frenar el resto', async () => {
    const loader = jest.fn(async (url: string) => {
      if (url === 'mala') throw new Error('red')
      return `data:${url}`
    })
    const out = await prepareReportImages(['mala', 'buena'], { loader, retries: 2, retryDelayMs: 0 })
    expect(out.get('mala')).toBeNull()
    expect(out.get('buena')).toBe('data:buena')
    expect(loader.mock.calls.filter(([u]) => u === 'mala')).toHaveLength(3)
  })

  it('no supera el límite de descargas simultáneas', async () => {
    let active = 0
    let peak = 0
    const loader = async (url: string) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 5))
      active -= 1
      return url
    }
    const urls = Array.from({ length: 20 }, (_, i) => `u${i}`)
    await prepareReportImages(urls, { loader, concurrency: 4 })
    expect(peak).toBe(4)
  })

  it('informa el avance hasta el total', async () => {
    const progress: Array<[number, number]> = []
    await prepareReportImages(['a', 'b', 'c'], {
      loader: async (u) => u,
      onProgress: (done, total) => progress.push([done, total]),
    })
    expect(progress[progress.length - 1]).toEqual([3, 3])
  })
})
