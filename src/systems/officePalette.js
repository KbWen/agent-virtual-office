// Office palette — the ONE place the office shell colours and the agent inspector's look live
// (PURE, no React/DOM). Spec: docs/specs/calm-stationery-palette.md.
//
// Want a different look? Change the values here, then run:
//   npx vitest run tests/officePalette.test.js     # the rules below — fails with what to fix
//   node scripts/staged-capture.mjs                # a real screenshot, isolated from live status
//
// RULES (enforced by tests/officePalette.test.js, so a pretty palette cannot quietly hurt legibility):
//   R1  The main floor never camouflages a status hue: each STATUS_COLORS value (solid) vs the floor
//       >= RULES.minStatusHueContrast. Honest limit: rings render below full opacity (they pulse; 50% peak
//       at base effort, up to 100% at max effort), so on-screen ring contrast is usually LOWER than this
//       number (working amber: 1.25 solid, ~1.13 at 50%). It is a floor
//       guard, not a certificate; the name pill carries status at full strength. Status colours live
//       in src/systems/constants.js and are NOT palette tokens — they carry meaning, so a restyle
//       adapts the floor to them, never the reverse.
//   R2  Walls separate rooms: wallFace vs every floor it touches >= RULES.minWallContrast.
//   R3  Inspector text is readable: ink and mutedInk on paper >= RULES.minTextContrast (WCAG AA), the
//       name (ink) over the header tint for EVERY role colour in src/config/characters.json too, and
//       the close ✕ icon (mutedInk) over that tint >= RULES.minIconContrast (WCAG non-text 3:1).
//   R4  A status colour is never inspector text (none reaches 4.5:1 as text, even on white): in
//       AgentInspector.jsx STATUS_COLORS may only appear on the status dot <circle>.
//   R5  No palette hex is repeated as a literal in the components, and no room-shell <rect> in
//       PixelOffice.jsx (the BACKGROUND … ENTRANCE block) has a literal fill — floors, walls and door
//       openings take their colour from SCENE, so a door opening follows its room's floor token.
//
// Scope: the room shell (floors, walls, doors, frame), the team signs and the inspector card.
// Furniture art, sprites, speech bubbles and the day/night + theme overlays have their own homes
// (TopDownFurniture.jsx, AgentCharacter.jsx, BehaviorBubble.jsx, lighting.js, theme.js).

export const RULES = Object.freeze({
  minStatusHueContrast: 1.2,
  minWallContrast: 1.5,
  minTextContrast: 4.5,
  minIconContrast: 3,
})

// ── Room shell (PixelOffice.jsx). Coordinates live in the component; only colours live here. ──
export const SCENE = Object.freeze({
  background: '#3a3028',   // behind everything, visible only at the seams
  outerFrame: '#2a2018',   // the building's outer walls
  floors: Object.freeze({
    hallway: '#D0C0A0',    // entrance + hallway
    mainOffice: '#D6C29C', // "warm oak": light enough that every status ring gains contrast
    meeting: '#9898B0',
    lounge: '#A8B898',
    research: '#9898B0',
  }),
  wallFace: '#806E5A',     // interior thick walls
  wallEdge: '#4a3a2a',     // the narrow darker edge on the room side of a wall
  wallEdgeOpacity: 0.5,
  doorPost: '#7a6a5a',
  corridorTint: '#8a7a5a', // faint walking-lane hint on the main floor
  corridorOpacity: 0.05,
  floorGridOpacity: 0.02,  // floor texture: reduce to calm it, keep > 0 so the floor is not flat
})

// Team area labels on the main floor. ENGINEERING is the one readable signature (+ a short accent
// rule); PLANNING and REVIEW stay faint because they sit on the sprint board / beside a name tag.
export const SIGNS = Object.freeze({
  ink: '#303C37',
  accent: '#345D50',
  font: "'Segoe UI', system-ui, sans-serif",
  signatureOpacity: 0.75,
  faintOpacity: 0.4,
})

// ── Agent inspector card (AgentInspector.jsx) ──
// Type sizes are SCENE units: the card counter-scales to a net 1.6× on screen, so 10 ≈ 16px.
export const CARD = Object.freeze({
  paper: '#F5F2E9',
  ink: '#303C37',
  mutedInk: '#626D65',
  line: '#B9B7A8',
  font: "'Segoe UI', system-ui, sans-serif",
  cornerCssPx: 6,          // on-screen radius, independent of zoom
  headerHeight: 28,
  headerTintOpacity: 0.16, // role colour wash behind the name
  type: Object.freeze({ name: 10, close: 10, status: 9, body: 9, row: 8.75, history: 7.5 }),
  closeHitSize: 18,        // invisible click/tap target around the ✕ (scene units ≈ 29 CSS px)
})

// ── WCAG relative-luminance contrast (used by the rules test; exported so tools can reuse it) ──
function channel(c) {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function parseHex(hex) {
  let h = String(hex).replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a #rgb/#rrggbb colour: ${hex}`)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

export function relativeLuminance(rgb) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(Array.isArray(a) ? a : parseHex(a))
  const lb = relativeLuminance(Array.isArray(b) ? b : parseHex(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Composite `fg` at `opacity` over an opaque `bg` → rgb array.
export function mixOver(fg, bg, opacity) {
  const f = Array.isArray(fg) ? fg : parseHex(fg)
  const b = Array.isArray(bg) ? bg : parseHex(bg)
  return f.map((v, i) => v * opacity + b[i] * (1 - opacity))
}
