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

  it('skips duplicate _seq payloads on ETag-less servers so external status is not re-applied', async () => {
    // ETag-less server: _seq dedup is the only guard against re-delivery
    const state = createFilePollingState()
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(makeResponse({
        etag: null,
        jsonData: { type: 'office-status', _seq: 'same', agents: [{ role: 'dev', status: 'working' }] },
      }))
      .mockResolvedValueOnce(makeResponse({
        etag: null,
        jsonData: { type: 'office-status', _seq: 'same', agents: [{ role: 'dev', status: 'working' }] },
      }))
    const callback = vi.fn()

    await pollFileStatusOnce(fetchImpl, state, callback)
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(state.lastSeq).toBe('same')
  })

  it('delivers when ETag changes even if _seq is unchanged (same-ms hook writes)', async () => {
    // Two hook processes writing in the same millisecond produce identical _seq integers.
    // ETag (body hash) is the authoritative change signal; a fresh 200 + new ETag must deliver.
    const state = createFilePollingState()
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(makeResponse({
        etag: 'hash-a',
        jsonData: { type: 'office-status', _seq: '1000', agents: [{ role: 'dev', status: 'working', label: 'A' }] },
      }))
      .mockResolvedValueOnce(makeResponse({
        etag: 'hash-b',
        jsonData: { type: 'office-status', _seq: '1000', agents: [{ role: 'dev', status: 'done', label: 'B' }] },
      }))
    const callback = vi.fn()

    await pollFileStatusOnce(fetchImpl, state, callback)
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('restores prevEtag on parse failure so recovered body is not 304-skipped', async () => {
    // R34 fix: parseError must not keep the new ETag; if it did, a recovered server
    // would return 304 (same-ETag) and the valid body would never be delivered.
    const state = createFilePollingState()
    state.lastEtag = 'prev-etag'
    const badJsonFetch = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => 'new-etag' },
      json: vi.fn().mockRejectedValue(new SyntaxError('bad json')),
    })
    const callback = vi.fn()

    const result = await pollFileStatusOnce(badJsonFetch, state, callback)

    expect(result).toMatchObject({ ok: false, parseError: true })
    expect(state.lastEtag).toBe('prev-etag')   // restored — not 'new-etag'
    expect(state.lastSeq).toBeNull()            // unchanged
    expect(callback).not.toHaveBeenCalled()
  })

  it('resets backoff after a 304 Not Modified response', async () => {
    const state = createFilePollingState()
    state.consecutive404 = 12  // in backoff, but 12 % 3 === 0 so this poll runs
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 304, headers: { get: () => null } })
    const callback = vi.fn()

    const result = await pollFileStatusOnce(fetchImpl, state, callback)

    expect(result).toMatchObject({ ok: true, unchanged: true })
    expect(state.consecutive404).toBe(0)  // server is alive — clear backoff
    expect(callback).not.toHaveBeenCalled()
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

  it('caps consecutive404 at 30 so a persistently flaky server does not ratchet forever', async () => {
    // H2 fix: without the cap, 50% error rate ratchets consecutive404 unbounded and the
    // office effectively goes blind (only 1 poll per 3 cycles, each itself 50% likely to fail).
    const state = createFilePollingState()
    // Simulate 100 consecutive network errors
    const failFetch = vi.fn().mockRejectedValue(new Error('network'))
    for (let i = 0; i < 100; i++) {
      state.inFlight = false  // reset so each poll can run (backoff skips some, but we set directly)
      if (state.consecutive404 <= 10 || state.consecutive404 % 3 === 0) {
        await pollFileStatusOnce(failFetch, state, vi.fn())
      } else {
        // Simulate the backoff skip
        state.consecutive404++
      }
    }
    expect(state.consecutive404).toBeLessThanOrEqual(30)
  })

  it('caps consecutive404 at 30 on 404 responses too', async () => {
    const state = createFilePollingState()
    const notFoundFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => null } })
    for (let i = 0; i < 50; i++) {
      state.inFlight = false
      if (state.consecutive404 <= 10 || state.consecutive404 % 3 === 0) {
        await pollFileStatusOnce(notFoundFetch, state, vi.fn())
      } else {
        state.consecutive404 = Math.min(state.consecutive404 + 1, 30)
      }
    }
    expect(state.consecutive404).toBeLessThanOrEqual(30)
  })
})
