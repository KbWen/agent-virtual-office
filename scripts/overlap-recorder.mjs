// Distrust-mode overlap forensics (owner screenshot 2026-06-10: "又在不同地方重疊...應該要有八個人").
// Samples BOTH the rendered DOM transforms (what the user's eyes see) AND store ground truth
// (positions, CURRENT-LEG targetPosition, isMoving, behavior, inGroupEvent) every 200ms.
// When a pair sits <30px apart for >=2s with both visually at rest, dump each agent's last
// ~12s ring buffer so the mechanism that brought them together is visible (leg-target hole?
// group event? returnHome? social?). Default 12 minutes.
import { chromium } from 'playwright-core'

const MINUTES = Number(process.argv[2] || 12)

const browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }))
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1') } catch {} })
await page.goto('http://localhost:5173/?lang=en', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('svg [data-agent-id]', { timeout: 15000 })
await page.waitForTimeout(1000)

const report = await page.evaluate(async ({ minutes }) => {
  const store = (await import('/src/systems/store.js')).useOfficeStore

  const parse = (g) => {
    const m = /translate\(([-\d.]+)[, ]+([-\d.]+)\)/.exec(g.getAttribute('transform') || '')
    return m ? { x: +m[1], y: +m[2] } : null
  }
  const rings = {}            // id -> [{t, dom, pos, tgt, moving, behavior, group}] ring of 60
  const pairState = {}        // "a+b" -> { since, reported }
  const events = []
  const stats = { samples: 0, pairSecondsUnder30AtRest: 0 }
  const t0 = Date.now()

  while (Date.now() - t0 < minutes * 60000) {
    const now = Date.now()
    const s = store.getState()
    const els = [...document.querySelectorAll('[data-agent-id]')]
    const dom = {}
    for (const el of els) {
      const p = parse(el)
      if (p) dom[el.getAttribute('data-agent-id')] = p
    }
    stats.samples++
    const ids = Object.keys(dom)
    for (const id of ids) {
      const a = s.agents[id] || {}
      const ring = rings[id] || (rings[id] = [])
      const prev = ring[ring.length - 1]
      const vel = prev ? Math.hypot(dom[id].x - prev.dom.x, dom[id].y - prev.dom.y) : 0
      ring.push({
        t: Math.round((now - t0) / 100) / 10,
        dom: { x: Math.round(dom[id].x), y: Math.round(dom[id].y) },
        vel: Math.round(vel * 10) / 10,
        pos: a.position ? { x: Math.round(a.position.x), y: Math.round(a.position.y) } : null,
        tgt: a.targetPosition ? { x: Math.round(a.targetPosition.x), y: Math.round(a.targetPosition.y) } : null,
        moving: !!a.isMoving,
        behavior: a.behavior || null,
        group: !!a.inGroupEvent,
        status: a.status || null,
      })
      if (ring.length > 60) ring.shift()
    }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = ids[i], B = ids[j]
        const d = Math.hypot(dom[A].x - dom[B].x, dom[A].y - dom[B].y)
        const k = [A, B].sort().join('+')
        const rA = rings[A][rings[A].length - 1], rB = rings[B][rings[B].length - 1]
        const atRest = rA.vel < 0.5 && rB.vel < 0.5
        if (d < 30 && atRest) {
          stats.pairSecondsUnder30AtRest += 0.2
          if (!pairState[k]) pairState[k] = { since: now, reported: false }
          if (!pairState[k].reported && now - pairState[k].since >= 2000 && events.length < 12) {
            pairState[k].reported = true
            events.push({
              pair: k, dist: Math.round(d), tSec: Math.round((now - t0) / 1000),
              ringA: { id: A, tail: rings[A].slice(-50) },
              ringB: { id: B, tail: rings[B].slice(-50) },
            })
          }
        } else if (pairState[k] && (d >= 35 || !atRest)) {
          delete pairState[k]
        }
      }
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return { stats, eventCount: events.length, events }
}, { minutes: MINUTES })

console.log(JSON.stringify(report, null, 1))
await browser.close()
