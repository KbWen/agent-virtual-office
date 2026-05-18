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

    it('M-1: strips agents with invalid role or status (untrusted in-browser channel)', () => {
      const msg = {
        type: 'office-status',
        agents: [
          { role: 'hacker', status: 'working' },        // invalid role
          { role: 'dev', status: 'pwned' },              // invalid status
          { role: 'dev', status: 'working' },            // valid — kept
        ],
      }
      const result = normalizeStatusMessage(msg)
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0].role).toBe('dev')
    })

    it('M-1: caps oversized label/task/hint strings at 200 chars', () => {
      const big = 'x'.repeat(500)
      const msg = {
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working', label: big, task: big, hint: big }],
        workflow: big,
      }
      const result = normalizeStatusMessage(msg)
      expect(result.agents[0].label.length).toBe(200)
      expect(result.agents[0].task.length).toBe(200)
      expect(result.agents[0].hint.length).toBe(200)
      expect(result.workflow.length).toBe(200)
    })

    it('M-1: validates mood against VALID_MOODS and strips unknown values', () => {
      const valid = normalizeStatusMessage({ type: 'office-status', agents: [], mood: 'rushing' })
      expect(valid.mood).toBe('rushing')
      const invalid = normalizeStatusMessage({ type: 'office-status', agents: [], mood: 'panicking' })
      expect(invalid.mood).toBeUndefined()
    })

    it('M-1: activeCount counts only working+blocked agents (not idle)', () => {
      const msg = {
        type: 'office-status',
        agents: [
          { role: 'dev', status: 'working' },
          { role: 'qa', status: 'idle' },
          { role: 'ops', status: 'done' },
        ],
      }
      const result = normalizeStatusMessage(msg)
      expect(result.activeCount).toBe(1)
    })

    it('M-1: tolerates non-array agents without throwing', () => {
      const msg = { type: 'office-status', agents: 'not-an-array' }
      const result = normalizeStatusMessage(msg)
      expect(result.agents).toEqual([])
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
