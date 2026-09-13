import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  RULES, SCENE, SIGNS, CARD, contrastRatio, mixOver, parseHex,
} from '../src/systems/officePalette.js'
import { STATUS_COLORS } from '../src/systems/constants.js'

// The palette rules (see the header of src/systems/officePalette.js). Every rule is a function that
// returns human-readable violations for ANY palette or source text, and every rule is asserted below
// to fail on a real past bad value — a rule that cannot fail is not a rule.

const root = process.cwd()
const readSrc = (...p) => readFileSync(join(root, ...p), 'utf-8')
const fmt = (n) => n.toFixed(2)

const ROLE_COLORS = [...new Set(
  [...readSrc('src', 'config', 'characters.json').matchAll(/"color"\s*:\s*"(#[0-9A-Fa-f]{3,6})"/g)].map((m) => m[1]),
)]
// AgentInspector falls back to this when an agent has no colour.
const ROLE_FALLBACK = '#888'

// ── JSX helpers: brace-aware, so `onClick={() => x}` or `a > b` inside an attribute does not end a tag ──
function stripComments(src) {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function openingTags(src, names) {
  const tags = []
  const re = new RegExp(`<(${names.join('|')})\\b`, 'g')
  let m
  while ((m = re.exec(src))) {
    let depth = 0
    let i = m.index + m[0].length
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    tags.push({ name: m[1], start: m.index, end: i, text: src.slice(m.index, i + 1) })
  }
  return tags
}

// ── Rules ──
function statusHueViolations(scene) {
  const floor = scene.floors.mainOffice
  return Object.entries(STATUS_COLORS)
    .map(([status, color]) => ({ status, color, ratio: contrastRatio(color, floor) }))
    .filter((r) => r.ratio < RULES.minStatusHueContrast)
    .map((r) => `R1: status colour "${r.status}" (${r.color}) is ${fmt(r.ratio)}:1 against the main floor ${floor}; ` +
      `needs >= ${RULES.minStatusHueContrast}:1. Adjust SCENE.floors.mainOffice — never STATUS_COLORS.`)
}

function wallViolations(scene) {
  return Object.entries(scene.floors)
    .map(([room, floor]) => ({ room, floor, ratio: contrastRatio(scene.wallFace, floor) }))
    .filter((r) => r.ratio < RULES.minWallContrast)
    .map((r) => `R2: wallFace ${scene.wallFace} is ${fmt(r.ratio)}:1 against the ${r.room} floor ${r.floor}; ` +
      `needs >= ${RULES.minWallContrast}:1 or the rooms stop reading as separate.`)
}

function cardViolations(card, roleColors) {
  const out = []
  for (const [name, color] of [['ink', card.ink], ['mutedInk', card.mutedInk]]) {
    const ratio = contrastRatio(color, card.paper)
    if (ratio < RULES.minTextContrast) {
      out.push(`R3: CARD.${name} ${color} is ${fmt(ratio)}:1 on paper ${card.paper}; needs >= ${RULES.minTextContrast}:1.`)
    }
  }
  for (const role of roleColors) {
    const header = mixOver(role, card.paper, card.headerTintOpacity)
    const name = contrastRatio(card.ink, header)
    if (name < RULES.minTextContrast) {
      out.push(`R3: the name (CARD.ink) is ${fmt(name)}:1 over the ${role} header tint; needs >= ${RULES.minTextContrast}:1. Lower CARD.headerTintOpacity.`)
    }
    const close = contrastRatio(card.mutedInk, header)
    if (close < RULES.minIconContrast) {
      out.push(`R3: the close icon (CARD.mutedInk) is ${fmt(close)}:1 over the ${role} header tint; needs >= ${RULES.minIconContrast}:1.`)
    }
  }
  return out
}

const normHex = (h) => {
  const x = h.replace('#', '').toLowerCase()
  return '#' + (x.length === 3 ? x.split('').map((c) => c + c).join('') : x)
}
const STATUS_HEXES = new Set(Object.values(STATUS_COLORS).map(normHex))

function statusTextViolations(inspectorSrc) {
  const out = []
  if (/STATUS_COLORS\s+as\s+\w+/.test(inspectorSrc)) {
    out.push('R4: STATUS_COLORS is imported under another name — keep the name so this rule can see every use.')
  }
  const src = stripComments(inspectorSrc).replace(/^import .*$/gm, '')
  for (const tag of openingTags(src, ['text', 'tspan'])) {
    for (const h of tag.text.match(/#[0-9A-Fa-f]{6}(?![0-9A-Fa-f])|#[0-9A-Fa-f]{3}(?![0-9A-Fa-f])/g) || []) {
      if (STATUS_HEXES.has(normHex(h))) out.push(`R4: <${tag.name}> uses status colour ${h} as a literal text colour.`)
    }
  }
  const circles = openingTags(src, ['circle'])
  for (const m of src.matchAll(/STATUS_COLORS/g)) {
    const inCircle = circles.some((t) => m.index > t.start && m.index < t.end)
    if (!inCircle) {
      const line = src.slice(0, m.index).split('\n').length
      out.push(`R4: STATUS_COLORS used outside the status dot <circle> (stripped-source line ${line}); ` +
        'status colours are not readable as text — keep text in CARD.ink / CARD.mutedInk.')
    }
  }
  return out
}

function literalViolations(src, file, tokenHexes) {
  const literals = (src.match(/#[0-9A-Fa-f]{6}(?![0-9A-Fa-f])/g) || []).map((h) => h.toLowerCase())
  return [...new Set(literals.filter((h) => tokenHexes.has(h)))]
    .map((h) => `R5: ${file} repeats palette colour ${h} as a literal — use the officePalette token.`)
}

function shellFillViolations(pixelOfficeSrc) {
  const start = pixelOfficeSrc.indexOf('═══ BACKGROUND ═══')
  const end = pixelOfficeSrc.indexOf('═══ ENTRANCE ═══')
  if (start < 0 || end < 0) return ['R5: room-shell markers (═══ BACKGROUND ═══ … ═══ ENTRANCE ═══) not found in PixelOffice.jsx']
  return openingTags(pixelOfficeSrc.slice(start, end), ['rect'])
    // Any quoted colour (except none/transparent) or a string literal inside a JSX expression.
    .filter((t) => /\bfill="(?!none"|transparent")[^"]*"|\bfill=\{\s*['"`]/.test(t.text))
    .map((t) => `R5: room-shell rect with a literal fill: ${t.text.replace(/\s+/g, ' ')} — use a SCENE token.`)
}

const TOKEN_HEXES = (() => {
  const set = new Set()
  const collect = (obj) => {
    for (const v of Object.values(obj)) {
      if (typeof v === 'string' && v.startsWith('#')) set.add(v.toLowerCase())
      else if (v && typeof v === 'object') collect(v)
    }
  }
  collect(SCENE); collect(SIGNS); collect(CARD)
  return set
})()

describe('office palette — helpers', () => {
  it('contrast matches known WCAG values', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#777', '#fff')).toBeCloseTo(4.48, 2)
  })

  it('rejects a colour it cannot parse instead of silently scoring it', () => {
    expect(() => parseHex('rebeccapurple')).toThrow(/not a #rgb/)
  })

  it('reads every role colour from characters.json (so a new role is covered automatically)', () => {
    expect(ROLE_COLORS.length).toBeGreaterThanOrEqual(8)
  })

  it('the JSX tag scanner is not fooled by `=>` or `>` inside an attribute', () => {
    const [tag] = openingTags('<text onClick={() => go(a > b)} fill={X}>hi</text>', ['text'])
    expect(tag.text).toBe('<text onClick={() => go(a > b)} fill={X}>')
  })
})

describe('office palette — rules hold for the shipped palette and source', () => {
  it('R1: no status colour is camouflaged by the main floor', () => {
    expect(statusHueViolations(SCENE)).toEqual([])
  })

  it('R2: walls separate every room they border', () => {
    expect(wallViolations(SCENE)).toEqual([])
  })

  it('R3: card text and the close icon are readable, over every role header tint too', () => {
    expect(cardViolations(CARD, [...ROLE_COLORS, ROLE_FALLBACK])).toEqual([])
  })

  it('R4: the inspector uses STATUS_COLORS only on the status dot', () => {
    const src = readSrc('src', 'components', 'AgentInspector.jsx')
    expect(statusTextViolations(src)).toEqual([])
    expect(src).toMatch(/<circle\b[^>]*fill=\{STATUS_COLORS\[status\]/)
  })

  it('R5: no palette literal in the components, no literal fill in the room shell', () => {
    for (const file of ['PixelOffice.jsx', 'AgentInspector.jsx']) {
      expect(literalViolations(readSrc('src', 'components', file), file, TOKEN_HEXES)).toEqual([])
    }
    expect(shellFillViolations(readSrc('src', 'components', 'PixelOffice.jsx'))).toEqual([])
  })
})

describe('office palette — each rule bites on a real past bad value', () => {
  it('R1 flags the old #C8A878 floor, where working amber sat at 1.04:1', () => {
    const v = statusHueViolations({ ...SCENE, floors: { ...SCENE.floors, mainOffice: '#C8A878' } })
    expect(v.some((m) => m.includes('"working"'))).toBe(true)
  })

  it('R2 flags the rejected #A39C89 wall, which vanished against the research floor', () => {
    expect(wallViolations({ ...SCENE, wallFace: '#A39C89' }).some((m) => m.includes('research'))).toBe(true)
  })

  it('R3 flags a status colour used as card text, and a header tint too strong for the name or icon', () => {
    expect(cardViolations({ ...CARD, mutedInk: STATUS_COLORS.working }, [])).toHaveLength(1)
    const strong = cardViolations({ ...CARD, headerTintOpacity: 0.9 }, ROLE_COLORS)
    expect(strong.some((m) => m.includes('the name'))).toBe(true)
    expect(strong.some((m) => m.includes('close icon'))).toBe(true)
  })

  it('R4 flags the pre-palette status line, and an alias that smuggles the colour into text', () => {
    // Verbatim from AgentInspector.jsx before this change (0ce9c46^).
    const before = `<circle cx={12} cy={42} r={5} fill={STATUS_COLORS[status] || color || '#888'} />
        <text x={22} y={45} fontSize="10" fontFamily="monospace" fill={STATUS_COLORS[status] || color || '#888'} fontWeight="bold">`
    // Two hits, both real: STATUS_COLORS outside the dot, and the '#888' fallback (= idle's colour) as text.
    const hits = statusTextViolations(before)
    expect(hits.some((m) => m.includes('outside the status dot'))).toBe(true)
    expect(hits.some((m) => m.includes('#888'))).toBe(true)
    const alias = `const tone = STATUS_COLORS[status]\n<text onClick={() => close()} fill={tone}>x</text>`
    expect(statusTextViolations(alias)).toHaveLength(1)
    const renamed = "import { STATUS_COLORS as SC } from '../systems/store'\n<text fill={SC[s]}>x</text>"
    expect(statusTextViolations(renamed).length).toBeGreaterThan(0)
    expect(statusTextViolations('<text fill="#EF9F27">Working</text>')).toHaveLength(1)
  })

  it('R5 flags the pre-palette door literal, and a near-miss hex a token check alone would miss', () => {
    const shell = (rect) => `{/* ═══ BACKGROUND ═══ */}\n${rect}\n{/* ═══ ENTRANCE ═══ */}`
    // Verbatim from PixelOffice.jsx before this change (0ce9c46^).
    const doorBefore = '<rect x="598" y="185" width="25" height="50" fill="#9898B0" />'
    expect(literalViolations(doorBefore, 'PixelOffice.jsx', TOKEN_HEXES)).toHaveLength(1)
    expect(shellFillViolations(shell(doorBefore))).toHaveLength(1)
    expect(shellFillViolations(shell('<rect x="598" y="185" width="25" height="50" fill="#9898B1" />'))).toHaveLength(1)
    expect(shellFillViolations(shell(`<rect x="598" y="185" fill={'#9898B1'} />`))).toHaveLength(1)
    expect(shellFillViolations(shell('<rect width="800" height="560" fill={SCENE.background} />'))).toEqual([])
  })
})
