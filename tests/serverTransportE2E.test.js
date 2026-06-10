/**
 * AVO-150 — Transport-spine E2E (AC-1..AC-5)
 *
 * Boots a real `node server.mjs` child process against a temp directory so
 * os.homedir() (Windows: USERPROFILE) resolves into a fresh, isolated path.
 * NEVER writes to the developer's real ~/.claude/office-status.json.
 *
 * Isolation mechanism:
 *   spawn env: { ...process.env, HOME: tempDir, USERPROFILE: tempDir }
 *   server.mjs line 68: STATUS_PATH = path.join(os.homedir(), '.claude', 'office-status.json')
 *   os.homedir() reads USERPROFILE on Windows at child-process start → resolves to tempDir.
 *
 * AC-1: real process harness (this file)
 * AC-2: field survival for every AGENT_CARRY_FIELDS member + 3 H5 reasonCode tokens
 * AC-3: shorthand POST; invalid-role dropped; invalid-status coerced to idle (#52); _seq monotonic
 * AC-4: malformed JSON → 4xx, server stays alive
 * AC-5: vitest file, runs in npm test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { AGENT_CARRY_FIELDS } from '../src/utils/statusFields.js'
import { BLOCKED_REASONS } from '../src/systems/classify.js'

// ─── helpers ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Allocate a free TCP port via OS ephemeral assignment. */
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

/** Poll GET /api/health until ok:true or deadline. */
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

// ─── test state ───────────────────────────────────────────────────────────────

let BASE_URL
let serverProc
let tempDir
let statusFilePath

// ─── lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Create an isolated temp home dir; server writes to tempDir/.claude/office-status.json
  tempDir = mkdtempSync(join(tmpdir(), 'avo-150-e2e-'))
  mkdirSync(join(tempDir, '.claude'), { recursive: true })
  statusFilePath = join(tempDir, '.claude', 'office-status.json')

  const port = await freePort()
  BASE_URL = `http://127.0.0.1:${port}`

  serverProc = spawn(
    process.execPath,
    ['server.mjs', `--port=${port}`, '--no-open'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Redirect os.homedir() into the temp dir on both Linux (HOME) and Windows (USERPROFILE).
        HOME: tempDir,
        USERPROFILE: tempDir,
        // Explicitly unset any token so auth gating is off.
        OFFICE_API_TOKEN: '',
      },
    }
  )

  // Capture stderr for diagnostics on failure.
  let stderr = ''
  serverProc.stderr.on('data', d => { stderr += d.toString() })
  serverProc.on('error', err => {
    throw new Error(`Failed to spawn server.mjs: ${err.message}`)
  })

  const ready = await waitForServer(BASE_URL, 25_000)
  if (!ready) {
    serverProc.kill('SIGKILL')
    throw new Error(
      `server.mjs did not become ready within 25s on ${BASE_URL}.\nStderr: ${stderr.slice(-800)}`
    )
  }
}, 30_000)

afterAll(() => {
  try { serverProc?.kill('SIGTERM') } catch {}
  // Temp dir cleanup: leave it to the OS to avoid race with async server shutdown.
})

// ─── helpers for assertions ───────────────────────────────────────────────────

async function postStatus(body) {
  return fetch(`${BASE_URL}/api/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function getStatus() {
  const res = await fetch(`${BASE_URL}/api/status`)
  expect(res.status).toBe(200)
  return res.json()
}

async function postEvent(body) {
  return fetch(`${BASE_URL}/api/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── AC-1 (sanity) ────────────────────────────────────────────────────────────

describe('AC-1 real-process harness', () => {
  it('GET /api/health returns ok:true', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('isolation: temp dir gains .claude/office-status.json after first POST', async () => {
    // Seed a POST so the file gets written.
    const res = await postStatus({ dev: 'working' })
    expect(res.status).toBe(200)
    // File must now exist inside the temp dir, never in the real ~/.claude.
    expect(existsSync(statusFilePath)).toBe(true)
  })
})

// ─── AC-2 field survival ──────────────────────────────────────────────────────

describe('AC-2 field survival for AGENT_CARRY_FIELDS', () => {
  // Synthetic valid values per field.
  const SYNTHETIC = {
    task:       'synthetic-task-value',
    label:      'synthetic-label-value',
    hint:       'synthetic-hint-value',
    reasonCode: 'blocked-unknown',   // valid enum; overridden for blocked-status fields
    activeFile: 'src/synthetic.js',
  }

  for (const field of AGENT_CARRY_FIELDS) {
    it(`field "${field}" survives POST → GET round-trip`, async () => {
      // reasonCode requires status=blocked to be meaningful; others can use 'working'.
      const needsBlocked = field === 'reasonCode'
      const value = SYNTHETIC[field]
      const res = await postStatus({
        type: 'office-status',
        agents: [{
          role: 'dev',
          status: needsBlocked ? 'blocked' : 'working',
          [field]: value,
        }],
      })
      expect(res.status).toBe(200)

      const merged = await getStatus()
      const devAgent = (merged?.agents ?? []).find(a => a.role === 'dev')
      expect(devAgent, `no dev agent in GET response for field=${field}`).toBeTruthy()
      expect(devAgent[field]).toBe(value)
    })
  }

  // H5 tokens — loop all three through reasonCode end-to-end.
  const H5_TOKENS = ['permission-denied', 'api-rate-limit', 'api-auth-failed']
  for (const token of H5_TOKENS) {
    it(`H5 reasonCode token "${token}" survives POST → GET end-to-end`, async () => {
      const res = await postStatus({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'blocked', reasonCode: token }],
      })
      expect(res.status).toBe(200)
      const merged = await getStatus()
      const devAgent = (merged?.agents ?? []).find(a => a.role === 'dev')
      expect(devAgent).toBeTruthy()
      expect(devAgent.reasonCode).toBe(token)
    })
  }

  it('invalid reasonCode is sanitized to null (not passed through)', async () => {
    const res = await postStatus({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'blocked', reasonCode: 'NOT_A_VALID_REASON_CODE' }],
    })
    expect(res.status).toBe(200)
    const merged = await getStatus()
    const devAgent = (merged?.agents ?? []).find(a => a.role === 'dev')
    expect(devAgent).toBeTruthy()
    expect(devAgent.reasonCode).toBeNull()
  })

  it('all BLOCKED_REASONS members are valid reasonCode values on the wire', async () => {
    // This proves the BLOCKED_REASONS enum used by the test matches the server's sanitizer.
    for (const token of BLOCKED_REASONS) {
      const res = await postStatus({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'blocked', reasonCode: token }],
      })
      expect(res.status).toBe(200)
      const merged = await getStatus()
      const devAgent = (merged?.agents ?? []).find(a => a.role === 'dev')
      expect(devAgent?.reasonCode, `token "${token}" was dropped`).toBe(token)
    }
  })
})

// ─── AC-3 behavioral spine ────────────────────────────────────────────────────

describe('AC-3 behavioral spine checks', () => {
  it('shorthand POST {dev:"working", qa:"running tests"} → GET reflects both agents', async () => {
    const res = await postStatus({ dev: 'working', qa: 'running tests' })
    expect(res.status).toBe(200)
    const merged = await getStatus()
    const agents = merged?.agents ?? []
    const dev = agents.find(a => a.role === 'dev')
    const qa  = agents.find(a => a.role === 'qa')
    expect(dev).toBeTruthy()
    expect(dev.status).toBe('working')
    expect(qa).toBeTruthy()
    // Non-status string value → task field, status coerced to 'working'
    expect(qa.status).toBe('working')
    expect(qa.task).toBe('running tests')
  })

  it('invalid role is dropped (never appears in GET response)', async () => {
    const res = await postStatus({
      type: 'office-status',
      agents: [
        { role: 'dev',          status: 'working' },
        { role: 'NOT_A_ROLE',   status: 'working' },
      ],
    })
    expect(res.status).toBe(200)
    const merged = await getStatus()
    const roles = (merged?.agents ?? []).map(a => a.role)
    expect(roles).toContain('dev')
    expect(roles).not.toContain('NOT_A_ROLE')
  })

  it('#52 — invalid status is coerced to "idle" on the real server path', async () => {
    const res = await postStatus({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'INVALID_STATUS_VALUE' }],
    })
    expect(res.status).toBe(200)
    const merged = await getStatus()
    const devAgent = (merged?.agents ?? []).find(a => a.role === 'dev')
    expect(devAgent).toBeTruthy()
    expect(devAgent.status).toBe('idle')
  })

  it('_seq strictly increases across ≥4 alternating POST /api/status + POST /api/event calls', async () => {
    const seqs = []

    // Helper: extract _seq from the GET response after each write.
    async function recordSeq() {
      const merged = await getStatus()
      const seq = merged?._seq
      expect(seq, '_seq must be present in GET response').toBeTruthy()
      seqs.push(Number(seq))
    }

    // Write 1: POST /api/status
    await postStatus({ type: 'office-status', agents: [{ role: 'dev', status: 'working' }] })
    await recordSeq()

    // Write 2: POST /api/event
    await postEvent({ event: 'test-passed' })
    await recordSeq()

    // Write 3: POST /api/status
    await postStatus({ type: 'office-status', agents: [{ role: 'qa', status: 'done' }] })
    await recordSeq()

    // Write 4: POST /api/event
    await postEvent({ event: 'build-success' })
    await recordSeq()

    // Assert monotonically increasing
    expect(seqs.length).toBeGreaterThanOrEqual(4)
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i], `_seq[${i}]=${seqs[i]} must be > _seq[${i-1}]=${seqs[i-1]}`).toBeGreaterThan(seqs[i - 1])
    }
  })
})

// ─── AC-4 failure honesty ─────────────────────────────────────────────────────

describe('AC-4 failure honesty', () => {
  it('malformed JSON body → 4xx (not 5xx), not a crash', async () => {
    const res = await fetch(`${BASE_URL}/api/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ this is not json !!!',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  it('server stays alive after malformed JSON — subsequent GET still 200', async () => {
    // Send another malformed request to be sure.
    await fetch(`${BASE_URL}/api/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '<<< garbage >>>',
    })
    // The server must still respond correctly.
    const res = await fetch(`${BASE_URL}/api/status`)
    expect(res.status).toBe(200)
  })

  it('malformed JSON to /api/event → 4xx, server stays alive', async () => {
    const res = await fetch(`${BASE_URL}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json-at-all',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)

    // Server still alive.
    const health = await fetch(`${BASE_URL}/api/health`)
    expect(health.status).toBe(200)
  })
})
