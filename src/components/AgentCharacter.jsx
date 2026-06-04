import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useOfficeStore, STATUS_COLORS } from '../systems/store.js'
import { getNextBehavior } from '../systems/behaviorEngine'
import { getTargetForBehavior, calcFacing, calculatePath, needsLocationChange, HOME_POSITIONS } from '../systems/movementSystem'
import { eventBubble, charName, useLocale } from '../i18n'
import { WALK_SPEED, WALK_FRAME_INTERVAL, BEHAVIOR_STUCK_RETRIES, BEHAVIOR_STUCK_RETRY_MS, WATCHDOG_INTERVAL, WATCHDOG_TIMEOUT } from '../systems/constants.js'
import BehaviorBubble from './BehaviorBubble'

// ═══ PIXEL ART SPRITE SYSTEM ═══
// Each sprite = grid of colored pixels (like RPG Maker / Stardew Valley)
// Grid: 16 wide × 20 tall, each pixel = 2×2 SVG units → 32×40 total
const PX = 2  // pixel size in SVG units
const GRID_W = 16
const GRID_H = 20

// Transparent = null, otherwise hex color string
// Sprites drawn top-down 3/4 view (big chibi head, small body)

// ─── Base sprite templates ──────────────────────────────────────────────
// '_' = transparent, 'S' = skin, 'H' = hair, 'C' = clothes, 'E' = eye,
// 'P' = pants/shoes, 'W' = white highlight, 'M' = mouth, 'B' = blush

const SKIN = '#FFE0C0'
const SKIN_SHADOW = '#F0C8A0'
const PANTS = '#3a3a5a'
const SHOES = '#2a2a3a'
const EYE = '#1a1a2a'
const WHITE = '#FFFFFF'
const MOUTH = '#C08060'
const BLUSH = '#FFB6C1'

// Base character facing down (idle frame 0)
// Row by row: 0=top of head ... 19=feet

function getBaseSprite(hairColor, clothesColor, hairStyle, gender = 'male') {
  // Start with empty grid
  const grid = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(null))

  // ── Hair top (rows 0-3) ──
  const hc = hairColor
  const hd = darken(hairColor, 30) // darker shade

  if (hairStyle === 'twin-tails') {
    // Twin tail puffs on sides — longer tails for female
    setPixels(grid, 0, [,,,,, hc, hc, hc, hc, hc, hc])
    setPixels(grid, 1, [,,,, hc, hc, hc, hc, hc, hc, hc])
    setPixels(grid, 2, [, hc, hc,, hc, hd, hc, hc, hc, hd, hc,, hc, hc])
    setPixels(grid, 3, [, hc, hc, hc, hc, hc, hc, hc, hc, hc, hc, hc, hc, hc])
    if (gender === 'female') {
      // Longer twin tails hanging down
      setPixels(grid, 4, [hc, hc,,,,,,,,,,,,, hc, hc])
      setPixels(grid, 5, [hc, hc,,,,,,,,,,,,, hc, hc])
    }
  } else if (hairStyle === 'hard-hat') {
    const hat = '#F5A623'
    const hatD = '#E09520'
    setPixels(grid, 0, [,,,,, hat, hat, hat, hat, hat, hat])
    setPixels(grid, 1, [,,,, hat, hat, hat, hat, hat, hat, hat])
    setPixels(grid, 2, [,,, hat, hat, hat, hat, hat, hat, hat, hat, hat])
    setPixels(grid, 3, [,, hatD, hatD, hatD, hatD, hatD, hatD, hatD, hatD, hatD, hatD, hatD])
  } else if (hairStyle === 'beret') {
    const beret = '#6a5aaa'
    setPixels(grid, 0, [,,,, beret, beret, beret, beret, beret, beret, beret])
    setPixels(grid, 1, [,,, beret, beret, beret, beret, beret, beret, beret, beret, beret])
    setPixels(grid, 2, [,,, beret, beret, hc, hc, hc, hc, hc, hc, beret])
    setPixels(grid, 3, [,,,, hc, hc, hd, hc, hc, hd, hc, hc])
  } else if (hairStyle === 'long') {
    // Long flowing hair for female characters
    setPixels(grid, 0, [,,,,, hc, hc, hc, hc, hc, hc])
    setPixels(grid, 1, [,,,, hc, hc, hc, hc, hc, hc, hc])
    setPixels(grid, 2, [,,, hc, hc, hd, hc, hc, hc, hd, hc, hc])
    setPixels(grid, 3, [,,, hc, hc, hc, hc, hc, hc, hc, hc, hc])
    // Hair flowing down sides
    setPixels(grid, 4, [,,, hc,,,,,,,,, hc])
    setPixels(grid, 5, [,,, hc,,,,,,,,, hc])
    setPixels(grid, 6, [,,, hc,,,,,,,,, hc])
  } else if (hairStyle === 'bangs') {
    setPixels(grid, 0, [,,,,, hc, hc, hc, hc, hc, hc])
    setPixels(grid, 1, [,,,, hc, hc, hc, hc, hc, hc, hc])
    setPixels(grid, 2, [,,,, hc, hd, hc, hd, hc, hd, hc])
    setPixels(grid, 3, [,,,, hc, hc, hc, hc, hc, hc, hc])
    if (gender === 'female') {
      // Side bangs flowing down
      setPixels(grid, 4, [,,, hc,,,,,,,,, hc])
      setPixels(grid, 5, [,,, hc,,,,,,,,,])
    }
  } else if (hairStyle === 'spiky') {
    setPixels(grid, 0, [,,,, hc,,, hc,,, hc])
    setPixels(grid, 1, [,,, hc, hc, hc, hc, hc, hc, hc, hc, hc])
    setPixels(grid, 2, [,,,, hc, hd, hc, hc, hc, hd, hc])
    setPixels(grid, 3, [,,,, hc, hc, hc, hc, hc, hc, hc])
  } else { // neat / default
    setPixels(grid, 0, [,,,,, hc, hc, hc, hc, hc, hc])
    setPixels(grid, 1, [,,,, hc, hc, hc, hc, hc, hc, hc])
    setPixels(grid, 2, [,,,, hc, hd, hc, hc, hc, hd, hc])
    setPixels(grid, 3, [,,,, hc, hc, hc, hc, hc, hc, hc])
  }

  // ── Face (rows 4-8) ──
  const sk = SKIN
  const sd = SKIN_SHADOW
  // Hair pixels from above may already occupy row 4-6, setPixels won't overwrite null→null
  // but we need to set face pixels (they'll overwrite only where needed)
  setPixels(grid, 4,  [,,,, sk, sk, sk, sk, sk, sk, sk, sk])
  setPixels(grid, 5,  [,,, sk, sk, sk, sk, sk, sk, sk, sk, sk, sk])
  // Eyes row — female gets slightly bigger/rounder eyes with eyelashes
  if (gender === 'female') {
    setPixels(grid, 6, [,,, sk, sk, EYE, WHITE, sk, sk, EYE, WHITE, sk, sk])
    // Eyelashes
    setPixels(grid, 5, [,,,,, EYE,,,,,EYE])
    setPixels(grid, 7, [,,, sk, BLUSH, sk, sk, sk, sk, sk, sk, BLUSH, sk])
    // Small cute mouth
    setPixels(grid, 8, [,,,, sk, sk, sk, '#F08080', sk, sk, sk, sk])
  } else {
    setPixels(grid, 6, [,,, sk, sk, EYE, WHITE, sk, sk, EYE, WHITE, sk, sk])
    setPixels(grid, 7, [,,, sk, BLUSH, sk, sk, sk, sk, sk, sk, BLUSH, sk])
    setPixels(grid, 8, [,,,, sk, sk, sk, MOUTH, MOUTH, sk, sk, sk])
  }
  // Chin
  setPixels(grid, 9, [,,,,, sd, sk, sk, sk, sk, sd])

  // ── Body (rows 10-14) ──
  const cc = clothesColor
  const cd = darken(clothesColor, 25)
  // Neck
  setPixels(grid, 10, [,,,,,,, sk, sk])

  if (gender === 'female') {
    // Slimmer shoulders, fitted top
    setPixels(grid, 11, [,,,,, cc, cc, cc, cc, cc, cc])
    setPixels(grid, 12, [,,,,, cc, cd, cc, cc, cd, cc])
    setPixels(grid, 13, [,,,,, cc, cc, cc, cc, cc, cc])
    // Skirt (A-line shape, wider at bottom)
    const sc = darken(clothesColor, 10)
    setPixels(grid, 14, [,,,, sc, sc, sc, sc, sc, sc, sc, sc])
    setPixels(grid, 15, [,,, sc, sc, sc, sc, sc, sc, sc, sc, sc, sc])
    // Legs visible below skirt
    setPixels(grid, 16, [,,,,, sk, sk,,, sk, sk])
    setPixels(grid, 17, [,,,,, SHOES, SHOES,,, SHOES, SHOES])
  } else {
    // Shoulders + shirt
    setPixels(grid, 11, [,,,, sk, cc, cc, cc, cc, cc, cc, sk])
    setPixels(grid, 12, [,,,, sk, cc, cd, cc, cc, cd, cc, sk])
    setPixels(grid, 13, [,,,,, cc, cc, cc, cc, cc, cc])
    setPixels(grid, 14, [,,,,, cc, cc, cc, cc, cc, cc])
    // ── Legs (rows 15-17) ──
    setPixels(grid, 15, [,,,,,, PANTS, PANTS, PANTS, PANTS])
    setPixels(grid, 16, [,,,,,, PANTS,,, PANTS])
    setPixels(grid, 17, [,,,,, SHOES, SHOES,,, SHOES, SHOES])
  }

  return grid
}

// Walk frame 1: left leg forward
function getWalkFrame1(base, gender = 'male') {
  const grid = base.map(row => [...row])
  if (gender === 'female') {
    // Keep skirt, just move feet
    clearRow(grid, 16); clearRow(grid, 17)
    setPixels(grid, 16, [,,,, SKIN,,,,, SKIN])
    setPixels(grid, 17, [,,, SHOES, SHOES,,,, SHOES, SHOES])
  } else {
    clearRow(grid, 15); clearRow(grid, 16); clearRow(grid, 17)
    setPixels(grid, 15, [,,,,, PANTS, PANTS,,,, PANTS])
    setPixels(grid, 16, [,,,, SHOES, SHOES,,,, PANTS])
    setPixels(grid, 17, [,,,,,,,,, SHOES, SHOES])
  }
  return grid
}

// Walk frame 2: right leg forward
function getWalkFrame2(base, gender = 'male') {
  const grid = base.map(row => [...row])
  if (gender === 'female') {
    clearRow(grid, 16); clearRow(grid, 17)
    setPixels(grid, 16, [,,,,, SKIN,,,, SKIN])
    setPixels(grid, 17, [,,,, SHOES, SHOES,,, SHOES, SHOES])
  } else {
    clearRow(grid, 15); clearRow(grid, 16); clearRow(grid, 17)
    setPixels(grid, 15, [,,,,, PANTS,,,, PANTS, PANTS])
    setPixels(grid, 16, [,,,,, PANTS,,,, SHOES, SHOES])
    setPixels(grid, 17, [,,,,, SHOES, SHOES])
  }
  return grid
}

// ─── Helper functions ──────────────────────────────────────────────────
function setPixels(grid, row, pixels) {
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] != null) grid[row][i] = pixels[i]
  }
}

function clearRow(grid, row) {
  for (let i = 0; i < grid[row].length; i++) grid[row][i] = null
}

const _darkenCache = new Map()
function darken(hex, amount) {
  const key = `${hex}:${amount}`
  if (_darkenCache.has(key)) return _darkenCache.get(key)
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  const result = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
  _darkenCache.set(key, result)
  return result
}

// ─── Character configs ──────────────────────────────────────────────────
const CHAR_STYLES = {
  pm:      { hair: '#3a2a1a', hairStyle: 'neat',       clothes: '#378ADD', gender: 'male' },
  arch:    { hair: '#5a4a8a', hairStyle: 'beret',      clothes: '#7F77DD', gender: 'male' },
  dev:     { hair: '#2a5a3a', hairStyle: 'twin-tails', clothes: '#1D9E75', gender: 'female' },
  qa:      { hair: '#5a4a3a', hairStyle: 'neat',       clothes: '#BA7517', gender: 'male' },
  ops:     { hair: '#4a3a2a', hairStyle: 'hard-hat',   clothes: '#D85A30', gender: 'male' },
  res:     { hair: '#3a7a6a', hairStyle: 'long',       clothes: '#5DCAA5', gender: 'female' },
  gate:    { hair: '#2a1a1a', hairStyle: 'spiky',      clothes: '#E24B4A', gender: 'male' },
  planner:  { hair: '#3a2a1a', hairStyle: 'neat',       clothes: '#378ADD', gender: 'male' },
  worker:   { hair: '#2a5a3a', hairStyle: 'bangs',      clothes: '#1D9E75', gender: 'female' },
  checker:  { hair: '#5a4a3a', hairStyle: 'neat',       clothes: '#BA7517', gender: 'male' },
  designer: { hair: '#4a1a2a', hairStyle: 'long',       clothes: '#E8688A', gender: 'female' },
}

// ─── Expression modifiers ──────────────────────────────────────────────
function applyExpression(grid, expression) {
  const g = grid.map(row => [...row])
  // Modify eye/mouth rows (6, 7, 8)
  switch (expression) {
    case 'happy': {
      // Closed happy eyes (^_^)
      g[6][5] = SKIN; g[6][6] = SKIN; g[6][9] = SKIN; g[6][10] = SKIN
      // Draw ^ shapes with darker color
      g[5][5] = EYE; g[5][6] = null; g[5][9] = EYE; g[5][10] = null
      g[6][5] = null; g[6][6] = EYE; g[6][9] = null; g[6][10] = EYE
      // Smile
      g[8][6] = SKIN; g[8][7] = '#F08080'; g[8][8] = '#F08080'; g[8][9] = SKIN
      break
    }
    case 'sleepy': {
      // Closed line eyes
      g[6][5] = SKIN; g[6][6] = SKIN; g[6][9] = SKIN; g[6][10] = SKIN
      g[6][5] = EYE; g[6][6] = EYE; g[6][9] = EYE; g[6][10] = EYE
      g[8][7] = SKIN; g[8][8] = SKIN  // no mouth
      break
    }
    case 'focused': {
      // Smaller intense eyes
      g[6][5] = EYE; g[6][6] = EYE; g[6][9] = EYE; g[6][10] = EYE
      g[7][7] = BLUSH; // no blush, tense
      g[7][10] = BLUSH
      break
    }
    case 'surprised': {
      // Big round eyes
      g[5][5] = EYE; g[5][9] = EYE
      g[6][5] = EYE; g[6][6] = WHITE; g[6][9] = EYE; g[6][10] = WHITE
      // O mouth
      g[8][7] = '#F08080'; g[8][8] = '#F08080'
      break
    }
    case 'tired': {
      // Half-closed eyes
      g[6][5] = SKIN; g[6][6] = EYE; g[6][9] = SKIN; g[6][10] = EYE
      // Wavy mouth
      g[8][7] = MOUTH; g[8][8] = SKIN
      break
    }
    case 'confused': {
      // One eye bigger
      g[6][5] = EYE; g[6][6] = WHITE
      g[6][9] = EYE; g[6][10] = EYE  // squinting
      g[8][7] = MOUTH; g[8][8] = MOUTH
      break
    }
    // 'normal' = default, no changes
  }
  return g
}

// ─── Pixel Grid Renderer ──────────────────────────────────────────────
function PixelSprite({ grid, flipX = false, scale = 1 }) {
  const rects = useMemo(() => {
    const result = []
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const color = grid[y]?.[x]
        if (!color) continue
        const px = flipX ? (GRID_W - 1 - x) * PX : x * PX
        result.push(
          <rect
            key={`${x}-${y}`}
            x={px}
            y={y * PX}
            width={PX}
            height={PX}
            fill={color}
          />
        )
      }
    }
    return result
  }, [grid, flipX])

  const w = GRID_W * PX
  const h = GRID_H * PX

  return (
    <g transform={`translate(${-w/2 * scale}, ${-h * scale}) scale(${scale})`}>
      {rects}
    </g>
  )
}

// ─── Full Sprite with shadow ──────────────────────────────────────────
// React.memo: AgentCharacter re-renders ~30fps while the character walks (setRenderPos
// fires every other RAF frame). Of CharacterPixelSprite's five props only walkFrame
// (250ms cadence) and isMoving change during a walk — charId/expression/facing are
// stable. Memo elides the component invocation (and its baseRole string-split +
// CHAR_STYLES lookup) on the ~28-of-30 frames per second where no prop changed; the
// inner useMemos only guarded the sprite-grid generation, not the function body itself.
export const CharacterPixelSprite = React.memo(function CharacterPixelSprite({ charId, expression, isMoving, walkFrame, facing }) {
  // Strip session prefix for style lookup: "feat-x~dev" → use dev's style
  const baseRole = charId.includes('~') ? charId.split('~').pop() : charId
  const style = CHAR_STYLES[charId] || CHAR_STYLES[baseRole] || CHAR_STYLES.pm
  const gender = style.gender || 'male'

  const sprites = useMemo(() => {
    const base = getBaseSprite(style.hair, style.clothes, style.hairStyle, gender)
    return {
      idle: base,
      walk1: getWalkFrame1(base, gender),
      walk2: getWalkFrame2(base, gender),
    }
  }, [style.hair, style.clothes, style.hairStyle, gender])

  const grid = useMemo(() => {
    const base = isMoving ? (walkFrame ? sprites.walk2 : sprites.walk1) : sprites.idle
    return applyExpression(base, expression)
  }, [isMoving, walkFrame, sprites, expression])

  const flipX = facing === 'left'

  return (
    <g>
      {/* Shadow */}
      <ellipse cx={0} cy={1} rx={10} ry={3} fill="rgba(0,0,0,0.15)" />
      <PixelSprite grid={grid} flipX={flipX} scale={1} />
    </g>
  )
})

// ═══ BEHAVIOR INDICATOR ICONS ═══
// Small pixel-art icons that appear next to the character based on current behavior
// React.memo: AgentCharacter re-renders on every useLocale / reducedMotion / agentState
// change. BehaviorIndicator's only prop is `behavior` (a stable string) — memo prevents a
// parent-triggered re-render when the behavior is unchanged. Its own 600ms `frame` interval
// still drives the icon animation independently.
const BehaviorIndicator = React.memo(function BehaviorIndicator({ behavior }) {
  const [frame, setFrame] = useState(0)
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)

  useEffect(() => {
    // Animate indicator every 600ms
    const iv = reducedMotion ? null : setInterval(() => setFrame(f => (f + 1) % 4), 600)
    return () => { if (iv) clearInterval(iv) }
  }, [reducedMotion])

  // Position: to the right of character
  const ox = 14, oy = -8

  switch (behavior) {
    case 'typing': {
      // Tiny keyboard with blinking cursor
      const cursorOn = frame % 2 === 0
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={4} width={8} height={4} rx={0.5} fill="#555" />
          <rect x={1} y={5} width={1} height={1} fill="#8f8" />
          <rect x={3} y={5} width={1} height={1} fill="#8f8" />
          <rect x={5} y={5} width={1} height={1} fill="#8f8" />
          {cursorOn && <rect x={6} y={2} width={1} height={2} fill="#5f5" />}
        </g>
      )
    }
    case 'reading-screen': {
      // Small document with scanning line
      const scanY = frame
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={0} width={7} height={9} rx={0.5} fill="#fff" stroke="#aaa" strokeWidth={0.3} />
          <rect x={1} y={1} width={5} height={0.8} fill="#ccc" />
          <rect x={1} y={3} width={4} height={0.8} fill="#ccc" />
          <rect x={1} y={5} width={5} height={0.8} fill="#ccc" />
          <rect x={1} y={7} width={3} height={0.8} fill="#ccc" />
          <rect x={0} y={scanY * 2} width={7} height={1} fill="#378ADD" opacity={0.3} />
        </g>
      )
    }
    case 'writing-notes': {
      // Pencil with writing motion
      const dx = frame % 2
      return (
        <g transform={`translate(${ox + dx}, ${oy})`}>
          <line x1={0} y1={8} x2={5} y2={2} stroke="#E8A830" strokeWidth={1.5} />
          <line x1={5} y1={2} x2={6} y2={1} stroke="#F5C860" strokeWidth={1} />
          <circle cx={0} cy={8} r={0.5} fill="#333" />
        </g>
      )
    }
    case 'research': {
      // Magnifier glass
      const bob = frame % 2
      return (
        <g transform={`translate(${ox}, ${oy + bob})`}>
          <circle cx={3} cy={3} r={3} fill="none" stroke="#5DCAA5" strokeWidth={0.8} />
          <circle cx={3} cy={3} r={2} fill="rgba(93,202,165,0.15)" />
          <line x1={5} y1={5} x2={7} y2={7} stroke="#5DCAA5" strokeWidth={1} />
        </g>
      )
    }
    case 'gantt-chart': {
      // Mini chart bars
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={6} width={3 + (frame % 2)} height={2} fill="#378ADD" rx={0.3} />
          <rect x={0} y={3} width={5} height={2} fill="#5CB88A" rx={0.3} />
          <rect x={0} y={0} width={4 + (frame % 3)} height={2} fill="#EF9F27" rx={0.3} />
        </g>
      )
    }
    case 'magnifier': {
      // QA magnifier with checkmark
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <circle cx={3} cy={3} r={3} fill="none" stroke="#BA7517" strokeWidth={0.8} />
          <line x1={5} y1={5} x2={7} y2={7} stroke="#BA7517" strokeWidth={1} />
          {frame % 2 === 0 && (
            <polyline points="1.5,3 2.5,4 4.5,1.5" fill="none" stroke="#5CB88A" strokeWidth={0.6} />
          )}
        </g>
      )
    }
    case 'shield-verify': {
      // Shield icon
      const glow = frame % 2 === 0 ? 0.8 : 0.4
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <path d="M3,0 L6,2 L6,5 L3,7 L0,5 L0,2 Z" fill="#E24B4A" opacity={glow} />
          <text x={3} y={4.5} textAnchor="middle" dominantBaseline="middle" fontSize="4" fill="white">✓</text>
        </g>
      )
    }
    case 'deploy-button': {
      // Deploy/rocket
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={1} y={2} width={5} height={5} rx={1} fill="#D85A30" />
          <circle cx={3.5} cy={4.5} r={1.5} fill={frame % 2 === 0 ? '#5f5' : '#3a3'} />
        </g>
      )
    }
    case 'drink-coffee':
    case 'goto-coffee-machine': {
      // Coffee cup with steam
      const steamH = frame % 2 === 0 ? -2 : -3
      return (
        <g transform={`translate(${ox}, ${oy + 2})`}>
          <rect x={0} y={2} width={5} height={5} rx={0.5} fill="#8B6914" />
          <rect x={1} y={3} width={3} height={2} fill="#4A2800" />
          <line x1={1.5} y1={steamH + 2} x2={1.5} y2={1} stroke="#ccc" strokeWidth={0.4} opacity={0.6} />
          <line x1={3.5} y1={steamH + 2.5} x2={3.5} y2={1} stroke="#ccc" strokeWidth={0.4} opacity={0.6} />
        </g>
      )
    }
    case 'whiteboard': {
      // Mini whiteboard with marker
      const mx = frame % 3
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={0} width={8} height={7} rx={0.5} fill="#fff" stroke="#888" strokeWidth={0.3} />
          <line x1={1 + mx} y1={2} x2={4 + mx} y2={2} stroke="#378ADD" strokeWidth={0.6} />
          <line x1={1} y1={4} x2={5} y2={4} stroke="#E24B4A" strokeWidth={0.6} />
        </g>
      )
    }
    case 'meeting': {
      // Speech bubbles (meeting)
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={0} width={5} height={4} rx={1} fill="#378ADD" opacity={frame % 2 === 0 ? 0.8 : 0.4} />
          <rect x={3} y={3} width={5} height={4} rx={1} fill="#5CB88A" opacity={frame % 2 === 0 ? 0.4 : 0.8} />
        </g>
      )
    }
    case 'chat': {
      // Chat bubbles
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={0} width={6} height={4} rx={1} fill="#7F77DD" opacity={0.7} />
          <text x={3} y={2.8} textAnchor="middle" fontSize="3" fill="white">...</text>
        </g>
      )
    }
    case 'check-phone': {
      // Phone screen
      return (
        <g transform={`translate(${ox}, ${oy + 1})`}>
          <rect x={0} y={0} width={4} height={6} rx={0.5} fill="#333" />
          <rect x={0.5} y={0.5} width={3} height={4.5} fill={frame % 2 === 0 ? '#6af' : '#5ae'} />
        </g>
      )
    }
    case 'stretch': {
      // Stretch arms
      const armY = frame % 2 === 0 ? -1 : 0
      return (
        <g transform={`translate(${ox}, ${oy + armY})`}>
          <line x1={0} y1={4} x2={2} y2={1} stroke="#FFE0C0" strokeWidth={1} />
          <line x1={6} y1={4} x2={4} y2={1} stroke="#FFE0C0" strokeWidth={1} />
          <text x={3} y={8} textAnchor="middle" fontSize="4" fill="#5CB88A">~</text>
        </g>
      )
    }
    case 'nap': {
      // Zzz
      const zy = frame % 2 === 0 ? 0 : -1
      return (
        <g transform={`translate(${ox}, ${oy + zy})`}>
          <text x={0} y={3} fontSize="4" fill="#888" opacity={0.7}>z</text>
          <text x={3} y={1} fontSize="5" fill="#888" opacity={0.5}>Z</text>
          <text x={5} y={-1} fontSize="6" fill="#888" opacity={0.3}>Z</text>
        </g>
      )
    }
    case 'thumbs-up': {
      // Thumbs up
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <text x={3} y={6} textAnchor="middle" fontSize="7" fill="#EF9F27" opacity={frame % 2 === 0 ? 1 : 0.6}>👍</text>
        </g>
      )
    }
    case 'print': {
      // Printer icon
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={2} width={7} height={4} rx={0.5} fill="#888" />
          <rect x={1} y={0} width={5} height={3} fill="#fff" stroke="#aaa" strokeWidth={0.3} />
          {frame % 2 === 0 && <rect x={1} y={5} width={5} height={2} fill="#fff" />}
        </g>
      )
    }
    case 'scratch-head':
    case 'sigh':
    case 'desk-slam': {
      // Frustration marks
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <text x={3} y={4} textAnchor="middle" fontSize="6" fill="#E24B4A" opacity={frame % 2 === 0 ? 0.9 : 0.4}>💢</text>
        </g>
      )
    }
    case 'phone-call': {
      // Phone
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={1} y={0} width={3} height={6} rx={0.8} fill="#333" />
          <rect x={1.5} y={0.5} width={2} height={3.5} fill={frame % 2 === 0 ? '#5ae' : '#4ad'} />
        </g>
      )
    }
    default:
      return null
  }
})

// ─── Unicode-aware text width for monospace SVG ──────────────────────
// CJK chars ~10 units, ASCII ~7 units at fontSize 12 monospace
function estimateTextWidth(str) {
  let w = 0
  for (const ch of str) {
    w += ch.codePointAt(0) > 0x2E7F ? 10 : 7
  }
  return w
}

// ─── AVO-132: effort folded into the single working glow ring ───────────
// The old AVO-102 ThinkingAura was a SECOND concentric violet ring stacked on the working
// glow — ring-on-ring clutter on a 32px sprite. Instead, elevated effort (high/xhigh/max)
// now intensifies the ONE working glow ring (stronger peak opacity + thicker stroke), so a
// sprite never shows two rings. Normal/absent effort leaves the ring at its base intensity.
const EFFORT_GLOW = { high: { op: 0.7, sw: 2.5 }, xhigh: { op: 0.85, sw: 3 }, max: { op: 1, sw: 3.5 } }
const BASE_GLOW = { op: 0.5, sw: 2 }
// AVO-131: the in-scene TaskLabel tool pill (AVO-103) was removed — the exact tool now
// shows only in the AgentInspector (click-to-inspect). The classifier still backs the
// inspector's `inspectorTaskLabel`; nothing in the office scene renders the raw tool string.

// ─── POINT 2: counter-scale glance-text so it stays readable as the office shrinks ──────
// The office renders with `meet`, so when its on-screen scale (sceneScale) drops below 1 every
// label would shrink with it. The label group cancels the office shrink (×1/sceneScale) to hold
// a ~constant on-screen text size. sceneScale ≥ 1 (office at/above native) → factor 1 (labels
// ride the office up, already big enough; wide desktop is byte-identical).
//
// CAP = 1.5 is an overlap guard, NOT arbitrary. Desks are fixed coordinates (dev/ops are 120
// units apart; pm/designer too). On-screen agent separation AND pill size both scale with
// sceneScale, so in the capped region their ratio is constant: a name pill (~80 units for the
// widest name) stays narrower than the 120-unit gap as long as cap < 120/80 ≈ 1.5 → adjacent
// active agents' name tags never collide. At the threshold sceneScale = 1/1.5 ≈ 0.667 the net
// on-screen text reaches full size (1.0) right where the office is already spread enough to clear;
// below that the cap lets text shrink gently (still far larger than with no counter-scale at all).
// Empirically verified overlap-free with all 8 agents active across a 320–1280px sweep.
// Pure for unit testing.
export const LABEL_SCALE_MAX = 1.5
export function computeLabelScale(sceneScale, max = LABEL_SCALE_MAX) {
  if (!(sceneScale > 0)) return 1
  return Math.min(max, 1 / Math.min(sceneScale, 1))
}

// ═══ AGENT CHARACTER WITH RAF-BASED MOVEMENT ═══

function AgentCharacter({ agent }) {
  const { id, color } = agent
  useLocale() // re-render on language change
  const name = charName(id)
  const agentState = useOfficeStore((s) => s.agents[id])
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)
  // AVO-132: session effort level intensifies the working glow ring (folded in from the
  // removed ThinkingAura). Subscribe to just `effort` so we re-render only when it changes.
  const effort = useOfficeStore((s) => s.effort)
  // AVO-138: is THIS role currently supervising active subagent helpers? Role-scoped boolean →
  // referentially stable, re-renders only on a false<->true transition. When true, the lead
  // shows a calm 'supervising' state (steady halo + 👀) and the pulsing working ring is
  // suppressed — the helper huddle carries the live "work is happening" motion instead.
  const hasActiveHelper = useOfficeStore((s) => s.helpers.some((h) => h.parentRole === id))
  // POINT 2: counter-scale name/status/bubble labels by the office's live shrink factor so
  // glance-text stays readable when the office is docked small. Primitive subscription →
  // re-renders only when the scale actually changes (PixelOffice no-ops equal writes).
  const sceneScale = useOfficeStore((s) => s.sceneScale)
  const labelScale = computeLabelScale(sceneScale)
  // L3 reluctant-participant tell (transient expiry ts). Pure overlay — never affects behavior.
  const reluctantUntil = useOfficeStore((s) => s.reluctant?.[id])

  const timerRef = useRef(null)
  const pathRef = useRef([])
  const movingRef = useRef(false)
  const movingStuckRef = useRef(0)
  const pendingBehaviorRef = useRef(null) // deferred behavior for location-based actions
  const [walkFrame, setWalkFrame] = useState(0)
  // AVO-128: name tags are revealed only when an agent is active (working/blocked/
  // planning/done) or hovered, and hidden at rest — at idle, identity rides on the
  // sprite + color + desk position. `hovered` lets a desktop user pull up any name.
  const [hovered, setHovered] = useState(false)
  // Tracks every fire-and-forget setTimeout (bubble clears, handoff steps) so the
  // unmount cleanup can cancel them. Without this, a deferred clearBubble/handoff
  // callback fires up to ~4s after the component unmounts and mutates the store
  // against a torn-down character.
  const deferredTimersRef = useRef(new Set())
  const scheduleDeferred = useCallback((fn, ms) => {
    const handle = setTimeout(() => {
      deferredTimersRef.current.delete(handle)
      if (isUnmountedRef.current) return
      fn()
    }, ms)
    deferredTimersRef.current.add(handle)
    return handle
  }, [])

  // RAF-based smooth movement — only runs while walking
  const visualPosRef = useRef(null)
  const targetPosRef = useRef(null)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)
  const lastFrameWallTimeRef = useRef(0)
  const isUnmountedRef = useRef(false)
  const [renderPos, setRenderPos] = useState(null)
  const [isWalking, setIsWalking] = useState(false)
  const visualReady = renderPos !== null
  // Use refs for callbacks accessed inside RAF to avoid stale closures
  const onWaypointReachedRef = useRef(null)

  // Initialize visual position from agent's home position.
  // Depend on agentState's PRESENCE (a boolean), not the agentState object itself.
  // agentState is s.agents[id], whose identity changes on every mutation — behavior,
  // bubble, and ~30×/sec position updates while walking. The old `[agentState]` dep
  // therefore re-fired this effect on every walk frame, even though its body is a
  // one-shot guarded by `!visualPosRef.current` and does nothing after the first run.
  // The seed only needs to happen once, when the agent first appears (false→true),
  // so a presence boolean is the precise dependency.
  const agentPresent = !!agentState
  useEffect(() => {
    if (!agentState) return
    const home = agentState.position || { x: 300, y: 250 }
    if (!visualPosRef.current) {
      visualPosRef.current = { ...home }
      targetPosRef.current = { ...home }
      setRenderPos({ ...home })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentPresent])

  // Keep the rendered position aligned with authoritative store corrections when
  // the character is not actively walking. This makes external resets, deterministic
  // simulations, and restored persisted positions visible immediately after mount.
  useEffect(() => {
    if (!agentState?.position || isWalking || agentState.isMoving) return
    const next = agentState.position
    const current = visualPosRef.current
    if (current && Math.hypot(current.x - next.x, current.y - next.y) < 1) return
    visualPosRef.current = { ...next }
    targetPosRef.current = { ...(agentState.targetPosition || next) }
    setRenderPos({ ...next })
  }, [
    agentState?.position?.x,
    agentState?.position?.y,
    agentState?.targetPosition?.x,
    agentState?.targetPosition?.y,
    agentState?.isMoving,
    isWalking,
  ])

  // Walk animation timer (leg alternation)
  useEffect(() => {
    if (!isWalking) return
    const iv = reducedMotion ? null : setInterval(() => setWalkFrame((f) => 1 - f), WALK_FRAME_INTERVAL)
    return () => { if (iv) clearInterval(iv) }
  }, [isWalking, reducedMotion])

  // RAF animation loop — only active while walking, stops when arrived
  // Throttled to ~30fps React updates (physics still runs at 60fps for smooth position)
  const frameSkipRef = useRef(false)
  const startRaf = useCallback(() => {
    if (rafRef.current) return // already running
    lastTimeRef.current = null
    lastFrameWallTimeRef.current = Date.now()

    const animate = (timestamp) => {
      if (isUnmountedRef.current || !visualPosRef.current || !targetPosRef.current) {
        rafRef.current = null
        return
      }
      lastFrameWallTimeRef.current = Date.now()

      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = timestamp

      const vp = visualPosRef.current
      const tp = targetPosRef.current
      const dx = tp.x - vp.x
      const dy = tp.y - vp.y
      const dist = Math.hypot(dx, dy)

      if (dist > 1.5) {
        const step = WALK_SPEED * dt
        if (step >= dist) {
          vp.x = tp.x
          vp.y = tp.y
        } else {
          vp.x += (dx / dist) * step
          vp.y += (dy / dist) * step
        }
        // Throttle React state updates to every other frame (~30fps)
        frameSkipRef.current = !frameSkipRef.current
        if (frameSkipRef.current) {
          setRenderPos({ x: Math.round(vp.x * 10) / 10, y: Math.round(vp.y * 10) / 10 })
        }
        rafRef.current = requestAnimationFrame(animate)
      } else {
        // Arrived — snap and stop RAF
        vp.x = tp.x
        vp.y = tp.y
        setRenderPos({ x: tp.x, y: tp.y })
        setIsWalking(false)
        rafRef.current = null
        lastTimeRef.current = null
        // Process next waypoint via ref (avoids stale closure)
        if (onWaypointReachedRef.current) onWaypointReachedRef.current()
      }
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [])

  // Browser throttling, tab restores, or hot reload can occasionally leave a character
  // marked as walking with a stale RAF handle. Restart the loop instead of letting the
  // store stay stuck at isMoving:true forever.
  useEffect(() => {
    if (!isWalking) return
    const watchdog = setInterval(() => {
      // A backgrounded tab pauses RAF; skip the watchdog while hidden to avoid
      // false-positive stall diagnostics and spurious RAF re-queues.
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastFrameWallTimeRef.current < 1500) return
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      // Surface the stall instead of restarting silently — a rising count means frames
      // are being dropped somewhere (tab throttling, HMR, an exception in animate()).
      useOfficeStore.getState().recordWatchdogRestart()
      if (import.meta.env?.DEV) console.warn(`[watchdog] restarted stalled walk loop for "${id}"`)
      startRaf()
    }, 1000)
    return () => clearInterval(watchdog)
  }, [isWalking, startRaf])

  // Cleanup RAF + deferred timers on unmount
  useEffect(() => {
    isUnmountedRef.current = false
    const deferred = deferredTimersRef.current
    return () => {
      isUnmountedRef.current = true
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      // Cancel any in-flight bubble-clear / handoff timers so they don't fire
      // against a torn-down component after unmount.
      for (const handle of deferred) clearTimeout(handle)
      deferred.clear()
    }
  }, [])

  // Handle arriving at a waypoint
  const onWaypointReached = useCallback(() => {
    const store = useOfficeStore.getState()

    if (pathRef.current.length > 0) {
      const next = pathRef.current.shift()
      // Continue to next waypoint
      targetPosRef.current = { ...next }
      // Merge "arrived at this waypoint" + "retarget to next" into one store write.
      // The old code did setAgentArrived() then setAgentTarget() — two set() calls,
      // two subscriber wake-ups per intermediate waypoint. advanceAgentWaypoint snaps
      // position onto the reached target and sets the next leg in a single set().
      if (visualPosRef.current) {
        const facing = calcFacing(visualPosRef.current.x, visualPosRef.current.y, next.x, next.y)
        store.advanceAgentWaypoint(id, next, facing)
      } else {
        store.advanceAgentWaypoint(id, next)
      }
      startRaf()
    } else {
      store.setAgentArrived(id)
      movingRef.current = false
      setIsWalking(false)
      // Apply deferred behavior now that character has arrived at destination.
      const pending = pendingBehaviorRef.current
      if (pending) {
        pendingBehaviorRef.current = null
        // If a group event took over while this character was walking (the groupTarget
        // effect redirects the in-flight walk), the deferred behavior is stale — applying
        // it would overwrite the group event's behavior/bubble with whatever doSchedule
        // had queued. officeLife owns behavior during group events; drop the pending one.
        if (!store.agents[id]?.inGroupEvent) {
          store.setAgentBehavior(id, pending.behaviorId, pending.expression, pending.bubble)
          // Clear bubble after a while
          if (pending.bubble) {
            scheduleDeferred(() => useOfficeStore.getState().clearBubble(id), Math.min(pending.duration * 0.5, 4000))
          }
        }
      }
    }
  }, [id, startRaf, scheduleDeferred])

  // Keep ref in sync
  onWaypointReachedRef.current = onWaypointReached

  // Move to a new target (called from doSchedule)
  const startWalkTo = useCallback((waypoint) => {
    targetPosRef.current = { ...waypoint }
    if (visualPosRef.current) {
      const facing = calcFacing(visualPosRef.current.x, visualPosRef.current.y, waypoint.x, waypoint.y)
      useOfficeStore.getState().setAgentTarget(id, waypoint, facing)
    }
    setIsWalking(true)
    startRaf()
  }, [id, startRaf])

  useEffect(() => {
    if (!agentState?.returnHomeOnIdle || agentState.status !== 'idle' || agentState.inGroupEvent || isWalking) return
    const home = HOME_POSITIONS[id]
    const current = visualPosRef.current
    if (!home || !current) return
    const store = useOfficeStore.getState()
    store.clearReturnHomeIntent(id)
    if (Math.hypot(current.x - home.x, current.y - home.y) < 5) return
    const path = calculatePath(current, home)
    if (path.length === 0) return
    movingRef.current = true
    pathRef.current = path.slice(1)
    startWalkTo(path[0])
  }, [agentState?.returnHomeOnIdle, agentState?.status, agentState?.inGroupEvent, id, isWalking, startWalkTo, visualReady])

  // Behavior scheduling — wrapped in try/catch to guarantee the chain never breaks
  const doSchedule = useCallback(() => {
    if (isUnmountedRef.current) return
    let nextDelay = 8000 // fallback delay if anything goes wrong

    try {
      const store = useOfficeStore.getState()
      if (store.isPaused) {
        timerRef.current = setTimeout(doSchedule, 2000)
        return
      }

      const agent = store.agents[id]
      if (!agent) {
        timerRef.current = setTimeout(doSchedule, 3000)
        return
      }

      // Skip scheduling during group events — officeLife controls behavior
      if (agent.inGroupEvent) {
        timerRef.current = setTimeout(doSchedule, 2000)
        return
      }

      // If still walking, wait and retry (with stuck detection)
      if (movingRef.current) {
        movingStuckRef.current = (movingStuckRef.current || 0) + 1
        // If stuck moving for too many retries, force unstick
        if (movingStuckRef.current > BEHAVIOR_STUCK_RETRIES) {
          movingRef.current = false
          movingStuckRef.current = 0
          pendingBehaviorRef.current = null
          setIsWalking(false)
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
        } else {
          timerRef.current = setTimeout(doSchedule, BEHAVIOR_STUCK_RETRY_MS)
          return
        }
      }
      movingStuckRef.current = 0

      // L2: an UNTRACKED agent (no live real signal) leans in with teamPulse; a TRACKED agent is
      // never modulated (R1) → pass teamPulse 0. `tracked` is reused for the focusAnchor bias below.
      const tracked = !!store.externalStatus[id]
      const teamPulse = tracked ? 0 : (store.teamPulse || 0)
      const next = getNextBehavior(id, agent.status || 'idle', new Date().getHours(), store.mood || 'normal', teamPulse)
      // Guard the re-schedule delay: a non-finite or non-positive duration would make
      // setTimeout(doSchedule, nextDelay) fire on the next tick, spinning the behavior
      // chain in a tight CPU loop. Fall back to the 8s default if the value is unusable.
      nextDelay = (Number.isFinite(next.duration) && next.duration > 0) ? next.duration : 8000

      // Walk to behavior location
      const destination = getTargetForBehavior(id, next.behaviorId, store.agents)
      let willWalk = false
      if (destination && visualPosRef.current) {
        const current = visualPosRef.current
        const sameSpot = Math.abs(current.x - destination.x) < 5 && Math.abs(current.y - destination.y) < 5
        if (!sameSpot) {
          const path = calculatePath(current, destination)
          if (path.length > 0) {
            willWalk = true
            movingRef.current = true
            pathRef.current = path.slice(1)
            startWalkTo(path[0])
          }
        }
      }

      // For location-based behaviors (coffee, whiteboard, toilet, etc.),
      // defer the behavior label until the character arrives at the destination.
      // This prevents "去泡咖啡" showing while still sitting at desk.
      if (willWalk && needsLocationChange(next.behaviorId)) {
        pendingBehaviorRef.current = next
        // Don't change the displayed behavior yet — keep current one while walking
      } else {
        pendingBehaviorRef.current = null
        // Desk behavior or already at location — apply immediately
        store.setAgentBehavior(id, next.behaviorId, next.expression, next.bubble)
        // Clear bubble after a while
        if (next.bubble) {
          scheduleDeferred(() => useOfficeStore.getState().clearBubble(id), Math.min(next.duration * 0.5, 4000))
        }
        // L2 focusAnchor (spec living-office-events.md): a STATIONARY, UNTRACKED idle agent orients
        // toward the hottest live desk — the room "turns toward where the real work is". Honest
        // (orientation ≠ work-claim). Skipped for tracked agents (R1); bails on a stale/missing/idle
        // anchor; base-role fallback resolves a 'slug~role' worktree anchor to its rendered agent.
        if (!willWalk && !tracked && store.focusAnchor && store.focusAnchor !== id && visualPosRef.current) {
          let anchor = store.agents[store.focusAnchor]
          if (!anchor && store.focusAnchor.includes('~')) {
            anchor = store.agents[store.focusAnchor.slice(store.focusAnchor.lastIndexOf('~') + 1)]
          }
          if (anchor && anchor.status && anchor.status !== 'idle' && anchor.position) {
            const dir = calcFacing(visualPosRef.current.x, visualPosRef.current.y, anchor.position.x, anchor.position.y)
            store.setAgentFacing(id, dir)
          }
        }
      }

      // Trigger handoff animation for pass-document
      if (next.behaviorId === 'pass-document') {
        const others = Object.keys(store.agents).filter(oid => oid !== id)
        if (others.length > 0) {
          const targetId = others[Math.floor(Math.random() * others.length)]
          store.addHandoff(id, targetId)
          scheduleDeferred(() => {
            const s = useOfficeStore.getState()
            if (!s.agents[targetId]?.inGroupEvent) {
              s.setAgentBehavior(targetId, 'reading-screen', 'normal', eventBubble('handoff-received'))
              scheduleDeferred(() => s.clearBubble(targetId), 3000)
            }
          }, 1500)
        }
      }
    } catch (err) {
      console.error(`[${id}] doSchedule error:`, err)
    }

    // ALWAYS schedule next — even if an error occurred above
    timerRef.current = setTimeout(doSchedule, nextDelay)
  }, [id, startWalkTo, scheduleDeferred])

  // Watch for group event movement targets
  const lastGroupTargetRef = useRef(null)
  useEffect(() => {
    // When a group event clears (groupTarget → null), reset the dedup ref so the NEXT
    // group event always re-evaluates — even if it happens to assign the same coords.
    if (!agentState?.groupTarget) { lastGroupTargetRef.current = null; return }
    if (!visualPosRef.current) return
    const gt = agentState.groupTarget
    // Only trigger if target actually changed
    const last = lastGroupTargetRef.current
    if (last && Math.abs(last.x - gt.x) < 3 && Math.abs(last.y - gt.y) < 3) return
    lastGroupTargetRef.current = gt
    const current = visualPosRef.current
    const sameSpot = Math.abs(current.x - gt.x) < 5 && Math.abs(current.y - gt.y) < 5
    if (!sameSpot) {
      const path = calculatePath(current, gt)
      if (path.length > 0) {
        movingRef.current = true
        pathRef.current = path.slice(1)
        startWalkTo(path[0])
      }
    }
  }, [agentState?.groupTarget, startWalkTo, visualReady])

  // Start behavior loop — with watchdog to restart if chain dies
  useEffect(() => {
    const delay = 500 + Math.random() * 3000
    timerRef.current = setTimeout(doSchedule, delay)

    // Watchdog: if no behavior change for WATCHDOG_TIMEOUT, force restart the chain.
    // The timeout must stay above the longest legitimate behavior duration so a slow
    // (not dead) behavior is never truncated — see constants.js for the budget.
    const lastBehaviorRef = { behavior: null, since: Date.now() }
    const watchdog = setInterval(() => {
      const agent = useOfficeStore.getState().agents[id]
      if (!agent) return
      // Don't fire during group events — officeLife controls behavior and duration
      if (agent.inGroupEvent) {
        lastBehaviorRef.behavior = agent.behavior
        lastBehaviorRef.since = Date.now()
        return
      }
      if (agent.behavior !== lastBehaviorRef.behavior) {
        lastBehaviorRef.behavior = agent.behavior
        lastBehaviorRef.since = Date.now()
      } else if (Date.now() - lastBehaviorRef.since > WATCHDOG_TIMEOUT) {
        // Stuck — force restart
        clearTimeout(timerRef.current)
        movingRef.current = false
        movingStuckRef.current = 0
        pendingBehaviorRef.current = null
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
        setIsWalking(false)
        timerRef.current = setTimeout(doSchedule, 500)
        lastBehaviorRef.since = Date.now()
      }
    }, WATCHDOG_INTERVAL)

    return () => {
      clearTimeout(timerRef.current)
      clearInterval(watchdog)
    }
  }, [doSchedule, id])

  const setSelectedAgent = useOfficeStore((s) => s.setSelectedAgent)

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    setSelectedAgent(id)
  }, [id, setSelectedAgent])

  // Stable keyboard handler — the root <g> re-renders ~30fps while the character walks
  // (setRenderPos). A fresh inline `onKeyDown={(e) => ...}` arrow allocated a new closure
  // on every one of those frames; useCallback over the already-stable handleClick keeps
  // one closure for the component's lifetime.
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e) }
  }, [handleClick])

  const state = agentState || {}
  const pos = renderPos || state.position || { x: 0, y: 0 }
  const session = state.session || null

  // Name tag dimensions — memoized on `name`. estimateTextWidth runs a per-codepoint
  // loop; AgentCharacter re-renders ~30fps while walking (setRenderPos) and `name`
  // changes only on a locale switch, so without this memo the char-width loop ran on
  // every walk frame for a result that is constant for the whole walk.
  const { tagW, tagHalfW } = useMemo(() => {
    const w = estimateTextWidth(name) + 16
    return { tagW: w, tagHalfW: w / 2 }
  }, [name])
  const tagFill = state.status !== 'idle' ? (STATUS_COLORS[state.status] || color) : color
  // '◷' is a monochrome Unicode clock glyph — tints with tagFill like the other status icons,
  // consistent with the 8×8 white badge. Replaces the colour emoji '🧠' which clipped and
  // ignored tagFill at fontSize 7.
  const statusIcon = state.status === 'working' ? '⚡' : state.status === 'blocked' ? '✕' : state.status === 'done' ? '✓' : state.status === 'planning' ? '◷' : null
  const glowColor = STATUS_COLORS[state.status]
  // AVO-128: show the name only when the agent is doing something or is being inspected.
  const showName = hovered || (state.status && state.status !== 'idle')

  return (
    <g transform={`translate(${pos.x}, ${pos.y}) scale(1.35)`}
      style={{ cursor: 'pointer' }} onClick={handleClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      data-agent-id={id}
      data-agent-status={state.status || 'idle'}
      data-agent-behavior={state.behavior || 'idle'}
      data-supervising={hasActiveHelper ? '1' : '0'}
      role="button" aria-label={name} tabIndex={0}
      onKeyDown={handleKeyDown}>
      {/* AVO-132: single working/planning glow ring; effort (high/xhigh/max) intensifies it
          (peak opacity + stroke width) instead of stacking a second concentric aura.
          Planning uses a calm violet ring at BASE_GLOW intensity (effort does not apply). */}
      {(state.status === 'working' || state.status === 'planning') && !hasActiveHelper && (() => {
        const g = state.status === 'working' ? (EFFORT_GLOW[effort] || BASE_GLOW) : BASE_GLOW
        return (
          <circle cx={0} cy={-18} r={22} fill="none" stroke={glowColor} strokeWidth={g.sw} opacity={g.op}>
            {!reducedMotion && <animate attributeName="opacity" values={`${(g.op * 0.4).toFixed(2)};${g.op};${(g.op * 0.4).toFixed(2)}`} dur="1.5s" repeatCount="indefinite" />}
            {!reducedMotion && <animate attributeName="r" values="20;24;20" dur="1.5s" repeatCount="indefinite" />}
          </circle>
        )
      })()}
      {/* AVO-138: calm SUPERVISING halo — a gently-breathing (very slow, low-amplitude) role-tinted
          ring while the lead oversees its subagent helpers. The 3s breathe is intentionally slower
          and lower-amplitude than the own-work 1.5s pulse so the supervising vs working distinction
          is preserved. reducedMotion → static ring (no animation). The fast pulse above is RESERVED
          for the lead's OWN direct work (no active helpers). Status visibility preserved by name tag
          + this halo + the 👀 chip. */}
      {(state.status === 'working' || state.status === 'planning') && hasActiveHelper && (
        <circle cx={0} cy={-18} r={22} fill="none" stroke={glowColor} strokeWidth={BASE_GLOW.sw}
          opacity={(BASE_GLOW.op * 0.6).toFixed(2)} data-supervise-halo="1">
          {!reducedMotion && (
            <animate attributeName="opacity"
              values={`${(BASE_GLOW.op * 0.3).toFixed(2)};${(BASE_GLOW.op * 0.6).toFixed(2)};${(BASE_GLOW.op * 0.3).toFixed(2)}`}
              dur="3s" repeatCount="indefinite" />
          )}
        </circle>
      )}
      {state.status === 'blocked' && (
        <circle cx={0} cy={-18} r={22} fill="none" stroke={glowColor} strokeWidth="2" opacity="0.4">
          {!reducedMotion && <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1s" repeatCount="indefinite" />}
        </circle>
      )}
      {/* AVO-135: 'done' is a ONE-SHOT celebratory flash, not a standing ring — removes the
          last "status board" tell (a permanent done state). Expands + fades once, then gone;
          the ✓ status icon + green name carry the done state after. reducedMotion → no flash. */}
      {state.status === 'done' && !reducedMotion && (
        <circle cx={0} cy={-18} r={16} fill="none" stroke={glowColor} strokeWidth="2.5" opacity="0.6">
          <animate attributeName="r" values="16;30" dur="0.7s" repeatCount="1" fill="freeze" />
          <animate attributeName="opacity" values="0.6;0" dur="0.7s" repeatCount="1" fill="freeze" />
        </circle>
      )}

      <CharacterPixelSprite
        charId={id}
        expression={state.expression || 'normal'}
        isMoving={isWalking}
        walkFrame={walkFrame}
        facing={state.facing || 'down'}
      />

      {/* Behavior-specific indicator icon */}
      {/* AVO-134: a one-shot pop-in (scale + slight squash) when the behavior CHANGES.
          Keyed on the behavior so React remounts (replays the pop) on a real change, but a
          same-behavior re-render reuses the element → no re-fire. reducedMotion → static. */}
      {!isWalking && (
        <g key={state.behavior}>
          {!reducedMotion && (
            <animateTransform attributeName="transform" type="scale"
              values="0 0;1.15 0.9;1 1" keyTimes="0;0.6;1" dur="0.3s" repeatCount="1" fill="freeze" />
          )}
          <BehaviorIndicator behavior={state.behavior} />
        </g>
      )}

      {/* Name tag + bubble: undo the 1.35 character scale, then grow each block IN PLACE by
          labelScale around its own anchor (POINT 2). Anchor-preserving (translate THEN scale, not
          scale-the-whole-group) so a counter-scaled label gets bigger without floating upward into
          the agent above it — that float was what made adjacent active agents' tags collide. At
          labelScale 1 (office ≥ native) this is byte-identical to the prior `scale(1/1.35)`. */}
      <g transform={`scale(${1 / 1.35})`}>
        <g transform={`translate(0, -48) scale(${labelScale})`}>
          {/* Session branch badge — shown above name tag for worktree agents */}
          {session && (
            <g transform="translate(0, -16)">
              <rect x={-tagHalfW} y={-7} width={tagW} height={13} rx={6}
                fill={color} opacity="0.7" />
              <text x={0} y={1} textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fontFamily="monospace" fill="white" opacity="0.95">
                {session.slice(0, 16)}
              </text>
            </g>
          )}
          {/* AVO-128: name tag only when active or hovered; hidden at idle rest. */}
          {showName && (
            <>
              <rect x={-tagHalfW} y={-11} width={tagW} height={20} rx={10}
                fill={tagFill} opacity="0.92" />
              <text x={0} y={1} textAnchor="middle" dominantBaseline="middle"
                fontSize="12" fontFamily="monospace" fontWeight="bold" fill="white">
                {name}
              </text>
            </>
          )}
          {statusIcon && (
            <g transform={`translate(${tagHalfW - 2}, -2)`}>
              <rect x={-4} y={-4} width={8} height={8} rx={2} fill="white" opacity="0.9" />
              <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill={tagFill}>{statusIcon}</text>
            </g>
          )}
          {/* AVO-138: steady 👀 overseer chip on the opposite shoulder while supervising helpers. */}
          {hasActiveHelper && (
            <g transform={`translate(${-(tagHalfW - 2)}, -2)`} data-supervise-cue="1">
              <rect x={-5} y={-5} width={10} height={10} rx={3} fill="white" opacity="0.9" />
              <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize="8">👀</text>
            </g>
          )}
        </g>

        {/* Bubble grows in place too (anchored at its -68 origin). At labelScale 1 this is
            identical to the prior `<BehaviorBubble x={0} y={-68}/>` directly under scale(1/1.35).
            FLIP-BELOW: an agent near the office top (e.g. the Gatekeeper at the top wall) would draw
            its above-the-head bubble past the SVG's y=0 edge and get clipped. The bubble's projected
            top is pos.y − 68 − 34·labelScale; when that crosses the top edge we anchor it just below
            the agent (+6) and flip the tail up so the whole bubble stays inside the scene. */}
        {(() => {
          const bubbleTopAbove = pos.y - 68 - 34 * labelScale
          const below = bubbleTopAbove < 6
          return (
            <g transform={`translate(0, ${below ? 6 : -68}) scale(${labelScale})`}>
              <BehaviorBubble x={0} y={0} below={below} message={state.bubble} />
            </g>
          )
        })()}

        {/* L3 reluctant-participant tell (spec living-office-events.md): a tracked agent torn by a
            set-piece nearby shows a sub-dominant ⏳ — "knows it has work but the event is happening".
            Real-context bubbles PREEMPT it (only shown when no bubble); never moves the body / never
            touches status. Sits to the upper-right of the head so it doesn't fight the name tag. */}
        {!state.bubble && reluctantUntil && reluctantUntil > Date.now() && (
          <g transform={`translate(10, -34) scale(${labelScale})`} data-reluctant="1" opacity="0.7" pointerEvents="none">
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fontSize="9">⏳</text>
          </g>
        )}
        {/* AVO-131: the monospace tool pill was removed from the glance layer — the
            prop-icon + bubble carry the action in-world; the exact tool is shown in the
            AgentInspector (click-to-inspect) instead. */}
      </g>
    </g>
  )
}

// Prevent parent re-renders from cascading — AgentCharacter reads its own state from store
export default React.memo(AgentCharacter, (prev, next) => {
  return prev.agent.id === next.agent.id
    && prev.agent.color === next.agent.color
})
