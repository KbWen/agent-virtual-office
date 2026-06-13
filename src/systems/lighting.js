// Time-of-day color-grade for the office (AVO-111).
//
// A smooth, continuous day cycle — deep night, a warm purple-to-amber dawn, a
// clear neutral midday, a golden hour, an orange sunset, and a blue dusk back
// into night. Replaces the original 9-step discrete `getLightingOverlay`, whose
// hard jumps between bands read as the lighting "snapping" rather than the room
// living through the day.
//
// Sampled at HOUR resolution on purpose: PixelOffice subscribes to the store's
// `hour` (never `minute`, for render-cost reasons — see the Clock widget note in
// PixelOffice.jsx), so this MUST stay a pure function of the integer hour. The
// curve is defined by keyframes and linearly interpolated between them, so every
// adjacent hour differs by only a small amount (no visible snap).

// Each keyframe: hour anchor, fill as [r,g,b], and tint opacity (0 = fully clear).
// Palette tuned by a 5-lens design panel (AVO-111 polish). Hard rules baked in:
//   • Opacity ceiling 0.38 — night ambiance must never bury status legibility
//     (the product's #1 law); deep night is a DESATURATED indigo, never near-black.
//   • Sunset is desaturated terracotta, off the orange working-ring hue band, so a
//     status ring never blends into the floor and white bubbles aren't recolored.
//   • Half-hour anchors (6.5 dawn rose-blush, 16.5 warm shoulder) only SHAPE the
//     interpolation between integer hours — PixelOffice samples integer `hour` only.
const KEYFRAMES = [
  { h: 0,    rgb: [12, 14, 38],   op: 0.38 }, // deep night — desaturated indigo
  { h: 5,    rgb: [22, 24, 60],   op: 0.36 }, // last of night, periwinkle
  { h: 6,    rgb: [88, 66, 112],  op: 0.30 }, // pre-dawn violet
  { h: 6.5,  rgb: [212, 132, 140], op: 0.24 }, // dawn rose-blush (transit only)
  { h: 7,    rgb: [255, 208, 152], op: 0.17 }, // warm dawn — sun cresting
  { h: 8,    rgb: [255, 236, 206], op: 0.06 }, // soft morning shoulder
  { h: 9,    rgb: [255, 255, 255], op: 0.0 },  // clear — day begins (legibility anchor)
  { h: 16,   rgb: [255, 255, 255], op: 0.0 },  // clear — day ends (legibility anchor)
  { h: 16.5, rgb: [255, 244, 222], op: 0.05 }, // warm shoulder into golden hour
  { h: 17,   rgb: [255, 188, 116], op: 0.08 }, // golden hour
  { h: 18,   rgb: [236, 126, 92],  op: 0.13 }, // sunset — desaturated terracotta
  { h: 19,   rgb: [108, 68, 120],  op: 0.26 }, // dusk — magenta-leaning purple
  { h: 20,   rgb: [46, 44, 96],    op: 0.32 }, // blue evening
  { h: 21,   rgb: [26, 28, 70],    op: 0.36 }, // night falling
  { h: 23,   rgb: [12, 14, 38],    op: 0.38 }, // deep night — wraps to h0
]

// Opacity ceiling shared by the curve and the non-finite fallback (status-legibility law).
export const MAX_OPACITY = 0.38
const NIGHT = { fill: 'rgb(12, 14, 38)', opacity: MAX_OPACITY }

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Lighting tint for a given wall-clock hour.
 * @param {number} hour integer 0–23 (other values wrap / fall back to night).
 * @returns {{ fill: string, opacity: number }} an SVG-ready rgb() fill + opacity.
 */
export function getLightingOverlay(hour) {
  const n = Number(hour)
  if (!Number.isFinite(n)) return { ...NIGHT }
  const h = ((n % 24) + 24) % 24

  // Find the keyframe pair bracketing this hour.
  let lo = KEYFRAMES[0]
  let hi = KEYFRAMES[KEYFRAMES.length - 1]
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (h >= KEYFRAMES[i].h && h <= KEYFRAMES[i + 1].h) {
      lo = KEYFRAMES[i]
      hi = KEYFRAMES[i + 1]
      break
    }
  }

  const span = hi.h - lo.h
  const t = span === 0 ? 0 : (h - lo.h) / span
  const r = Math.round(lerp(lo.rgb[0], hi.rgb[0], t))
  const g = Math.round(lerp(lo.rgb[1], hi.rgb[1], t))
  const b = Math.round(lerp(lo.rgb[2], hi.rgb[2], t))
  // Round opacity to 3dp so equality/snapshot comparisons stay stable.
  const opacity = Math.round(lerp(lo.op, hi.op, t) * 1000) / 1000
  return { fill: `rgb(${r}, ${g}, ${b})`, opacity }
}
