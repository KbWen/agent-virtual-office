/**
 * 2026-09-26 dev-server parity wave — behavioral tests.
 *
 * Boots the REAL `vite.config.mjs` middleware via Vite's programmatic `createServer()`
 * (root = repo root, so our plugins' relative imports resolve normally) with an isolated
 * `OFFICE_STATUS_DIR` per server instance — never touches the developer's real ~/.claude.
 * Prefers real HTTP/SSE behavior over source-regex assertions (existing
 * `viteEventMiddlewareParity.test.js` stays as-is; this file covers the NEW findings).
 *
 * Findings covered (see docs/specs/engineering-audit-remediation.md 2026-09-26 wave):
 *   F-1  file-watcher fallback must not react to files under OFFICE_STATUS_DIR
 *   F-2  fallback must not overwrite a non-file-watcher status younger than the stale window
 *   F-3  officeStatusPlugin's SSE watcher must react to add/unlink, not just change
 *   F-4  Vite's own permissive CORS middleware must not shadow the plugin's CORS/token logic
 *   F-5  scanAndMerge call sites that were unguarded must not crash the dev server
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createServer } from 'vite'
import { mkdtempSync, writeFileSync, appendFileSync, rmSync, mkdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const servers = []
const scratchFiles = []

async function bootDevServer(env = {}) {
  const tempStatus = mkdtempSync(join(tmpdir(), 'avo-dev-parity-status-'))
  const savedEnv = {}
  const keys = ['OFFICE_STATUS_DIR', 'OFFICE_DISABLE_FILE_WATCHER', 'OFFICE_API_ALLOWED_ORIGINS', 'OFFICE_API_TOKEN']
  for (const k of keys) savedEnv[k] = process.env[k]

  process.env.OFFICE_STATUS_DIR = tempStatus
  delete process.env.OFFICE_DISABLE_FILE_WATCHER
  delete process.env.OFFICE_API_ALLOWED_ORIGINS
  delete process.env.OFFICE_API_TOKEN
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }

  const server = await createServer({
    configFile: 'vite.config.mjs',
    root: ROOT,
    logLevel: 'silent',
    server: { port: 0, strictPort: false, host: '127.0.0.1' },
  })
  await server.listen()

  // Restore ambient env immediately — the config already captured what it needed at
  // creation time (module-level consts + per-call getOfficeApiConfig() inside the plugin
  // factory), so later servers/tests are not affected by this one's env.
  for (const k of keys) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }

  const addr = server.httpServer.address()
  const base = `http://127.0.0.1:${addr.port}`
  servers.push(server)
  return { server, base, tempStatus }
}

afterEach(async () => {
  while (servers.length) {
    const s = servers.pop()
    try { await s.close() } catch {}
  }
  while (scratchFiles.length) {
    const f = scratchFiles.pop()
    try { unlinkSync(f) } catch {}
  }
}, 30_000)

// ─── F-1: fallback must not react to files under OFFICE_STATUS_DIR ────────────

describe('F-1 file-watcher fallback scope (must not fabricate status from OFFICE_STATUS_DIR writes)', () => {
  it('editing a non-office-status file inside OFFICE_STATUS_DIR never produces a merged status', async () => {
    const { base, tempStatus } = await bootDevServer()

    // Simulates a Claude Code transcript / debug file living under ~/.claude (here: the
    // isolated OFFICE_STATUS_DIR) — NOT a legitimate project source edit.
    const foreignFile = join(tempStatus, 'debug-log.txt')
    writeFileSync(foreignFile, 'line 1\n')
    await new Promise((r) => setTimeout(r, 300))
    appendFileSync(foreignFile, 'line 2\n')  // guarantee a 'change' event fires

    // Give the (1500ms-debounced) fallback writer every chance to fire before asserting
    // it did NOT.
    await new Promise((r) => setTimeout(r, 2000))

    const res = await fetch(`${base}/api/status`)
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toBe('null')
  }, 25_000)
})

// ─── F-3: officeStatusPlugin watcher must react to add/unlink ─────────────────

describe('F-3 SSE push on new/removed session files (add/unlink), not just change', () => {
  it('creating a brand-new session file pushes an SSE update without waiting for a change event', async () => {
    const { base, tempStatus } = await bootDevServer()

    // A single continuous pump loop (NOT a series of racing reader.read() calls — a stream
    // reader only supports one outstanding read() at a time; racing a fresh read() against a
    // timeout on every retry leaves earlier read() calls dangling and can silently swallow the
    // very chunk being waited for). An AbortController bounds the whole pump instead.
    const controller = new AbortController()
    const streamRes = await fetch(`${base}/api/status/stream`, { signal: controller.signal })
    expect(streamRes.status).toBe(200)
    const reader = streamRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let found = null
    const overallTimer = setTimeout(() => controller.abort(), 5000)

    const pump = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let idx
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const match = chunk.match(/^event: status\ndata: (.+)$/s)
            if (match) {
              const payload = JSON.parse(match[1])
              if ((payload.agents ?? []).some((a) => a.role.includes('dev'))) {
                found = payload
                return
              }
            }
          }
        }
      } catch {}  // aborted — expected on timeout
    })()

    // Give the connection a moment to settle, then create the NEW session file (an 'add'
    // event — not an edit of an existing file, so no 'change' event fires for it at all).
    await new Promise((r) => setTimeout(r, 300))
    const sessionFile = join(tempStatus, 'office-status-parityslug.json')
    writeFileSync(sessionFile, JSON.stringify({
      _seq: String(Date.now()),
      _cwd: ROOT,
      type: 'office-status',
      agents: [{ role: 'dev', status: 'working' }],
    }))

    await pump
    clearTimeout(overallTimer)
    // reader.cancel() alone closes the underlying stream/connection — calling
    // controller.abort() too (after the body may already be settled) raced an unhandled
    // rejection out of undici's fetch internals.
    try { reader.cancel() } catch {}

    expect(found, 'expected an SSE push after creating a new session file (add event)').toBeTruthy()
  }, 25_000)
})

// ─── F-2: fallback overwrite-protection window must match the stale window, not 10s ─────

describe('F-2 fallback overwrite protection outlives 10s (matches the multi-minute stale window)', () => {
  it('a webhook-set blocked status survives past 10s when a file-watcher edit follows', async () => {
    const { base } = await bootDevServer()

    const eventRes = await fetch(`${base}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'build-failed' }),
    })
    expect(eventRes.status).toBe(200)

    let merged = await (await fetch(`${base}/api/status`)).json()
    expect(merged.agents.find((a) => a.role === 'ops')?.status).toBe('blocked')

    // Wait past the OLD 10s guard window (but well inside the 5-minute stale window).
    await new Promise((r) => setTimeout(r, 10_800))

    // Trigger the file-watcher fallback via a real project-root edit.
    const scratchFile = join(ROOT, `.avo-dev-parity-scratch-${process.pid}.jsx`)
    scratchFiles.push(scratchFile)
    writeFileSync(scratchFile, '// scratch\n')
    await new Promise((r) => setTimeout(r, 200))
    appendFileSync(scratchFile, '// edit\n')

    await new Promise((r) => setTimeout(r, 2000))

    merged = await (await fetch(`${base}/api/status`)).json()
    const ops = merged.agents.find((a) => a.role === 'ops')
    expect(ops?.status, 'webhook-set blocked status must not be overwritten by the file-watcher fallback within the stale window').toBe('blocked')
  }, 30_000)
})

// ─── F-4: dev CORS must be governed by the plugin, not Vite's built-in cors middleware ────

describe('F-4 dev CORS parity (plugin logic is authoritative, not Vite\'s default cors middleware)', () => {
  it('an explicitly allowed non-loopback origin gets its own ACAO header on preflight', async () => {
    const { base } = await bootDevServer({ OFFICE_API_ALLOWED_ORIGINS: 'https://office.example' })

    const res = await fetch(`${base}/api/event`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://office.example', 'Access-Control-Request-Method': 'POST' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('https://office.example')
  }, 25_000)

  it('a loopback origin NOT in an explicit allowlist is rejected (403), matching prod', async () => {
    const { base } = await bootDevServer({ OFFICE_API_ALLOWED_ORIGINS: 'https://office.example' })

    const res = await fetch(`${base}/api/event`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
    })
    expect(res.status).toBe(403)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  }, 25_000)

  it('a disallowed non-loopback origin with no allowlist configured is rejected (403), matching prod', async () => {
    const { base } = await bootDevServer()

    const res = await fetch(`${base}/api/event`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
    })
    expect(res.status).toBe(403)
  }, 25_000)
})

// ─── F-5: previously-unguarded scanAndMerge call sites must not crash the dev server ──────

describe('F-5 unguarded scanAndMerge call sites are hardened', () => {
  it('a malformed session file does not crash the SSE endpoint', async () => {
    const { base, tempStatus } = await bootDevServer()

    mkdirSync(tempStatus, { recursive: true })
    writeFileSync(join(tempStatus, 'office-status-corrupt.json'), '{not valid json')

    const res = await fetch(`${base}/api/status/stream`)
    expect(res.status).toBe(200)
    try { res.body.cancel() } catch {}

    // Server must still be alive and answering normally afterward.
    const health = await fetch(`${base}/api/health`)
    expect(health.status).toBe(200)
  }, 25_000)

  it('a malformed session file edited after an SSE client connects does not crash the debounced broadcast', async () => {
    const { base, tempStatus } = await bootDevServer()

    const streamRes = await fetch(`${base}/api/status/stream`)
    expect(streamRes.status).toBe(200)

    const corruptFile = join(tempStatus, 'office-status-corrupt2.json')
    writeFileSync(corruptFile, '{"_seq": "' + Date.now() + '", "agents": "not-an-array-but-truthy-should-not-crash-scanAndMerge-itself"')
    await new Promise((r) => setTimeout(r, 300))
    appendFileSync(corruptFile, 'still not valid json')

    await new Promise((r) => setTimeout(r, 500))
    try { streamRes.body.cancel() } catch {}

    const health = await fetch(`${base}/api/health`)
    expect(health.status).toBe(200)
  }, 25_000)
})
