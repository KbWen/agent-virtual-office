// Distrust-mode visual audit (owner: "空間很大卻常走到附近/蓋過去" + "人物不連貫?").
// FRESH page, ORGANIC office, 3 minutes @250ms sampling of the RENDERED transforms
// ([data-agent-id] translate) — the layer the user's eyes actually see.
// Measures: (1) proximity — seconds with any pair <30px (heavy overlap) and <45px
// (touching), per-pair + where; (2) continuity — per-sample displacement; a jump
// >48px/sample (~2.4x max walk step) = teleport event, listed with context.
import { chromium } from 'playwright-core'
import { readdirSync, renameSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const claudeDir = path.join(os.homedir(), '.claude')
const moved = []
for (const f of readdirSync(claudeDir)) {
  if (/^office-status(-[^.]+)?\.json$/.test(f)) {
    renameSync(path.join(claudeDir, f), path.join(claudeDir, f + '.pa-bak'))
    moved.push(f)
  }
}
process.on('exit', () => {
  for (const f of moved) {
    const bak = path.join(claudeDir, f + '.pa-bak')
    if (existsSync(bak)) { try { renameSync(bak, path.join(claudeDir, f)) } catch {} }
  }
})

const browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }))
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1') } catch {} })
await page.goto('http://localhost:5173/?lang=en', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('svg [data-agent-id]', { timeout: 15000 })
await page.waitForTimeout(1000)

const report = await page.evaluate(async () => {
  const store = (await import('/src/systems/store.js')).useOfficeStore
  for (const id of Object.keys(store.getState().agents)) store.getState().clearExternalStatus(id)

  const parse = (g) => {
    const m = /translate\(([-\d.]+)[, ]+([-\d.]+)\)/.exec(g.getAttribute('transform') || '')
    return m ? { x: +m[1], y: +m[2] } : null
  }
  const last = {}
  const stats = {
    samples: 0, anyUnder30: 0, anyUnder45: 0,
    pairsUnder30: {}, teleports: [], maxStepSeen: 0,
    movingSamples: 0,
  }
  const t0 = Date.now()
  while (Date.now() - t0 < 180000) {
    const els = [...document.querySelectorAll('[data-agent-id]')]
    const pos = {}
    for (const el of els) {
      const id = el.getAttribute('data-agent-id')
      const p = parse(el)
      if (p) pos[id] = p
    }
    stats.samples++
    const ids = Object.keys(pos)
    let u30 = false, u45 = false
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const d = Math.hypot(pos[ids[i]].x - pos[ids[j]].x, pos[ids[i]].y - pos[ids[j]].y)
        if (d < 30) { u30 = true; const k = [ids[i], ids[j]].sort().join('+'); stats.pairsUnder30[k] = (stats.pairsUnder30[k] || 0) + 1 }
        if (d < 45) u45 = true
      }
      const id = ids[i]
      if (last[id]) {
        const step = Math.hypot(pos[id].x - last[id].x, pos[id].y - last[id].y)
        if (step > 0.5) stats.movingSamples++
        if (step > stats.maxStepSeen) stats.maxStepSeen = Math.round(step)
        if (step > 48 && stats.teleports.length < 20) {
          stats.teleports.push({ id, from: `${Math.round(last[id].x)},${Math.round(last[id].y)}`, to: `${Math.round(pos[id].x)},${Math.round(pos[id].y)}`, step: Math.round(step), tSec: Math.round((Date.now() - t0) / 1000) })
        }
      }
      last[id] = pos[id]
    }
    if (u30) stats.anyUnder30++
    if (u45) stats.anyUnder45++
    await new Promise(r => setTimeout(r, 250))
  }
  return stats
})
console.log(JSON.stringify(report, null, 2))
await browser.close()
