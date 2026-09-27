/**
 * fix/dev-allowed-hosts — behavioral test: OFFICE_ALLOWED_HOSTS now governs the Vite dev
 * server's own Host-header validation (`server.allowedHosts`), not just production
 * `server.mjs`. Before this change, Vite 8's built-in `hostValidationMiddleware` always ran
 * with an EMPTY allowedHosts list here, so any custom hostname (e.g. a reverse-proxied dev
 * setup) got a 403 regardless of OFFICE_ALLOWED_HOSTS.
 *
 * Boots the REAL `vite.config.mjs` via Vite's programmatic `createServer()`, same technique as
 * `tests/viteDevServerParity.test.js`. Uses a raw TCP request (not `fetch`) because `Host` is a
 * forbidden header the Fetch API will not let a client override — same technique as
 * `tests/serverCrashHardening.test.js`'s `rawRequest` helper for the same reason.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createServer } from 'vite'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { connect } from 'node:net'

const servers = []
const tempDirs = []

function mkdtempTracked(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

async function bootDevServer(env = {}) {
  const tempRoot = mkdtempTracked('avo-allowed-hosts-root-')
  writeFileSync(join(tempRoot, 'index.html'), '<!doctype html><html><body></body></html>')
  const tempStatus = mkdtempTracked('avo-allowed-hosts-status-')
  const savedEnv = {}
  const keys = ['OFFICE_STATUS_DIR', 'OFFICE_ALLOWED_HOSTS']
  for (const k of keys) savedEnv[k] = process.env[k]

  process.env.OFFICE_STATUS_DIR = tempStatus
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }

  const server = await createServer({
    configFile: 'vite.config.mjs',
    root: tempRoot,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { port: 0, strictPort: false, host: '127.0.0.1' },
  })
  await server.listen()

  // Restore ambient env immediately — vite.config.mjs's ALLOWED_HOSTS_ENV is a module-level
  // const captured at config-load time (inside createServer above), so later servers/tests
  // are unaffected by this one's env, matching viteDevServerParity.test.js's pattern.
  for (const k of keys) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }

  const addr = server.httpServer.address()
  servers.push(server)
  return { server, port: addr.port }
}

afterEach(async () => {
  while (servers.length) {
    const s = servers.pop()
    try { await s.close() } catch {}
  }
  while (tempDirs.length) {
    const d = tempDirs.pop()
    try { rmSync(d, { recursive: true, force: true }) } catch {}
  }
}, 30_000)

/** Send a raw HTTP/1.1 request with an explicit Host header over a fresh TCP socket, since
 *  the Fetch API forbids a caller from overriding `Host`. Resolves with the raw response text
 *  (or '' on reset/timeout) without throwing. */
function rawGet(port, pathname, hostHeader, { timeoutMs = 4000 } = {}) {
  return new Promise((resolve) => {
    const sock = connect(port, '127.0.0.1', () => {
      sock.write(`GET ${pathname} HTTP/1.1\r\nHost: ${hostHeader}\r\nConnection: close\r\n\r\n`)
    })
    let data = ''
    sock.on('data', (d) => { data += d.toString() })
    const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
    sock.on('close', finish)
    sock.on('error', finish)
    setTimeout(finish, timeoutMs)
  })
}

function statusLine(raw) {
  return raw.split('\r\n')[0] || ''
}

describe('OFFICE_ALLOWED_HOSTS governs the Vite dev server Host check', () => {
  it('an unlisted custom Host is rejected (403) when OFFICE_ALLOWED_HOSTS is set', async () => {
    const { port } = await bootDevServer({ OFFICE_ALLOWED_HOSTS: 'office.example' })
    const raw = await rawGet(port, '/', 'evil.example')
    expect(statusLine(raw)).toContain('403')
  }, 20_000)

  it('a Host listed verbatim in OFFICE_ALLOWED_HOSTS is allowed through (not 403)', async () => {
    const { port } = await bootDevServer({ OFFICE_ALLOWED_HOSTS: 'office.example' })
    const raw = await rawGet(port, '/', 'office.example')
    expect(statusLine(raw)).not.toContain('403')
  }, 20_000)

  it('a leading-dot suffix entry allows a matching subdomain (parity with server.mjs)', async () => {
    const { port } = await bootDevServer({ OFFICE_ALLOWED_HOSTS: '.example.com' })
    const raw = await rawGet(port, '/', 'dev.example.com')
    expect(statusLine(raw)).not.toContain('403')
  }, 20_000)

  it('a leading-dot suffix entry still rejects an unrelated host', async () => {
    const { port } = await bootDevServer({ OFFICE_ALLOWED_HOSTS: '.example.com' })
    const raw = await rawGet(port, '/', 'evil.example')
    expect(statusLine(raw)).toContain('403')
  }, 20_000)

  it('a port on the OFFICE_ALLOWED_HOSTS entry is stripped, matching server.mjs semantics', async () => {
    const { port } = await bootDevServer({ OFFICE_ALLOWED_HOSTS: 'office.example:5174' })
    const raw = await rawGet(port, '/', 'office.example')
    expect(statusLine(raw)).not.toContain('403')
  }, 20_000)

  it('localhost keeps working (Vite default) when OFFICE_ALLOWED_HOSTS is unset', async () => {
    const { port } = await bootDevServer()
    const raw = await rawGet(port, '/', 'localhost')
    expect(statusLine(raw)).not.toContain('403')
  }, 20_000)

  it('an arbitrary custom Host is still rejected by Vite default when OFFICE_ALLOWED_HOSTS is unset', async () => {
    const { port } = await bootDevServer()
    const raw = await rawGet(port, '/', 'anything.example')
    expect(statusLine(raw)).toContain('403')
  }, 20_000)
})
