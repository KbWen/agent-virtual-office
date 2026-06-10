/**
 * hookWriteLock.test.js — AC-1..AC-4 verification for the STATUS_FILE write-lock.
 *
 * AC-4 (load-bearing): multi-process mutual exclusion proof.
 * AC-3: stale-lock steal.
 * AC-2: bounded wait / proceed-unlocked fallback.
 * Also verifies: no throw on lock error, release is idempotent.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

// Import the hook module (CJS loaded via dynamic import so ESM vitest can use it)
const hook = await import('../public/hooks/office-status-hook.js')
const { acquireStatusLock, releaseStatusLock, STATUS_LOCK_CONFIG } = hook

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Create a fresh temp directory and return a base path for STATUS_FILE.
 * Each test gets an isolated path so tests don't share locks.
 */
function makeTempBase(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `avo-lock-test-${label}-`))
  return path.join(dir, 'office-status.json')
}

/**
 * Override STATUS_LOCK_CONFIG.lockDir for the duration of one test by
 * monkey-patching the getter's dependency (OFFICE_STATUS_FILE env var).
 * Returns a cleanup function that restores the prior env value.
 */
function withLockBase(base) {
  const prior = process.env.OFFICE_STATUS_FILE
  process.env.OFFICE_STATUS_FILE = base
  return () => {
    if (prior === undefined) delete process.env.OFFICE_STATUS_FILE
    else process.env.OFFICE_STATUS_FILE = prior
  }
}

// ─── AC-1: basic acquire / release ──────────────────────────────────────────

describe('acquireStatusLock / releaseStatusLock — basic contract (AC-1)', () => {
  let restore
  let base

  beforeEach(() => {
    base = makeTempBase('basic')
    restore = withLockBase(base)
  })

  afterEach(() => {
    restore()
    // Best-effort cleanup: remove temp dir
    try { fs.rmSync(path.dirname(base), { recursive: true, force: true }) } catch {}
  })

  it('returns { ok: true } when lock dir is absent', () => {
    const lock = acquireStatusLock()
    expect(lock.ok).toBe(true)
    if (lock.ok) releaseStatusLock()
  })

  it('lock dir exists after acquire', () => {
    const lock = acquireStatusLock()
    expect(fs.existsSync(STATUS_LOCK_CONFIG.lockDir)).toBe(true)
    if (lock.ok) releaseStatusLock()
  })

  it('lock dir is removed after release', () => {
    const lock = acquireStatusLock()
    if (lock.ok) releaseStatusLock()
    expect(fs.existsSync(STATUS_LOCK_CONFIG.lockDir)).toBe(false)
  })

  it('releaseStatusLock is idempotent — double-release never throws', () => {
    const lock = acquireStatusLock()
    if (lock.ok) {
      releaseStatusLock()
      expect(() => releaseStatusLock()).not.toThrow()
    }
  })

  it('acquire never throws even when the lock dir parent does not exist', () => {
    // Point to a non-existent parent directory
    const nonExistentBase = path.join(os.tmpdir(), 'avo-nonexistent-parent-xyz', 'status.json')
    process.env.OFFICE_STATUS_FILE = nonExistentBase
    expect(() => {
      const lock = acquireStatusLock()
      if (lock.ok) releaseStatusLock()
    }).not.toThrow()
  })
})

// ─── AC-3: stale-lock steal ──────────────────────────────────────────────────

describe('acquireStatusLock — stale-lock steal (AC-3)', () => {
  let restore
  let base

  beforeEach(() => {
    base = makeTempBase('stale')
    restore = withLockBase(base)
  })

  afterEach(() => {
    restore()
    try { fs.rmSync(path.dirname(base), { recursive: true, force: true }) } catch {}
  })

  it('steals a lock dir whose mtime is older than staleMs (3 s backdated)', () => {
    const lockDir = STATUS_LOCK_CONFIG.lockDir
    // Create the lock dir manually (simulating a crashed holder)
    fs.mkdirSync(lockDir, { recursive: true })
    // Backdate mtime by 3 000 ms (well past the 2 000 ms stale threshold)
    const past = new Date(Date.now() - 3_000)
    fs.utimesSync(lockDir, past, past)
    // Our acquire should steal it and succeed
    const lock = acquireStatusLock()
    expect(lock.ok).toBe(true)
    if (lock.ok) releaseStatusLock()
  })

  it('does NOT steal a fresh lock dir (just created)', () => {
    const lockDir = STATUS_LOCK_CONFIG.lockDir
    // Create a fresh lock dir — mtime is now, well within staleMs
    fs.mkdirSync(lockDir, { recursive: true })
    // A second acquire must fail (budget exhausted quickly because another "holder" is present)
    // Speed up the test: temporarily reduce maxRetries via a separate override
    const origRetries = STATUS_LOCK_CONFIG.maxRetries
    STATUS_LOCK_CONFIG.maxRetries = 0  // 0 retries → fail immediately
    const lock2 = acquireStatusLock()
    STATUS_LOCK_CONFIG.maxRetries = origRetries
    expect(lock2.ok).toBe(false)
    // Clean up manually (no lock.ok here)
    try { fs.rmdirSync(lockDir) } catch {}
  })
})

// ─── AC-2: bounded wait — returns ok:false without throwing ─────────────────

describe('acquireStatusLock — bounded fallback (AC-2)', () => {
  let restore
  let base

  beforeEach(() => {
    base = makeTempBase('bounded')
    restore = withLockBase(base)
  })

  afterEach(() => {
    restore()
    try { fs.rmSync(path.dirname(base), { recursive: true, force: true }) } catch {}
  })

  it('returns ok:false within ~1 s when lock is held and never expires', async () => {
    const lockDir = STATUS_LOCK_CONFIG.lockDir
    // Hold a fresh lock (mtime = now → not stealable)
    fs.mkdirSync(lockDir, { recursive: true })

    const start = Date.now()
    const lock = acquireStatusLock()
    const elapsed = Date.now() - start

    expect(lock.ok).toBe(false)
    expect(elapsed).toBeLessThan(1_000)  // well within 1 s total
    // Cleanup: remove lock dir ourselves (simulating the real holder releasing it)
    try { fs.rmdirSync(lockDir) } catch {}
  })

  it('does NOT throw when acquire fails', () => {
    const lockDir = STATUS_LOCK_CONFIG.lockDir
    fs.mkdirSync(lockDir, { recursive: true })
    // Reduce retries to speed up test
    const orig = STATUS_LOCK_CONFIG.maxRetries
    STATUS_LOCK_CONFIG.maxRetries = 0
    expect(() => acquireStatusLock()).not.toThrow()
    STATUS_LOCK_CONFIG.maxRetries = orig
    try { fs.rmdirSync(lockDir) } catch {}
  })
})

// ─── AC-4: multi-process mutual-exclusion proof ──────────────────────────────
// Spawn ≥6 concurrent child processes, each doing N=15 locked read-increment-write
// cycles on a shared JSON counter file.  Final counter MUST equal exactly 6×15=90.

describe('acquireStatusLock — multi-process mutual exclusion (AC-4)', () => {
  it('produces exact counter 6×15=90 under concurrent contention (no lost updates)', async () => {
    const WORKERS = 6
    const CYCLES  = 15

    // Shared counter file
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-lock-ac4-'))
    const counterFile = path.join(dir, 'counter.json')
    fs.writeFileSync(counterFile, JSON.stringify({ n: 0 }))

    // The lock base: we set OFFICE_STATUS_FILE so STATUS_LOCK_CONFIG.lockDir
    // resolves to counterFile + '.lock'
    const lockBase = counterFile

    // Inline child script written to a temp .cjs file so we can import the hook
    // (dynamic import of CJS from -e inline string has path-resolution issues on Windows).
    const childScript = path.join(dir, 'worker.cjs')
    const hookPath = path.resolve('public/hooks/office-status-hook.js')
      .replace(/\\/g, '\\\\')   // escape backslashes for embedding in a string literal
    const counterFilePath = counterFile.replace(/\\/g, '\\\\')

    // The hook attaches process.stdin handlers at require-time.  When stdin reaches EOF
    // without valid JSON, the hook writes a benign "[office-hook] ..." message to stderr
    // and exits 0.  The lock/counter for-loop is synchronous, so it completes before the
    // event-loop drains stdin.  We pipe a no-op JSON event as stdin so the hook processes
    // it silently (falls into `default: return`) — no stderr, clean exit.
    const noopEvent = JSON.stringify({ hook_event_name: '__noop__' })

    fs.writeFileSync(childScript, `
'use strict'
process.env.OFFICE_STATUS_FILE = '${counterFilePath}'
const { acquireStatusLock, releaseStatusLock } = require('${hookPath}')
const fs = require('fs')
const CYCLES = ${CYCLES}
const FILE   = '${counterFilePath}'
// CI-flake lesson (2026-06-10, PR #89): production semantics allow acquire to give up
// after its ~250ms budget and PROCEED UNLOCKED (liveness over consistency). On a 2-core
// CI runner, 6 workers x 15 cycles exhausts that budget for some worker -> it wrote
// UNLOCKED -> torn read ("Unexpected end of JSON input") / lost update -> exact-90
// assertion failed. The property under test is "writes made WHILE HOLDING the lock
// never lose updates", so the TEST worker retries until it actually holds the lock
// (10s overall deadline); production keeps its bounded-fallback behavior untouched.
function acquireOrRetry(deadlineMs) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const lock = acquireStatusLock()
    if (lock.ok) return lock
    if (Date.now() > deadline) throw new Error('worker: lock not acquired within deadline')
  }
}
for (let i = 0; i < CYCLES; i++) {
  const lock = acquireOrRetry(10_000)
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
    data.n += 1
    fs.writeFileSync(FILE, JSON.stringify(data))
  } finally {
    if (lock.ok) releaseStatusLock()
  }
}
// signal completion via exit code 0 explicitly so nothing lingers
process.exitCode = 0
`)

    // Launch WORKERS child processes and wait for all to finish.
    // We pipe a no-op JSON event as stdin so the hook's stdin handler exits cleanly.
    await new Promise((resolve, reject) => {
      let done = 0
      let failed = false
      for (let w = 0; w < WORKERS; w++) {
        const child = spawn(process.execPath, [childScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, OFFICE_STATUS_FILE: lockBase },
        })
        // Feed a no-op hook event to suppress the hook's "Unexpected end of JSON" stderr
        child.stdin.write(noopEvent)
        child.stdin.end()

        child.stderr.on('data', (d) => {
          const msg = d.toString()
          // Filter out the known benign hook warning (stdin closed before processEvent)
          if (msg.includes('[office-hook]')) return
          if (!failed) {
            failed = true
            reject(new Error(`Worker stderr: ${msg.slice(0, 200)}`))
          }
        })
        child.on('close', (code) => {
          if (code !== 0 && !failed) {
            failed = true
            reject(new Error(`Worker exited with code ${code}`))
          }
          if (++done === WORKERS && !failed) resolve()
        })
      }
    })

    const result = JSON.parse(fs.readFileSync(counterFile, 'utf-8'))
    expect(result.n).toBe(WORKERS * CYCLES)

    // Cleanup
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  }, 30_000)  // generous timeout for slow CI / high contention
})
