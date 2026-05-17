import { describe, it, expect } from 'vitest'
import { normalizePost, VALID_ROLES, VALID_STATUSES, VALID_MOODS, MAX_MOOD_DURATION } from '../src/utils/normalizePost.js'

describe('normalizePost', () => {
  describe('shorthand format', () => {
    it('converts dev: "working" to full format', () => {
      const result = normalizePost({ dev: 'working' })
      expect(result.type).toBe('office-status')
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0]).toMatchObject({ role: 'dev', status: 'working', task: null })
      expect(result.activeCount).toBe(1)
    })

    it('treats non-status values as tasks with status "working"', () => {
      const result = normalizePost({ dev: 'writing tests' })
      expect(result.agents[0]).toMatchObject({ role: 'dev', status: 'working', task: 'writing tests' })
    })

    it('handles multiple agents', () => {
      const result = normalizePost({ dev: 'working', qa: 'blocked', ops: 'done' })
      expect(result.agents).toHaveLength(3)
      expect(result.activeCount).toBe(2) // dev + qa, not ops (done)
    })

    it('ignores unknown roles', () => {
      const result = normalizePost({ dev: 'working', hacker: 'evil' })
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0].role).toBe('dev')
    })

    it('passes through workflow and source', () => {
      const result = normalizePost({ dev: 'working', workflow: 'Sprint 1', source: 'curl' })
      expect(result.workflow).toBe('Sprint 1')
      expect(result.source).toBe('curl')
    })

    it('defaults source to "api"', () => {
      const result = normalizePost({ dev: 'working' })
      expect(result.source).toBe('api')
    })

    it('passes label and hint to all agents', () => {
      const result = normalizePost({ dev: 'working', qa: 'working', label: 'editing App.jsx', hint: 'error' })
      for (const a of result.agents) {
        expect(a.label).toBe('editing App.jsx')
        expect(a.hint).toBe('error')
      }
    })

    it('truncates hint at 200 characters', () => {
      const longHint = 'x'.repeat(300)
      const result = normalizePost({ dev: 'working', hint: longHint })
      expect(result.agents[0].hint).toHaveLength(200)
    })

    it('rejects non-string hint values', () => {
      expect(normalizePost({ dev: 'working', hint: 42 }).agents[0].hint).toBeNull()
      expect(normalizePost({ dev: 'working', hint: { xss: true } }).agents[0].hint).toBeNull()
      expect(normalizePost({ dev: 'working', hint: ['a'] }).agents[0].hint).toBeNull()
    })
  })

  describe('full format (type: office-status)', () => {
    it('passes through valid agents', () => {
      const body = {
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }, { role: 'qa', status: 'done' }],
      }
      const result = normalizePost(body)
      expect(result.agents).toHaveLength(2)
    })

    it('filters out invalid roles', () => {
      const body = {
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }, { role: 'hacker', status: 'working' }],
      }
      const result = normalizePost(body)
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0].role).toBe('dev')
    })

    it('filters out invalid statuses', () => {
      const body = {
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }, { role: 'qa', status: 'sleeping' }],
      }
      const result = normalizePost(body)
      expect(result.agents).toHaveLength(1)
    })

    it('normalizes hint to null if missing', () => {
      const body = {
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
      }
      const result = normalizePost(body)
      expect(result.agents[0].hint).toBeNull()
    })

    it('truncates hint at 200 characters in full format', () => {
      const body = {
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working', hint: 'y'.repeat(300) }],
      }
      const result = normalizePost(body)
      expect(result.agents[0].hint).toHaveLength(200)
    })

    it('rejects non-string hint in full format', () => {
      const body = {
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working', hint: 999 }],
      }
      const result = normalizePost(body)
      expect(result.agents[0].hint).toBeNull()
    })
  })

  describe('mood validation', () => {
    it('accepts valid moods', () => {
      for (const mood of VALID_MOODS) {
        const result = normalizePost({ dev: 'working', mood })
        expect(result.mood).toBe(mood)
      }
    })

    it('rejects invalid moods', () => {
      const result = normalizePost({ dev: 'working', mood: 'hacked' })
      expect(result.mood).toBeNull()
    })

    it('rejects invalid moods in full format', () => {
      const result = normalizePost({ type: 'office-status', agents: [], mood: '<script>' })
      expect(result.mood).toBeNull()
    })
  })

  describe('moodDuration capping', () => {
    it('caps duration at MAX_MOOD_DURATION', () => {
      const result = normalizePost({
        type: 'office-status', agents: [],
        mood: 'rushing', moodDuration: 999_999_999,
      })
      expect(result.moodDuration).toBe(MAX_MOOD_DURATION)
    })

    it('defaults to 60000 for non-numeric duration', () => {
      const result = normalizePost({
        type: 'office-status', agents: [],
        mood: 'rushing', moodDuration: 'forever',
      })
      expect(result.moodDuration).toBe(60000)
    })

    it('passes through valid duration', () => {
      const result = normalizePost({
        type: 'office-status', agents: [],
        mood: 'rushing', moodDuration: 30000,
      })
      expect(result.moodDuration).toBe(30000)
    })

    it('clamps zero to floor (1000)', () => {
      const result = normalizePost({
        type: 'office-status', agents: [],
        mood: 'rushing', moodDuration: 0,
      })
      expect(result.moodDuration).toBe(1000)
    })

    it('clamps negative to floor (1000)', () => {
      const result = normalizePost({
        type: 'office-status', agents: [],
        mood: 'rushing', moodDuration: -5,
      })
      expect(result.moodDuration).toBe(1000)
    })

    it('clamps sub-floor value to 1000', () => {
      const result = normalizePost({
        type: 'office-status', agents: [],
        mood: 'rushing', moodDuration: 500,
      })
      expect(result.moodDuration).toBe(1000)
    })

    it('clamps zero in shorthand format to floor (1000)', () => {
      const result = normalizePost({ dev: 'working', mood: 'rushing', moodDuration: 0 })
      expect(result.moodDuration).toBe(1000)
    })

    it('returns null when moodDuration is null', () => {
      const result = normalizePost({
        type: 'office-status', agents: [],
        mood: 'rushing', moodDuration: null,
      })
      expect(result.moodDuration).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('handles empty body', () => {
      const result = normalizePost({})
      expect(result.agents).toHaveLength(0)
      expect(result.activeCount).toBe(0)
    })

    it('handles null values for roles', () => {
      const result = normalizePost({ dev: null, qa: 'working' })
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0].role).toBe('qa')
    })
  })
})

describe('constants', () => {
  it('VALID_ROLES has 8 entries', () => {
    expect(VALID_ROLES).toHaveLength(8)
  })

  it('VALID_STATUSES has 4 entries', () => {
    expect(VALID_STATUSES).toHaveLength(4)
  })

  it('VALID_MOODS has 7 entries', () => {
    expect(VALID_MOODS).toHaveLength(7)
  })

  it('MAX_MOOD_DURATION is 1 hour', () => {
    expect(MAX_MOOD_DURATION).toBe(3_600_000)
  })
})
