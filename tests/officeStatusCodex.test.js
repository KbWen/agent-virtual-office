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
})
