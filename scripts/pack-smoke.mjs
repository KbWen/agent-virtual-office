#!/usr/bin/env node
/**
 * pack-smoke.mjs — npm-pack install smoke harness (AVO-151)
 *
 * Packs the repo into a tarball, installs it in a fresh temp project, then
 * asserts the four contract properties of the published artifact:
 *
 *   Assertion 0: library subpath exports import from an installed tarball.
 *   Assertion 1: setup exits 0; ALL 8 hook events are registered; hook file exists.
 *   Assertion 2: setup is idempotent — a second run adds no duplicate entries.
 *   Assertion 3: the installed hook runs standalone — pipe a __noop__ event → exit 0,
 *                no non-benign stderr (mirrors hookWriteLock.test.js filter).
 *   Assertion 4: Quick-Start boot — dev mode serves HTML at / within 120s.
 *
 * Dev-mode readiness note (discovered in cli.js lines 280-375):
 *   The default launch (`node bin/cli.js`) starts Vite dev server, NOT server.mjs.
 *   Vite does NOT expose /api/health — that endpoint only exists in server.mjs (serve).
 *   Therefore: poll GET / for HTTP 200 + body containing '<div id="root"' (index.html
 *   mount point, confirmed at line 24 of index.html). Budget: 120s (first run installs
 *   dev deps via npm install if Vite can't be resolved).
 *
 * EXIT CODES:
 *   0  — all assertions passed
 *   1  — any assertion failed or unexpected error (diagnostics on stderr)
 *
 * USAGE:
 *   npm run smoke:pack          # from repo root
 *   node scripts/pack-smoke.mjs
 */

import { execSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Canonical hook event list (from cli.js line 68) ───────────────────────────
// SYNC CONTRACT: keep in lockstep with bin/cli.js's event array. A DROPPED event is
// caught (assertion fails); an ADDED 9th event would NOT be (coverage gap) — update
// this list whenever cli.js's setup registration changes.
const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'SubagentStart',
  'SubagentStop',
  'UserPromptSubmit',
  'Stop',
  'PermissionDenied',
  'StopFailure',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Print failure and exit 1. */
function fail(label, ...lines) {
  process.stderr.write(`\nFAIL [${label}]\n`)
  for (const line of lines) process.stderr.write(`  ${line}\n`)
  process.exit(1)
}

/** Find a free TCP port by asking the OS for an ephemeral port. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

/** Poll fn() every intervalMs until it returns true or deadline expires. */
async function poll(fn, deadlineMs, intervalMs = 500) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    if (await fn()) return true
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return false
}

/** Kill a process tree (Windows: taskkill /T /F; POSIX: SIGTERM then SIGKILL). */
async function killTree(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') {
    try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }) } catch {}
  } else {
    try { child.kill('SIGTERM') } catch {}
    await new Promise(r => setTimeout(r, 2000))
    try { if (child.exitCode === null) child.kill('SIGKILL') } catch {}
  }
}

// ── State ──────────────────────────────────────────────────────────────────────
let tmpDir = null
let tarballPath = null
let devChild = null

async function cleanup() {
  await killTree(devChild)
  if (tarballPath && existsSync(tarballPath)) {
    try { rmSync(tarballPath) } catch {}
  }
  if (tmpDir && existsSync(tmpDir)) {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

// Ensure cleanup on any exit path
process.on('exit', () => {
  // Synchronous best-effort kill on exit (cleanup already ran in try/finally for normal path)
  if (devChild && devChild.exitCode === null) {
    if (process.platform === 'win32') {
      try { execSync(`taskkill /pid ${devChild.pid} /T /F`, { stdio: 'ignore' }) } catch {}
    } else {
      try { devChild.kill('SIGKILL') } catch {}
    }
  }
  if (tarballPath && existsSync(tarballPath)) { try { rmSync(tarballPath) } catch {} }
  if (tmpDir && existsSync(tmpDir)) { try { rmSync(tmpDir, { recursive: true, force: true }) } catch {} }
})

// ── Main ───────────────────────────────────────────────────────────────────────

let port
try {
  port = await getFreePort()
} catch (e) {
  fail('port-probe', `Could not find a free port: ${e.message}`)
}

try {
  // ── Step 0: npm pack ─────────────────────────────────────────────────────────
  console.log('[pack-smoke] Step 0: npm pack...')
  const packDest = os.tmpdir()
  let packOutput
  try {
    packOutput = execSync(`npm pack --pack-destination "${packDest}"`, {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim()
  } catch (e) {
    fail('npm-pack', `npm pack failed: ${e.message}`, e.stderr || '')
  }
  // npm pack outputs the tarball filename (last non-empty line)
  const packLines = packOutput.split('\n').map(l => l.trim()).filter(Boolean)
  const tarballName = packLines[packLines.length - 1]
  tarballPath = path.join(packDest, tarballName)
  if (!existsSync(tarballPath)) {
    fail('npm-pack', `Tarball not found at expected path: ${tarballPath}`, `pack stdout: ${packOutput}`)
  }
  console.log(`[pack-smoke] Tarball: ${tarballPath}`)

  // ── Step 1: Create temp project, npm init + install tarball ─────────────────
  console.log('[pack-smoke] Step 1: creating temp project...')
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'avo-pack-smoke-'))
  console.log(`[pack-smoke] Temp dir: ${tmpDir}`)

  try {
    execSync('npm init -y', { cwd: tmpDir, stdio: 'pipe' })
  } catch (e) {
    fail('npm-init', `npm init -y failed: ${e.message}`)
  }

  console.log('[pack-smoke] Installing tarball (this installs all dependencies)...')
  try {
    execSync(`npm install "${tarballPath}"`, {
      cwd: tmpDir,
      stdio: 'inherit',
    })
  } catch (e) {
    fail('npm-install', `npm install <tarball> failed: ${e.message}`)
  }

  const cliPath = path.join(tmpDir, 'node_modules', 'agent-virtual-office', 'bin', 'cli.js')
  const hookSrcPath = path.join(tmpDir, 'node_modules', 'agent-virtual-office', 'public', 'hooks', 'office-status-hook.js')
  if (!existsSync(cliPath)) {
    fail('install-check', `bin/cli.js not found at: ${cliPath}`, 'Check package.json "files" whitelist includes bin/')
  }
  if (!existsSync(hookSrcPath)) {
    fail('install-check', `Hook source not found at: ${hookSrcPath}`, 'Check package.json "files" whitelist includes public/')
  }
  console.log('[pack-smoke] Install OK — cli.js and hook source present.')

  // ── Assertion 0: reusable library subpaths import from installed package ──────
  console.log('[pack-smoke] Assertion 0: library subpath imports...')
  const libraryCheckPath = path.join(tmpDir, 'library-import-check.mjs')
  writeFileSync(libraryCheckPath, `
import { VALID_STATUSES, normalizePost } from 'agent-virtual-office/status-contract'
import { normalizePost as normalizePostAlias } from 'agent-virtual-office/normalize-post'
import { agentStatus, presenceRows } from 'agent-virtual-office/agent-status-model'
import { buildAgentStatusSnapshot } from 'agent-virtual-office/agent-status-snapshot'

const norm = normalizePost({ dev: 'working' })
if (!VALID_STATUSES.includes('awaiting-approval')) throw new Error('status-contract export missing awaiting-approval')
if (norm.agents[0]?.status !== 'working') throw new Error('status-contract normalizePost failed')
if (normalizePostAlias({ qa: 'blocked' }).agents[0]?.status !== 'blocked') throw new Error('normalize-post export failed')
if (agentStatus({ status: 'idle' }, { status: 'done' }) !== 'done') throw new Error('agent-status-model export failed')
if (presenceRows({ agents: [{ id: 'dev', status: 'idle' }], externalStatus: { dev: { status: 'done' } } }).rows[0]?.status !== 'done') throw new Error('presenceRows export failed')

const snapshot = buildAgentStatusSnapshot({
  agents: { dev: { id: 'dev', status: 'idle' } },
  externalStatus: { dev: { status: 'done', task: 'Edit' } },
})
if (snapshot.agents[0]?.status !== 'done' || snapshot.presence.rows[0]?.task !== 'Edit') {
  throw new Error('agent-status-snapshot export failed')
}
console.log('library imports OK')
`)
  try {
    execSync(`node "${libraryCheckPath}"`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
  } catch (e) {
    fail('assertion-0-library-imports', `Library subpath import check failed: ${e.message}`, `stdout: ${e.stdout}`, `stderr: ${e.stderr}`)
  }
  console.log('[pack-smoke]   status-contract, normalize-post, agent-status-model, agent-status-snapshot imported.')
  console.log('[pack-smoke] Assertion 0: PASS')

  // ── Assertion 1: setup exits 0; all events registered; hook path exists ──────
  console.log('[pack-smoke] Assertion 1: running setup...')

  // Use a per-test home dir so we don't pollute the real ~/.claude/settings.json
  const fakeHome = path.join(tmpDir, 'fake-home')
  const fakeClaudeDir = path.join(fakeHome, '.claude')
  // cli.js reads os.homedir() — we override via HOME (POSIX) / USERPROFILE (Windows)
  const homeEnv = {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    // Prevent npm from reading/writing the real user config during the child runs
    npm_config_userconfig: path.join(fakeHome, '.npmrc'),
  }

  let setupOut1, setupErr1
  try {
    const result = execSync(`node "${cliPath}" setup`, {
      cwd: tmpDir,
      env: homeEnv,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    setupOut1 = result
  } catch (e) {
    fail('assertion-1-setup-exit', `setup exited non-zero: ${e.message}`, `stdout: ${e.stdout}`, `stderr: ${e.stderr}`)
  }
  console.log('[pack-smoke]   setup exited 0.')

  // Parse settings.json
  const settingsPath = path.join(fakeClaudeDir, 'settings.json')
  if (!existsSync(settingsPath)) {
    fail('assertion-1-settings', `settings.json not created at: ${settingsPath}`)
  }
  let settings
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
  } catch (e) {
    fail('assertion-1-settings-parse', `settings.json is not valid JSON: ${e.message}`)
  }

  // Verify all hook events are registered
  const missingEvents = []
  for (const event of HOOK_EVENTS) {
    const entries = settings?.hooks?.[event]
    if (!Array.isArray(entries) || entries.length === 0) {
      missingEvents.push(event)
    }
  }
  if (missingEvents.length > 0) {
    fail('assertion-1-events', `Missing hook registrations for: ${missingEvents.join(', ')}`)
  }
  console.log(`[pack-smoke]   All ${HOOK_EVENTS.length} events registered.`)

  // Verify hook command path exists on disk
  // cli.js copies hook to <home>/.claude/office-status-hook.js and registers that path
  const hookDest = path.join(fakeClaudeDir, 'office-status-hook.js')
  if (!existsSync(hookDest)) {
    fail('assertion-1-hookfile', `Hook file not found at: ${hookDest}`)
  }
  // Also verify settings.json references a path that contains 'office-status-hook'
  const sampleEvent = HOOK_EVENTS[0]
  const sampleEntries = settings.hooks[sampleEvent]
  const hookCmds = sampleEntries.flatMap(e => (e.hooks || []).map(h => h.command || ''))
  if (!hookCmds.some(cmd => cmd.includes('office-status-hook'))) {
    fail('assertion-1-hookref', `settings.json hook command does not reference office-status-hook`, `commands found: ${JSON.stringify(hookCmds)}`)
  }
  console.log('[pack-smoke]   Hook file exists on disk and referenced in settings.json.')
  console.log('[pack-smoke] Assertion 1: PASS')

  // ── Assertion 2: idempotency — second setup run adds no duplicates ────────────
  console.log('[pack-smoke] Assertion 2: running setup again (idempotency)...')
  try {
    execSync(`node "${cliPath}" setup`, {
      cwd: tmpDir,
      env: homeEnv,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
  } catch (e) {
    fail('assertion-2-setup2-exit', `Second setup exited non-zero: ${e.message}`, e.stderr || '')
  }

  let settings2
  try {
    settings2 = JSON.parse(readFileSync(settingsPath, 'utf-8'))
  } catch (e) {
    fail('assertion-2-parse', `settings.json invalid after second setup: ${e.message}`)
  }

  const dupEvents = []
  for (const event of HOOK_EVENTS) {
    const entries = settings2?.hooks?.[event] || []
    const count = entries.filter(e =>
      (e.hooks || []).some(h => h.command && h.command.includes('office-status-hook'))
    ).length
    if (count > 1) dupEvents.push(`${event} (count=${count})`)
  }
  if (dupEvents.length > 0) {
    fail('assertion-2-duplicates', `Duplicate hook entries after second setup:`, ...dupEvents)
  }
  console.log('[pack-smoke]   No duplicates. Per-event count === 1.')
  console.log('[pack-smoke] Assertion 2: PASS')

  // ── Assertion 3: standalone hook exits 0 with __noop__ event ─────────────────
  console.log('[pack-smoke] Assertion 3: standalone hook test...')
  const noopEvent = JSON.stringify({ hook_event_name: '__noop__' })

  await new Promise((resolve, reject) => {
    const hookChild = spawn(process.execPath, [hookDest], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stderrBuf = ''
    let stdoutBuf = ''
    hookChild.stdout.on('data', d => { stdoutBuf += d.toString() })
    hookChild.stderr.on('data', d => { stderrBuf += d.toString() })
    hookChild.stdin.write(noopEvent)
    hookChild.stdin.end()

    hookChild.on('error', err => reject(new Error(`spawn error: ${err.message}`)))
    hookChild.on('close', code => {
      if (code !== 0) {
        reject(new Error(`hook exited ${code}. stderr: ${stderrBuf.slice(0, 500)}`))
        return
      }
      // Filter out benign [office-hook] prefixed messages (mirrors hookWriteLock.test.js)
      const nonBenignStderr = stderrBuf.split('\n').filter(line => {
        const trimmed = line.trim()
        return trimmed.length > 0 && !trimmed.includes('[office-hook]')
      }).join('\n')
      if (nonBenignStderr.length > 0) {
        reject(new Error(`hook produced non-benign stderr:\n${nonBenignStderr.slice(0, 500)}`))
        return
      }
      resolve()
    })
  }).catch(e => fail('assertion-3-hook', e.message))

  console.log('[pack-smoke]   Hook exited 0, no non-benign stderr.')
  console.log('[pack-smoke] Assertion 3: PASS')

  // ── Assertion 4: Quick-Start boot — dev mode serves HTML at / ─────────────────
  // Dev mode readiness design:
  //   cli.js default mode spawns Vite (not server.mjs). Vite does NOT expose
  //   /api/health — only server.mjs (serve command) does. We poll GET / for
  //   HTTP 200 + '<div id="root"' (index.html mount, confirmed in index.html:24).
  //   Budget: 120s (first run may npm-install dev deps via npm install if Vite
  //   can't be resolved; in practice deps are in node_modules already so it skips).
  console.log(`[pack-smoke] Assertion 4: Quick-Start boot on port ${port}...`)
  console.log('[pack-smoke]   (polls GET / for 200+HTML; dev mode has no /api/health)')

  devChild = spawn(process.execPath, [cliPath, `--port=${port}`, '--no-open'], {
    cwd: tmpDir,
    env: {
      ...process.env,
      HOME: fakeHome,
      USERPROFILE: fakeHome,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let devStdout = ''
  let devStderr = ''
  devChild.stdout.on('data', d => { devStdout += d.toString() })
  devChild.stderr.on('data', d => { devStderr += d.toString() })
  devChild.on('error', err => {
    fail('assertion-4-spawn', `Failed to spawn dev server: ${err.message}`)
  })

  // Check if child died early
  let devExited = false
  let devExitCode = null
  devChild.on('close', code => {
    devExited = true
    devExitCode = code
  })

  const BOOT_TIMEOUT_MS = 120_000
  const ready = await poll(async () => {
    if (devExited) return false // child crashed — stop polling
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      if (res.ok) {
        const body = await res.text()
        return body.includes('<div id="root"')
      }
      return false
    } catch {
      return false
    }
  }, BOOT_TIMEOUT_MS, 1000)

  if (!ready) {
    const reason = devExited
      ? `Dev server exited prematurely with code ${devExitCode}`
      : `Dev server did not respond within ${BOOT_TIMEOUT_MS}ms`
    fail('assertion-4-boot',
      reason,
      `stdout (tail): ${devStdout.slice(-600)}`,
      `stderr (tail): ${devStderr.slice(-600)}`
    )
  }

  // GET / → 200 + HTML with app mount
  let rootBody = ''
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`)
    if (!res.ok) {
      fail('assertion-4-root', `GET / returned ${res.status} (expected 200)`)
    }
    rootBody = await res.text()
  } catch (e) {
    fail('assertion-4-root', `GET / threw: ${e.message}`)
  }

  if (!rootBody.includes('<div id="root"')) {
    fail('assertion-4-root-content',
      `GET / body does not contain '<div id="root"'`,
      `body snippet: ${rootBody.slice(0, 300)}`
    )
  }

  console.log('[pack-smoke]   Dev server responded with HTML containing app mount.')
  console.log('[pack-smoke] Assertion 4: PASS')

  console.log('\n[pack-smoke] ALL ASSERTIONS PASSED\n')

} finally {
  await cleanup()
}
