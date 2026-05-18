import { describe, expect, it } from 'vitest'

const { normalizeCodexStatusPayload } = await import('../public/hooks/office-status-codex.js')

describe('normalizeCodexStatusPayload', () => {
  it('normalizes shorthand Codex CLI payloads into office-status messages', () => {
    const result = normalizeCodexStatusPayload({
      dev: 'working',
      workflow: 'Build Feature',
    }, 1234567890)

    expect(result).toMatchObject({
      type: 'office-status',
      source: 'codex-cli',
      workflow: 'Build Feature',
      agents: [
        { role: 'dev', task: null, status: 'working', label: null, hint: null },
      ],
    })
    expect(result._seq).toBe('1234567890')
  })

  it('preserves full office-status payloads while ensuring Codex defaults', () => {
    const result = normalizeCodexStatusPayload({
      type: 'office-status',
      agents: [{ role: 'qa', status: 'done', label: 'Verified' }],
    }, 1234567890)

    expect(result).toMatchObject({
      type: 'office-status',
      source: 'codex-cli',
      agents: [{ role: 'qa', status: 'done', label: 'Verified' }],
      _seq: '1234567890',
    })
  })

  it('M-2: activeCount counts only working+blocked, not idle (contract parity with server path)', () => {
    // Old formula was status !== 'done', which included idle in the active count.
    const result = normalizeCodexStatusPayload({
      type: 'office-status',
      agents: [
        { role: 'dev', status: 'working' },
        { role: 'qa', status: 'idle' },
        { role: 'ops', status: 'done' },
      ],
    }, 9999)
    expect(result.activeCount).toBe(1)  // only dev:working; qa:idle and ops:done excluded
  })

  it('M-2: mood is validated against VALID_MOODS (invalid mood becomes null)', () => {
    const valid = normalizeCodexStatusPayload({ type: 'office-status', agents: [], mood: 'rushing' }, 1)
    expect(valid.mood).toBe('rushing')
    const invalid = normalizeCodexStatusPayload({ type: 'office-status', agents: [], mood: 'panicking' }, 1)
    expect(invalid.mood).toBeNull()
  })

  it('M-2: flat-path activeCount also counts only working+blocked', () => {
    // Flat-object path: { dev: 'working', qa: 'idle' }
    const result = normalizeCodexStatusPayload({ dev: 'working', qa: 'idle' }, 9999)
    expect(result.activeCount).toBe(1)  // dev:working only; qa:idle excluded
  })
})
