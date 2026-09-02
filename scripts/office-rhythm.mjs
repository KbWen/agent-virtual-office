#!/usr/bin/env node
/**
 * office-rhythm.mjs — measure whether the office reads ALIVE or merely BUSY.
 *
 * Samples the running office for N minutes and hands the timeline to `officeRhythm.mjs`, which
 * answers the two questions `sim-soak` structurally cannot: is motion CLUSTERED (bursts and real
 * quiet — rhythm) or SPREAD (someone always walking — churn), and is the office narrating an
 * activity an agent left minutes ago (backlog AVO-195).
 *
 * HERMETIC BY DEFAULT, via TWO independent isolations — one alone is not enough:
 *   OFFICE_STATUS_DIR=<empty temp>   the default `~/.claude` is where the operator's own live
 *                                    Claude Code hook traffic lands every few seconds.
 *   OFFICE_DISABLE_FILE_WATCHER=1    the dev server otherwise manufactures agent status from edits
 *                                    to the PROJECT ITSELF, and writes it into whatever status dir
 *                                    it was given — isolated or not.
 * The second one is not theoretical: the first real run of this tool aborted with
 * `external agent status arrived (dev, res)` because tests and docs were being edited beside it.
 * The run ASSERTS no external status arrived and WITHHOLDS the numbers if any did, because a
 * contaminated run reported as a measurement is worse than no measurement.
 *
 * USAGE
 *   node scripts/office-rhythm.mjs                    # 8-minute hermetic run
 *   node scripts/office-rhythm.mjs --minutes 3
 *   RHYTHM_REPORT=rhythm.json node scripts/office-rhythm.mjs
 *
 * READING THE OUTPUT — the caveat that cost a control run to learn: quote the stillness GAP from
 * a single run, never the stillness LEVEL. Two 8-minute runs on identical code measured 1.4% and
 * 11.8%, while the gap to independence held at -12.3 and -10.5. Any claim about the level needs a
 * paired control run on the unchanged build.
 *
 * EXIT: 0 = measured and reported; 1 = could not measure (never a verdict on the office itself —
 * this tool reports, it does not gate).
 */
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeRhythm, formatRhythm } from './officeRhythm.mjs'
import { formatTargetIdentityError, inspectAvoViteTarget } from './soakTarget.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const require = createRequire(path.join(ROOT, 'package.json'))
const argIdx = process.argv.indexOf('--minutes')
const MINUTES = argIdx > -1 ? Number(process.argv[argIdx + 1]) : 8
const SAMPLE_INTERVAL_MS = 250
const PORT = Number(process.env.RHYTHM_PORT || 5197)

if (!Number.isFinite(MINUTES) || MINUTES <= 0) {
  console.error('office-rhythm ERROR: --minutes must be a positive number')
  process.exit(1)
}

const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(viteBin)) {
  console.error('office-rhythm ERROR: Vite binary not found. Run `npm ci` first.')
  process.exit(1)
}

let statusDir = null
let serverProc = null
let browser = null
let cleanupPromise = null

async function cleanup() {
  if (cleanupPromise) return cleanupPromise
  cleanupPromise = (async () => {
    try { await browser?.close() } catch {}
    if (serverProc?.pid) {
      if (process.platform === 'win32') {
        await new Promise((resolve) => {
          const killer = spawn('taskkill.exe', ['/pid', String(serverProc.pid), '/t', '/f'], { stdio: 'ignore' })
          killer.on('error', resolve)
          killer.on('exit', resolve)
        })
      } else {
        try { process.kill(-serverProc.pid, 'SIGTERM') } catch {}
      }
    }
    // Only ever the mkdtemp directory this process created, never an operator-supplied path.
    if (statusDir) { try { rmSync(statusDir, { recursive: true, force: true }) } catch {} }
  })()
  return cleanupPromise
}
process.once('SIGINT', () => cleanup().then(() => process.exit(130)))
process.once('SIGTERM', () => cleanup().then(() => process.exit(143)))

const urlUp = async (url) => {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok } catch { return false }
}

let exitCode = 0
try {
  statusDir = mkdtempSync(path.join(os.tmpdir(), 'avo-rhythm-status-'))
  serverProc = spawn(
    process.execPath,
    [viteBin, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      // BOTH are required. OFFICE_STATUS_DIR alone leaves the dev server's file-watcher
      // fallback manufacturing agent status from edits to the project itself -- which aborted the
      // first real run of this tool with `external agent status arrived (dev, res)` while tests
      // and docs were being edited alongside it.
      env: { ...process.env, OFFICE_STATUS_DIR: statusDir, OFFICE_DISABLE_FILE_WATCHER: '1' },
    },
  )
  serverProc.stdout.on('error', () => {})
  serverProc.stderr.on('error', () => {})

  const baseUrl = `http://localhost:${PORT}`
  const deadline = Date.now() + 40000
  while (Date.now() < deadline && !(await urlUp(`${baseUrl}/`))) {
    await new Promise((r) => setTimeout(r, 300))
  }
  if (!(await urlUp(`${baseUrl}/`))) throw new Error('vite dev server did not become ready')

  const identity = await inspectAvoViteTarget(baseUrl, { timeoutMs: 5000 })
  if (identity.status !== 'match') throw new Error(formatTargetIdentityError(baseUrl, identity))

  const { chromium } = require('playwright')
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
  await page.waitForTimeout(1500)

  console.log(`office-rhythm: sampling ${MINUTES} min @${SAMPLE_INTERVAL_MS}ms against ${baseUrl} (hermetic)`)
  const out = await page.evaluate(async ({ minutes, interval }) => {
    const store = (await import('/src/systems/store.js')).useOfficeStore
    const parse = (g) => {
      const m = /translate\(([-\d.]+)[, ]+([-\d.]+)\)/.exec(g.getAttribute('transform') || '')
      return m ? { x: +m[1], y: +m[2] } : null
    }
    const samples = []
    const t0 = Date.now()
    while (Date.now() - t0 < minutes * 60000) {
      const st = store.getState()
      const agents = {}
      for (const el of document.querySelectorAll('[data-agent-id]')) {
        const id = el.getAttribute('data-agent-id')
        const p = parse(el)
        const a = st.agents[id]
        // x/y are the RENDERED position — the layer the user's eyes see. `moving` is carried for
        // completeness but the analysis never reads it; a store flag is intent, not truth.
        if (p && a) agents[id] = { x: p.x, y: p.y, moving: !!a.isMoving, group: !!a.inGroupEvent, beh: a.behavior || null, bub: a.bubble ? 1 : 0 }
      }
      samples.push({ t: Date.now() - t0, agents })
      await new Promise((r) => setTimeout(r, interval))
    }
    return { samples, externalStatusKeys: Object.keys(store.getState().externalStatus || {}) }
  }, { minutes: MINUTES, interval: SAMPLE_INTERVAL_MS })

  // Assume-failure: a contaminated run must not be reported as a measurement of the office.
  if (out.externalStatusKeys.length > 0) {
    throw new Error(
      `run was NOT hermetic — external agent status arrived during sampling (${out.externalStatusKeys.join(', ')}). `
      + 'Numbers withheld: live hook traffic drives agents into working/blocked and relocates them.',
    )
  }

  const report = analyzeRhythm(out.samples)
  console.log(formatRhythm(report))
  if (process.env.RHYTHM_REPORT) {
    writeFileSync(process.env.RHYTHM_REPORT, JSON.stringify({ minutes: MINUTES, ...report }, null, 1))
    console.log(`office-rhythm: report written to ${process.env.RHYTHM_REPORT}`)
  }
} catch (err) {
  process.stderr.write(`office-rhythm ERROR: ${err.message}\n`)
  exitCode = 1
} finally {
  await cleanup()
}
process.exit(exitCode)
