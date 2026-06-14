// AVO-115 — Shareable end-of-day office card (cozy postcard).
//
// A still pixel-art PNG that summarizes today's office as a warm postcard — NOT a
// stats/power-level/sports card. Weather/mood is the hero; at most ONE gentle number
// (today's done count) is woven into a derived caption. No event counting, no bars,
// no rankings (see docs/specs/shareable-daily-card.md). Rendering is 100% client-side.
//
// Split design:
//   buildCardModel(input)  — PURE, no canvas. Selects copy + the single number +
//                            empty-day variant. Unit-testable in vitest (no jsdom).
//   renderDailyCard(input) — draws the model to a canvas and resolves a PNG Blob.
//   shareOrDownloadCard()  — feature-detected Web Share → download fallback.

import en from '../locales/en.json'
import zhTW from '../locales/zh-TW.json'

const LOCALES = { en, 'zh-TW': zhTW }

// Resolve the dailyCard string sub-tree for a locale, falling back to en per-key.
export function resolveCardStrings(locale = 'en') {
  const base = (en.dailyCard) || {}
  const loc = (LOCALES[locale]?.dailyCard) || {}
  return deepMerge(base, loc)
}

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v)
    } else {
      out[k] = v
    }
  }
  return out
}

function interpolate(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

// Local-day key (YYYY-MM-DD). Mirrors the store's getLocalDayKey formatting so the card
// footer matches the ledgers, without coupling to / modifying the store module.
export function todayKey(now = Date.now()) {
  const d = new Date(now)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Map a weather family to one of the four hero skins (defensive default = clear).
const HERO_KEYS = new Set(['clear', 'cloudy', 'rain', 'thunderstorm'])
function heroFor(weather) {
  return HERO_KEYS.has(weather) ? weather : 'clear'
}

// Pick the caption key from the HONEST signals we own: done count + mood.
// Empty day (no done) → quiet variant with NO number. Otherwise derive a cozy phrase.
export function captionKeyFor(doneTotal, mood) {
  if (!doneTotal || doneTotal <= 0) return 'empty'
  switch (mood) {
    case 'rushing':    return 'busy'
    case 'frustrated': return 'rainy'
    case 'stuck':      return 'stormy'
    case 'intense':    return 'headsdown'
    case 'smooth':
    case 'normal':
    case 'idle':
    default:           return 'smooth'
  }
}

// Honest qualitative blocked tail (NO number — keeps the card off the "stats" path
// and avoids implying a precise blocked tally on a celebratory postcard).
function blockedTailKey(blockedTotal) {
  if (!blockedTotal || blockedTotal <= 0) return null
  return blockedTotal <= 2 ? 'snagsFew' : 'snagsMany'
}

// Non-negative integer or 0. Rejects fractional, negative, NaN, and Infinity so the card
// can never render a fractional/garbage number (the "cozy postcard, not a stats card" guard).
function safeCount(v) {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// PURE: build the renderable model. No canvas, no globals.
export function buildCardModel(input = {}) {
  const {
    dayKey = '',
    mood = 'normal',
    weather = 'clear',
    locale = 'en',
  } = input
  // Coerce counts to non-negative integers up front. The ledgers always sum to ints, but
  // this is the live guard for the owner's non-negotiable "cozy postcard, NOT a stats card"
  // rule: a fractional/garbage count (e.g. 3.75) would otherwise render "3.75" and inflate
  // the body number count past the ≤2 invariant. NaN/negative/undefined → 0 → empty variant.
  const doneTotal = safeCount(input.doneTotal)
  const blockedTotal = safeCount(input.blockedTotal)
  const s = resolveCardStrings(locale)
  const hero = heroFor(weather)
  const captionKey = captionKeyFor(doneTotal, mood)
  const captionTpl = (s.caption && s.caption[captionKey]) || (s.caption && s.caption.empty) || ''
  const caption = interpolate(captionTpl, { done: doneTotal })

  const tailKey = blockedTailKey(blockedTotal)
  const blockedTail = tailKey ? ((s.blocked && s.blocked[tailKey]) || '') : null

  const moodWord = (s.moodWord && s.moodWord[hero]) || hero

  // Count numeric runs in the BODY copy only (caption + blocked tail). The footer
  // date is metadata, not a stat, and is excluded by design (AC-6). The card must
  // never read as a stats grid: body numbers must be ≤ 2 (in practice 0 or 1).
  const body = `${caption} ${blockedTail || ''}`
  const numericTokenCount = (body.match(/\d+/g) || []).length

  return {
    hero,
    moodWord,
    captionKey,
    caption,
    blockedTail,
    footer: `${dayKey} · ${s.source || 'Agent Virtual Office'}`,
    isEmptyDay: captionKey === 'empty',
    numericTokenCount,
  }
}

// ─── Canvas rendering ───────────────────────────────────────────────────────

const W = 760
const H = 960
const MARGIN = 48

// Warm cream postcard base + per-weather sky palette.
const PALETTE = {
  base: '#FDF6EC',
  ink: '#4A4036',
  inkSoft: '#8A7E6F',
  border: '#E6D8C3',
  sky: {
    clear:        ['#FCE7C4', '#FBD79C'],
    cloudy:       ['#CBD6E0', '#E9EEF3'],
    rain:         ['#93A6BA', '#BCC8D6'],
    thunderstorm: ['#474B66', '#6C7090'],
  },
  floor: '#EADBC2',
  deskTop: '#C99A6A',
  deskLeg: '#A87C4E',
  monitor: '#3B4252',
}

// Tiny representative agent colors (cozy, not role-accurate — this is ambient art).
const AGENT_COLORS = ['#E8927C', '#7CA7E8', '#8FCB9B', '#E8C97C']

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawHeroSky(ctx, hero, x, y, w, h) {
  const [top, bottom] = PALETTE.sky[hero] || PALETTE.sky.clear
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  roundRect(ctx, x, y, w, h, 18)
  ctx.fill()

  const cx = x + w * 0.74
  const cy = y + h * 0.36
  ctx.save()
  if (hero === 'clear') {
    // Sun
    ctx.fillStyle = '#FFF3D6'
    ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,243,214,0.55)'
    ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2); ctx.fill()
  } else if (hero === 'cloudy') {
    drawCloud(ctx, cx - 20, cy, '#F4F7FB')
  } else if (hero === 'rain') {
    drawCloud(ctx, cx - 20, cy - 6, '#E4EAF1')
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3
    for (let i = 0; i < 5; i++) {
      const rx = cx - 34 + i * 16
      ctx.beginPath(); ctx.moveTo(rx, cy + 22); ctx.lineTo(rx - 6, cy + 42); ctx.stroke()
    }
  } else if (hero === 'thunderstorm') {
    drawCloud(ctx, cx - 20, cy - 6, '#9AA0C0')
    ctx.fillStyle = '#FBE7A0'
    ctx.beginPath()
    ctx.moveTo(cx, cy + 18); ctx.lineTo(cx - 12, cy + 44); ctx.lineTo(cx - 2, cy + 44)
    ctx.lineTo(cx - 12, cy + 66); ctx.lineTo(cx + 14, cy + 36); ctx.lineTo(cx + 2, cy + 36)
    ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}

function drawCloud(ctx, x, y, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 22, 0, Math.PI * 2)
  ctx.arc(x + 24, y - 8, 26, 0, Math.PI * 2)
  ctx.arc(x + 50, y, 22, 0, Math.PI * 2)
  ctx.rect(x - 2, y, 54, 22)
  ctx.fill()
}

function drawOfficeVignette(ctx, x, y, w, h) {
  // Floor
  ctx.fillStyle = PALETTE.floor
  roundRect(ctx, x, y, w, h, 14)
  ctx.fill()
  // Three little desks with monitors + a tiny agent each
  const slots = 3
  const gap = w / slots
  for (let i = 0; i < slots; i++) {
    const dx = x + gap * i + gap * 0.5
    const dy = y + h * 0.62
    // desk
    ctx.fillStyle = PALETTE.deskTop
    ctx.fillRect(dx - 38, dy, 76, 12)
    ctx.fillStyle = PALETTE.deskLeg
    ctx.fillRect(dx - 34, dy + 12, 8, 22)
    ctx.fillRect(dx + 26, dy + 12, 8, 22)
    // monitor
    ctx.fillStyle = PALETTE.monitor
    ctx.fillRect(dx - 16, dy - 22, 32, 22)
    ctx.fillStyle = '#9DB7C9'
    ctx.fillRect(dx - 12, dy - 18, 24, 14)
    // agent (head + body) behind desk
    const ac = AGENT_COLORS[i % AGENT_COLORS.length]
    ctx.fillStyle = '#F2D2B6'
    ctx.beginPath(); ctx.arc(dx, dy - 34, 9, 0, Math.PI * 2); ctx.fill() // head
    ctx.fillStyle = ac
    roundRect(ctx, dx - 11, dy - 28, 22, 22, 6); ctx.fill() // body
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  // Fallback for scripts without spaces (zh-TW): char-wrap if a single "word" overflows.
  if (lines.length === 1 && ctx.measureText(lines[0]).width > maxWidth) {
    const chars = [...String(text)]
    const out = []
    let cur = ''
    for (const ch of chars) {
      const test = cur + ch
      if (ctx.measureText(test).width > maxWidth && cur) { out.push(cur); cur = ch }
      else cur = test
    }
    if (cur) out.push(cur)
    return out
  }
  return lines
}

// Draw the model to a 2D context. Exported for the live/Playwright check.
export function drawCard(ctx, model) {
  // Postcard base + border
  ctx.fillStyle = PALETTE.base
  roundRect(ctx, 4, 4, W - 8, H - 8, 28)
  ctx.fill()
  ctx.strokeStyle = PALETTE.border
  ctx.lineWidth = 4
  roundRect(ctx, 4, 4, W - 8, H - 8, 28)
  ctx.stroke()

  // ZONE 1 — weather hero (dominant)
  drawHeroSky(ctx, model.hero, MARGIN, MARGIN, W - MARGIN * 2, 300)
  ctx.fillStyle = 'rgba(74,64,54,0.72)'
  ctx.font = '600 26px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(model.moodWord, MARGIN + 22, MARGIN + 300 - 26)

  // ZONE 2 — tiny office vignette (ambient art, not a chart)
  drawOfficeVignette(ctx, MARGIN, MARGIN + 336, W - MARGIN * 2, 230)

  // ZONE 3 — one warm derived caption (the single number lives here)
  ctx.fillStyle = PALETTE.ink
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.textAlign = 'center'
  const bodyTop = MARGIN + 336 + 230 + 56
  const lines = wrapText(ctx, model.caption, W - MARGIN * 2 - 24)
  let ty = bodyTop
  for (const line of lines) {
    ctx.fillText(line, W / 2, ty)
    ty += 44
  }
  if (model.blockedTail) {
    ctx.fillStyle = PALETTE.inkSoft
    ctx.font = '400 22px system-ui, sans-serif'
    ctx.fillText(model.blockedTail, W / 2, ty + 8)
  }

  // Footer — date + source (metadata)
  ctx.fillStyle = PALETTE.inkSoft
  ctx.font = '500 20px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(model.footer, W / 2, H - MARGIN - 8)
}

// Render the card to a PNG Blob (client-side only). Throws in non-DOM envs.
export function renderDailyCard(input = {}) {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('renderDailyCard requires a DOM (client-side only)'))
  }
  const model = buildCardModel(input)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  drawCard(ctx, model)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

// Feature-detected share: Web Share (with file) → download fallback. Never throws on
// an unsupported environment; always resolves to the path taken for testability.
export async function shareOrDownloadCard(blob, filename, shareMeta = {}) {
  const file = (typeof File !== 'undefined') ? new File([blob], filename, { type: 'image/png' }) : null
  if (file && typeof navigator !== 'undefined' && navigator.canShare && navigator.share
      && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareMeta.title, text: shareMeta.text })
      return 'shared'
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled'
      // fall through to download on any share failure
    }
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}

function downloadBlob(blob, filename) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const __CARD_DIMS__ = { W, H }
