// spec_ref: docs/specs/cozy-interactions.md C6 — actual preview download control.
import { afterEach, expect, it, vi } from 'vitest'
const env = vi.hoisted(() => ({ slot: 0, status: 'ready', url: 'blob:local-card', imageUrl: 'data:image/png;base64,LOCAL', effects: [], setters: [], states: [] }))
vi.mock('react', async original => ({ ...await original(),
  useId: () => 'cozy-card', useRef: () => ({ current: null }),
  useEffect: effect => { env.effects.push(effect) },
  useState: init => {
    const slot = env.slot++
    const setter = vi.fn()
    env.setters[slot] = setter
    const state = slot === 2 ? { status: env.status, url: env.url, imageUrl: env.imageUrl } : init
    env.states[slot] = state
    return [state, setter]
  },
}))
vi.mock('../src/components/useCozyPopover.js', () => ({
  useCozyPopover: () => ({ current: null }), cozyButtonClass: '', cozyPopoverClass: '',
}))
vi.mock('../src/i18n', () => ({ useLocale: () => {}, t: (_key, fallback) => fallback }))
vi.mock('../src/systems/dailyCard.js', async original => ({
  ...await original(), renderDailyCard: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}))
import CozyCardPreview from '../src/components/CozyCardPreview.jsx'

function downloadControl(tree) {
  if (!tree || typeof tree !== 'object') return null
  if (tree.type === 'button' && Object.hasOwn(tree.props, 'disabled')) return tree
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = downloadControl(child)
    if (found) return found
  }
  return null
}
function image(tree) {
  if (!tree || typeof tree !== 'object') return null
  if (tree.type === 'img') return tree
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = image(child)
    if (found) return found
  }
  return null
}
function retryControl(tree) {
  if (!tree || typeof tree !== 'object') return null
  if (tree.type === 'button' && tree.props.children === 'Try again') return tree
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = retryControl(child)
    if (found) return found
  }
  return null
}
afterEach(() => vi.unstubAllGlobals())
it('downloads the current PNG URL locally and removes the temporary anchor', () => {
  env.slot = 0; env.status = 'ready'; env.url = 'blob:local-card'; env.imageUrl = 'data:image/png;base64,LOCAL'; env.effects = []; env.setters = []; env.states = []
  const link = { click: vi.fn(), remove: vi.fn() }
  const appendChild = vi.fn()
  vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { appendChild } })
  const tree = CozyCardPreview({ input: { dayKey: '2026-10-23' }, onClose: vi.fn() })
  const button = downloadControl(tree)
  expect(button.props.disabled).toBe(false)
  expect(image(tree).props.src).toBe('data:image/png;base64,LOCAL')
  button.props.onClick()
  expect(link.href).toBe('blob:local-card')
  expect(link.download).toBe('office-2026-10-23.png')
  expect(appendChild).toHaveBeenCalledWith(link)
  expect(link.click).toHaveBeenCalledOnce()
  expect(link.remove).toHaveBeenCalledOnce()
})
it('does not start a download while a newer decoration is still rendering', () => {
  env.slot = 0; env.status = 'loading'; env.effects = []; env.setters = []; env.states = []
  const createElement = vi.fn()
  vi.stubGlobal('document', { createElement })
  const button = downloadControl(CozyCardPreview({ input: {}, onClose: vi.fn() }))
  expect(button.props.disabled).toBe(true)
  button.props.onClick()
  expect(createElement).not.toHaveBeenCalled()
})

it('wires the preview image to a CSP-allowed data URL from the rendered PNG blob', async () => {
  env.slot = 0; env.status = 'loading'; env.url = null; env.imageUrl = null; env.effects = []; env.setters = []; env.states = []
  class FakeFileReader {
    readAsDataURL() {
      this.result = 'data:image/png;base64,COMPONENT'
      this.onload?.()
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader)
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:download-card'),
    revokeObjectURL: vi.fn(),
  })

  CozyCardPreview({ input: { dayKey: '2026-10-23' }, onClose: vi.fn() })
  const cleanup = env.effects[0]()
  env.effects[1]()
  await vi.waitFor(() => expect(env.setters[2]).toHaveBeenCalledWith({
    status: 'ready', url: 'blob:download-card', imageUrl: 'data:image/png;base64,COMPONENT',
  }))
  cleanup()

  env.slot = 0; env.status = 'ready'; env.url = 'blob:download-card'; env.imageUrl = 'data:image/png;base64,COMPONENT'
  env.effects = []; env.setters = []; env.states = []
  const readyTree = CozyCardPreview({ input: { dayKey: '2026-10-23' }, onClose: vi.fn() })
  expect(image(readyTree).props.src).toBe('data:image/png;base64,COMPONENT')
  const download = downloadControl(readyTree)
  const link = { click: vi.fn(), remove: vi.fn() }
  vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { appendChild: vi.fn() } })
  download.props.onClick()
  expect(link.href).toBe('blob:download-card')
})

it('turns an image decode failure into retryable state and fences a stale image error', () => {
  env.slot = 0; env.status = 'ready'; env.url = 'blob:local-card'; env.imageUrl = 'data:image/png;base64,LOCAL'; env.effects = []; env.setters = []; env.states = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const tree = CozyCardPreview({ input: {}, onClose: vi.fn() })
  const previewImage = image(tree)
  const errorButton = previewImage.props.onError

  errorButton()
  const update = env.setters[2].mock.calls[0][0]
  const captured = env.states[2]
  expect(update(captured))
    .toEqual({ status: 'error', url: null })
  const newerSameUrl = { ...captured }
  expect(update(newerSameUrl)).toBe(newerSameUrl)
  const newerDifferentUrl = { status: 'ready', url: 'data:image/png;base64,NEWER' }
  expect(update(newerDifferentUrl)).toBe(newerDifferentUrl)

  env.status = 'error'; env.slot = 0; env.setters = []; env.states = []
  const retryTree = CozyCardPreview({ input: {}, onClose: vi.fn() })
  expect(downloadControl(retryTree).props.disabled).toBe(true)
  expect(retryControl(retryTree)).not.toBeNull()
})
