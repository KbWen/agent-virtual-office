#!/usr/bin/env node
/**
 * sim-soak.mjs — the soak gate for emergent visual bugs (AVO-157).
 *
 * Runs the office headless for N minutes and asserts WORLD INVARIANTS the unit suite
 * cannot see (they only exist across minutes of runtime): no teleports, no sustained
 * standing stacks, no frozen walkers, no one standing inside furniture. This is the
 * machine version of the owner watching the office — the bug class behind every
 * "角色又疊在一起/瞬移/凍住" report.
 *
 * SERVER CHOICE: a Vite DEV server (spawned, or reuse via SOAK_URL) — the sampler needs
 * /src module access inside the page to read store ground truth (isMoving/inGroupEvent).
 * Production-bundle render health is render-smoke's job; this gate checks RUNTIME BEHAVIOR.
 *
 * USAGE:
 *   npm run soak                       # 5-minute local soak (reuses :5173 if up)
 *   npm run soak:spawn                 # 5-minute local soak with a fresh Vite server
 *   node scripts/sim-soak.mjs --minutes 12
 *   node scripts/sim-soak.mjs --spawn --minutes 12
 *   SOAK_URL=http://localhost:5173 node scripts/sim-soak.mjs   # reuse a running server
 *   SOAK_REPORT=soak-report.json ...                            # also write a JSON report
 *
 * EXIT: 0 = all invariants held; 1 = violations (diagnostics on stderr).
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateSoak } from './soakInvariants.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const FETCH_ATTEMPT_TIMEOUT_MS = 1000
const argIdx = process.argv.indexOf('--minutes')
const MINUTES = argIdx > -1 ? Number(process.argv[argIdx + 1]) : 5
const SAMPLE_INTERVAL_MS = 250
const FORCE_SPAWN = process.env.SOAK_SPAWN === '1' || process.argv.includes('--spawn')

function failEarly(message) {
  console.error(`sim-soak ERROR: ${message}`)
  process.exit(1)
}

function parsePortEnv(name, value) {
  if (!/^\d+$/.test(value || '')) throw new Error(`${name} must be an integer port in 1..65535`)
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer port in 1..65535`)
  }
  return port
}

const PORT = (() => {
  try {
    return parsePortEnv('SOAK_PORT', process.env.SOAK_PORT || '5198')
  } catch (err) {
    failEarly(err.message)
  }
})()

if (!Number.isFinite(MINUTES) || MINUTES <= 0) {
  failEarly('--minutes must be a finite number greater than 0')
}

async function urlUp(url) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_ATTEMPT_TIMEOUT_MS)
    const ok = (await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))).ok
    return ok
  } catch {
    return false
  }
}

// ── Server: reuse SOAK_URL / a running :5173 dev server, else spawn vite ──────────────
// SOAK_SPAWN=1 / --spawn skips reuse shortcuts — lets the CI spawn path be exercised locally.
let baseUrl = FORCE_SPAWN ? null : (process.env.SOAK_URL || null)
let serverProc = null
let serverExit = null
if (!baseUrl && !FORCE_SPAWN && await urlUp('http://localhost:5173/')) baseUrl = 'http://localhost:5173'
if (!baseUrl) {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(viteBin)) {
    console.error('sim-soak ERROR: Vite binary not found. Run `npm ci` first.')
    process.exit(1)
  }
  serverProc = spawn(
    process.execPath,
    [viteBin, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' }
  )
  serverProc.stdout.on('error', () => {})
  serverProc.stderr.on('error', () => {})
  serverProc.once('close', (code, signal) => { serverExit = { code, signal } })
  baseUrl = `http://localhost:${PORT}`
  const deadline = Date.now() + 30000
  while (Date.now() < deadline && !(await urlUp(baseUrl + '/'))) {
    if (serverExit) {
      console.error(`sim-soak ERROR: vite exited before readiness (code=${serverExit.code}, signal=${serverExit.signal})`)
      process.exit(1)
    }
    await new Promise(r => setTimeout(r, 300))
  }
  if (!(await urlUp(baseUrl + '/'))) {
    console.error('sim-soak ERROR: vite dev server did not become ready')
    await cleanup()
    process.exit(1)
  }
}

let browser = null
let cleanupPromise = null
async function stopServerProcessTree() {
  if (!serverProc?.pid || serverExit) return
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill.exe', ['/pid', String(serverProc.pid), '/t', '/f'], { stdio: 'ignore' })
      killer.on('error', resolve)
      killer.on('exit', resolve)
    })
    return
  }
  try {
    process.kill(-serverProc.pid, 'SIGTERM')
    const exited = await new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 1500)
      serverProc.once('close', () => {
        clearTimeout(timer)
        resolve(true)
      })
    })
    if (!exited) process.kill(-serverProc.pid, 'SIGKILL')
  } catch {}
}
async function cleanup() {
  if (cleanupPromise) return cleanupPromise
  cleanupPromise = (async () => {
  try { await browser?.close() } catch {}
  await stopServerProcessTree()
  try { serverProc?.stdout?.destroy() } catch {}
  try { serverProc?.stderr?.destroy() } catch {}
  })()
  return cleanupPromise
}
process.once('SIGINT', () => cleanup().then(() => process.exit(130)))
process.once('SIGTERM', () => cleanup().then(() => process.exit(143)))
process.once('exit', () => {
  if (!serverProc?.pid || serverExit || process.platform === 'win32') return
  try { process.kill(-serverProc.pid, 'SIGKILL') } catch {}
})

let exitCode = 0
try {
  try {
    browser = await chromium.launch({ headless: true })
  } catch {
    const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    if (!existsSync(systemChrome)) throw new Error('No Chromium. Run: npx playwright install --with-deps chromium')
    browser = await chromium.launch({ headless: true, executablePath: systemChrome })
  }
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1') } catch {} })
  await page.goto(`${baseUrl}/?lang=en`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('svg [data-agent-id]', { timeout: 20000 })
  await page.waitForTimeout(1000)

  console.log(`sim-soak: sampling ${MINUTES} min @250ms against ${baseUrl} ...`)
  const samples = await page.evaluate(async ({ minutes }) => {
    const store = (await import('/src/systems/store.js')).useOfficeStore
    // Geometry verdicts are computed HERE (the page imports the real movementSystem via
    // Vite) — node-side import of src/*.js parses as CJS and cannot use named exports.
    const { isOnFloor, isOnObstacle } = await import('/src/systems/movementSystem.js')
    const parse = (g) => {
      const m = /translate\(([-\d.]+)[, ]+([-\d.]+)\)/.exec(g.getAttribute('transform') || '')
      return m ? { x: +m[1], y: +m[2] } : null
    }
    const out = []
    const t0 = Date.now()
    while (Date.now() - t0 < minutes * 60000) {
      const st = store.getState()
      const agents = {}
      for (const el of document.querySelectorAll('[data-agent-id]')) {
        const id = el.getAttribute('data-agent-id')
        const p = parse(el)
        const a = st.agents[id]
        if (p && a) {
          agents[id] = {
            x: p.x, y: p.y,
            moving: !!a.isMoving, group: !!a.inGroupEvent,
            offFloor: !isOnFloor(p.x, p.y) || isOnObstacle(p.x, p.y),
          }
        }
      }
      out.push({ t: Date.now() - t0, agents })
      await new Promise(r => setTimeout(r, 250))
    }
    return out
  }, { minutes: MINUTES })

  const minSamples = Math.max(1, Math.floor((MINUTES * 60000) / SAMPLE_INTERVAL_MS) - 2)
  if (samples.length < minSamples) {
    throw new Error(`insufficient samples: got ${samples.length}, expected at least ${minSamples}`)
  }

  const result = evaluateSoak(samples)
  if (process.env.SOAK_REPORT) {
    writeFileSync(process.env.SOAK_REPORT, JSON.stringify({ minutes: MINUTES, samples: samples.length, ...result }, null, 1))
  }
  for (const e of result.warnings?.groupStack || []) {
    console.log(`sim-soak WARN [groupStack, non-failing] ${JSON.stringify(e)}`)
  }
  if (result.pass) {
    console.log(`sim-soak PASS — ${samples.length} samples over ${MINUTES} min, 0 invariant violations (teleport/stack/frozen/off-floor)`)
  } else {
    exitCode = 1
    process.stderr.write(`sim-soak FAIL — ${result.total} violation(s):\n`)
    for (const [kind, list] of Object.entries(result.violations)) {
      for (const e of list) process.stderr.write(`  [${kind}] ${JSON.stringify(e)}\n`)
    }
  }
} catch (err) {
  process.stderr.write(`sim-soak ERROR: ${err.message}\n`)
  exitCode = 1
} finally {
  await cleanup()
}
process.exit(exitCode)
