#!/usr/bin/env node
// Visual verification for the panel-approved wave (AVO-165/167/169).
//
// Runs against a throwaway Vite dev server because the fixture stages app internals through
// browser-side module imports. The browser route stubs below intentionally freeze /api/status
// and SSE: this verifier owns its fixture state, and live local status files must not race or
// mask the visual assertions.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = process.env.PANEL_SHOT_DIR
  ? path.resolve(process.env.PANEL_SHOT_DIR)
  : path.join(ROOT, '.pet-shots')
const READY_TIMEOUT_MS = 20_000
const POLL_INTERVAL_MS = 250

mkdirSync(OUT, { recursive: true })

async function pickPort() {
  if (process.env.PANEL_PORT) return parseInt(process.env.PANEL_PORT, 10)
  return await new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

async function waitForServer(url, deadlineMs) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {}
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
  return false
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true })
  } catch {
    const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    if (existsSync(systemChrome)) {
      return await chromium.launch({ headless: true, executablePath: systemChrome })
    }
    throw new Error('No Chromium available. Run: npx playwright install --with-deps chromium')
  }
}

const PORT = await pickPort()
const BASE_URL = `http://127.0.0.1:${PORT}`
const URL = `${BASE_URL}/?lang=en&smoke=panel`
const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
if (!existsSync(viteBin)) {
  console.error('ERROR: Vite binary not found. Run `npm ci` first.')
  process.exit(1)
}
const serverProc = spawn(
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' }
)

let serverStdout = ''
let serverStderr = ''
serverProc.stdout.on('data', d => { serverStdout += d.toString() })
serverProc.stderr.on('data', d => { serverStderr += d.toString() })

let browser = null
let page = null
let result = null
let pass = false

async function stopServerProcessTree() {
  if (!serverProc.pid) return
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
  try { await page?.close() } catch {}
  try { await browser?.close() } catch {}
  await stopServerProcessTree()
}

try {
  const ready = await waitForServer(BASE_URL, READY_TIMEOUT_MS)
  if (!ready) {
    throw new Error(
      `server did not become ready on ${BASE_URL}; stdout=${serverStdout.slice(-500)} stderr=${serverStderr.slice(-500)}`
    )
  }

  browser = await launchBrowser()
  page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })

  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  await page.route('**/api/status**', route => route.fulfill({
    status: route.request().url().includes('/api/status/stream') ? 204 : 200,
    contentType: route.request().url().includes('/api/status/stream') ? 'text/plain' : 'application/json',
    body: route.request().url().includes('/api/status/stream')
      ? ''
      : JSON.stringify({ ok: true, agents: [], sessions: [], workflow: null }),
  }))
  await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1') } catch {} })
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('svg', { timeout: 20_000 })
  await page.waitForTimeout(500)

  const bodyText = await page.evaluate(() => document.body.innerText || '')
  const errorBoundary = /Something went wrong/i.test(bodyText)

  async function stageOffice(selectedAgent = null) {
    await page.evaluate(async (selected) => {
      const store = (await import('/src/systems/store.js')).useOfficeStore
      const mv = await import('/src/systems/movementSystem.js')
      const HOME = mv.HOME_POSITIONS
      const s = store.getState()
      const now = Date.now()
      const agents = { ...s.agents }
      for (const id of Object.keys(agents)) {
        const h = HOME[id] || agents[id].position
        agents[id] = { ...agents[id], position: { ...h }, targetPosition: { ...h }, isMoving: false,
          inGroupEvent: false, journeyTarget: null, bubble: null,
          status: id === 'dev' ? 'awaiting-approval' : id === 'qa' ? 'blocked' : agents[id].status }
      }
      store.setState({
        agents,
        externalStatus: {
          dev: { status: 'awaiting-approval', task: 'Review', label: 'Waiting for approval', changedAt: now - 120000 },
          qa:  { status: 'blocked', task: 'Test run', reasonCode: 'test-run-failed', label: 'npm test failed', changedAt: now - 120000 },
        },
        selectedAgent: selected,
        isPaused: true,
        activeEvent: null,
        activeWorkflow: null,
        reducedMotion: true,
        handoffs: [],
        helpers: [],
      })
    }, selectedAgent)
    await page.waitForTimeout(150)
  }

  await stageOffice()

  const cyanProbe = await page.evaluate(() => {
    const group = document.querySelector('svg g[data-agent-id="dev"][data-agent-status="awaiting-approval"]')
    let cyanStroke = 0
    let cyanFill = 0
    if (group) {
      for (const el of group.querySelectorAll('*')) {
        const st = (el.getAttribute('stroke') || '').toLowerCase()
        const fl = (el.getAttribute('fill') || '').toLowerCase()
        if (st === '#1e9fd4') cyanStroke++
        if (fl === '#1e9fd4') cyanFill++
      }
    }
    return { scopedToDev: !!group, cyanStroke, cyanFill }
  })

  await page.evaluate(() => { const svg = document.querySelector('svg'); if (svg) svg.setAttribute('viewBox', '0 0 800 560') })
  await page.waitForTimeout(150)
  await (await page.$('svg')).screenshot({ path: path.join(OUT, 'avo167-office-await-vs-blocked.png') })

  await stageOffice('qa')
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('svg text')).some((t) => /Blocked · \d/.test(t.textContent || '')),
    { timeout: 5000 })
  const inspBlocked = await page.evaluate(() =>
    Array.from(document.querySelectorAll('svg text')).map(t => t.textContent).filter(t => t && /·|\d+[smh]\b/.test(t)))
  await (await page.$('svg')).screenshot({ path: path.join(OUT, 'avo169-inspector-blocked-duration.png') })

  await stageOffice('dev')
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('svg text')).some((t) => /Awaiting approval · \d/.test(t.textContent || '')),
    { timeout: 5000 })
  const inspAwait = await page.evaluate(() =>
    Array.from(document.querySelectorAll('svg text')).map(t => t.textContent).filter(t => t && (/·|\d+[smh]\b/.test(t) || /await/i.test(t))))
  await (await page.$('svg')).screenshot({ path: path.join(OUT, 'avo167-169-inspector-await-duration.png') })

  await stageOffice(null)
  await page.evaluate(async () => {
    const store = (await import('/src/systems/store.js')).useOfficeStore
    window.__avoDevPos = store.getState().agents.dev?.position
  })
  await page.evaluate(() => {
    const svg = document.querySelector('svg'); const p = window.__avoDevPos
    if (svg && p) svg.setAttribute('viewBox', `${Math.round(p.x - 70)} ${Math.round(p.y - 95)} 140 145`)
  })
  await page.waitForTimeout(200)
  await (await page.$('svg')).screenshot({ path: path.join(OUT, 'avo167-await-ring-closeup.png') })

  result = { baseUrl: BASE_URL, shotDir: OUT, errors, errorBoundary, cyanProbe, inspBlocked, inspAwait }
  pass = errors.length === 0 && !errorBoundary && cyanProbe.scopedToDev
    && cyanProbe.cyanStroke > 0 && cyanProbe.cyanFill > 0
    && inspBlocked.some(t => /Blocked · \d/.test(t)) && inspAwait.some(t => /Awaiting approval · \d/.test(t))
} catch (err) {
  result = { ...(result || {}), error: err.message, stack: err.stack?.split('\n').slice(0, 8) }
} finally {
  await cleanup()
}

console.log(JSON.stringify(result, null, 2))
console.log(pass ? 'PASS: 0 errors, scoped cyan ring+pill rendered, inspector durations show' : 'FAIL: panel visual assertions did not pass')
process.exit(pass ? 0 : 1)
