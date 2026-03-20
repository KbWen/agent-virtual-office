import { describe, it, expect } from 'vitest'
import { normalizeStatusMessage } from '../src/inference/inferStatus.js'

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
    it('passes through office-status messages as-is', () => {
      const msg = { type: 'office-status', agents: [{ role: 'dev', status: 'working' }] }
      expect(normalizeStatusMessage(msg)).toBe(msg) // same reference
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
    })
  })
})
