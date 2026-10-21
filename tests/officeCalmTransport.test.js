import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanAndMerge } from '../src/server/scanSessions.mjs'
import { useOfficeStore } from '../src/systems/store.js'
import { startStatusIntegration, normalizeStatusMessage } from '../src/inference/inferStatus.js'
import { startOfficeCalm } from '../src/systems/officeCalm.js'
import { OBSERVED_ACTIVITY_TTL_MS } from '../src/utils/statusContract.mjs'

const BASE = 1_800_000_000_000
let dir, original, stopIntegration, stopCalm, source
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(BASE)
  original = useOfficeStore.getState()
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-calm-pipeline-'))
  const win = new EventTarget()
  win.location = { protocol: 'http:', origin: 'http://localhost', search: '', hash: '' }
  win.parent = {}
  vi.stubGlobal('window', win)
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('EventSource', class {
    constructor() { source = this; this.handlers = {} }
    addEventListener(name, callback) { this.handlers[name] = callback }
    close() {}
  })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, headers: { get: () => null },
    text: async () => JSON.stringify(scanAndMerge(dir, dir)) })))
  useOfficeStore.setState({ experienceFlags: { ...original.experienceFlags, calmEnabled: true },
    officeCalm: { mode: 'unknown', eligibleSince: null }, observedActivity: null,
    externalStatus: {}, statusSource: 'organic', integrationSource: null, helpers: [], isPaused: false })
})
afterEach(() => {
  stopIntegration?.(); stopCalm?.(); stopIntegration = stopCalm = null
  useOfficeStore.setState(original, true)
  vi.unstubAllGlobals(); vi.useRealTimers()
  fs.rmSync(dir, { recursive: true, force: true })
})
function write(name, status = 'idle') {
  fs.writeFileSync(path.join(dir, `office-status-${name}.json`), JSON.stringify({
    type: 'office-status', _cwd: dir, source: 'api', _seq: String(BASE), agents: [{ role: 'dev', status }],
  }))
}
function start() { stopIntegration = startStatusIntegration(useOfficeStore); stopCalm = startOfficeCalm(useOfficeStore, { document: null }) }

describe('AVO-199 real scanner -> normalizer -> transport -> store -> controller', () => {
  it.each([1, 2])('qualifies %i scoped idle source(s) without adding idle representatives', async count => {
    write('alpha'); if (count === 2) write('beta')
    const raw = scanAndMerge(dir, dir)
    expect(raw.agents).toHaveLength(count === 2 ? 0 : 1)
    expect(normalizeStatusMessage(raw).observedActivity).toBeUndefined()
    start()
    await vi.advanceTimersByTimeAsync(1200)
    expect(useOfficeStore.getState().observedActivity).toEqual({ state: 'all-idle', expiresAt: BASE + OBSERVED_ACTIVITY_TTL_MS })
    expect(useOfficeStore.getState().officeCalm.mode).toBe('settling')
    const since = useOfficeStore.getState().officeCalm.eligibleSince
    await vi.advanceTimersByTimeAsync(since + 29_999 - Date.now())
    expect(useOfficeStore.getState().officeCalm.mode).toBe('settling')
    await vi.advanceTimersByTimeAsync(1)
    expect(useOfficeStore.getState().officeCalm.mode).toBe('quiet')
    if (count === 2) {
      expect(useOfficeStore.getState().statusSource).toBe('organic')
      expect(useOfficeStore.getState().externalStatus).toEqual({})
    }
    await vi.advanceTimersByTimeAsync(BASE + OBSERVED_ACTIVITY_TTL_MS - Date.now())
    expect(useOfficeStore.getState().officeCalm.mode).toBe('unknown')
  })
  it.each(['working', 'done', 'unexpected'])('a second %s source never proves quiet despite empty/filtered representatives', async status => {
    write('alpha'); write('beta', status); start()
    await vi.advanceTimersByTimeAsync(40_000)
    expect(useOfficeStore.getState().officeCalm.mode).not.toBe('quiet')
    expect(useOfficeStore.getState().observedActivity?.state).not.toBe('all-idle')
  })
  it('source replacement and a forged browser idle summary invalidate a real quiet proof', async () => {
    write('alpha'); write('beta'); start()
    await vi.advanceTimersByTimeAsync(32_000)
    expect(useOfficeStore.getState().officeCalm.mode).toBe('quiet')
    const event = new Event('message')
    Object.assign(event, { origin: 'http://localhost', source: {}, data: { type: 'office-status', source: 'multi-session', agents: [], observedActivity: { state: 'all-idle', expiresAt: BASE + OBSERVED_ACTIVITY_TTL_MS } } })
    window.dispatchEvent(event)
    expect(useOfficeStore.getState().observedActivity).toBeNull()
    expect(useOfficeStore.getState().officeCalm.mode).toBe('unknown')
  })
})
