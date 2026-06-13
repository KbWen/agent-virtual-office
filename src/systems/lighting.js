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
const KEYFRAMES = [
  { h: 0,  rgb: [5, 5, 16],      op: 0.45 }, // deep night
  { h: 5,  rgb: [12, 12, 48],    op: 0.42 }, // last of night, blue
  { h: 6,  rgb: [70, 55, 95],    op: 0.32 }, // pre-dawn purple
  { h: 7,  rgb: [255, 210, 150], op: 0.18 }, // warm dawn
  { h: 8,  rgb: [255, 235, 200], op: 0.07 }, // soft morning
  { h: 9,  rgb: [255, 255, 255], op: 0.0 },  // clear — day begins
  { h: 16, rgb: [255, 255, 255], op: 0.0 },  // clear — day ends
  { h: 17, rgb: [255, 180, 100], op: 0.08 }, // golden hour
  { h: 18, rgb: [255, 120, 60],  op: 0.16 }, // sunset orange
  { h: 19, rgb: [95, 60, 110],   op: 0.27 }, // dusk purple
  { h: 20, rgb: [30, 30, 82],    op: 0.36 }, // blue evening
  { h: 21, rgb: [15, 15, 58],    op: 0.42 }, // night falling
  { h: 23, rgb: [5, 5, 16],      op: 0.45 }, // deep night
]

const NIGHT = { fill: 'rgb(5, 5, 16)', opacity: 0.45 }

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
