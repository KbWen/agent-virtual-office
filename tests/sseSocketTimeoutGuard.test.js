/**
 * fix/server-hardening — F2 (SSE dropped ~every 60s)
 *
 * Root cause: `server.setTimeout(30000)` applies a 30s idle-socket timeout to every
 * connection, and the SSE heartbeat interval was also 30s — the two clocks are not
 * phase-locked, so on roughly every other cycle the socket goes fully idle for the 30s
 * window before the next heartbeat lands and gets destroyed, dropping the stream
 * approximately every 60s (src/inference/inferStatus.js's onerror path then reports
 * degraded integration health during the reconnect).
 *
 * This is a deliberately STATIC/structural regression guard rather than a full runtime
 * E2E: the server-side per-socket timeout value (`req.socket.timeout`) is server-internal
 * state with no external observable effect short of either (a) waiting past the real 30s+
 * boundary — explicitly out of scope per the task brief ("don't write a 60s-sleeping
 * test") — or (b) adding a test-only introspection seam to server.mjs purely to serve this
 * one assertion, which would be test-driven production-code pollution for a single-use
 * seam (no such seam exists today; not adding one here per the task brief's own fallback:
 * "otherwise assert the stream socket timeout is 0"). A structural assertion pinned to the
 * exact fix (the `req.socket?.setTimeout(0)` call inside the `/api/status/stream` route,
 * plus the heartbeat interval literal) still fails red on the pre-fix source and flips
 * green on the fix, and a revert of either line immediately fails it again (verified by
 * mutation-check — see Work Log Evidence).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = readFileSync(path.join(ROOT, 'server.mjs'), 'utf-8')

/** Extract the `/api/status/stream` route block: from its registration line up to the
 *  next `if (url.pathname === ...)` sibling route (or the closing of the server callback). */
function extractSseRouteBlock(source) {
  const startIdx = source.indexOf("url.pathname === '/api/status/stream'")
  expect(startIdx, "could not locate the '/api/status/stream' route in server.mjs").toBeGreaterThan(-1)
  const afterStart = source.slice(startIdx)
  const nextRouteIdx = afterStart.indexOf("url.pathname === '/api/lang'")
  expect(nextRouteIdx, "could not locate the next sibling route ('/api/lang') to bound the SSE block").toBeGreaterThan(-1)
  return afterStart.slice(0, nextRouteIdx)
}

describe('F2 — SSE socket-timeout / heartbeat structural guard', () => {
  it('the /api/status/stream route disables the per-socket idle timeout (req.socket.setTimeout(0))', () => {
    const block = extractSseRouteBlock(SOURCE)
    expect(block).toMatch(/req\.socket\??\.setTimeout\(\s*0\s*\)/)
  })

  it('the disabling call happens BEFORE the client is added to sseClients (ordering matters for new connections)', () => {
    const block = extractSseRouteBlock(SOURCE)
    const timeoutIdx = block.search(/req\.socket\??\.setTimeout\(\s*0\s*\)/)
    const addIdx = block.indexOf('sseClients.add(res)')
    expect(timeoutIdx).toBeGreaterThan(-1)
    expect(addIdx).toBeGreaterThan(-1)
    expect(timeoutIdx).toBeLessThan(addIdx)
  })

  it('the SSE heartbeat interval is well under the 30s server.setTimeout idle window', () => {
    const match = SOURCE.match(/const _sseHeartbeat = setInterval\([\s\S]*?\},\s*(\d[\d_]*)\s*\)/)
    expect(match, 'could not locate the _sseHeartbeat setInterval call').not.toBeNull()
    const intervalMs = Number(match[1].replace(/_/g, ''))
    expect(intervalMs).toBeLessThanOrEqual(15_000)
  })

  it('server.setTimeout is still 30s for every OTHER (non-SSE) route — slowloris guard untouched', () => {
    expect(SOURCE).toMatch(/server\.setTimeout\(30000\)/)
    expect(SOURCE).toMatch(/server\.headersTimeout = 15000/)
    expect(SOURCE).toMatch(/server\.requestTimeout = 30000/)
  })
})
