// Visual verification for the panel-approved wave (AVO-165/167/169) — LOAD THE PAGE (green tests ≠
// renders; preview_screenshot hangs in this repo, so we use headless Playwright against the dev server).
// Stages dev=awaiting-approval (new cyan ring) next to qa=blocked (red ring), with changedAt 2min ago
// so the inspector shows the elapsed-time line. Asserts 0 console errors + no ErrorBoundary, probes
// that the new cyan actually renders, and shots the office + both inspector states + a ring close-up.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'fs'

const URL = 'http://localhost:5173/?lang=en'
const OUT = 'C:/Users/wen/.gemini/antigravity/scratch/agent-virtual-office/.pet-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }))
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1') } catch {} })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('svg', { timeout: 20000 })
await page.waitForTimeout(900)

const bodyText = await page.evaluate(() => document.body.innerText || '')
const errorBoundary = /Something went wrong/i.test(bodyText)

async function stageOffice(selectedAgent = null) {
  // Restage immediately before every probe. The real app's status integration can poll after page
  // load and legitimately overwrite store state; a visual verifier must control its own fixture.
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

// Probe: did the new awaiting-approval cyan actually render (ring stroke + name-pill fill)?
const cyanProbe = await page.evaluate(() => {
  let stroke = 0, fill = 0
  for (const el of document.querySelectorAll('svg *')) {
    const st = (el.getAttribute('stroke') || '').toLowerCase()
    const fl = (el.getAttribute('fill') || '').toLowerCase()
    if (st === '#1e9fd4') stroke++
    if (fl === '#1e9fd4') fill++
  }
  return { cyanStroke: stroke, cyanFill: fill }
})

await page.evaluate(() => { const svg = document.querySelector('svg'); if (svg) svg.setAttribute('viewBox', '0 0 800 560') })
await page.waitForTimeout(150)
await (await page.$('svg')).screenshot({ path: `${OUT}/avo167-office-await-vs-blocked.png` })

// AVO-169: inspector on the BLOCKED agent → "Blocked · 2m"
await stageOffice('qa')
await page.waitForFunction(() =>
  Array.from(document.querySelectorAll('svg text')).some((t) => /Blocked · \d/.test(t.textContent || '')),
  { timeout: 5000 })
const inspBlocked = await page.evaluate(() =>
  Array.from(document.querySelectorAll('svg text')).map(t => t.textContent).filter(t => t && /·|\d+[smh]\b/.test(t)))
await (await page.$('svg')).screenshot({ path: `${OUT}/avo169-inspector-blocked-duration.png` })

// AVO-167+169: inspector on the AWAITING agent → "Awaiting approval · 2m" (cyan header)
await stageOffice('dev')
await page.waitForFunction(() =>
  Array.from(document.querySelectorAll('svg text')).some((t) => /Awaiting approval · \d/.test(t.textContent || '')),
  { timeout: 5000 })
const inspAwait = await page.evaluate(() =>
  Array.from(document.querySelectorAll('svg text')).map(t => t.textContent).filter(t => t && (/·|\d+[smh]\b/.test(t) || /await/i.test(t))))
await (await page.$('svg')).screenshot({ path: `${OUT}/avo167-169-inspector-await-duration.png` })

// AVO-167: close-up of the awaiting-approval cyan ring (inspector closed for a clean shot)
await stageOffice(null)
await page.evaluate(() => {
  const svg = document.querySelector('svg')
  const p = window.__avoDevPos
  if (svg) svg.setAttribute('viewBox', p ? `${p.x - 70} ${p.y - 95} 140 145` : '180 300 180 180')
})
await page.evaluate(async () => {
  const store = (await import('/src/systems/store.js')).useOfficeStore
  window.__avoDevPos = store.getState().agents.dev?.position
})
await page.evaluate(() => {
  const svg = document.querySelector('svg'); const p = window.__avoDevPos
  if (svg && p) svg.setAttribute('viewBox', `${Math.round(p.x - 70)} ${Math.round(p.y - 95)} 140 145`)
})
await page.waitForTimeout(200)
await (await page.$('svg')).screenshot({ path: `${OUT}/avo167-await-ring-closeup.png` })

await browser.close()
const result = { errors, errorBoundary, cyanProbe, inspBlocked, inspAwait }
console.log(JSON.stringify(result, null, 2))
const pass = errors.length === 0 && !errorBoundary && cyanProbe.cyanStroke > 0 && cyanProbe.cyanFill > 0
  && inspBlocked.some(t => /Blocked · \d/.test(t)) && inspAwait.some(t => /Awaiting approval · \d/.test(t))
console.log(pass ? '✅ PASS: 0 errors, cyan ring+pill rendered, inspector duration shows' : '⚠️ CHECK the JSON above')
if (!pass) process.exit(1)
