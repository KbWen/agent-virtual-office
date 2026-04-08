import { describe, it, expect } from 'vitest'
import { buildHashStatusMessage, normalizeStatusMessage } from '../src/inference/inferStatus.js'

describe('normalizeStatusMessage', () => {
  it('returns null for null input', () => {
    expect(normalizeStatusMessage(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(normalizeStatusMessage('hello')).toBeNull()
    expect(normalizeStatusMessage(42)).toBeNull()
    expect(normalizeStatusMessage(undefined)).toBeNull()
  })

  it('returns null for unknown message types', () => {
    expect(normalizeStatusMessage({ type: 'unknown' })).toBeNull()
    expect(normalizeStatusMessage({ foo: 'bar' })).toBeNull()
  })

  describe('office-status protocol', () => {
    it('normalizes office-status messages with stable source metadata', () => {
      const msg = { type: 'office-status', agents: [{ role: 'dev', status: 'working' }] }
      expect(normalizeStatusMessage(msg)).toMatchObject({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
        source: 'external',
      })
      expect(normalizeStatusMessage(msg)?._seq).toEqual(expect.any(String))
    })

    it('preserves incoming source and _seq when already provided', () => {
      const msg = {
        type: 'office-status',
        _seq: 'codex-42',
        source: 'codex-cli',
        agents: [{ role: 'dev', status: 'done' }],
      }

      expect(normalizeStatusMessage(msg)).toMatchObject({
        _seq: 'codex-42',
        source: 'codex-cli',
      })
    })
  })

  describe('legacy office-vibe conversion', () => {
    it('converts office-vibe to office-status', () => {
      const result = normalizeStatusMessage({
        type: 'office-vibe',
        agent: 'dev',
        command: 'npm test',
        phase: 'running',
      })
      expect(result.type).toBe('office-status')
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0]).toMatchObject({
        role: 'dev',
        task: 'npm test',
        status: 'working',
      })
    })

    it('maps "done" phase to done status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'done' })
      expect(result.agents[0].status).toBe('done')
    })

    it('maps "complete" phase to done status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'completed' })
      expect(result.agents[0].status).toBe('done')
    })

    it('maps "blocked" phase to blocked status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'blocked' })
      expect(result.agents[0].status).toBe('blocked')
    })

    it('maps "error" phase to blocked status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'error' })
      expect(result.agents[0].status).toBe('blocked')
    })

    it('maps unknown phase to working status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'thinking' })
      expect(result.agents[0].status).toBe('working')
    })

    it('defaults to working when no phase', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', command: 'test' })
      expect(result.agents[0].status).toBe('working')
    })

    it('passes through source and workflow', () => {
      const result = normalizeStatusMessage({
        type: 'office-vibe',
        source: 'gemini',
        workflow: 'Sprint 1',
      })
      expect(result.source).toBe('gemini')
      expect(result.workflow).toBe('Sprint 1')
      expect(result._seq).toEqual(expect.any(String))
    })
  })

  describe('hash bridge normalization', () => {
    it('builds a stable seq for the same hash payload', () => {
      const first = buildHashStatusMessage('#dev=done&workflow=Codex%20App%20Bridge&source=codex-app')
      const second = buildHashStatusMessage('#dev=done&workflow=Codex%20App%20Bridge&source=codex-app')

      expect(first).toMatchObject({
        type: 'office-status',
        source: 'codex-app',
        workflow: 'Codex App Bridge',
        agents: [{ role: 'dev', status: 'done' }],
      })
      expect(second?._seq).toBe(first?._seq)
    })
  })
})
