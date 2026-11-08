// Phase-1 Pixel appearance live verification (spec: docs/specs/phased-pixel-character-refresh.md).
//
// Spawns its own dev server against an EMPTY status dir (OFFICE_STATUS_DIR, see staged-capture.mjs
// for why), stages a busy office, then drives the REAL footer control and asserts on the RENDER:
//   - same-state Classic vs Pixel captures (full scene + enlarged desk crops)
//   - world positions / door claims / statuses unchanged across toggles; actor <g> nodes not remounted
//   - status written as a real hook status FILE reaches the render while in Pixel
//   - click + keyboard (Enter) on an actor still work in Pixel
//   - reduced motion: no walk-bob class in Pixel
//   - required-asset failure (gate.png aborted) keeps the complete Classic pack + error cue
// Exits non-zero on any failed assertion. Captures go to --out (default .pet-shots/pixel-phase1).
import { chromium } from 'playwright-core'
import { spawn } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : fallback }
const PORT = Number(arg('--port', '5198'))
const OUT = arg('--out', '.pet-shots/pixel-phase1')
const LANG = arg('--lang', 'en')
mkdirSync(OUT, { recursive: true })

const STAGED = [
  { agentId: 'pm', status: 'planning', task: '/plan', label: '🧠 planning' },
  { agentId: 'arch', status: 'working', task: 'Write', label: '📐 design' },
  { agentId: 'dev', status: 'working', task: 'Edit', label: '✏️ Edit store.js' },
  { agentId: 'qa', status: 'working', task: 'Bash', label: '🔍 vitest' },
  { agentId: 'ops', status: 'blocked', task: 'Bash', label: '❌ build failed', reasonCode: 'build-failed' },
  { agentId: 'res', status: 'done', task: 'Read', label: '✅ done' },
  { agentId: 'designer', status: 'working', task: 'Edit', label: '🎨 tokens' },
  { agentId: 'gate', status: 'idle', task: null, label: null },
]

const statusDir = mkdtempSync(path.join(tmpdir(), 'avo-pixel-status-'))
let server = null
let browser = null
const results = []
const cleanup = () => {
  try { if (browser) browser.close() } catch {}
  try { if (server) server.kill() } catch {}
  try { rmSync(statusDir, { recursive: true, force: true }) } catch {}
}
process.on('exit', cleanup)
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + JSON.stringify(detail) : ''}`) }

server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  env: { ...process.env, OFFICE_STATUS_DIR: statusDir, OFFICE_DISABLE_FILE_WATCHER: '1' }, stdio: 'ignore',
})
const base = `http://localhost:${PORT}`
for (let up = false, end = Date.now() + 40000; !up;) {
  if (Date.now() > end) { console.error('dev server did not start'); process.exit(1) }
  try { up = (await fetch(base + '/')).ok } catch { await new Promise(r => setTimeout(r, 400)) }
}

browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }))

async function openPage({ failAsset = null, reducedMotion = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 920 }, deviceScaleFactor: 2, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
  if (failAsset) await page.route(`**/assets/characters/pixel-v1/${failAsset}`, r => r.abort())
  await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1'); localStorage.removeItem('avo.office-appearance') } catch {} })
  await page.goto(`${base}/?lang=${LANG}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-agent-id]', { timeout: 20000 })
  await page.waitForTimeout(600)
  return { page, ctx, errors }
}

async function stage(page) {
  await page.evaluate(async (updates) => {
    const store = (await import('/src/systems/store.js')).useOfficeStore
    const mv = await import('/src/systems/movementSystem.js')
    store.getState().applyExternalStatus(updates, { source: 'external', statusSource: 'external' })
    const s = store.getState()
    const agents = { ...s.agents }
    for (const id of Object.keys(agents)) {
      const h = mv.HOME_POSITIONS[id] || agents[id].position
      agents[id] = { ...agents[id], position: { ...h }, targetPosition: { ...h }, isMoving: false }
    }
    store.setState({ agents, isPaused: true, activeEvent: null })
  }, STAGED)
  await page.waitForTimeout(700)
}

// World truth: rendered actor transforms + store positions/claims/statuses.
async function snapshot(page) {
  return page.evaluate(async () => {
    const store = (await import('/src/systems/store.js')).useOfficeStore.getState()
    const actors = {}
    for (const n of document.querySelectorAll('[data-agent-id]')) {
      actors[n.getAttribute('data-agent-id')] = { transform: n.getAttribute('transform'), status: n.getAttribute('data-agent-status') }
    }
    const pos = {}
    for (const [id, a] of Object.entries(store.agents)) pos[id] = { p: a.position, t: a.targetPosition, f: a.facing, m: !!a.isMoving }
    return { actors, pos, doorClaims: JSON.stringify(store.doorTraffic ?? null), bodies: document.querySelectorAll('[data-body="pixel"]').length }
  })
}

async function tagNodes(page) {
  await page.evaluate(() => { window.__avoActorNodes = new Map([...document.querySelectorAll('[data-agent-id]')].map(n => [n.getAttribute('data-agent-id'), n])) })
}
async function sameNodes(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-agent-id]')].every(n => window.__avoActorNodes?.get(n.getAttribute('data-agent-id')) === n))
}
async function clickAppearance(page, value) {
  await page.click(`[data-appearance-option="${value}"]`)
}
async function waitActive(page, value, ms = 5000) {
  return page.waitForFunction((v) => document.querySelector(`[data-appearance-option="${v}"]`)?.getAttribute('aria-pressed') === 'true', value, { timeout: ms }).then(() => true, () => false)
}
async function shoot(page, name) {
  const svg = await page.$('svg')
  await page.evaluate(() => { const s = document.querySelector('svg'); s.dataset.vb = s.getAttribute('viewBox'); s.setAttribute('viewBox', '0 0 800 560') })
  await page.waitForTimeout(250)
  await svg.screenshot({ path: path.join(OUT, `${name}-scene.png`) })
  // Enlarged desk crops for feet / chair fit review: aspect-matched to the svg box, footer hidden.
  const crops = { 'desks-top': [100, 205, 470], 'desks-bottom': [100, 300, 470], lobby: [40, 30, 200] }
  await page.evaluate(() => { for (const n of document.querySelectorAll('.fixed.bottom-0')) n.style.visibility = 'hidden' })
  for (const [label, [x, y, w]] of Object.entries(crops)) {
    await page.evaluate(([x, y, w]) => {
      const s = document.querySelector('svg'); const r = s.getBoundingClientRect()
      s.setAttribute('viewBox', `${x} ${y} ${w} ${(w * r.height / r.width).toFixed(1)}`)
    }, [x, y, w])
    await page.waitForTimeout(250)
    await svg.screenshot({ path: path.join(OUT, `${name}-${label}.png`) })
  }
  await page.evaluate(() => { for (const n of document.querySelectorAll('.fixed.bottom-0')) n.style.visibility = ''; const s = document.querySelector('svg'); s.setAttribute('viewBox', s.dataset.vb) })
}

// ── 1. same-state Classic vs Pixel + world invariants ───────────────────────────────────────────
{
  const { page, ctx, errors } = await openPage()
  await stage(page)
  await tagNodes(page)
  const before = await snapshot(page)
  check('staged statuses reached the render', STAGED.every(u => before.actors[u.agentId]?.status === u.status), before.actors)
  await shoot(page, 'classic')
  await clickAppearance(page, 'pixel')
  check('Pixel becomes active after full preload', await waitActive(page, 'pixel'))
  await page.waitForTimeout(500)
  const pix = await snapshot(page)
  check('Pixel renders 8 raster bodies', pix.bodies === 8, { bodies: pix.bodies })
  check('no classic procedural body remains under Pixel', await page.evaluate(() => [...document.querySelectorAll('[data-agent-id]')].every(n => n.querySelector('[data-body="pixel"]') && !n.querySelector('[data-idle-wave]'))))
  check('actor transforms unchanged by toggle', JSON.stringify(pix.actors) === JSON.stringify(before.actors))
  check('store positions/targets/facing unchanged by toggle', JSON.stringify(pix.pos) === JSON.stringify(before.pos))
  check('door claims unchanged by toggle', pix.doorClaims === before.doorClaims)
  check('actor nodes not remounted by toggle', await sameNodes(page))
  await shoot(page, 'pixel')
  // pixel images actually decoded in the page
  const imgs = await page.evaluate(() => Promise.all([...document.querySelectorAll('[data-body="pixel"] image')].map(i => i.getBBox()).map(b => b.width)))
  check('every Pixel image has layout size 56 (local units, 7/8 scale)', imgs.length === 8 && imgs.every(w => w === 56), imgs)
  // toggle back and forth again (second swap must be instant, no reload)
  await clickAppearance(page, 'classic'); check('back to Classic', await waitActive(page, 'classic'))
  await clickAppearance(page, 'pixel'); check('Pixel again (cached pack)', await waitActive(page, 'pixel', 1000))
  const again = await snapshot(page)
  check('positions still unchanged after 3 toggles', JSON.stringify(again.pos) === JSON.stringify(before.pos) && JSON.stringify(again.actors) === JSON.stringify(before.actors))
  check('actor nodes still not remounted', await sameNodes(page))

  // ── 2. input in Pixel: click opens inspector, Enter works ──
  const devBox = await page.$('[data-agent-id="dev"] [data-body-hit="1"]')
  const hitBox = await devBox.boundingBox()
  await page.mouse.click(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2)
  await page.waitForTimeout(500)
  const selectedByClick = await page.evaluate(async () => (await import('/src/systems/store.js')).useOfficeStore.getState().selectedAgent)
  check('mouse click on a Pixel body selects the agent', selectedByClick === 'dev', { selectedByClick })
  await page.keyboard.press('Escape')
  await page.evaluate(async () => (await import('/src/systems/store.js')).useOfficeStore.setState({ selectedAgent: null }))
  await page.focus('[data-agent-id="arch"]')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  const selectedByKey = await page.evaluate(async () => (await import('/src/systems/store.js')).useOfficeStore.getState().selectedAgent)
  check('keyboard Enter on a focused Pixel actor selects it', selectedByKey === 'arch', { selectedByKey })
  await page.evaluate(async () => (await import('/src/systems/store.js')).useOfficeStore.setState({ selectedAgent: null }))
  await page.keyboard.press('Escape')

  // ── 3. real hook status FILE reaches the render while in Pixel ──
  await page.evaluate(async () => (await import('/src/systems/store.js')).useOfficeStore.setState({ isPaused: false }))
  writeFileSync(path.join(statusDir, 'office-status-pixel-verify.json'), JSON.stringify({
    _seq: String(Date.now()), _cwd: process.cwd(), type: 'office-status',
    agents: [{ role: 'gate', task: 'Bash', status: 'working', label: '🛡 pixel verify', hint: null }],
    activeCount: 1, workflow: null, source: 'claude-cli',
  }))
  const fileReached = await page.waitForFunction(() => document.querySelector('[data-agent-id="gate"]')?.getAttribute('data-agent-status') === 'working', null, { timeout: 15000 }).then(() => true, () => false)
  check('hook status file reaches the Pixel render (gate idle→working)', fileReached)
  check('gate still renders its Pixel master after the live update', await page.evaluate(() => document.querySelector('[data-agent-id="gate"] [data-body="pixel"]')?.getAttribute('data-pixel-role') === 'gate'))
  await page.evaluate(async () => (await import('/src/systems/store.js')).useOfficeStore.setState({ isPaused: true }))
  await shoot(page, 'pixel-live-status')
  check('no console errors (main page)', errors.length === 0, errors.slice(0, 3))
  await ctx.close()
}

// ── 4. reduced motion: walking actor gets no bob ────────────────────────────────────────────────
{
  const { page, ctx } = await openPage({ reducedMotion: true })
  await clickAppearance(page, 'pixel'); await waitActive(page, 'pixel')
  await page.waitForTimeout(2500)
  const bobs = await page.evaluate(() => document.querySelectorAll('.avo-pixel-walk-bob').length)
  check('reduced motion: zero walk-bob nodes', bobs === 0, { bobs })
  await ctx.close()
}

// ── 5. required asset failure keeps the complete Classic pack ───────────────────────────────────
{
  const { page, ctx } = await openPage({ failAsset: 'gate.png' })
  await clickAppearance(page, 'pixel')
  await page.waitForFunction(() => document.querySelector('[data-appearance-status]')?.getAttribute('data-appearance-status') === 'error', null, { timeout: 8000 }).catch(() => {})
  const st = await page.evaluate(() => ({
    status: document.querySelector('[data-appearance-status]')?.getAttribute('data-appearance-status'),
    pixelBodies: document.querySelectorAll('[data-body="pixel"]').length,
    classicPressed: document.querySelector('[data-appearance-option="classic"]')?.getAttribute('aria-pressed'),
  }))
  check('asset failure → error cue, 0 Pixel bodies, Classic still pressed', st.status === 'error' && st.pixelBodies === 0 && st.classicPressed === 'true', st)
  await (await page.$('[data-appearance-status]')).screenshot({ path: path.join(OUT, 'switch-error.png') })
  await ctx.close()
}

const failed = results.filter(r => !r.ok)
writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ when: new Date().toISOString(), results }, null, 2))
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
cleanup()
process.exit(failed.length ? 1 : 0)
