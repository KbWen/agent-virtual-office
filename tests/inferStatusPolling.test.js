import { describe, it, expect, vi } from 'vitest'
import { createFilePollingState, pollFileStatusOnce } from '../src/inference/inferStatus.js'

function makeResponse({ ok = true, status = 200, etag = null, jsonData = null }) {
  return {
    ok,
    status,
    headers: { get: () => etag },
    json: vi.fn().mockResolvedValue(jsonData),
  }
}

describe('pollFileStatusOnce', () => {
  it('ignores overlapping polls while a request is already in flight', async () => {
    const state = createFilePollingState()
    state.inFlight = true
    const fetchImpl = vi.fn()
    const callback = vi.fn()

    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(callback).not.toHaveBeenCalled()
  })

  it('skips duplicate _seq payloads so external status is not re-applied', async () => {
    const state = createFilePollingState()
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(makeResponse({
        etag: 'v1',
        jsonData: { type: 'office-status', _seq: 'same', agents: [{ role: 'dev', status: 'working' }] },
      }))
      .mockResolvedValueOnce(makeResponse({
        etag: 'v2',
        jsonData: { type: 'office-status', _seq: 'same', agents: [{ role: 'dev', status: 'working' }] },
      }))
    const callback = vi.fn()

    await pollFileStatusOnce(fetchImpl, state, callback)
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(state.lastSeq).toBe('same')
  })

  it('resets backoff after a successful fetch', async () => {
    const state = createFilePollingState()
    state.consecutive404 = 11
    const callback = vi.fn()
    const skippedFetch = vi.fn()
    const successFetch = vi.fn().mockResolvedValue(makeResponse({
      etag: 'v3',
      jsonData: { type: 'office-status', _seq: 'fresh', agents: [{ role: 'qa', status: 'done' }] },
    }))

    await pollFileStatusOnce(skippedFetch, state, callback)
    expect(skippedFetch).not.toHaveBeenCalled()

    state.consecutive404 = 12
    await pollFileStatusOnce(successFetch, state, callback)

    expect(successFetch).toHaveBeenCalledOnce()
    expect(state.consecutive404).toBe(0)
    expect(callback).toHaveBeenCalledOnce()
  })
})
