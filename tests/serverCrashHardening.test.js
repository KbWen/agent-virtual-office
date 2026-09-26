/**
 * fix/server-hardening — F1 (P1 crash) + F2 (SSE 60s drop) + F3 (Host validation)
 *
 * Boots a real `node server.mjs` child process against a temp HOME so
 * os.homedir() resolves into an isolated path (same isolation technique as
 * tests/serverTransportE2E.test.js). NEVER writes to the developer's real
 * ~/.claude/office-status.json.
 *
 * F1: a raw TCP request whose request-target makes `new URL(req.url, 'http://x')`
 *     throw (e.g. absolute-form target with an invalid authority, or a request
 *     line containing an unescaped '[') must NOT crash the process — the
 *     connection may be reset, but a subsequent GET /api/health must still
 *     succeed on the SAME still-running process.
 *
 * F3: requests whose Host header names a host outside the allowlist must be
 *     rejected (403) rather than served, closing the DNS-rebinding read.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, connect } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

async function waitForServer(base, deadlineMs = 20_000) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) {
        const body = await res.json()
        if (body.ok) return true
      }
    } catch {}
    await new Promise(r => setTimeout(r, 150))
  }
  return false
}

/** Send a raw request line over a fresh TCP socket to `port`; resolve with
 *  whatever bytes come back (or '' on reset/timeout) without throwing. */
function rawRequest(port, requestLine, { hostHeader = 'x', timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    const sock = connect(port, '127.0.0.1', () => {
      sock.write(`${requestLine}\r\nHost: ${hostHeader}\r\nConnection: close\r\n\r\n`)
    })
    let data = ''
    sock.on('data', d => { data += d.toString() })
    const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
    sock.on('close', finish)
    sock.on('error', finish)
    setTimeout(finish, timeoutMs)
  })
}

let BASE_URL, PORT, serverProc, tempDir, stderr

beforeAll(async () => {
  const distIndex = join(ROOT, 'dist', 'index.html')
  if (!existsSync(distIndex)) {
    throw new Error('dist/index.html not found — run `npm run build` before this suite (server.mjs requires the bundle).')
  }
  tempDir = mkdtempSync(join(tmpdir(), 'avo-hardening-e2e-'))
  mkdirSync(join(tempDir, '.claude'), { recursive: true })

  PORT = await freePort()
  BASE_URL = `http://127.0.0.1:${PORT}`

  stderr = ''
  serverProc = spawn(
    process.execPath,
    ['server.mjs', `--port=${PORT}`, '--no-open'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HOME: tempDir, USERPROFILE: tempDir, OFFICE_API_TOKEN: '' },
    }
  )
  serverProc.stderr.on('data', d => { stderr += d.toString() })
  serverProc.on('error', err => { throw new Error(`Failed to spawn server.mjs: ${err.message}`) })

  const ready = await waitForServer(BASE_URL, 25_000)
  if (!ready) {
    serverProc.kill('SIGKILL')
    throw new Error(`server.mjs did not become ready within 25s.\nStderr: ${stderr.slice(-800)}`)
  }
}, 30_000)

afterAll(() => {
  try { serverProc?.kill('SIGTERM') } catch {}
})

describe('F1 — malformed request-target must not crash the process', () => {
  it('an absolute-form request-target with an invalid authority does not kill the server', async () => {
    // Reproduces the auditor's repro: `new URL('http://a:b:c/', 'http://x')` throws
    // TypeError: Invalid URL synchronously inside the request-listener callback.
    await rawRequest(PORT, 'GET http://a:b:c/ HTTP/1.1')

    // The crash (pre-fix) exits the whole process — give it a moment to have
    // done so if it was going to, then prove the SAME process still answers.
    await new Promise(r => setTimeout(r, 300))

    expect(serverProc.exitCode, `server process exited (crash). Stderr: ${stderr.slice(-800)}`).toBeNull()

    const health = await fetch(`${BASE_URL}/api/health`)
    expect(health.status).toBe(200)
    const body = await health.json()
    expect(body.ok).toBe(true)
  })

  it('a request line containing a bracket-only authority also survives (serveStatic path)', async () => {
    await rawRequest(PORT, 'GET http://[ HTTP/1.1')
    await new Promise(r => setTimeout(r, 300))
    expect(serverProc.exitCode, `server process exited (crash). Stderr: ${stderr.slice(-800)}`).toBeNull()
    const health = await fetch(`${BASE_URL}/api/health`)
    expect(health.status).toBe(200)
  })

  it('server keeps serving normal GET /api/status after the malformed request', async () => {
    const res = await fetch(`${BASE_URL}/api/status`)
    expect(res.status).toBe(200)
  })
})

describe('F3 — Host header validation (DNS-rebinding guard)', () => {
  it('loopback Host header (127.0.0.1:<port>) is allowed', async () => {
    const res = await fetch(`${BASE_URL}/api/health`, { headers: { Host: `127.0.0.1:${PORT}` } })
    expect(res.status).toBe(200)
  })

  it('localhost Host header is allowed', async () => {
    const res = await fetch(`${BASE_URL}/api/health`, { headers: { Host: `localhost:${PORT}` } })
    expect(res.status).toBe(200)
  })

  it('an attacker-controlled Host header is rejected with 403 on /api/health', async () => {
    const raw = await rawRequest(PORT, 'GET /api/health HTTP/1.1', { hostHeader: 'evil.example' })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('an attacker-controlled Host header is rejected with 403 on /api/status', async () => {
    const raw = await rawRequest(PORT, 'GET /api/status HTTP/1.1', { hostHeader: 'evil.example' })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('an attacker-controlled Host header is rejected with 403 on /api/status/stream', async () => {
    const raw = await rawRequest(PORT, 'GET /api/status/stream HTTP/1.1', { hostHeader: 'evil.example' })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('the server stays alive after a rejected-Host request', async () => {
    const health = await fetch(`${BASE_URL}/api/health`)
    expect(health.status).toBe(200)
  })
})
