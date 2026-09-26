/**
 * fix/server-hardening — LOW-4 (review round 2, 2026-09-26): SSE client cap
 *
 * With the per-socket idle timeout disabled on the SSE route (F2), a connection can be held
 * open indefinitely, so an unbounded number of concurrent SSE clients is a resource-
 * exhaustion surface. `OFFICE_MAX_SSE_CLIENTS` caps it; beyond the cap, new SSE connections
 * get 503 instead of being accepted. This test spawns the server with a deliberately tiny
 * cap (3) so the boundary is reachable without opening hundreds of real sockets.
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
const MAX_SSE_CLIENTS = 3

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

/** Open a raw SSE connection and resolve once the status line + headers are in. Keeps the
 *  socket open (does not close it) so it counts toward the server's live sseClients set. */
function openSseConnection(port) {
  return new Promise((resolve, reject) => {
    const sock = connect(port, '127.0.0.1', () => {
      sock.write('GET /api/status/stream HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n')
    })
    let data = ''
    const onData = (d) => {
      data += d.toString()
      if (data.includes('\r\n\r\n')) {
        sock.removeListener('data', onData)
        resolve({ sock, statusLine: data.split('\r\n')[0] })
      }
    }
    sock.on('data', onData)
    sock.on('error', reject)
    setTimeout(() => reject(new Error('timed out waiting for SSE response headers')), 5000)
  })
}

let PORT, serverProc, tempDir, stderr = ''

beforeAll(async () => {
  const distIndex = join(ROOT, 'dist', 'index.html')
  if (!existsSync(distIndex)) {
    throw new Error('dist/index.html not found — run `npm run build` before this suite.')
  }
  tempDir = mkdtempSync(join(tmpdir(), 'avo-sse-cap-e2e-'))
  mkdirSync(join(tempDir, '.claude'), { recursive: true })
  PORT = await freePort()

  serverProc = spawn(
    process.execPath,
    ['server.mjs', `--port=${PORT}`, '--no-open'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        OFFICE_API_TOKEN: '',
        OFFICE_STATUS_DIR: join(tempDir, '.claude'),
        OFFICE_ALLOWED_HOSTS: '',
        OFFICE_MAX_SSE_CLIENTS: String(MAX_SSE_CLIENTS),
      },
    }
  )
  serverProc.stderr.on('data', d => { stderr += d.toString() })

  const ready = await waitForServer(`http://127.0.0.1:${PORT}`, 25_000)
  if (!ready) {
    serverProc.kill('SIGKILL')
    throw new Error(`server.mjs did not become ready.\nStderr: ${stderr.slice(-800)}`)
  }
}, 30_000)

afterAll(() => { try { serverProc?.kill('SIGTERM') } catch {} })

describe('LOW-4 — OFFICE_MAX_SSE_CLIENTS caps concurrent SSE connections', () => {
  const held = []
  afterAll(() => { for (const sock of held) { try { sock.destroy() } catch {} } })

  it(`accepts up to the configured cap (${MAX_SSE_CLIENTS}) and rejects the next one with 503`, async () => {
    for (let i = 0; i < MAX_SSE_CLIENTS; i++) {
      const { sock, statusLine } = await openSseConnection(PORT)
      expect(statusLine, `connection ${i + 1}/${MAX_SSE_CLIENTS} should be accepted`).toMatch(/^HTTP\/1\.1 200/)
      held.push(sock) // kept open — must count toward the live sseClients set
    }
    // One more, over the cap, must be rejected.
    const over = await openSseConnection(PORT)
    expect(over.statusLine).toMatch(/^HTTP\/1\.1 503/)
    over.sock.destroy() // this one was refused, never added to sseClients — safe to close
  })

  it('the server stays alive and /api/health still responds after a 503 rejection', async () => {
    const health = await fetch(`http://127.0.0.1:${PORT}/api/health`)
    expect(health.status).toBe(200)
  })

  it('closing a held connection frees a cap slot for a new one', async () => {
    const freed = held.pop()
    freed.destroy()
    // Give the server's 'close' listener a moment to remove it from sseClients.
    await new Promise(r => setTimeout(r, 200))
    const { sock, statusLine } = await openSseConnection(PORT)
    expect(statusLine).toMatch(/^HTTP\/1\.1 200/)
    held.push(sock)
  })
})
