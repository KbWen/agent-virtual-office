// Deterministic staged-office screenshot.
//
// WHY THIS EXISTS: the dev server reads status from `~/.claude/office-status*.json`, which is the
// operator's own live Claude Code hook traffic. Any scene staged via `applyExternalStatus` is
// overwritten within ~2s, so every prior visual judgement in this repo was taken under whatever the
// operator happened to be doing. Worse, the failure is SILENT — `clutter-audit-shot.mjs` produced a
// shot captioned "6 quiet" while claiming to stage six busy agents, and it exited 0.
//
// This script spawns its own dev server pointed at an EMPTY status directory (OFFICE_STATUS_DIR),
// so nothing competes with the staging, and then ASSERTS the staging actually held before it will
// save an image. A shot that did not stage is a failure, not a picture.
//
// Usage:
//   node scripts/staged-capture.mjs                 # default "busy" scenario
//   node scripts/staged-capture.mjs --scenario quiet
//   node scripts/staged-capture.mjs --out .pet-shots/my-shot.png
//   node scripts/staged-capture.mjs --hide-names     # A/B counterfactual: same scene, name
//                                                        # tags suppressed, status rings kept.
//                                                        # Render-only — changes no source.
import { chromium } from 'playwright-core'
import { spawn } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : fallback
}

const SCENARIO = arg('--scenario', 'busy')
const PORT = Number(arg('--port', '5199'))
const HIDE_NAMES = process.argv.includes('--hide-names')
const OUT = arg('--out', `.pet-shots/staged-${SCENARIO}${HIDE_NAMES ? '-nonames' : ''}.png`)
const LANG = arg('--lang', 'en')

// Every role in the base roster, so the "busy" case is the one the owner actually runs:
// many parallel agents, not the two that happen to be active right now.
const SCENARIOS = {
  busy: [
    { agentId: 'pm', status: 'planning', task: '/plan', label: '🧠 planning' },
    { agentId: 'arch', status: 'working', task: 'Write', label: '📐 design' },
    { agentId: 'dev', status: 'working', task: 'Edit', label: '✏️ Edit store.js' },
    { agentId: 'qa', status: 'working', task: 'Bash', label: '🔍 vitest' },
    { agentId: 'ops', status: 'blocked', task: 'Bash', label: '❌ build failed', reasonCode: 'build-failed' },
    { agentId: 'res', status: 'done', task: 'Read', label: '✅ done' },
    { agentId: 'designer', status: 'working', task: 'Edit', label: '🎨 tokens' },
    { agentId: 'gate', status: 'working', task: 'Bash', label: '🛡 gate' },
  ],
  quiet: [
    { agentId: 'dev', status: 'working', task: 'Edit', label: '✏️ Edit store.js' },
    { agentId: 'ops', status: 'done', task: 'Bash', label: '✅ done' },
  ],
}

const staged = SCENARIOS[SCENARIO]
if (!staged) {
  console.error(`unknown --scenario "${SCENARIO}"; known: ${Object.keys(SCENARIOS).join(', ')}`)
  process.exit(2)
}

const statusDir = mkdtempSync(path.join(tmpdir(), 'avo-staged-status-'))
mkdirSync(path.dirname(OUT), { recursive: true })

let server = null
let browser = null
const cleanup = () => {
  try { if (browser) browser.close() } catch {}
  try { if (server) server.kill() } catch {}
  try { rmSync(statusDir, { recursive: true, force: true }) } catch {}
}
process.on('exit', cleanup)

const fail = (msg) => { console.error(`staged-capture FAILED: ${msg}`); cleanup(); process.exit(1) }

// ── isolated dev server ───────────────────────────────────────────────────────────────────────
server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  env: { ...process.env, OFFICE_STATUS_DIR: statusDir },
  stdio: 'ignore',
})

const base = `http://localhost:${PORT}`
const deadline = Date.now() + 40000
let up = false
while (Date.now() < deadline) {
  try {
    const r = await fetch(base + '/', { method: 'GET' })
    if (r.ok) { up = true; break }
  } catch { /* not listening yet */ }
  await new Promise(r => setTimeout(r, 400))
}
if (!up) fail(`dev server did not come up on ${base} within 40s`)

// ── stage + assert + shoot ────────────────────────────────────────────────────────────────────
browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }))
const page = await browser.newPage({ viewport: { width: 1280, height: 920 }, deviceScaleFactor: 2 })
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1') } catch {} })
await page.goto(`${base}/?lang=${LANG}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('svg', { timeout: 20000 })
await page.waitForTimeout(600)

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
  window.dispatchEvent(new Event('resize'))
}, staged)
await page.waitForTimeout(700)

// THE ASSERTION. Read the rendered DOM, not the store we just wrote to — a store write that never
// reached the render is exactly the failure this script exists to catch.
const seen = await page.evaluate(() => {
  const out = {}
  for (const n of document.querySelectorAll('[data-agent-id]')) {
    out[n.getAttribute('data-agent-id')] = n.getAttribute('data-agent-status') || 'idle'
  }
  return out
})
const mismatched = staged.filter(u => seen[u.agentId] !== u.status)
if (mismatched.length) {
  fail(`staging did not reach the render for ${mismatched.length}/${staged.length} agents: ` +
       mismatched.map(m => `${m.agentId} wanted=${m.status} got=${seen[m.agentId]}`).join(', '))
}

// Text-object census — the number this whole exercise is about.
const census = await page.evaluate(() => ({
  activeAgents: [...document.querySelectorAll('[data-agent-id]')]
    .filter(n => (n.getAttribute('data-agent-status') || 'idle') !== 'idle').length,
  visibleBubbles: document.querySelectorAll('[data-bubble-visible="1"]').length,
}))

// A/B counterfactual, applied to the RENDER only so the source stays untouched: suppress the
// name tag for routine active states, keep it for the exception ones a reader must not miss, and
// leave every status ring in place. This answers "what does dropping the name channel buy?" with
// an image instead of an opinion.
if (HIDE_NAMES) {
  await page.evaluate(() => {
    const EXCEPTION = new Set(['blocked', 'awaiting-approval'])
    for (const n of document.querySelectorAll('[data-agent-id]')) {
      if (EXCEPTION.has(n.getAttribute('data-agent-status') || 'idle')) continue
      // The name tag is the <rect rx=10 h=20> + its sibling <text>, both inside the label group.
      for (const t of n.querySelectorAll('text')) {
        const r = t.previousElementSibling
        if (r && r.tagName === 'rect' && r.getAttribute('rx') === '10') { r.style.display = 'none'; t.style.display = 'none' }
      }
    }
  })
  await page.waitForTimeout(150)
}

await page.evaluate(() => { const s = document.querySelector('svg'); if (s) s.setAttribute('viewBox', '0 0 800 560') })
await page.waitForTimeout(200)
await (await page.$('svg')).screenshot({ path: OUT })

console.log(JSON.stringify({
  scenario: SCENARIO,
  hideNames: HIDE_NAMES,
  statusDir,
  staged: staged.length,
  rendered: seen,
  census,
  textObjects: census.activeAgents + census.visibleBubbles,
  consoleErrors: errors,
  out: OUT,
}, null, 2))
cleanup()
