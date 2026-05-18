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

  it('resets backoff and skipTick after a 304 Not Modified response', async () => {
    // skipTick drives the 1-in-3 recovery cadence; set it to 2 so the next call (→3) runs
    const state = createFilePollingState()
    state.consecutive404 = 12
    state.skipTick = 2
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 304, headers: { get: () => null } })
    const callback = vi.fn()

    const result = await pollFileStatusOnce(fetchImpl, state, callback)

    expect(result).toMatchObject({ ok: true, unchanged: true })
    expect(state.consecutive404).toBe(0)   // server is alive — clear backoff
    expect(state.skipTick).toBe(0)         // also reset so next outage starts fresh
    expect(callback).not.toHaveBeenCalled()
  })

  it('resets backoff after a successful fetch', async () => {
    // At consecutive404=11, skipTick advances each call; every 3rd tick allows a real poll.
    // Tick 1 (skipTick→1): skip. Tick 2 (skipTick→2): skip. Tick 3 (skipTick→3, 3%3=0): runs.
    const state = createFilePollingState()
    state.consecutive404 = 11
    const callback = vi.fn()
    const skippedFetch = vi.fn()
    const successFetch = vi.fn().mockResolvedValue(makeResponse({
      etag: 'v3',
      jsonData: { type: 'office-status', _seq: 'fresh', agents: [{ role: 'qa', status: 'done' }] },
    }))

    // First two calls skipped (skipTick 1, 2 — both non-multiples of 3)
    state.inFlight = false
    await pollFileStatusOnce(skippedFetch, state, callback)  // skipTick → 1
    state.inFlight = false
    await pollFileStatusOnce(skippedFetch, state, callback)  // skipTick → 2
    expect(skippedFetch).not.toHaveBeenCalled()

    // Third call: skipTick reaches 3 (3 % 3 === 0) → poll runs
    state.inFlight = false
    await pollFileStatusOnce(successFetch, state, callback)

    expect(successFetch).toHaveBeenCalledOnce()
    expect(state.consecutive404).toBe(0)
    expect(state.skipTick).toBe(0)
    expect(callback).toHaveBeenCalledOnce()
  })

  it('caps consecutive404 at 30 so a persistently unreachable server does not ratchet forever', async () => {
    // skipTick drives cadence; every 3rd call is a real poll attempt even in backoff.
    // The counter grows to the cap via those recovery-attempt polls that also fail.
    const state = createFilePollingState()
    const failFetch = vi.fn().mockRejectedValue(new Error('network'))
    for (let i = 0; i < 200; i++) {
      state.inFlight = false
      await pollFileStatusOnce(failFetch, state, vi.fn())
    }
    expect(state.consecutive404).toBeLessThanOrEqual(30)
  })

  it('caps consecutive404 at 30 on 404 responses too', async () => {
    const state = createFilePollingState()
    const notFoundFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => null } })
    for (let i = 0; i < 200; i++) {
      state.inFlight = false
      await pollFileStatusOnce(notFoundFetch, state, vi.fn())
    }
    expect(state.consecutive404).toBeLessThanOrEqual(30)
  })
})
