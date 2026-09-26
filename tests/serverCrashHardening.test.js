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
      env: {
        ...process.env,
        HOME: tempDir,
        USERPROFILE: tempDir,
        OFFICE_API_TOKEN: '',
        // Review round 2 fix: an inherited OFFICE_STATUS_DIR would point this child at the
        // developer's real status dir instead of the isolated temp one (HOME/USERPROFILE
        // alone aren't enough once that override is set), and an inherited
        // OFFICE_ALLOWED_HOSTS could silently widen the F3 403 assertions below.
        OFFICE_STATUS_DIR: join(tempDir, '.claude'),
        OFFICE_ALLOWED_HOSTS: '',
      },
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

  it('a reverse-proxy-style Host (nginx.conf forwards "Host $host" = server_name) is 403 by default', async () => {
    // Reproduces HIGH-1 from review round 2: docs/deployment/nginx.conf forwards the
    // configured server_name (e.g. office.example.com) verbatim as the Host header. Without
    // OFFICE_ALLOWED_HOSTS set, that MUST be rejected (this server's default is deny, not the
    // documented-deployment host) — see the companion describe block below for the
    // OFFICE_ALLOWED_HOSTS-set case that proves the escape hatch actually works.
    const raw = await rawRequest(PORT, 'GET /api/health HTTP/1.1', { hostHeader: 'office.example.com' })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('an HTTP/1.1 request with NO Host header is 400 from Node itself (never reaches our code)', async () => {
    // RFC 7230 requires Host on HTTP/1.1; Node's own http_parser enforces this and returns
    // 400 before our request-listener callback ever runs. Documented here so the isAllowedHost
    // "missing Host is allowed" branch below isn't mistaken for reachable on this path.
    const raw = await new Promise((resolve) => {
      const sock = connect(PORT, '127.0.0.1', () => {
        sock.write('GET /api/health HTTP/1.1\r\nConnection: close\r\n\r\n')
      })
      let data = ''
      sock.on('data', d => { data += d.toString() })
      const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
      sock.on('close', finish)
      sock.on('error', finish)
      setTimeout(finish, 2000)
    })
    expect(raw).toMatch(/^HTTP\/1\.1 400/)
  })

  it('an HTTP/1.0 request with NO Host header reaches isAllowedHost and IS allowed through', async () => {
    // HTTP/1.0 has no Host requirement, so this DOES reach our request listener with
    // req.headers.host === undefined. A rebinding attack requires the BROWSER to send an
    // attacker-chosen Host; a request that omits Host entirely poses no rebinding risk (see
    // the isAllowedHost comment in server.mjs), so it must NOT be rejected.
    const raw = await new Promise((resolve) => {
      const sock = connect(PORT, '127.0.0.1', () => {
        sock.write('GET /api/health HTTP/1.0\r\nConnection: close\r\n\r\n')
      })
      let data = ''
      sock.on('data', d => { data += d.toString() })
      const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
      sock.on('close', finish)
      sock.on('error', finish)
      setTimeout(finish, 2000)
    })
    expect(raw).toMatch(/^HTTP\/1\.1 200/)
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

// ─── F3 round 2 — OFFICE_ALLOWED_HOSTS escape hatch (HIGH-1 fix) ────────────────
//
// A separate server instance, spawned with OFFICE_ALLOWED_HOSTS set, proves the documented
// reverse-proxy fix actually works end-to-end (not just "the code compiles").
describe('F3 round 2 — OFFICE_ALLOWED_HOSTS permits a reverse-proxy / extra-LAN Host', () => {
  let altPort, altProc, altTempDir, altStderr = ''

  beforeAll(async () => {
    altTempDir = mkdtempSync(join(tmpdir(), 'avo-hardening-allowedhosts-'))
    mkdirSync(join(altTempDir, '.claude'), { recursive: true })
    altPort = await freePort()
    altProc = spawn(
      process.execPath,
      ['server.mjs', `--port=${altPort}`, '--no-open'],
      {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HOME: altTempDir,
          USERPROFILE: altTempDir,
          OFFICE_API_TOKEN: '',
          OFFICE_STATUS_DIR: join(altTempDir, '.claude'),
          // office.example.com: exact match, mirrors nginx.conf's server_name.
          // .suffix.example: leading-dot entry — must match both the bare suffix AND subdomains.
          // mypc.local:9999: a port suffix in the env value itself must be stripped/ignored.
          OFFICE_ALLOWED_HOSTS: 'office.example.com, .suffix.example, mypc.local:9999',
        },
      }
    )
    altProc.stderr.on('data', d => { altStderr += d.toString() })
    const ready = await waitForServer(`http://127.0.0.1:${altPort}`, 25_000)
    if (!ready) {
      altProc.kill('SIGKILL')
      throw new Error(`allowlisted server.mjs did not become ready.\nStderr: ${altStderr.slice(-800)}`)
    }
  }, 30_000)

  afterAll(() => { try { altProc?.kill('SIGTERM') } catch {} })

  it('an exact-match env entry (the nginx.conf server_name case) is allowed', async () => {
    const raw = await rawRequest(altPort, 'GET /api/health HTTP/1.1', { hostHeader: 'office.example.com' })
    expect(raw).toMatch(/^HTTP\/1\.1 200/)
  })

  it('a hostname NOT in the allowlist is still 403 on this same server', async () => {
    const raw = await rawRequest(altPort, 'GET /api/health HTTP/1.1', { hostHeader: 'evil.example' })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('a leading-dot env entry matches the bare suffix itself', async () => {
    const raw = await rawRequest(altPort, 'GET /api/health HTTP/1.1', { hostHeader: 'suffix.example' })
    expect(raw).toMatch(/^HTTP\/1\.1 200/)
  })

  it('a leading-dot env entry matches an arbitrary subdomain', async () => {
    const raw = await rawRequest(altPort, 'GET /api/health HTTP/1.1', { hostHeader: 'deep.nested.suffix.example' })
    expect(raw).toMatch(/^HTTP\/1\.1 200/)
  })

  it('an env entry with a port suffix matches a request Host with a DIFFERENT port', async () => {
    const raw = await rawRequest(altPort, 'GET /api/health HTTP/1.1', { hostHeader: `mypc.local:${altPort}` })
    expect(raw).toMatch(/^HTTP\/1\.1 200/)
  })

  // Review round 3, LOW-7: a leading-dot suffix entry must match only at a real label
  // boundary (a preceding '.'), not on a bare string-suffix overlap.
  it('a hostname that merely ENDS WITH the suffix text (no dot boundary) is still rejected', async () => {
    // ".suffix.example" must NOT match "evilsuffix.example" — "evilsuffix.example" ends with
    // the literal characters "suffix.example" but there is no '.' immediately before them.
    const raw = await rawRequest(altPort, 'GET /api/health HTTP/1.1', { hostHeader: 'evilsuffix.example' })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('a hostname that is a prefix of the suffix entry (no leading dot match) is rejected', async () => {
    const raw = await rawRequest(altPort, 'GET /api/health HTTP/1.1', { hostHeader: 'suffix.example.evil.com' })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })
})

// ─── Review round 3, LOW-5 — a '.' allowlist entry must never re-open trailing-dot rebinding
describe('F3 round 3 — a bare "." env entry is ignored, not treated as a universal suffix', () => {
  let dotPort, dotProc, dotTempDir, dotStderr = ''

  beforeAll(async () => {
    dotTempDir = mkdtempSync(join(tmpdir(), 'avo-hardening-dotentry-'))
    mkdirSync(join(dotTempDir, '.claude'), { recursive: true })
    dotPort = await freePort()
    dotProc = spawn(
      process.execPath,
      ['server.mjs', `--port=${dotPort}`, '--no-open'],
      {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HOME: dotTempDir,
          USERPROFILE: dotTempDir,
          OFFICE_API_TOKEN: '',
          OFFICE_STATUS_DIR: join(dotTempDir, '.claude'),
          // A stray/trailing comma can produce an effectively-'.' entry; also test a
          // literal lone '.' directly.
          OFFICE_ALLOWED_HOSTS: '.',
        },
      }
    )
    dotProc.stderr.on('data', d => { dotStderr += d.toString() })
    const ready = await waitForServer(`http://127.0.0.1:${dotPort}`, 25_000)
    if (!ready) {
      dotProc.kill('SIGKILL')
      throw new Error(`dot-entry server.mjs did not become ready.\nStderr: ${dotStderr.slice(-800)}`)
    }
  }, 30_000)

  afterAll(() => { try { dotProc?.kill('SIGTERM') } catch {} })

  it('a trailing-dot FQDN (a rebinding vector if "." were treated as a suffix) is still 403', async () => {
    const raw = await rawRequest(dotPort, 'GET /api/health HTTP/1.1', { hostHeader: 'attacker.com.' })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('an ordinary unrelated hostname is still 403 (the "." entry grants nothing)', async () => {
    const raw = await rawRequest(dotPort, 'GET /api/health HTTP/1.1', { hostHeader: 'evil.example' })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })
})

// ─── Review round 3, MEDIUM-2 — a valid OFFICE_API_TOKEN exempts a request from the Host check
describe('F3 round 3 — a valid OFFICE_API_TOKEN bearer exempts a request from the Host check', () => {
  let tokPort, tokProc, tokTempDir, tokStderr = ''
  const TOKEN = 'test-secret-token-123'

  beforeAll(async () => {
    tokTempDir = mkdtempSync(join(tmpdir(), 'avo-hardening-token-'))
    mkdirSync(join(tokTempDir, '.claude'), { recursive: true })
    tokPort = await freePort()
    tokProc = spawn(
      process.execPath,
      ['server.mjs', `--port=${tokPort}`, '--no-open'],
      {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HOME: tokTempDir,
          USERPROFILE: tokTempDir,
          OFFICE_API_TOKEN: TOKEN,
          OFFICE_STATUS_DIR: join(tokTempDir, '.claude'),
          OFFICE_ALLOWED_HOSTS: '',
        },
      }
    )
    tokProc.stderr.on('data', d => { tokStderr += d.toString() })
    // /api/health requires no auth, so it can't prove readiness once a token is required for
    // writes — but GET /api/health itself is unauthenticated either way, so this still works.
    const ready = await waitForServer(`http://127.0.0.1:${tokPort}`, 25_000)
    if (!ready) {
      tokProc.kill('SIGKILL')
      throw new Error(`token-exempt server.mjs did not become ready.\nStderr: ${tokStderr.slice(-800)}`)
    }
  }, 30_000)

  afterAll(() => { try { tokProc?.kill('SIGTERM') } catch {} })

  it('bad Host + a valid token is allowed on a write route (POST /api/event)', async () => {
    const body = JSON.stringify({ event: 'test-passed' })
    const reqStr =
      `POST /api/event HTTP/1.1\r\n` +
      `Host: evil.example\r\n` +
      `X-Office-Token: ${TOKEN}\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      `Connection: close\r\n\r\n${body}`
    const raw = await new Promise((resolve) => {
      const sock = connect(tokPort, '127.0.0.1', () => { sock.write(reqStr) })
      let data = ''
      sock.on('data', d => { data += d.toString() })
      const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
      sock.on('close', finish)
      sock.on('error', finish)
      setTimeout(finish, 3000)
    })
    expect(raw).toMatch(/^HTTP\/1\.1 200/)
  })

  it('bad Host + NO token is still 403 on the same write route', async () => {
    const body = JSON.stringify({ event: 'test-passed' })
    const reqStr =
      `POST /api/event HTTP/1.1\r\n` +
      `Host: evil.example\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      `Connection: close\r\n\r\n${body}`
    const raw = await new Promise((resolve) => {
      const sock = connect(tokPort, '127.0.0.1', () => { sock.write(reqStr) })
      let data = ''
      sock.on('data', d => { data += d.toString() })
      const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
      sock.on('close', finish)
      sock.on('error', finish)
      setTimeout(finish, 3000)
    })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('bad Host + an INVALID token is still 403 (not any-token, only a MATCHING token)', async () => {
    const body = JSON.stringify({ event: 'test-passed' })
    const reqStr =
      `POST /api/event HTTP/1.1\r\n` +
      `Host: evil.example\r\n` +
      `X-Office-Token: wrong-token\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      `Connection: close\r\n\r\n${body}`
    const raw = await new Promise((resolve) => {
      const sock = connect(tokPort, '127.0.0.1', () => { sock.write(reqStr) })
      let data = ''
      sock.on('data', d => { data += d.toString() })
      const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
      sock.on('close', finish)
      sock.on('error', finish)
      setTimeout(finish, 3000)
    })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  // Review round 4, LOW-11: the exemption reads BOTH credential forms (X-Office-Token above,
  // and Authorization: Bearer here) via the same hasValidApiToken()/isAuthorized() path — a
  // caller authenticating with a bearer token must get the same exemption, not just the
  // custom header form.
  it('bad Host + a valid token in Bearer form (Authorization header) also exempts the request', async () => {
    const body = JSON.stringify({ event: 'test-passed' })
    const reqStr =
      `POST /api/event HTTP/1.1\r\n` +
      `Host: evil.example\r\n` +
      `Authorization: Bearer ${TOKEN}\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      `Connection: close\r\n\r\n${body}`
    const raw = await new Promise((resolve) => {
      const sock = connect(tokPort, '127.0.0.1', () => { sock.write(reqStr) })
      let data = ''
      sock.on('data', d => { data += d.toString() })
      const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
      sock.on('close', finish)
      sock.on('error', finish)
      setTimeout(finish, 3000)
    })
    expect(raw).toMatch(/^HTTP\/1\.1 200/)
  })
})

// ─── Review round 4, LOW-11 — "open mode" (no OFFICE_API_TOKEN configured) grants no
// Host-check exemption, no matter what credential header a request carries. hasValidApiToken()
// returns false whenever apiToken is null (see server.mjs) — this proves that decision holds
// end-to-end, not just at the unit level.
describe('F3 round 4 — open mode (no token configured) grants no Host-check exemption', () => {
  let openPort, openProc, openTempDir, openStderr = ''

  beforeAll(async () => {
    openTempDir = mkdtempSync(join(tmpdir(), 'avo-hardening-openmode-'))
    mkdirSync(join(openTempDir, '.claude'), { recursive: true })
    openPort = await freePort()
    openProc = spawn(
      process.execPath,
      ['server.mjs', `--port=${openPort}`, '--no-open'],
      {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HOME: openTempDir,
          USERPROFILE: openTempDir,
          OFFICE_API_TOKEN: '', // open mode — no token configured at all
          OFFICE_STATUS_DIR: join(openTempDir, '.claude'),
          OFFICE_ALLOWED_HOSTS: '',
        },
      }
    )
    openProc.stderr.on('data', d => { openStderr += d.toString() })
    const ready = await waitForServer(`http://127.0.0.1:${openPort}`, 25_000)
    if (!ready) {
      openProc.kill('SIGKILL')
      throw new Error(`open-mode server.mjs did not become ready.\nStderr: ${openStderr.slice(-800)}`)
    }
  }, 30_000)

  afterAll(() => { try { openProc?.kill('SIGTERM') } catch {} })

  it('bad Host + an X-Office-Token header (any value) is still 403 in open mode', async () => {
    const body = JSON.stringify({ event: 'test-passed' })
    const reqStr =
      `POST /api/event HTTP/1.1\r\n` +
      `Host: evil.example\r\n` +
      `X-Office-Token: anything-at-all\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      `Connection: close\r\n\r\n${body}`
    const raw = await new Promise((resolve) => {
      const sock = connect(openPort, '127.0.0.1', () => { sock.write(reqStr) })
      let data = ''
      sock.on('data', d => { data += d.toString() })
      const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
      sock.on('close', finish)
      sock.on('error', finish)
      setTimeout(finish, 3000)
    })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('bad Host + an Authorization: Bearer header (any value) is still 403 in open mode', async () => {
    const body = JSON.stringify({ event: 'test-passed' })
    const reqStr =
      `POST /api/event HTTP/1.1\r\n` +
      `Host: evil.example\r\n` +
      `Authorization: Bearer anything-at-all\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      `Connection: close\r\n\r\n${body}`
    const raw = await new Promise((resolve) => {
      const sock = connect(openPort, '127.0.0.1', () => { sock.write(reqStr) })
      let data = ''
      sock.on('data', d => { data += d.toString() })
      const finish = () => { try { sock.destroy() } catch {}; resolve(data) }
      sock.on('close', finish)
      sock.on('error', finish)
      setTimeout(finish, 3000)
    })
    expect(raw).toMatch(/^HTTP\/1\.1 403/)
  })

  it('the server stays alive after open-mode 403s (GET /api/health still 200 with an allowed Host)', async () => {
    const health = await fetch(`http://127.0.0.1:${openPort}/api/health`)
    expect(health.status).toBe(200)
  })
})

// ─── Review round 3, LOW-7 — rejected-Host log cap is a lifetime cap, not a time window
describe('F3 round 3 — rejected-Host log cap (lifetime, not rate-limited)', () => {
  let capPort, capProc, capTempDir, capStderr = ''

  beforeAll(async () => {
    capTempDir = mkdtempSync(join(tmpdir(), 'avo-hardening-logcap-'))
    mkdirSync(join(capTempDir, '.claude'), { recursive: true })
    capPort = await freePort()
    capProc = spawn(
      process.execPath,
      ['server.mjs', `--port=${capPort}`, '--no-open'],
      {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HOME: capTempDir,
          USERPROFILE: capTempDir,
          OFFICE_API_TOKEN: '',
          OFFICE_STATUS_DIR: join(capTempDir, '.claude'),
          OFFICE_ALLOWED_HOSTS: '',
        },
      }
    )
    capProc.stdout.on('data', () => {}) // drain
    capProc.stderr.on('data', d => { capStderr += d.toString() })
    const ready = await waitForServer(`http://127.0.0.1:${capPort}`, 25_000)
    if (!ready) {
      capProc.kill('SIGKILL')
      throw new Error(`log-cap server.mjs did not become ready.\nStderr: ${capStderr.slice(-800)}`)
    }
  }, 30_000)

  afterAll(() => { try { capProc?.kill('SIGTERM') } catch {} })

  it('logs at most 50 distinct-hostname lines even after 60 distinct rejected Hosts', async () => {
    // stdout carries the console.warn lines (console.warn goes to stderr in Node, actually —
    // capture both to be safe).
    let out = ''
    capProc.stdout.on('data', d => { out += d.toString() })
    capProc.stderr.on('data', d => { out += d.toString() })
    for (let i = 0; i < 60; i++) {
      await rawRequest(capPort, 'GET /api/health HTTP/1.1', { hostHeader: `evil-${i}.example` })
    }
    // Give the async console writes a moment to flush.
    await new Promise(r => setTimeout(r, 300))
    const matches = out.match(/403: rejected request with disallowed Host/g) || []
    expect(matches.length).toBeLessThanOrEqual(50)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('the server stays alive after 60 distinct rejected Hosts', async () => {
    const health = await fetch(`http://127.0.0.1:${capPort}/api/health`)
    expect(health.status).toBe(200)
  })
})
