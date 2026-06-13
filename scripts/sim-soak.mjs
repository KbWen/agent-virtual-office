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
 *   node scripts/sim-soak.mjs --minutes 12
 *   SOAK_URL=http://localhost:5173 node scripts/sim-soak.mjs   # reuse a running server
 *   SOAK_REPORT=soak-report.json ...                            # also write a JSON report
 *
 * EXIT: 0 = all invariants held; 1 = violations (diagnostics on stderr).
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { evaluateSoak } from './soakInvariants.mjs'

const argIdx = process.argv.indexOf('--minutes')
const MINUTES = argIdx > -1 ? Number(process.argv[argIdx + 1]) : 5
const PORT = parseInt(process.env.SOAK_PORT || '5198', 10)

async function urlUp(url) {
  try { return (await fetch(url)).ok } catch { return false }
}

// ── Server: reuse SOAK_URL / a running :5173 dev server, else spawn vite ──────────────
// SOAK_SPAWN=1 skips the reuse shortcuts — lets the CI spawn path be exercised locally.
let baseUrl = process.env.SOAK_SPAWN === '1' ? null : (process.env.SOAK_URL || null)
let serverProc = null
if (!baseUrl && process.env.SOAK_SPAWN !== '1' && await urlUp('http://localhost:5173/')) baseUrl = 'http://localhost:5173'
if (!baseUrl) {
  // shell:true is required for npx on Windows (.cmd shim); PORT is a parseInt-validated
  // module-level int (worst case NaN → harmless flag), no external string reaches the line.
  // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
  serverProc = spawn(`npx vite --port ${PORT} --strictPort`, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
  baseUrl = `http://localhost:${PORT}`
  const deadline = Date.now() + 30000
  while (Date.now() < deadline && !(await urlUp(baseUrl + '/'))) await new Promise(r => setTimeout(r, 300))
  if (!(await urlUp(baseUrl + '/'))) {
    console.error('sim-soak ERROR: vite dev server did not become ready')
    serverProc?.kill('SIGKILL')
    process.exit(1)
  }
}

let browser = null
async function cleanup() {
  try { await browser?.close() } catch {}
  try { serverProc?.kill('SIGTERM') } catch {}
}
process.on('SIGINT', () => cleanup().then(() => process.exit(130)))

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
