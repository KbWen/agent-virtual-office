import { describe, expect, it } from 'vitest'

const { normalizeCodexStatusPayload } = await import('../public/hooks/office-status-codex.js')

describe('normalizeCodexStatusPayload', () => {
  it('normalizes shorthand Codex CLI payloads into office-status messages', () => {
    const result = normalizeCodexStatusPayload({
      dev: 'working',
      workflow: 'Build Feature',
    })

    expect(result).toMatchObject({
      type: 'office-status',
      source: 'codex-cli',
      workflow: 'Build Feature',
      agents: [
        { role: 'dev', task: null, status: 'working', label: null, hint: null },
      ],
    })
    // _seq is a fresh monotonic integer string when the caller supplies none.
    expect(result._seq).toMatch(/^\d+$/)
  })

  it('preserves full office-status payloads while ensuring Codex defaults', () => {
    const result = normalizeCodexStatusPayload({
      type: 'office-status',
      agents: [{ role: 'qa', status: 'done', label: 'Verified' }],
    })

    expect(result).toMatchObject({
      type: 'office-status',
      source: 'codex-cli',
      agents: [{ role: 'qa', status: 'done', label: 'Verified' }],
    })
    expect(result._seq).toMatch(/^\d+$/)
  })

  it('honors a caller-supplied _seq only when it is a plain integer string', () => {
    // Valid integer string → passed through verbatim.
    const valid = normalizeCodexStatusPayload({ type: 'office-status', agents: [], _seq: '1700000000000' })
    expect(valid._seq).toBe('1700000000000')
    // Non-numeric / colon-joined _seq would break the client /^\d+$/ guard → replaced.
    const bad = normalizeCodexStatusPayload({ type: 'office-status', agents: [], _seq: '12:34' })
    expect(bad._seq).toMatch(/^\d+$/)
    expect(bad._seq).not.toBe('12:34')
  })

  it('emits strictly monotonic _seq across back-to-back calls in the same ms', () => {
    const a = normalizeCodexStatusPayload({ dev: 'working' })
    const b = normalizeCodexStatusPayload({ dev: 'working' })
    expect(parseInt(b._seq, 10)).toBeGreaterThan(parseInt(a._seq, 10))
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
