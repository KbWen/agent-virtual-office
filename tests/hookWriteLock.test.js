/**
 * hookWriteLock.test.js — AC-1..AC-4 verification for the STATUS_FILE write-lock.
 *
 * AC-4 (load-bearing): multi-process mutual exclusion proof.
 * AC-3: stale-lock steal.
 * AC-2: bounded wait / proceed-unlocked fallback.
 * Also verifies: no throw on lock error, release is idempotent.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

// Import the hook module (CJS loaded via dynamic import so ESM vitest can use it)
const hook = await import('../public/hooks/office-status-hook.js')
const { acquireStatusLock, releaseStatusLock, STATUS_LOCK_CONFIG, atomicWriteJson } = hook

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

// ─── 2026-09-26 audit finding 1: token-gated release ────────────────────────
// Corrects the false Risks claim in docs/specs/hook-status-write-lock.md ("mkdir atomicity
// means exactly one wins the retake") — that guarantee only covers a FRESH lock race, not the
// two-syscall (rmdir-then-mkdir) steal sequence. releaseStatusLock is now token-gated so a
// process can never remove a lock it does not currently own, even if its own staleMs window
// expired and someone else legitimately stole the lock out from under it.

describe('acquireStatusLock / releaseStatusLock — token-gated release (finding 1)', () => {
  let restore
  let base

  beforeEach(() => {
    base = makeTempBase('token')
    restore = withLockBase(base)
  })

  afterEach(() => {
    restore()
    try { fs.rmSync(path.dirname(base), { recursive: true, force: true }) } catch {}
  })

  it('acquire returns a token alongside ok:true', () => {
    const lock = acquireStatusLock()
    expect(lock.ok).toBe(true)
    expect(typeof lock.token).toBe('string')
    expect(lock.token.length).toBeGreaterThan(0)
    releaseStatusLock(lock.token)
  })

  it('release with the correct token removes the lock', () => {
    const lock = acquireStatusLock()
    releaseStatusLock(lock.token)
    expect(fs.existsSync(STATUS_LOCK_CONFIG.lockDir)).toBe(false)
  })

  it('release with a WRONG token does NOT remove a lock currently owned by someone else', () => {
    const lock = acquireStatusLock()
    expect(lock.ok).toBe(true)
    // Simulate: another process now legitimately owns this lock dir under a different token
    // (e.g. it stole our lock after we were descheduled past staleMs). Our stale release call
    // must be a no-op — it must NOT delete a lock it no longer owns.
    releaseStatusLock('not-our-token-' + Math.random())
    expect(fs.existsSync(STATUS_LOCK_CONFIG.lockDir)).toBe(true)
    // Cleanup with the real token so the test doesn't leak a lock dir.
    releaseStatusLock(lock.token)
    expect(fs.existsSync(STATUS_LOCK_CONFIG.lockDir)).toBe(false)
  })

  it('release with no token (legacy zero-arg form) still removes the lock unconditionally', () => {
    const lock = acquireStatusLock()
    releaseStatusLock()
    expect(fs.existsSync(STATUS_LOCK_CONFIG.lockDir)).toBe(false)
  })

  it('steal is atomic: an evicted stale lock cannot be un-stolen by a stat/rmdir race', () => {
    // Simulate a crashed holder: a stale lock dir with no owner token (legacy/pre-fix shape).
    fs.mkdirSync(STATUS_LOCK_CONFIG.lockDir, { recursive: true })
    const past = new Date(Date.now() - 3_000)
    fs.utimesSync(STATUS_LOCK_CONFIG.lockDir, past, past)

    const lock = acquireStatusLock()
    expect(lock.ok).toBe(true)
    // The new owner's token must now be the one on disk.
    const ownerFile = path.join(STATUS_LOCK_CONFIG.lockDir, 'owner')
    expect(fs.readFileSync(ownerFile, 'utf-8')).toBe(lock.token)
    releaseStatusLock(lock.token)
  })

  it('two sequential stale-steal attempts never leave two owner tokens disagreeing', () => {
    // First holder acquires, then goes stale (simulated by backdating mtime) without releasing
    // (crash). A second acquirer steals it; its token must be the sole token on disk, and
    // releasing with the FIRST holder's (now-stolen) token must not touch the second holder's lock.
    const first = acquireStatusLock()
    expect(first.ok).toBe(true)
    const past = new Date(Date.now() - 3_000)
    fs.utimesSync(STATUS_LOCK_CONFIG.lockDir, past, past)

    const second = acquireStatusLock()
    expect(second.ok).toBe(true)
    expect(second.token).not.toBe(first.token)

    // The crashed first holder's release (stale token) must not evict the second holder's lock.
    releaseStatusLock(first.token)
    expect(fs.existsSync(STATUS_LOCK_CONFIG.lockDir)).toBe(true)

    releaseStatusLock(second.token)
    expect(fs.existsSync(STATUS_LOCK_CONFIG.lockDir)).toBe(false)
  })
})

// ─── 2026-09-26 audit finding 2: atomicWriteJson retry-before-fallback ──────

describe('atomicWriteJson — retry rename before falling back to a direct write (finding 2)', () => {
  let dir, target

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-atomic-write-'))
    target = path.join(dir, 'status.json')
  })

  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  })

  it('writes successfully on the first attempt when there is no contention', () => {
    const ok = atomicWriteJson(target, JSON.stringify({ a: 1 }))
    expect(ok).toBe(true)
    expect(JSON.parse(fs.readFileSync(target, 'utf-8'))).toEqual({ a: 1 })
  })

  it('retries renameSync before giving up, using a bounded wait', () => {
    const origRename = fs.renameSync
    let calls = 0
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation((...a) => {
      calls++
      if (calls < 3) { const e = new Error('EBUSY'); e.code = 'EBUSY'; throw e }
      return origRename(...a)
    })
    const start = Date.now()
    const ok = atomicWriteJson(target, JSON.stringify({ b: 2 }), { retries: 3, waitMs: 5 })
    const elapsed = Date.now() - start
    spy.mockRestore()
    expect(ok).toBe(true)
    expect(calls).toBe(3)  // failed twice, succeeded on the 3rd
    expect(elapsed).toBeLessThan(500)  // bounded — not an unbounded retry loop
    expect(JSON.parse(fs.readFileSync(target, 'utf-8'))).toEqual({ b: 2 })
  })

  it('falls back to a direct write only after the retry budget is exhausted', () => {
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      const e = new Error('EBUSY'); e.code = 'EBUSY'; throw e
    })
    const ok = atomicWriteJson(target, JSON.stringify({ c: 3 }), { retries: 2, waitMs: 5 })
    spy.mockRestore()
    expect(ok).toBe(true)  // the direct-write fallback still succeeds
    expect(JSON.parse(fs.readFileSync(target, 'utf-8'))).toEqual({ c: 3 })
  })

  it('never throws even when both rename and the direct write fail', () => {
    const spy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      const e = new Error('EBUSY'); e.code = 'EBUSY'; throw e
    })
    const spy2 = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('ENOSPC')
    })
    let ok
    expect(() => { ok = atomicWriteJson(target, JSON.stringify({ d: 4 }), { retries: 1, waitMs: 5 }) }).not.toThrow()
    spy2.mockRestore()
    spy.mockRestore()
    expect(ok).toBe(false)
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
    if (lock.ok) releaseStatusLock(lock.token)
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

  // 2026-09-26 audit finding 1: the interesting race is the FIRST acquire of a stale/crashed
  // lock, where many processes simultaneously discover the same stale lock dir and all attempt
  // to steal it at once. Pre-seed a stale, ownerless lock dir (simulating a crashed holder) so
  // every worker's very first acquire is a steal attempt, then run the same exact-counter
  // invariant. A double-steal bug would manifest as a lost update (final n < expected) or a
  // torn read (a worker's JSON.parse throwing on a concurrently-written file).
  it('exact counter under contention starting from a pre-seeded STALE/crashed lock (steal race)', async () => {
    const WORKERS = 8
    const CYCLES = 6

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-lock-steal-race-'))
    const counterFile = path.join(dir, 'counter.json')
    fs.writeFileSync(counterFile, JSON.stringify({ n: 0 }))

    // Pre-seed a STALE lock dir (simulates a crashed prior holder) so every worker's first
    // acquire call must go through the steal path simultaneously.
    const lockDir = counterFile + '.lock'
    fs.mkdirSync(lockDir, { recursive: true })
    const past = new Date(Date.now() - 3_000)
    fs.utimesSync(lockDir, past, past)

    const childScript = path.join(dir, 'worker-steal.cjs')
    const hookPath = path.resolve('public/hooks/office-status-hook.js').replace(/\\/g, '\\\\')
    const counterFilePath = counterFile.replace(/\\/g, '\\\\')
    const noopEvent = JSON.stringify({ hook_event_name: '__noop__' })

    fs.writeFileSync(childScript, `
'use strict'
process.env.OFFICE_STATUS_FILE = '${counterFilePath}'
const { acquireStatusLock, releaseStatusLock } = require('${hookPath}')
const fs = require('fs')
const CYCLES = ${CYCLES}
const FILE   = '${counterFilePath}'
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
    if (lock.ok) releaseStatusLock(lock.token)
  }
}
process.exitCode = 0
`)

    await new Promise((resolve, reject) => {
      let done = 0
      let failed = false
      for (let w = 0; w < WORKERS; w++) {
        const child = spawn(process.execPath, [childScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, OFFICE_STATUS_FILE: counterFile },
        })
        child.stdin.write(noopEvent)
        child.stdin.end()
        child.stderr.on('data', (d) => {
          const msg = d.toString()
          if (msg.includes('[office-hook]')) return
          if (!failed) { failed = true; reject(new Error(`Worker stderr: ${msg.slice(0, 200)}`)) }
        })
        child.on('close', (code) => {
          if (code !== 0 && !failed) { failed = true; reject(new Error(`Worker exited with code ${code}`)) }
          if (++done === WORKERS && !failed) resolve()
        })
      }
    })

    const result = JSON.parse(fs.readFileSync(counterFile, 'utf-8'))
    expect(result.n).toBe(WORKERS * CYCLES)

    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  }, 30_000)
})
