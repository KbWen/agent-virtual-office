/**
 * #201 — real-server proof that OFFICE_PROJECT_ROOT reaches both the read and write paths.
 *
 * Reproduces the npx layout: `bin/cli.js` spawns the server with `cwd` set to the PACKAGE
 * root, so process.cwd() is NOT the project the user launched from. Under that split the
 * server must match session files against the forwarded project root, or every hook-written
 * file is filtered out as foreign (the reported bug: `source: 'file-watcher'`, `_hint:
 * 'no-hooks'`, labels degraded to raw .jsonl filenames).
 *
 * Isolation follows tests/serverTransportE2E.test.js: HOME/USERPROFILE point at a temp dir,
 * so os.homedir() resolves there and the developer's real ~/.claude is never touched.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
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

async function waitForServer(base, deadlineMs = 25_000) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok && (await res.json()).ok) return true
    } catch {}
    await new Promise(r => setTimeout(r, 150))
  }
  return false
}

let BASE_URL
let serverProc
let projectDir

beforeAll(async () => {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    throw new Error('dist/index.html not found — run `npm run build` before this e2e (server.mjs requires the bundle).')
  }

  const homeDir = mkdtempSync(join(tmpdir(), 'avo-201-home-'))
  mkdirSync(join(homeDir, '.claude'), { recursive: true })
  // The project the user "launched from" — distinct from ROOT (which stands in for the
  // npx package directory the server is actually spawned in).
  projectDir = mkdtempSync(join(tmpdir(), 'avo-201-project-'))

  // A hook-written session, stamped with the real project dir like office-status-hook.js does.
  writeFileSync(
    join(homeDir, '.claude', 'office-status-e2e.json'),
    JSON.stringify({
      type: 'office-status',
      _seq: String(Date.now()),
      _cwd: projectDir,
      source: 'claude-cli',
      agents: [{ role: 'ops', status: 'working', task: 'Bash', label: 'deploying' }],
    }),
  )

  const port = await freePort()
  BASE_URL = `http://127.0.0.1:${port}`

  serverProc = spawn(process.execPath, ['server.mjs', `--port=${port}`, '--no-open'], {
    // Deliberately the package root, exactly as bin/cli.js spawns it.
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      OFFICE_API_TOKEN: '',
      // What bin/cli.js forwards from the invoking cwd.
      OFFICE_PROJECT_ROOT: projectDir,
    },
  })

  let stderr = ''
  serverProc.stderr.on('data', d => { stderr += d.toString() })
  serverProc.on('error', err => { throw new Error(`Failed to spawn server.mjs: ${err.message}`) })

  if (!(await waitForServer(BASE_URL))) {
    serverProc.kill('SIGKILL')
    throw new Error(`server.mjs did not become ready on ${BASE_URL}.\nStderr: ${stderr.slice(-800)}`)
  }
}, 40_000)

afterAll(() => {
  try { serverProc?.kill('SIGTERM') } catch {}
})

describe('#201 — server honours the forwarded project root', () => {
  it('serves hook sessions from the invoking project, not the package dir', async () => {
    const body = await (await fetch(`${BASE_URL}/api/status`)).json()
    expect(body).not.toBeNull()
    // Before the fix this was 'file-watcher' with _hint: 'no-hooks' — the hook file was
    // dropped because its _cwd did not match the package dir the server runs in.
    expect(body.source).toBe('claude-cli')
    expect(body._hint).toBeUndefined()
    expect(body.agents.map(a => a.role)).toContain('ops')
  })

  it('reads back its own POSTed status (write and read roots agree)', async () => {
    const res = await fetch(`${BASE_URL}/api/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dev: 'blocked', workflow: 'e2e-201' }),
    })
    expect(res.status).toBe(200)

    const body = await (await fetch(`${BASE_URL}/api/status`)).json()
    expect(body).not.toBeNull()
    // The POST handler stamps _cwd itself. If it stamped process.cwd() while the reader
    // matched OFFICE_PROJECT_ROOT, this payload would be filtered out as foreign.
    // Multi-session merge prefixes roles with the session slug (`main~dev`).
    const baseRole = r => r.slice(r.lastIndexOf('~') + 1)
    expect(body.agents.some(a => baseRole(a.role) === 'dev' && a.status === 'blocked')).toBe(true)
  })

  it('counts the hook session in /api/health stats (getSessionStats root)', async () => {
    const body = await (await fetch(`${BASE_URL}/api/health`)).json()
    expect(body.ok).toBe(true)
    // 0 before the fix — getSessionStats matched against the package dir too.
    expect(body.hookSessionCount).toBeGreaterThan(0)
  })
})
