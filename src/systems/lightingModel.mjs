// Node-safe time-of-day lighting curve for package consumers.

const KEYFRAMES = [
  { h: 0, rgb: [12, 14, 38], op: 0.38 },
  { h: 5, rgb: [22, 24, 60], op: 0.36 },
  { h: 6, rgb: [88, 66, 112], op: 0.30 },
  { h: 6.5, rgb: [212, 132, 140], op: 0.24 },
  { h: 7, rgb: [255, 208, 152], op: 0.17 },
  { h: 8, rgb: [255, 236, 206], op: 0.06 },
  { h: 9, rgb: [255, 255, 255], op: 0 },
  { h: 16, rgb: [255, 255, 255], op: 0 },
  { h: 16.5, rgb: [255, 244, 222], op: 0.05 },
  { h: 17, rgb: [255, 188, 116], op: 0.08 },
  { h: 18, rgb: [236, 126, 92], op: 0.13 },
  { h: 19, rgb: [108, 68, 120], op: 0.26 },
  { h: 20, rgb: [46, 44, 96], op: 0.32 },
  { h: 21, rgb: [26, 28, 70], op: 0.36 },
  { h: 23, rgb: [12, 14, 38], op: 0.38 },
]

export const MAX_LIGHTING_OPACITY = 0.38
const NIGHT_OVERLAY = { fill: 'rgb(12, 14, 38)', opacity: MAX_LIGHTING_OPACITY }

function lerp(a, b, t) {
  return a + (b - a) * t
}

export function getLightingOverlay(hour) {
  const n = Number(hour)
  if (!Number.isFinite(n)) return { ...NIGHT_OVERLAY }
  const h = ((n % 24) + 24) % 24

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
  const opacity = Math.round(lerp(lo.op, hi.op, t) * 1000) / 1000
  return { fill: `rgb(${r}, ${g}, ${b})`, opacity }
}
