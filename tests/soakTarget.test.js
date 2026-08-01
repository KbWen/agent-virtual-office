import { describe, expect, it, vi } from 'vitest'
import { formatTargetIdentityError, inspectAvoViteTarget } from '../scripts/soakTarget.mjs'

const response = (body, status = 200) => new Response(body, { status })

describe('inspectAvoViteTarget', () => {
  it('accepts the AVO Vite store module', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response('export const useOfficeStore = create(); applyExternalStatus()'))
    const result = await inspectAvoViteTarget('http://localhost:5173/', { fetchImpl })

    expect(result).toMatchObject({ status: 'match', baseUrl: 'http://localhost:5173' })
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:5173/src/systems/store.js', expect.any(Object))
  })

  it('rejects an unrelated server even when it returns HTTP 200', async () => {
    const result = await inspectAvoViteTarget('http://localhost:5173', {
      fetchImpl: vi.fn().mockResolvedValue(response('<html>another app</html>')),
    })

    expect(result).toMatchObject({ status: 'mismatch' })
    expect(formatTargetIdentityError('http://localhost:5173', result)).toContain('target identity check failed for http://localhost:5173')
  })

  it('classifies a responding 404 as mismatch instead of spawnable absence', async () => {
    const result = await inspectAvoViteTarget('http://localhost:5173', {
      fetchImpl: vi.fn().mockResolvedValue(response('missing', 404)),
    })
    expect(result).toMatchObject({ status: 'mismatch', reason: expect.stringContaining('HTTP 404') })
  })

  it('distinguishes unreachable and invalid targets', async () => {
    const connectionRefused = new Error('fetch failed', { cause: { code: 'ECONNREFUSED' } })
    const unreachable = await inspectAvoViteTarget('http://localhost:5173', {
      fetchImpl: vi.fn().mockRejectedValue(connectionRefused),
    })
    expect(unreachable).toMatchObject({ status: 'unreachable', reason: 'fetch failed' })
    await expect(inspectAvoViteTarget('not a URL')).resolves.toEqual({ status: 'invalid', reason: 'invalid URL' })
  })

  it('fails closed when target identity cannot be proven', async () => {
    const result = await inspectAvoViteTarget('http://localhost:5173', {
      fetchImpl: vi.fn().mockRejectedValue(new Error('request timed out')),
    })
    expect(result).toMatchObject({ status: 'mismatch', reason: 'request timed out' })
  })
})
