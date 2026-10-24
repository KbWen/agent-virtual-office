import { afterEach, describe, it, expect, vi } from 'vitest'
import { blobToDataUrl, createCardPreviewRenderer } from './cozyCardPreview.js'

afterEach(() => vi.unstubAllGlobals())

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function setup(render, { createImageSource } = {}) {
  const states = []
  const createUrl = vi.fn(blob => `blob:${blob}`)
  const revokeUrl = vi.fn()
  const onError = vi.fn()
  const renderer = createCardPreviewRenderer({
    render, createUrl, revokeUrl, createImageSource, onError, onChange: state => states.push(state),
  })
  return { renderer, states, createUrl, revokeUrl, onError }
}

describe('cozy postcard preview lifecycle', () => {
  it('converts a rendered PNG blob to a CSP-allowed data URL', async () => {
    const reader = {
      result: 'data:image/png;base64,UE5H',
      onload: null,
      onerror: null,
      readAsDataURL: vi.fn(function () { this.onload?.() }),
    }
    class FakeFileReader {
      constructor() { Object.assign(this, reader) }
    }
    vi.stubGlobal('FileReader', FakeFileReader)
    const blob = { type: 'image/png' }

    await expect(blobToDataUrl(blob)).resolves.toBe('data:image/png;base64,UE5H')
    expect(reader.readAsDataURL).toHaveBeenCalledExactlyOnceWith(blob)
  })

  it('prepares a CSP-safe image source while retaining a separate downloadable URL', async () => {
    const createImageSource = vi.fn(async blob => `data:image/png;base64,${blob}`)
    const { renderer, states, createUrl } = setup(async () => 'PNG', { createImageSource })

    await renderer.request({ sticker: 'cat' })

    expect(createImageSource).toHaveBeenCalledExactlyOnceWith('PNG')
    expect(createUrl).toHaveBeenCalledExactlyOnceWith('PNG')
    expect(states.at(-1)).toEqual({
      status: 'ready', url: 'blob:PNG', imageUrl: 'data:image/png;base64,PNG',
    })
  })

  it('only publishes the latest selected decoration when rendering completes out of order', async () => {
    const first = deferred(), next = deferred()
    const render = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise)
    const { renderer, states, createUrl } = setup(render)
    const oldJob = renderer.request({ sticker: 'plant' })
    const newJob = renderer.request({ sticker: 'cat' })
    next.resolve('cat'); await newJob
    first.resolve('plant'); await oldJob
    expect(states.at(-1)).toEqual({ status: 'ready', url: 'blob:cat' })
    expect(createUrl).toHaveBeenCalledExactlyOnceWith('cat')
    expect(render).toHaveBeenNthCalledWith(2, { sticker: 'cat' })
  })

  it('releases replaced URLs immediately and the current URL exactly once on disposal', async () => {
    const { renderer, revokeUrl, states } = setup(async input => input.sticker)
    await renderer.request({ sticker: 'none' })
    const next = renderer.request({ sticker: 'plant' })
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:none')
    expect(states.at(-1)).toEqual({ status: 'loading', url: null })
    await next
    renderer.dispose(); renderer.dispose()
    expect(revokeUrl.mock.calls).toEqual([['blob:none'], ['blob:plant']])
  })

  it('does not allocate URLs or update state for work that completes after close', async () => {
    const pending = deferred()
    const { renderer, states, createUrl } = setup(() => pending.promise)
    const job = renderer.request({})
    renderer.dispose()
    pending.resolve('late'); await job
    expect(createUrl).not.toHaveBeenCalled()
    expect(states).toEqual([{ status: 'loading', url: null }])
    await renderer.request({})
    expect(states).toHaveLength(1)
  })

  it('releases a URL if its asynchronous conversion finishes after a newer selection', async () => {
    const firstUrl = deferred(), nextUrl = deferred()
    const createUrl = vi.fn(blob => blob === 'plant' ? firstUrl.promise : nextUrl.promise)
    const revokeUrl = vi.fn()
    const states = []
    const renderer = createCardPreviewRenderer({
      render: async input => input.sticker,
      createUrl,
      revokeUrl,
      onError: vi.fn(),
      onChange: state => states.push(state),
    })
    const oldJob = renderer.request({ sticker: 'plant' })
    await vi.waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1))
    const newJob = renderer.request({ sticker: 'cat' })
    await vi.waitFor(() => expect(createUrl).toHaveBeenCalledTimes(2))

    nextUrl.resolve('data:image/png;base64,cat')
    await newJob
    firstUrl.resolve('blob:stale-plant')
    await oldJob

    expect(states.at(-1)).toEqual({ status: 'ready', url: 'data:image/png;base64,cat' })
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:stale-plant')
  })

  it('does not allocate a downloadable URL for an image conversion made stale by a newer selection', async () => {
    const plantSource = deferred(), catSource = deferred()
    const createImageSource = vi.fn(blob => blob === 'plant' ? plantSource.promise : catSource.promise)
    const { renderer, states, createUrl, revokeUrl } = setup(async input => input.sticker, { createImageSource })
    const oldJob = renderer.request({ sticker: 'plant' })
    await vi.waitFor(() => expect(createImageSource).toHaveBeenCalledTimes(1))
    const newJob = renderer.request({ sticker: 'cat' })
    await vi.waitFor(() => expect(createImageSource).toHaveBeenCalledTimes(2))

    catSource.resolve('data:image/png;base64,cat')
    await newJob
    plantSource.resolve('data:image/png;base64,plant')
    await oldJob

    expect(createUrl).toHaveBeenCalledExactlyOnceWith('cat')
    expect(revokeUrl).not.toHaveBeenCalled()
    expect(states.at(-1)).toEqual({
      status: 'ready', url: 'blob:cat', imageUrl: 'data:image/png;base64,cat',
    })
  })

  it('does not allocate a downloadable URL when image conversion finishes after close', async () => {
    const pendingSource = deferred()
    const createImageSource = vi.fn(() => pendingSource.promise)
    const { renderer, states, createUrl, revokeUrl } = setup(async () => 'PNG', { createImageSource })
    const job = renderer.request({})
    await vi.waitFor(() => expect(createImageSource).toHaveBeenCalledOnce())
    renderer.dispose()
    pendingSource.resolve('data:image/png;base64,PNG')
    await job

    expect(createUrl).not.toHaveBeenCalled()
    expect(revokeUrl).not.toHaveBeenCalled()
    expect(states).toEqual([{ status: 'loading', url: null }])
  })

  it('shows a retryable error and skips download URL allocation when image conversion fails', async () => {
    const createImageSource = vi.fn().mockRejectedValue(new Error('FileReader failed'))
    const { renderer, states, createUrl, onError } = setup(async () => 'PNG', { createImageSource })

    await renderer.request({})

    expect(createUrl).not.toHaveBeenCalled()
    expect(states.at(-1)).toEqual({ status: 'error', url: null })
    expect(onError).toHaveBeenCalledWith({ stage: 'render', stale: false })
  })

  it('releases a URL if asynchronous conversion finishes after close', async () => {
    const pendingUrl = deferred()
    const { renderer, states, revokeUrl, createUrl } = setup(async () => 'rendered')
    createUrl.mockImplementation(() => pendingUrl.promise)
    const job = renderer.request({})
    await vi.waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1))
    renderer.dispose()
    pendingUrl.resolve('blob:closed-preview')
    await job

    expect(states).toEqual([{ status: 'loading', url: null }])
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:closed-preview')
  })

  it('reports an asynchronous URL conversion failure as retryable', async () => {
    const { renderer, states, createUrl, onError } = setup(async () => 'rendered')
    createUrl.mockRejectedValueOnce(new Error('FileReader failed'))

    await renderer.request({})

    expect(states.at(-1)).toEqual({ status: 'error', url: null })
    expect(onError).toHaveBeenCalledWith({ stage: 'render', stale: false })
  })

  it('shows an actionable error and permits a fresh retry', async () => {
    const render = vi.fn().mockRejectedValueOnce(new Error('canvas failure')).mockResolvedValueOnce('retry')
    const { renderer, states, onError } = setup(render)
    await renderer.request({})
    expect(states.at(-1)).toEqual({ status: 'error', url: null })
    expect(onError).toHaveBeenCalledWith({ stage: 'render', stale: false })
    await renderer.request({})
    expect(states.at(-1)).toEqual({ status: 'ready', url: 'blob:retry' })
  })

  it('observes stale failures without overwriting a newer successful preview', async () => {
    const old = deferred()
    const { renderer, states, onError } = setup(vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce('new'))
    const pending = renderer.request({})
    await renderer.request({})
    old.reject(new Error('old failure')); await pending
    expect(states.at(-1)).toEqual({ status: 'ready', url: 'blob:new' })
    expect(onError).toHaveBeenCalledWith({ stage: 'render', stale: true })
  })

  it('handles synchronous canvas and object URL allocation failures as retryable errors', async () => {
    const { renderer, states, createUrl, onError } = setup(vi.fn()
      .mockImplementationOnce(() => { throw new Error('no context') })
      .mockResolvedValue('image'))
    await renderer.request({})
    expect(states.at(-1)).toEqual({ status: 'error', url: null })
    createUrl.mockImplementationOnce(() => { throw new Error('no URL') })
    await renderer.request({})
    expect(states.at(-1)).toEqual({ status: 'error', url: null })
    expect(onError).toHaveBeenCalledTimes(2)
    await renderer.request({})
    expect(states.at(-1)).toEqual({ status: 'ready', url: 'blob:image' })
  })
})
