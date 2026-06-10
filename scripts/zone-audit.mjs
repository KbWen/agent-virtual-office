// Distrust-mode live audit for owner Q2 "agents never visit other rooms?" and
// Q4 "constant walking feels restless?". Headless Playwright (rendering compositor
// active), 3 minutes @250ms sampling of rendered [data-agent-id] transforms.
// Measures per-agent: zone occupancy %, room-visit events (zone change away from home
// held >=2s), walk events (contiguous moving runs), simultaneous-walker screen share.
// Pass --organic to shelve the live status files (untracked idle office) first.
import { chromium } from 'playwright-core'
import { readdirSync, renameSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ORGANIC = process.argv.includes('--organic')
const moved = []
if (ORGANIC) {
  const claudeDir = path.join(os.homedir(), '.claude')
  for (const f of readdirSync(claudeDir)) {
    if (/^office-status(-[^.]+)?\.json$/.test(f)) {
      renameSync(path.join(claudeDir, f), path.join(claudeDir, f + '.za-bak'))
      moved.push(path.join(claudeDir, f))
    }
  }
  process.on('exit', () => {
    for (const f of moved) {
      if (existsSync(f + '.za-bak')) { try { renameSync(f + '.za-bak', f) } catch {} }
    }
  })
}

const browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }))
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1') } catch {} })
await page.goto('http://localhost:5173/?lang=en', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('svg [data-agent-id]', { timeout: 15000 })
await page.waitForTimeout(1000)

const report = await page.evaluate(async ({ organic }) => {
  const store = (await import('/src/systems/store.js')).useOfficeStore
  const { getZone } = await import('/src/systems/movementSystem.js')
  if (organic) {
    for (const id of Object.keys(store.getState().agents)) store.getState().clearExternalStatus(id)
  }

  const parse = (g) => {
    const m = /translate\(([-\d.]+)[, ]+([-\d.]+)\)/.exec(g.getAttribute('transform') || '')
    return m ? { x: +m[1], y: +m[2] } : null
  }
  const agents = {}   // id -> { homeZone, zoneSamples:{}, lastPos, lastZone, zoneSince, visits:[], moving:false, walkEvents:0, movingSamples:0 }
  const stats = { samples: 0, walkers0: 0, walkers1: 0, walkers2plus: 0, trackedIds: Object.keys(store.getState().externalStatus || {}) }
  const t0 = Date.now()
  while (Date.now() - t0 < 180000) {
    const els = [...document.querySelectorAll('[data-agent-id]')]
    stats.samples++
    let walkers = 0
    for (const el of els) {
      const id = el.getAttribute('data-agent-id')
      const p = parse(el)
      if (!p) continue
      const z = getZone(p.x, p.y)
      let a = agents[id]
      if (!a) {
        a = agents[id] = { homeZone: z, zoneSamples: {}, lastPos: p, lastZone: z, zoneSince: Date.now(), visits: [], walkEvents: 0, movingSamples: 0, moving: false }
      }
      a.zoneSamples[z] = (a.zoneSamples[z] || 0) + 1
      const step = Math.hypot(p.x - a.lastPos.x, p.y - a.lastPos.y)
      const movingNow = step > 0.5
      if (movingNow) { a.movingSamples++; walkers++ }
      if (movingNow && !a.moving) a.walkEvents++
      a.moving = movingNow
      if (z !== a.lastZone) {
        a.lastZone = z
        a.zoneSince = Date.now()
      } else if (z !== a.homeZone && Date.now() - a.zoneSince >= 2000 && (a.visits.length === 0 || a.visits[a.visits.length - 1].zone !== z || Date.now() - a.visits[a.visits.length - 1].t > 5000)) {
        if (a.visits.length < 50 && !a.visits.some(v => v.zone === z && Date.now() - v.t < 10000)) {
          a.visits.push({ zone: z, t: Date.now() - 0, tSec: Math.round((Date.now() - t0) / 1000) })
        }
      }
      a.lastPos = p
    }
    if (walkers === 0) stats.walkers0++
    else if (walkers === 1) stats.walkers1++
    else stats.walkers2plus++
    await new Promise(r => setTimeout(r, 250))
  }
  const out = { stats, agents: {} }
  for (const [id, a] of Object.entries(agents)) {
    const total = Object.values(a.zoneSamples).reduce((s, v) => s + v, 0)
    out.agents[id] = {
      homeZone: a.homeZone,
      zonePct: Object.fromEntries(Object.entries(a.zoneSamples).map(([z, n]) => [z, Math.round(100 * n / total)])),
      roomVisits: a.visits.map(v => `${v.zone}@${v.tSec}s`),
      walkEvents: a.walkEvents,
      movingPct: Math.round(100 * a.movingSamples / total),
    }
  }
  return out
}, { organic: ORGANIC })
console.log(JSON.stringify(report, null, 2))
await browser.close()
