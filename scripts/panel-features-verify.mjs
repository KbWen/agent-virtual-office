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
const FETCH_ATTEMPT_TIMEOUT_MS = 1000

mkdirSync(OUT, { recursive: true })

function failEarly(message) {
  console.log(JSON.stringify({ error: message }, null, 2))
  console.log('FAIL: panel visual assertions did not pass')
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

async function pickPort() {
  if (process.env.PANEL_PORT) return parsePortEnv('PANEL_PORT', process.env.PANEL_PORT)
  return await new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => port ? resolve(port) : reject(new Error('failed to reserve a local port')))
    })
  })
}

async function waitForServer(url, deadlineMs, getServerExit) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    const serverExit = getServerExit()
    if (serverExit) {
      throw new Error(
        `vite exited before readiness (code=${serverExit.code}, signal=${serverExit.signal}); stderr=${serverStderr.slice(-500)}`
      )
    }
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_ATTEMPT_TIMEOUT_MS)
      const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
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

const PORT = await pickPort().catch(err => failEarly(err.message))
const BASE_URL = `http://127.0.0.1:${PORT}`
const PAGE_URL = `${BASE_URL}/?lang=en&smoke=panel`
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
let serverExit = null
serverProc.stdout.on('data', d => { serverStdout += d.toString() })
serverProc.stderr.on('data', d => { serverStderr += d.toString() })
serverProc.stdout.on('error', () => {})
serverProc.stderr.on('error', () => {})
serverProc.once('close', (code, signal) => { serverExit = { code, signal } })

let browser = null
let page = null
let result = null
let pass = false
let cleanupPromise = null

async function stopServerProcessTree() {
  if (!serverProc.pid || serverExit) return
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
  try { await page?.close() } catch {}
  try { await browser?.close() } catch {}
  await stopServerProcessTree()
  try { serverProc.stdout?.destroy() } catch {}
  try { serverProc.stderr?.destroy() } catch {}
  })()
  return cleanupPromise
}

async function shutdownFromSignal(code) {
  await cleanup()
  process.exit(code)
}
process.once('SIGINT', () => { shutdownFromSignal(130) })
process.once('SIGTERM', () => { shutdownFromSignal(143) })
process.once('exit', () => {
  if (!serverProc.pid || serverExit || process.platform === 'win32') return
  try { process.kill(-serverProc.pid, 'SIGKILL') } catch {}
})

try {
  const ready = await waitForServer(BASE_URL, READY_TIMEOUT_MS, () => serverExit)
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

  await page.route('**/*', route => {
    const pathname = new globalThis.URL(route.request().url()).pathname
    if (pathname === '/api/status/stream') {
      return route.fulfill({ status: 204, contentType: 'text/plain', body: '' })
    }
    if (pathname === '/api/status') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, agents: [], sessions: [], workflow: null }),
      })
    }
    return route.continue()
  })
  await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1') } catch {} })
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' })
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
    const countCyan = (selector) => {
      const group = document.querySelector(selector)
      let cyanStroke = 0
      let cyanFill = 0
      if (!group) return { scoped: false, cyanStroke, cyanFill }
      for (const el of group.querySelectorAll('*')) {
        const st = (el.getAttribute('stroke') || '').toLowerCase()
        const fl = (el.getAttribute('fill') || '').toLowerCase()
        if (st === '#1e9fd4') cyanStroke++
        if (fl === '#1e9fd4') cyanFill++
      }
      return { scoped: true, cyanStroke, cyanFill }
    }
    return {
      awaiting: countCyan('svg g[data-agent-id="dev"][data-agent-status="awaiting-approval"]'),
      blocked: countCyan('svg g[data-agent-id="qa"][data-agent-status="blocked"]'),
    }
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
  pass = errors.length === 0 && !errorBoundary
    && cyanProbe.awaiting.scoped && cyanProbe.awaiting.cyanStroke > 0 && cyanProbe.awaiting.cyanFill > 0
    && cyanProbe.blocked.scoped && cyanProbe.blocked.cyanStroke === 0 && cyanProbe.blocked.cyanFill === 0
    && inspBlocked.some(t => /Blocked · \d/.test(t)) && inspAwait.some(t => /Awaiting approval · \d/.test(t))
} catch (err) {
  result = { ...(result || {}), error: err.message, stack: err.stack?.split('\n').slice(0, 8) }
} finally {
  await cleanup()
}

console.log(JSON.stringify(result, null, 2))
console.log(pass ? 'PASS: 0 errors, scoped cyan ring+pill rendered, inspector durations show' : 'FAIL: panel visual assertions did not pass')
process.exitCode = pass ? 0 : 1
