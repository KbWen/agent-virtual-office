#!/usr/bin/env node
/**
 * render-smoke.mjs — Headless Playwright render-smoke harness (AVO-145, H1 hardening wave)
 *
 * SERVER CHOICE: Uses `node server.mjs` (the real production artifact) rather than
 * `vite preview` because server.mjs also serves /api/* endpoints. Without them the
 * app's status-polling fetch() calls emit console errors (404s), which would cause
 * this harness to fail on benign noise. vite preview does not implement /api/*.
 *
 * USAGE:
 *   npm run build          # required first — harness asserts on dist/
 *   npm run smoke          # same as: node scripts/render-smoke.mjs
 *   SMOKE_PORT=5200 npm run smoke   # override port
 *
 * EXIT CODES:
 *   0  — all assertions passed (summary printed to stdout)
 *   1  — assertion failure or server error (diagnostics printed to stderr)
 */

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

// ── Guard: dist/ must exist ────────────────────────────────────────────────────
if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('ERROR: dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}

// ── Config ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.SMOKE_PORT || '5199', 10)
const BASE_URL = `http://127.0.0.1:${PORT}`
const READY_TIMEOUT_MS = 20_000   // server readiness poll deadline
const SVG_TIMEOUT_MS = 15_000     // AC-1: svg must appear within 15s
const POLL_INTERVAL_MS = 250
const SVG_MIN_DESCENDANTS = 100   // AC-2: render-richness floor (heuristic)
const VIEWPORTS = [
  { name: 'wide-desktop', width: 2048, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile-tall', width: 390, height: 844 },
]

// ── Spawn server ───────────────────────────────────────────────────────────────
const serverProc = spawn(
  process.execPath,
  ['server.mjs', `--port=${PORT}`, '--no-open'],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
)

let serverStdout = ''
let serverStderr = ''
serverProc.stdout.on('data', d => { serverStdout += d.toString() })
serverProc.stderr.on('data', d => { serverStderr += d.toString() })
serverProc.on('error', err => {
  console.error('ERROR: Failed to spawn server.mjs:', err.message)
  process.exit(1)
})

// ── Cleanup guard (always kill child) ─────────────────────────────────────────
let browser = null
let cleanedUp = false
async function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  try { browser?.close() } catch {}
  try {
    serverProc.kill('SIGTERM')
    // Give it 3s then force
    await new Promise(resolve => setTimeout(resolve, 3000))
    if (!serverProc.killed) serverProc.kill('SIGKILL')
  } catch {}
}
process.on('exit', () => { if (!cleanedUp) { try { serverProc.kill('SIGKILL') } catch {} } })
process.on('SIGINT',  () => cleanup().then(() => process.exit(130)))
process.on('SIGTERM', () => cleanup().then(() => process.exit(143)))

// ── Poll until server is ready ─────────────────────────────────────────────────
async function waitForServer(url, deadlineMs) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) return true
    } catch {}
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
  return false
}

// ── Main ───────────────────────────────────────────────────────────────────────
let exitCode = 0
const diagnostics = []

try {
  // 1. Wait for server to be ready
  const ready = await waitForServer(BASE_URL, READY_TIMEOUT_MS)
  if (!ready) {
    diagnostics.push(`Server did not become ready within ${READY_TIMEOUT_MS}ms on ${BASE_URL}`)
    diagnostics.push(`Server stdout: ${serverStdout.slice(-500)}`)
    diagnostics.push(`Server stderr: ${serverStderr.slice(-500)}`)
    exitCode = 1
    throw new Error('server-not-ready')
  }

  // 2. Launch browser — prefer playwright-managed Chromium, fall back to system Chrome
  //    LOCAL dev: system Chrome avoids needing `npx playwright install`
  //    CI: chromium is always installed by the workflow step
  const launchOpts = { headless: true }
  try {
    browser = await chromium.launch(launchOpts)
  } catch {
    // Fallback: system Chrome (Windows path — harmless on Linux where it won't exist)
    const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    if (existsSync(systemChrome)) {
      browser = await chromium.launch({ ...launchOpts, executablePath: systemChrome })
    } else {
      throw new Error('No Chromium available. Run: npx playwright install --with-deps chromium')
    }
  }

  const page = await browser.newPage()

  // Collect errors from the very first navigation
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', err => pageErrors.push(err.message))
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // [ErrorBoundary] console.error fires when the boundary catches — this is the
      // symptom of the PR-#71 failure class and is NOT allowlisted; it must hard-fail.
      consoleErrors.push(text)
    }
  })

  // Set onboarded flag so the app doesn't show a welcome/onboarding overlay
  await page.addInitScript(() => {
    try { localStorage.setItem('office-onboarded', '1') } catch {}
  })

  let minSvgDescendants = Infinity
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    // 3. Navigate and wait for the SVG (AC-1: 15s timeout)
    await page.goto(`${BASE_URL}/?lang=en&smoke=${viewport.name}`, { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForSelector('svg', { timeout: SVG_TIMEOUT_MS })
    } catch {
      diagnostics.push(`AC-1 FAIL [${viewport.name}]: office <svg> did not appear within ${SVG_TIMEOUT_MS}ms`)
      exitCode = 1
      continue
    }

    // Allow a brief settle for console errors/layout to flush.
    await new Promise(r => setTimeout(r, 500))

    const metrics = await page.evaluate(() => {
      const svg = document.querySelector('svg')
      const bodyText = document.body.innerText || ''
      if (!svg) return { hasSvg: false, bodyText }

      function visibleText(pattern) {
        const nodes = Array.from(svg.querySelectorAll('text'))
          .filter((node) => pattern.test(node.textContent || ''))
        return nodes.some((node) => {
          const r = node.getBoundingClientRect()
          return r.bottom >= 0 && r.top <= window.innerHeight && r.right >= 0 && r.left <= window.innerWidth
        })
      }

      const r = svg.getBoundingClientRect()
      return {
        hasSvg: true,
        bodyText,
        descendants: svg.querySelectorAll('*').length,
        svgTop: r.top,
        svgBottom: r.bottom,
        svgHeight: r.height,
        windowHeight: window.innerHeight,
        hasVisibleTopLabel: visibleText(/WELCOME|MEETING/i),
        hasVisibleBottomLabel: visibleText(/LOUNGE|RESEARCH|WC/i),
      }
    })

    // 4. AC-1: ErrorBoundary fallback NOT rendered
    if (metrics.bodyText.includes('Something went wrong')) {
      diagnostics.push(`AC-1 FAIL [${viewport.name}]: ErrorBoundary fallback is rendered`)
      exitCode = 1
    }

    // 5. AC-2: SVG descendant count >= 100
    minSvgDescendants = Math.min(minSvgDescendants, metrics.descendants || 0)
    if ((metrics.descendants || 0) < SVG_MIN_DESCENDANTS) {
      diagnostics.push(
        `AC-2 FAIL [${viewport.name}]: svg has only ${metrics.descendants || 0} descendants ` +
        `(floor: ${SVG_MIN_DESCENDANTS}) — likely a blank/minimal render`
      )
      exitCode = 1
    }

    // 6. AC-3: the SVG viewport itself must fit in the visible app window.
    // Regression guard: a width-driven SVG can render lots of descendants while the authored
    // 800x560 office is vertically cropped out of the pane.
    if (!metrics.hasSvg || metrics.svgTop < -1 || metrics.svgBottom > metrics.windowHeight + 1) {
      diagnostics.push(
        `AC-3 FAIL [${viewport.name}]: office svg viewport is clipped vertically ` +
        `(top=${metrics.svgTop}, bottom=${metrics.svgBottom}, windowHeight=${metrics.windowHeight})`
      )
      exitCode = 1
    }

    // 7. AC-4: top and bottom scene anchors are visibly inside the viewport.
    // This catches future viewBox/slice regressions even when the <svg> box itself fits.
    if (!metrics.hasVisibleTopLabel || !metrics.hasVisibleBottomLabel) {
      diagnostics.push(
        `AC-4 FAIL [${viewport.name}]: full office anchors not visible ` +
        `(topLabel=${metrics.hasVisibleTopLabel}, bottomLabel=${metrics.hasVisibleBottomLabel})`
      )
      exitCode = 1
    }
  }

  // 7. AC-1: zero pageerrors
  if (pageErrors.length > 0) {
    diagnostics.push(`AC-1 FAIL: ${pageErrors.length} pageerror(s):`)
    pageErrors.forEach(e => diagnostics.push(`  pageerror: ${e}`))
    exitCode = 1
  }

  // 8. AC-1: zero console errors
  if (consoleErrors.length > 0) {
    diagnostics.push(`AC-1 FAIL: ${consoleErrors.length} console error(s):`)
    consoleErrors.forEach(e => diagnostics.push(`  console.error: ${e}`))
    exitCode = 1
  }

  if (exitCode === 0) {
    const matrix = VIEWPORTS.map(v => `${v.name}:${v.width}x${v.height}`).join(', ')
    console.log(`render-smoke PASS — ${VIEWPORTS.length} viewports (${matrix}), min svg descendants ${minSvgDescendants}, 0 pageerrors, 0 console errors`)
  } else {
    for (const line of diagnostics) process.stderr.write(line + '\n')
    process.stderr.write('render-smoke FAIL — see diagnostics above\n')
  }

} catch (err) {
  if (err.message !== 'server-not-ready') {
    process.stderr.write(`render-smoke ERROR: ${err.message}\n`)
    if (diagnostics.length > 0) {
      for (const line of diagnostics) process.stderr.write(line + '\n')
    }
  } else {
    for (const line of diagnostics) process.stderr.write(line + '\n')
    process.stderr.write('render-smoke FAIL — server did not start\n')
  }
  exitCode = 1
} finally {
  await cleanup()
}

process.exit(exitCode)
