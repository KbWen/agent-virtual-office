// Live check for event-visitor routes (boss-visit / dog-visit) on the shared navigation model.
// Own dev server on an empty OFFICE_STATUS_DIR; employees frozen at home; the visitor is driven
// by the real component. Every animation frame the visitor's FEET (rendered transform + feet
// offset) is tested against movementSystem's floor and furniture colliders, and its DOM paint
// position is checked against the employees above/below it. Records a video per visitor.
// Usage: node scripts/visitor-route-verify.mjs [--appearance pixel|classic] [--out dir]
import { chromium } from 'playwright-core'
import { spawn } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, renameSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

const arg = (n, f) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : f }
const OUT = arg('--out', '.pet-shots/visitors')
const APPEARANCE = arg('--appearance', 'pixel')
const PORT = Number(arg('--port', '5196'))
mkdirSync(OUT, { recursive: true })
const statusDir = mkdtempSync(path.join(tmpdir(), 'avo-visitor-'))
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { env: { ...process.env, OFFICE_STATUS_DIR: statusDir, OFFICE_DISABLE_FILE_WATCHER: '1' }, stdio: 'ignore' })
const base = `http://localhost:${PORT}`
for (let up = false, end = Date.now() + 40000; !up;) {
  if (Date.now() > end) { console.error('dev server did not start'); process.exit(1) }
  try { up = (await fetch(base + '/')).ok } catch { await new Promise(r => setTimeout(r, 400)) }
}
const browser = await chromium.launch({ headless: true })
const summary = {}
let failed = false

for (const [visitor, eventId, ms] of [['boss', 'boss-visit', 10500], ['dog', 'dog-visit', 19500]]) {
  const vdir = mkdtempSync(path.join(tmpdir(), 'avo-vid-'))
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, recordVideo: { dir: vdir, size: { width: 1280, height: 860 } } })
  const page = await ctx.newPage()
  await page.addInitScript((a) => { localStorage.setItem('office-onboarded', '1'); localStorage.setItem('avo.office-appearance', a) }, APPEARANCE)
  await page.goto(`${base}/?lang=en`)
  await page.waitForSelector('[data-agent-id]')
  await page.waitForTimeout(1500)
  const result = await page.evaluate(async ({ eventId, visitor, ms }) => {
    const store = (await import('/src/systems/store.js')).useOfficeStore
    const mv = await import('/src/systems/movementSystem.js')
    const { VISITOR_FEET_OFFSET } = await import('/src/systems/visitorRoutes.js')
    const s = store.getState()
    const agents = { ...s.agents }
    for (const id of Object.keys(agents)) {
      const h = mv.HOME_POSITIONS[id] || agents[id].position
      agents[id] = { ...agents[id], position: { ...h }, targetPosition: { ...h }, isMoving: false }
    }
    store.setState({ agents, isPaused: true, activeEvent: { id: eventId, duration: ms, name: eventId } })
    const out = { frames: 0, offFloor: [], onFurniture: [], depthErrors: [], minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 }
    const end = performance.now() + ms - 500
    await new Promise((resolve) => {
      const tick = () => {
        const g = document.querySelector(`[data-visitor="${visitor}"]`)
        if (g) {
          const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(g.getAttribute('transform'))
          const x = +m[1], y = +m[2] + VISITOR_FEET_OFFSET[visitor]
          out.frames++
          out.minX = Math.min(out.minX, x); out.maxX = Math.max(out.maxX, x); out.minY = Math.min(out.minY, y); out.maxY = Math.max(out.maxY, y)
          if (!mv.isOnFloor(x, y)) out.offFloor.push([+x.toFixed(1), +y.toFixed(1)])
          if (mv.isOnObstacle(x, y)) out.onFurniture.push([+x.toFixed(1), +y.toFixed(1)])
          // paint order: every employee painted before the visitor must have feet y <= visitor feet (+1 tolerance)
          const sibs = [...g.parentNode.children].filter(n => n === g || n.hasAttribute('data-agent-id'))
          const vi = sibs.indexOf(g)
          sibs.forEach((n, i) => {
            if (n === g) return
            const ay = +(/translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(n.getAttribute('transform'))[2])
            const before = i < vi
            // Allow 3px of hysteresis around a crossing (depth updates on the next frame).
            if (before && ay > y + 3) out.depthErrors.push({ agent: n.dataset.agentId, ay, y: +y.toFixed(1), painted: 'behind-wrong' })
            if (!before && ay < y - 3) out.depthErrors.push({ agent: n.dataset.agentId, ay, y: +y.toFixed(1), painted: 'front-wrong' })
          })
        }
        if (performance.now() < end) requestAnimationFrame(tick); else resolve()
      }
      requestAnimationFrame(tick)
    })
    return out
  }, { eventId, visitor, ms })
  await ctx.close()
  const vid = readdirSync(vdir).find(f => f.endsWith('.webm'))
  if (vid) renameSync(path.join(vdir, vid), path.join(OUT, `${visitor}-${APPEARANCE}.webm`))
  rmSync(vdir, { recursive: true, force: true })
  const ok = result.frames > 100 && !result.offFloor.length && !result.onFurniture.length && !result.depthErrors.length
  if (!ok) failed = true
  summary[visitor] = { ok, frames: result.frames, offFloor: result.offFloor.length, onFurniture: result.onFurniture.length, depthErrors: result.depthErrors.length, samples: { offFloor: result.offFloor.slice(0, 3), onFurniture: result.onFurniture.slice(0, 3), depth: result.depthErrors.slice(0, 3) }, bbox: [result.minX, result.minY, result.maxX, result.maxY].map(v => +v.toFixed(0)) }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${visitor}: ${JSON.stringify(summary[visitor])}`)
}
writeFileSync(path.join(OUT, `visitor-checks-${APPEARANCE}.json`), JSON.stringify({ when: new Date().toISOString(), appearance: APPEARANCE, summary }, null, 2))
await browser.close(); server.kill(); rmSync(statusDir, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
