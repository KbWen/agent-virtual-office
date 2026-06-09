/**
 * AVO-106 — `activeFile` must survive EVERY whitelist on the data path (the AVO-110 lesson:
 * trace a new field through every normalizer or it is silently dropped). Whitelists:
 *   hook → normalizePost (server ingest) → sanitizeAgent (in-browser) → routeExternalAgents →
 *   applyExternalStatus (store sink, + activeFileAt stamp).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { normalizePost } from '../src/utils/normalizePost.js'
import { normalizeStatusMessage } from '../src/inference/inferStatus.js'
import { routeExternalAgents } from '../src/inference/agentRouter.js'
import { useOfficeStore } from '../src/systems/store.js'

describe('activeFile — normalizePost (server /api/status ingest)', () => {
  it('carries a string activeFile through the office-status map', () => {
    const r = normalizePost({ type: 'office-status', agents: [{ role: 'dev', status: 'working', activeFile: '/r/src/store.js' }] })
    expect(r.agents[0].activeFile).toBe('/r/src/store.js')
  })
  it('non-string activeFile → null; caps at 200 chars', () => {
    const r = normalizePost({ type: 'office-status', agents: [
      { role: 'dev', status: 'working', activeFile: 42 },
      { role: 'qa', status: 'working', activeFile: 'x'.repeat(300) },
    ] })
    expect(r.agents[0].activeFile).toBeNull()
    expect(r.agents[1].activeFile.length).toBe(200)
  })
})

describe('activeFile — sanitizeAgent (in-browser channels, via normalizeStatusMessage)', () => {
  it('carries activeFile from an office-status message', () => {
    const msg = normalizeStatusMessage({ type: 'office-status', agents: [{ role: 'dev', status: 'working', activeFile: '/r/src/store.js' }] })
    expect(msg.agents[0].activeFile).toBe('/r/src/store.js')
  })
  it('caps untrusted activeFile at 200; non-string → null', () => {
    const msg = normalizeStatusMessage({ type: 'office-status', agents: [
      { role: 'dev', status: 'working', activeFile: 'y'.repeat(500) },
      { role: 'qa', status: 'working', activeFile: { evil: true } },
    ] })
    expect(msg.agents[0].activeFile.length).toBe(200)
    expect(msg.agents[1].activeFile).toBeNull()
  })
})

describe('activeFile — routeExternalAgents', () => {
  it('carries activeFile through routing', () => {
    const out = routeExternalAgents([{ role: 'dev', status: 'working', activeFile: '/r/src/store.js' }])
    expect(out[0].activeFile).toBe('/r/src/store.js')
  })
  it('absent activeFile → null', () => {
    const out = routeExternalAgents([{ role: 'dev', status: 'working' }])
    expect(out[0].activeFile).toBeNull()
  })
})

describe('activeFile — applyExternalStatus (store sink + activeFileAt stamp)', () => {
  beforeEach(() => {
    useOfficeStore.setState({ externalStatus: {}, statusSource: 'organic', activeWorkflow: null })
  })

  it('stores activeFile and stamps a finite activeFileAt', () => {
    useOfficeStore.getState().applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: 'Edit', activeFile: '/r/src/store.js' }],
      { source: 'external', statusSource: 'external' },
    )
    const ext = useOfficeStore.getState().externalStatus.dev
    expect(ext.activeFile).toBe('/r/src/store.js')
    expect(Number.isFinite(ext.activeFileAt)).toBe(true)
  })

  it('carries activeFileAt FORWARD on a same-file re-apply (no refresh → honest staleness)', () => {
    const apply = () => useOfficeStore.getState().applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: 'Edit', activeFile: '/r/src/store.js' }],
      { source: 'external', statusSource: 'external' },
    )
    apply()
    const t1 = useOfficeStore.getState().externalStatus.dev.activeFileAt
    apply()  // same file again
    expect(useOfficeStore.getState().externalStatus.dev.activeFileAt).toBe(t1)
  })

  it('re-stamps activeFileAt when the file CHANGES (task name is identical "Edit")', () => {
    const g = () => useOfficeStore.getState()
    g().applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Edit', activeFile: '/r/a.js' }], { source: 'external', statusSource: 'external' })
    const t1 = g().externalStatus.dev.activeFileAt
    g().applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Edit', activeFile: '/r/b.js' }], { source: 'external', statusSource: 'external' })
    const ext = g().externalStatus.dev
    expect(ext.activeFile).toBe('/r/b.js')
    expect(ext.activeFileAt).toBeGreaterThanOrEqual(t1)  // re-stamped (now), monotonic
  })

  it('null activeFile (non-file tool) → activeFile null, activeFileAt null', () => {
    useOfficeStore.getState().applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: 'Bash', activeFile: null }],
      { source: 'external', statusSource: 'external' },
    )
    const ext = useOfficeStore.getState().externalStatus.dev
    expect(ext.activeFile).toBeNull()
    expect(ext.activeFileAt).toBeNull()
  })

  it('end-to-end: office-status message → route → store lands activeFile', () => {
    const msg = normalizeStatusMessage({ type: 'office-status', agents: [
      { role: 'dev', status: 'working', task: 'Edit', activeFile: '/r/src/store.js' },
      { role: 'qa', status: 'working', task: 'Read', activeFile: '/r/src/store.js' },
    ] })
    const updates = routeExternalAgents(msg.agents)
    useOfficeStore.getState().applyExternalStatus(updates, { source: 'external', statusSource: 'external' })
    const ext = useOfficeStore.getState().externalStatus
    expect(ext.dev.activeFile).toBe('/r/src/store.js')
    expect(ext.qa.activeFile).toBe('/r/src/store.js')
  })
})
