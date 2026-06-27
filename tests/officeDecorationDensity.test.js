import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// VR-1 (2026-06-20 visual-reduction audit): the scene had 12 decorative <Plant> instances —
// scattered green specks at every edge/corner plus four redundant *stacked* pairs that read as
// clutter and competed with agent legibility. Thinned to a 6-plant symmetric PERIMETER frame
// (one per corner / mid-side, none crowding the central engineering desks).
//
// This guard locks the reduction: plants carry ZERO status signal (Plant({x,y}) — pure
// decoration), so re-inflating the count is always pure noise, never information. It also pins
// the legibility intent: no plant may sit inside the central desk/agent zone.
const src = readFileSync(join(process.cwd(), 'src', 'components', 'PixelOffice.jsx'), 'utf-8')

function plantCoords() {
  return [...src.matchAll(/<Plant\s+x=\{(\d+)\}\s+y=\{(\d+)\}\s*\/>/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
}

describe('VR-1 office decoration density', () => {
  const plants = plantCoords()

  it('keeps the plant count in the framing range [4,9] (6 perimeter + 3 dead-zone)', () => {
    expect(plants.length).toBeGreaterThanOrEqual(4)
    // VR-1 set a 6-plant perimeter frame. The office-layout-enrichment slices (owner-directed,
    // 2026-06-27) added 3 plants into genuine DEAD ZONES — the meeting breakout nook (×2) and the
    // hallway reception corner (×1) — all OUTSIDE the central desk legibility zone (pinned by the
    // next test). Filling empty space is not the clutter VR-1 removed, so the cap rises 6→9 to lock
    // the new intent; the legibility + no-cluster guards below are unchanged. Past 9 = unthinking noise.
    expect(plants.length).toBeLessThanOrEqual(9)
  })

  it('places NO plant inside the central engineering desk zone (legibility)', () => {
    // The agent desks/labels live in roughly x∈[120,560], y∈[210,370]. Decoration here would
    // crowd the agents — the exact thing the reduction removed (the old 430,430 + 500,55/105).
    const inDeskZone = plants.filter((p) => p.x >= 120 && p.x <= 560 && p.y >= 210 && p.y <= 370)
    expect(inDeskZone, `plants crowding the desk zone: ${JSON.stringify(inDeskZone)}`).toHaveLength(0)
  })

  it('has no redundant stacked pair (two plants within 40px)', () => {
    const clustered = []
    for (let i = 0; i < plants.length; i++) {
      for (let j = i + 1; j < plants.length; j++) {
        const d = Math.hypot(plants[i].x - plants[j].x, plants[i].y - plants[j].y)
        if (d < 40) clustered.push([plants[i], plants[j], Math.round(d)])
      }
    }
    expect(clustered, `stacked/clustered plant pairs: ${JSON.stringify(clustered)}`).toHaveLength(0)
  })
})
