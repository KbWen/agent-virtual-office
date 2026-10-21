#!/usr/bin/env node
// AVO-199: real scanner/SSE/poll/store/React wiring. Synthetic files live only in
// this dedicated server's scratch directory; only experienceFlags are staged.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATUS = path.join(ROOT, 'scratch/avo-199-validation/status')
const OUT = path.join(ROOT, 'scratch/avo-199-validation', process.env.CALM_MUTATION ? 'mutation-controller' : 'output/playwright')
const BASE = process.env.CALM_URL || 'http://127.0.0.1:59125'
assert.equal(new URL(BASE).hostname, '127.0.0.1', 'Verifier requires the isolated loopback dev server')
fs.mkdirSync(STATUS, { recursive: true }); fs.mkdirSync(OUT, { recursive: true })
const files = ['office-status-calm-alpha.json', 'office-status-calm-beta.json'].map(name => path.join(STATUS, name))
const records = []
function stage(status = 'idle') {
  files.forEach((file, i) => fs.writeFileSync(file, JSON.stringify({
    type: 'office-status', _cwd: ROOT, source: 'api', _seq: String(Date.now() - 5 + i),
    agents: [{ role: i ? 'qa' : 'dev', status: i ? 'idle' : status }],
  })))
}
function clearFixtures() { for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file) }
async function waitForFocusedTooltip(page, text) {
  const tooltip = page.getByRole('tooltip').filter({ hasText: text })
  const handle = await tooltip.elementHandle()
  assert(handle, `Missing focused tooltip: ${text}`)
  // The clock is intentionally controlled by this verifier; advance past the CSS fade
  // before checking computed visibility and taking a deterministic capture.
  await page.clock.fastForward(250)
  await page.waitForFunction(element => {
    if (!element?.isConnected) return false
    const style = getComputedStyle(element)
    if (style.visibility !== 'visible' || Number(style.opacity) < 0.99) return false
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const parentStyle = getComputedStyle(parent)
      const parentRect = parent.getBoundingClientRect()
      if (['hidden', 'clip', 'auto', 'scroll', 'overlay'].includes(parentStyle.overflowX)) {
        clip.left = Math.max(clip.left, parentRect.left)
        clip.right = Math.min(clip.right, parentRect.right)
      }
      if (['hidden', 'clip', 'auto', 'scroll', 'overlay'].includes(parentStyle.overflowY)) {
        clip.top = Math.max(clip.top, parentRect.top)
        clip.bottom = Math.min(clip.bottom, parentRect.bottom)
      }
    }
    return rect.left >= clip.left - 1 && rect.top >= clip.top - 1 &&
      rect.right <= clip.right + 1 && rect.bottom <= clip.bottom + 1
  }, handle, { polling: 'raf', timeout: 3000 })
  return tooltip
}

async function advanceCalmEntry(page) {
  for (let second = 0; second < 32; second++) {
    await page.clock.fastForward(1000)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
const matrix = [
  { name: 'full', width: 1280, height: 900 },
  { name: 'panel-wide', width: 800, height: 440, panel: true },
  { name: 'panel-tall', width: 420, height: 720, panel: true },
  { name: 'roster', width: 1280, height: 900, roster: true },
  { name: 'narrow', width: 375, height: 812 },
  { name: 'reduced-motion', width: 1280, height: 900, reducedMotion: 'reduce' },
  { name: 'high-contrast', width: 1280, height: 900, forcedColors: 'active' },
]
let browser
let diagnostics = []
try {
  const identity = await fetch(`${BASE}/src/systems/officeCalm.js`).then(r => r.text())
  assert(identity.includes('startOfficeCalm'), 'Expected AVO199 Vite module identity')
  try { browser = await chromium.launch({ headless: true }) }
  catch (error) {
    const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    if (!fs.existsSync(chrome)) throw error
    browser = await chromium.launch({ headless: true, executablePath: chrome })
  }
  for (const view of matrix.filter(view => !process.env.CALM_VIEW || view.name === process.env.CALM_VIEW)) {
    stage()
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height },
      reducedMotion: view.reducedMotion || 'no-preference', forcedColors: view.forcedColors || 'none' })
    const page = await context.newPage()
    if (process.env.CALM_MUTATION) page.setDefaultTimeout(3000)
    const errors = []
    diagnostics = errors
    const networkDiagnostics = []
    page.on('requestfailed', request => networkDiagnostics.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`))
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    // Test-only native graph observation. Nothing is added to the production app.
    await page.addInitScript(() => {
      localStorage.setItem('office-onboarded', '1')
      window.__calmAudioContexts = []
      const NativeAudio = window.AudioContext
      if (NativeAudio) window.AudioContext = class extends NativeAudio {
        constructor(...args) { super(...args); window.__calmAudioContexts.push(this) }
      }
    })
    await page.clock.install({ time: new Date() })
    await page.goto(`${BASE}/?lang=en${view.panel ? '&mode=panel' : ''}`, { waitUntil: 'domcontentloaded' })
    const storeHandle = await page.evaluateHandle(async () => (await import('/src/systems/store.js')).useOfficeStore)
    await page.waitForFunction(store => store.getState().observedActivity?.state === 'all-idle', storeHandle)
    const read = () => page.evaluate(async () => {
      const state = (await import('/src/systems/store.js')).useOfficeStore.getState()
      return { calm: state.officeCalm, observation: state.observedActivity, source: state.statusSource,
        health: state.integrationHealth, flags: state.experienceFlags, sound: state.soundscapeEnabled,
        external: state.externalStatus, contexts: window.__calmAudioContexts.map(ctx => ctx.state) }
    })
    assert.equal((await read()).calm.mode, 'unknown', 'disabled flag must reproduce baseline')
    const shot = name => page.screenshot({ path: path.join(OUT, `${view.name}-${name}.png`), animations: 'disabled' })
    await shot('baseline')
    await page.evaluate(async () => {
      const store = (await import('/src/systems/store.js')).useOfficeStore
      store.setState({ experienceFlags: { ...store.getState().experienceFlags, calmEnabled: true } })
    })
    if (view.roster) {
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      await page.getByRole('button', { name: 'Show list view', exact: true }).click()
    }
    const audio = view.name === 'full'
    if (audio) {
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      await page.getByRole('switch', { name: /Ambient soundscape/ }).click()
      await page.keyboard.press('Escape')
      assert.equal((await read()).contexts.length, 1, 'user gesture must create exactly one graph')
    }
    await page.waitForFunction(store => store.getState().officeCalm.mode === 'settling', storeHandle)
    const c1 = await read()
    if (c1.calm.mode !== 'settling') console.log(JSON.stringify({ view: view.name, c1, networkDiagnostics }))
    assert.equal(c1.calm.mode, 'settling')
    assert.equal(await page.getByRole('button', { name: /Connection status:.*Observed sessions idle/ }).count(), 0)
    await shot('C1-settling')
    // Advance the browser clock in bounded steps, yielding to the real API network.
    // Status and observation still come from scanAndMerge, not store injection.
    await advanceCalmEntry(page)
    assert.equal((await read()).calm.mode, 'quiet', `${view.name}: mounted controller did not enter quiet`)
    assert.equal((await read()).source, 'organic', 'empty multi-idle representatives must remain organic')
    const health = page.getByRole('button', { name: /Connection status:.*Observed sessions idle/ })
    assert.equal(await health.count(), 1)
    await health.focus()
    const englishTooltip = await waitForFocusedTooltip(page, 'Observed sessions idle')
    await shot('C2-quiet')
    if (audio) await englishTooltip.screenshot({ path: path.join(OUT, 'health-detail-en.png'), animations: 'disabled' })

    // Capture the paired disabled state at this same frozen browser timestamp, then
    // requalify through the normal 30-second predicate before the C3 interruption.
    await page.evaluate(async () => {
      const store = (await import('/src/systems/store.js')).useOfficeStore
      store.setState({ experienceFlags: { ...store.getState().experienceFlags, calmEnabled: false } })
    })
    await page.waitForFunction(store => store.getState().officeCalm.mode === 'unknown', storeHandle)
    assert.equal((await read()).observation.state, 'all-idle', 'paired baseline must keep the same source observation')
    await shot('C2-disabled-baseline')
    await page.evaluate(async () => {
      const store = (await import('/src/systems/store.js')).useOfficeStore
      store.setState({ experienceFlags: { ...store.getState().experienceFlags, calmEnabled: true } })
    })
    await page.waitForFunction(store => store.getState().officeCalm.mode === 'settling', storeHandle)
    await advanceCalmEntry(page)
    assert.equal((await read()).calm.mode, 'quiet', `${view.name}: paired baseline re-entry must complete the full predicate`)

    if (audio) {
      await page.clock.fastForward(1300)
      assert.deepEqual((await read()).contexts, ['suspended'], 'connected LFO graph must truly suspend')
      assert.equal((await read()).sound, true, 'quiet cannot change the sound preference')
      await page.keyboard.press('l')
      assert.equal(await page.getByRole('button', { name: /目前觀察到的工作階段皆閒置/ }).count(), 1)
      const chineseTooltip = await waitForFocusedTooltip(page, '目前觀察到的工作階段皆閒置')
      await shot('C2-quiet-zh-TW')
      await chineseTooltip.screenshot({ path: path.join(OUT, 'health-detail-zh-TW.png'), animations: 'disabled' })
      await page.keyboard.press('l')
    }
    stage('blocked')
    await page.waitForFunction(store => store.getState().officeCalm.mode === 'active', storeHandle)
    await page.getByRole('button', { name: /Connection status:.*Observed sessions idle/ }).waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('button', { name: /Connection status:.*Observed sessions idle/ }).count(), 0)
    if (audio) {
      await page.clock.fastForward(1500)
      assert.deepEqual((await read()).contexts, ['running'], 'new active work must restore the authorized graph')
    }
    await shot('C3-blocked')
    const emptyResponse = page.waitForResponse(async response => {
      if (new URL(response.url()).pathname !== '/api/status' || response.status() !== 200) return false
      try { const data = await response.json(); return !data?.observedActivity } catch { return false }
    })
    clearFixtures()
    // Await an actual post-unlink API snapshot, then its normal callback/debounce.
    // A transient earlier failed poll is not the authoritative source-disappearance edge.
    await page.clock.fastForward(20_000)
    await emptyResponse
    await page.clock.fastForward(200)
    await page.waitForFunction(store => {
      const state = store.getState()
      return state.observedActivity === null && state.officeCalm.mode === 'unknown'
    }, storeHandle)
    assert.equal((await read()).calm.mode, 'unknown')
    await page.getByRole('button', { name: /Connection status:.*Observed sessions idle/ }).waitFor({ state: 'hidden' })
    await shot('C4-unknown')
    await page.evaluate(async () => {
      const store = (await import('/src/systems/store.js')).useOfficeStore
      store.setState({ experienceFlags: { ...store.getState().experienceFlags, calmEnabled: false } })
    })
    assert.equal((await read()).calm.mode, 'unknown')
    assert.deepEqual(errors, [], `${view.name}: browser errors`)
    records.push({ view: view.name, states: ['baseline', 'C1', 'C2', 'C3', 'C4'], errors: errors.length, networkDiagnostics, audioLifecycle: audio ? 'native suspended -> running' : 'covered in full view' })
    await context.close()
    console.log(`browser-view PASS ${view.name}`)
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ passed: true, records }, null, 2) + '\n')
  console.log(JSON.stringify({ passed: true, views: records.length, captures: fs.readdirSync(OUT).filter(name => name.endsWith('.png')).length, browserErrors: 0, output: OUT }))
} catch (error) {
  fs.writeFileSync(path.join(OUT, 'failure.json'), JSON.stringify({ passed: false, message: error.message, stack: error.stack, diagnostics }, null, 2) + '\n')
  console.error(error.stack)
  console.error(JSON.stringify({ diagnostics }))
  process.exitCode = 1
} finally {
  await browser?.close()
  clearFixtures()
}
