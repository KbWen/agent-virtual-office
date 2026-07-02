import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useOfficeStore } from '../systems/store.js'
import { getNextBehavior } from '../systems/behaviorEngine'
import { getTargetForBehavior, pickSocialTarget, calcFacing, calculatePath, needsLocationChange, HOME_POSITIONS, resolveClaimAwareHomePosition, resolveFocusFacing, SOCIAL_BEHAVIORS, visuallyOverlapping, avoidOverlap } from '../systems/movementSystem'
import { eventBubble, charName, useLocale, t } from '../i18n'
import { BlockedReasonBadge } from './blockedReasonBadge'
import { recurringInfo } from '../systems/recurringFailure'
import { selectVisibleBubbles, BUBBLE_VISIBLE_CAP } from '../systems/bubbleVisibility.js'
import { stepWalkFrame } from '../systems/walkFrame.js'
import { WALK_SPEED, WALK_FRAME_INTERVAL, BEHAVIOR_STUCK_RETRIES, BEHAVIOR_STUCK_RETRY_MS, WATCHDOG_INTERVAL, WATCHDOG_TIMEOUT, shouldSkipBehaviorWatchdog } from '../systems/constants.js'
import BehaviorBubble from './BehaviorBubble'
import { shouldShakeDesk } from '../systems/eventJuice.js'
import { pickPokeReaction, pickQuipIndex } from '../systems/pokeReaction.js'
import { behaviorIndicatorIconKey } from '../systems/behaviorIndicatorIconKey.mjs'
import {
  BASE_GLOW,
  CHAR_SCALE,
  characterBubbleLayout,
  characterBubbleMessage,
  characterStatusVisual,
  computeLabelScale,
  LABEL_SCALE_MAX,
  nameTagMetrics,
} from '../systems/agentCharacterVisualModel.mjs'

export { CHAR_SCALE, computeLabelScale, LABEL_SCALE_MAX } from '../systems/agentCharacterVisualModel.mjs'
export const RAF_STALL_RESTART_MS = 2500

// Pure guard: returns true if a social arriver's TARGET should face back.
// R1: tracked agents (live externalStatus entry) are NEVER modulated.
// Also skip agents currently in a group event.
// Exported for unit-testing without a component mount.
export function shouldFaceBack(targetExtStatus, targetAgent) {
  if (targetExtStatus) return false          // R1: tracked → never modulate
  if (!targetAgent) return false             // agent not in store
  if (targetAgent.inGroupEvent) return false // group event owns facing
  return true
}

// RAF watchdog is only for a genuinely stale visible walk loop. Restarting the lost chain is
// non-snapping, so it can happen before GAP_SNAP_MS; true long-freeze fast-forward still lives in
// stepWalkFrame's >GAP_SNAP_MS branch.
export function shouldRestartRafWatchdog(lastFrameWallTime, now, visibilityState, stallMs = RAF_STALL_RESTART_MS) {
  if (visibilityState !== 'visible') return false
  if (!Number.isFinite(lastFrameWallTime) || lastFrameWallTime <= 0) return false
  return now - lastFrameWallTime > stallMs
}

export function shouldStopStaleLocalWalk(isWalking, agentState) {
  return Boolean(isWalking && agentState && agentState.isMoving === false)
}

export function isDocumentFocused(doc) {
  return !!doc && typeof doc.hasFocus === 'function' && doc.hasFocus()
}

export function shouldRecordRafWatchdogRestart(hadPendingFrame, isFocused, consecutiveLostRestarts = 0) {
  return !hadPendingFrame && isFocused && consecutiveLostRestarts >= 2
}

export function hasRafHandle(value) {
  return value !== null && value !== undefined
}

export function collectArrivalNudgeClaims(agents, id) {
  const blockers = []
  const claims = []
  for (const oid of Object.keys(agents || {})) {
    if (oid === id) continue
    const other = agents[oid]
    if (!other) continue
    if (other.groupTarget) { blockers.push(other.groupTarget); claims.push(other.groupTarget) }
    if (other.position && !other.isMoving) { blockers.push(other.position); claims.push(other.position) }
    if (other.isMoving) {
      if (other.targetPosition) { blockers.push(other.targetPosition); claims.push(other.targetPosition) }
      if (other.journeyTarget) { blockers.push(other.journeyTarget); claims.push(other.journeyTarget) }
    }
  }
  return { blockers, claims }
}

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
  // AVO-182: a non-#RRGGBB input (e.g. a CSS named colour or #RGB from a bad config) would parseInt→NaN
  // and cache "#NaNNaNNaN" forever. Pass the input through unchanged instead of corrupting the cache.
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
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

  const iconKey = behaviorIndicatorIconKey(behavior)
  if (!iconKey) return null

  // Position: to the right of character
  const ox = 14, oy = -8

  switch (iconKey) {
    case 'keyboard': {
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
    case 'document': {
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
    case 'pencil': {
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
    case 'magnifier': {
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
    case 'chart': {
      // Mini chart bars
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={6} width={3 + (frame % 2)} height={2} fill="#378ADD" rx={0.3} />
          <rect x={0} y={3} width={5} height={2} fill="#5CB88A" rx={0.3} />
          <rect x={0} y={0} width={4 + (frame % 3)} height={2} fill="#EF9F27" rx={0.3} />
        </g>
      )
    }
    case 'qa-magnifier': {
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
    case 'shield': {
      // Shield icon
      const glow = frame % 2 === 0 ? 0.8 : 0.4
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <path d="M3,0 L6,2 L6,5 L3,7 L0,5 L0,2 Z" fill="#E24B4A" opacity={glow} />
          <text x={3} y={4.5} textAnchor="middle" dominantBaseline="middle" fontSize="4" fill="white">✓</text>
        </g>
      )
    }
    case 'deploy': {
      // Deploy/rocket
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={1} y={2} width={5} height={5} rx={1} fill="#D85A30" />
          <circle cx={3.5} cy={4.5} r={1.5} fill={frame % 2 === 0 ? '#5f5' : '#3a3'} />
        </g>
      )
    }
    case 'coffee': {
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
    case 'meeting-bubbles': {
      // Speech bubbles (meeting)
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={0} width={5} height={4} rx={1} fill="#378ADD" opacity={frame % 2 === 0 ? 0.8 : 0.4} />
          <rect x={3} y={3} width={5} height={4} rx={1} fill="#5CB88A" opacity={frame % 2 === 0 ? 0.4 : 0.8} />
        </g>
      )
    }
    case 'chat-bubble': {
      // Chat bubbles
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={0} width={6} height={4} rx={1} fill="#7F77DD" opacity={0.7} />
          <text x={3} y={2.8} textAnchor="middle" fontSize="3" fill="white">...</text>
        </g>
      )
    }
    case 'phone': {
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
    case 'sleep': {
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
    case 'printer': {
      // Printer icon
      return (
        <g transform={`translate(${ox}, ${oy})`}>
          <rect x={0} y={2} width={7} height={4} rx={0.5} fill="#888" />
          <rect x={1} y={0} width={5} height={3} fill="#fff" stroke="#aaa" strokeWidth={0.3} />
          {frame % 2 === 0 && <rect x={1} y={5} width={5} height={2} fill="#fff" />}
        </g>
      )
    }
    case 'frustration': {
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

// AVO-131: the in-scene TaskLabel tool pill (AVO-103) was removed — the exact tool now
// shows only in the AgentInspector (click-to-inspect). The classifier still backs the
// inspector's `inspectorTaskLabel`; nothing in the office scene renders the raw tool string.

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
  // #47: active viewBox x-bounds so the speech bubble clamps to the VISIBLE office edges (default
  // 0..800 OR the panel crop). Primitive subscriptions → re-render only on a real bounds change.
  const sceneMinX = useOfficeStore((s) => s.sceneBounds.minX)
  const sceneW = useOfficeStore((s) => s.sceneBounds.w)
  // L3 reluctant-participant tell (transient expiry ts). Pure overlay — never affects behavior.
  const reluctantUntil = useOfficeStore((s) => s.reluctant?.[id])
  // AVO-110: hook-stamped blocked-reason token (primitive subscription → re-render only on change).
  // When blocked, this drives the over-head reason badge that overrides the BehaviorIndicator glyph.
  const reasonCode = useOfficeStore((s) => s.externalStatus[id]?.reasonCode || null)
  // AVO-117: this agent's rolling blocked-episode log slice (ref changes only when an episode is
  // recorded → re-render). The recurring SIGN is EPHEMERAL: only while currently blocked AND the
  // current reason is recurring (≥threshold in-window). Computed from the slice at render.
  const recurringLog = useOfficeStore((s) => s.recurringFailureLog?.[id])
  // Declutter: global speech-bubble concurrency cap. This agent shows its bubble only if it wins one
  // of the BUBBLE_VISIBLE_CAP slots (priority blocked>done>working, most-recent first). Primitive
  // boolean selector → this AgentCharacter re-renders only when ITS OWN visibility flips. Suppressing
  // the bubble hides TEXT only — the status ring / name-pill color / over-head badge still render, so
  // a blocked agent's state is never hidden by the cap (honesty preserved).
  // Rotation cadence is driven by store-emit frequency (the selector re-evaluates on each store
  // change). In any ACTIVE office that's sub-second — doSchedule fires setAgentBehavior every behavior
  // cycle (~2-5s × N agents) + waypoint arrivals + the ~1s status poll all write the store — and the
  // cap only binds when busy (many bubbles), exactly when churn is highest, so rotation advances
  // smoothly when it matters. A PAUSED office intentionally freezes everything (no liveliness expected).
  const bubbleVisible = useOfficeStore((s) => selectVisibleBubbles(s.agents, s.externalStatus, BUBBLE_VISIBLE_CAP, Date.now()).has(id))

  const timerRef = useRef(null)
  const pathRef = useRef([])
  const movingRef = useRef(false)
  const movingStuckRef = useRef(0)
  const pendingBehaviorRef = useRef(null) // deferred behavior for location-based actions
  const socialTargetRef = useRef(null)   // { targetId, position } captured in doSchedule for social walks; cleared on arrival/abort
  const nudgeCountRef = useRef(0)        // AVO-156 arrival nudge: max ONE aside-step per journey (no cascade); reset at each new walk start
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
  const lostRafRestartRef = useRef(0)
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

  // Store is authoritative for whether an agent is walking. If a reset/arrival clears
  // `agentState.isMoving` while the component-local flag is still true, stop the RAF loop instead
  // of letting the watchdog repeatedly "recover" a walk that no longer exists.
  useEffect(() => {
    if (!shouldStopStaleLocalWalk(isWalking, agentState)) return
    if (hasRafHandle(rafRef.current)) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    lastTimeRef.current = null
    movingRef.current = false
    setIsWalking(false)
  }, [agentState?.isMoving, isWalking, agentState])

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
    if (hasRafHandle(rafRef.current)) return // already running
    lastTimeRef.current = null
    lastFrameWallTimeRef.current = Date.now()

    const animate = (timestamp) => {
      if (isUnmountedRef.current || !visualPosRef.current || !targetPosRef.current) {
        rafRef.current = null
        return
      }
      lastFrameWallTimeRef.current = Date.now()
      // Any delivered RAF callback proves the walk loop recovered. Reset the lost-chain counter
      // even when this frame immediately snaps/arrives at a waypoint after a long host pause.
      lostRafRestartRef.current = 0

      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const gapMs = timestamp - lastTimeRef.current
      const dt = Math.min(gapMs / 1000, 0.1)
      lastTimeRef.current = timestamp

      const vp = visualPosRef.current
      const tp = targetPosRef.current

      // Pure per-frame math (src/systems/walkFrame.js) so the hidden-tab / jank
      // fast-forward semantics are unit-tested: a timestamp gap > GAP_SNAP_MS (rAF was
      // frozen — hidden tab or main-thread stall) snaps this leg to its target instead of
      // resuming a slow glide from the frozen pile (owner bug 2026-06-11: "8人只看到6人",
      // frozen walkers stacked, then visibly drifted apart on tab return).
      const arrived = stepWalkFrame(vp, tp, dt, gapMs, WALK_SPEED)

      if (!arrived) {
        // Throttle React state updates to every other frame (~30fps)
        frameSkipRef.current = !frameSkipRef.current
        if (frameSkipRef.current) {
          setRenderPos({ x: Math.round(vp.x * 10) / 10, y: Math.round(vp.y * 10) / 10 })
        }
        rafRef.current = requestAnimationFrame(animate)
      } else {
        // Arrived at THIS LEG — snap is already applied by stepWalkFrame; stop RAF and
        // chain on. isWalking is deliberately NOT cleared here: this branch fires at every
        // INTERMEDIATE waypoint too, and the 1.5s stall watchdog below is gated on
        // isWalking — clearing it here left legs 2..N of every journey unguarded, so a
        // render-jank rAF stall mid-route froze the walker in place (forensic capture
        // 2026-06-10: agents frozen at the shared lounge-door node for minutes, pixel-
        // stacked at 0px). onWaypointReached's FINAL-arrival branch owns the clear.
        setRenderPos({ x: tp.x, y: tp.y })
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
      if (!shouldRestartRafWatchdog(lastFrameWallTimeRef.current, Date.now(), document.visibilityState)) return
      const hadPendingFrame = hasRafHandle(rafRef.current)
      if (hadPendingFrame) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lostRafRestartRef.current = hadPendingFrame ? 0 : lostRafRestartRef.current + 1
      // Only count a truly lost RAF chain. A pending frame that has not fired yet usually means the
      // host WebView/browser automation throttled rendering; restarting keeps the walk alive, but
      // surfacing it as an app watchdog fault made Codex Browser sessions look broken while sprites
      // were still moving normally.
      if (shouldRecordRafWatchdogRestart(hadPendingFrame, isDocumentFocused(document), lostRafRestartRef.current)) {
        useOfficeStore.getState().recordWatchdogRestart()
        if (import.meta.env?.DEV) console.warn(`[watchdog] restarted stalled walk loop for "${id}"`)
      }
      // NO fast-forward here (A/B-proven regression, 2026-06-11): the watchdog fires at
      // 1.5s, which heavy-load render jank hits constantly on this machine — snapping made
      // every such stall a visible teleport (20 jumps in a 3-min audit vs 0 on baseline).
      // A restarted loop resumes the smooth glide; the LONG-freeze case (real tab-hide) is
      // handled by stepWalkFrame's GAP_SNAP_MS (5s) on the first resumed frame instead.
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
      if (hasRafHandle(rafRef.current)) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      // A mid-walk unmount (roster-mode toggle swaps the office for NarrowRoster while
      // s.agents persists) must release the journey claim — setAgentArrived will never
      // fire for the dead walk, and a stale journeyTarget would block that spot for every
      // picker until this agent's next walk start (AC-2, fresh review 2026-06-10 MED).
      useOfficeStore.getState().setAgentJourney(id, null)
      // Cancel any in-flight bubble-clear / handoff timers so they don't fire
      // against a torn-down component after unmount.
      for (const handle of deferred) clearTimeout(handle)
      deferred.clear()
    }
  }, [])

  // Move to a new target (called from doSchedule, group walks, and the arrival nudge).
  // Defined BEFORE onWaypointReached, which lists it as a dependency.
  const startWalkTo = useCallback((waypoint) => {
    targetPosRef.current = { ...waypoint }
    if (visualPosRef.current) {
      const facing = calcFacing(visualPosRef.current.x, visualPosRef.current.y, waypoint.x, waypoint.y)
      useOfficeStore.getState().setAgentTarget(id, waypoint, facing)
    }
    setIsWalking(true)
    startRaf()
  }, [id, startRaf])

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
      setIsWalking(false)  // FINAL arrival — the only legitimate walk-complete clear (see animate())
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
      // Facing-on-arrival: when a SOCIAL walk completes, face toward the social target
      // (the missing half of chat feel — without this, the arriver keeps the last walk-leg facing).
      const socialTarget = socialTargetRef.current
      if (socialTarget && visualPosRef.current) {
        const facing = calcFacing(
          visualPosRef.current.x, visualPosRef.current.y,
          socialTarget.position.x, socialTarget.position.y
        )
        store.setAgentFacing(id, facing)
        // Bonus lever — target faces back: mirror the pass-document foreign-write pattern.
        // R1 guard: never modulate a tracked agent. Also skip during group events.
        const s = store
        const targetAgent = s.agents[socialTarget.targetId]
        if (shouldFaceBack(s.externalStatus[socialTarget.targetId], targetAgent)) {
          const priorFacing = targetAgent.facing || 'down'
          const backFacing = calcFacing(
            socialTarget.position.x, socialTarget.position.y,
            visualPosRef.current.x, visualPosRef.current.y
          )
          s.setAgentFacing(socialTarget.targetId, backFacing)
          const duration = pending?.duration ?? 6000
          scheduleDeferred(() => {
            const st = useOfficeStore.getState()
            if (!st.externalStatus[socialTarget.targetId] && !st.agents[socialTarget.targetId]?.inGroupEvent) {
              st.setAgentFacing(socialTarget.targetId, priorFacing)
            }
          }, Math.min(duration * 0.5, 4000))
        }
        socialTargetRef.current = null
      }
      // AVO-156 F5 — arrival nudge (last-line recovery for stacks the planners could not
      // prevent: freeze deposits, simultaneous picks). Event-edge only (this exact arrival),
      // NEVER per-frame (ADR-004). The ARRIVER steps aside; the established stander is
      // never moved. One nudge per journey (nudgeCountRef), skipped during group events
      // (officeLife owns those positions).
      const s2 = useOfficeStore.getState()
      const me = s2.agents[id]
      if (me && !me.inGroupEvent && nudgeCountRef.current === 0 && visualPosRef.current) {
        const myPos = visualPosRef.current
        const { blockers, claims } = collectArrivalNudgeClaims(s2.agents, id)
        if (blockers.some(p => visuallyOverlapping(myPos, p))) {
          const nudged = avoidOverlap({ x: myPos.x, y: myPos.y }, claims)
          const clear = claims.every(p => !visuallyOverlapping(nudged, p))
          // Only SPEND the single per-journey nudge on a spot verified clear of all claims;
          // an unresolvable cluster keeps the attempt for the next arrival instead of
          // burning it on a sideways hop into another stack.
          if (clear && Math.hypot(nudged.x - myPos.x, nudged.y - myPos.y) > 2) {
            const nudgePath = calculatePath(myPos, nudged)
            if (nudgePath.length > 0) {
              nudgeCountRef.current = 1
              movingRef.current = true
              pathRef.current = nudgePath.slice(1)
              s2.setAgentJourney(id, nudged)
              startWalkTo(nudgePath[0])
            }
          }
        }
      }
    }
  }, [id, startRaf, scheduleDeferred, startWalkTo])

  // Keep ref in sync
  onWaypointReachedRef.current = onWaypointReached

  useEffect(() => {
    if (!agentState?.returnHomeOnIdle || agentState.status !== 'idle' || agentState.inGroupEvent || isWalking) return
    const current = visualPosRef.current
    if (!HOME_POSITIONS[id] || !current) return
    const store = useOfficeStore.getState()
    const home = resolveClaimAwareHomePosition(id, store.agents)
    if (!home) return
    store.clearReturnHomeIntent(id)
    if (Math.hypot(current.x - home.x, current.y - home.y) < 5) return
    const path = calculatePath(current, home)
    if (path.length === 0) return
    movingRef.current = true
    pathRef.current = path.slice(1)
    nudgeCountRef.current = 0
    store.setAgentJourney(id, home)  // publish journey END (AVO-156 RC-3)
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
          socialTargetRef.current = null  // abort: clear social target so no stale face-on-arrival
          store.setAgentJourney(id, null) // abort: a dead walk must not keep claiming its landing spot
          setIsWalking(false)
          if (hasRafHandle(rafRef.current)) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
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
      // AVO-165: count agents currently OUT (walking — non-null journeyTarget) so getNextBehavior can
      // soft-cap concurrent out-trips and stop the "always someone walking" pile-up (a concurrency
      // effect, not a per-agent rate). Read-only; keeping an agent at its desk is honest + R1-safe.
      const outTripCount = Object.values(store.agents).filter((a) => a && a.journeyTarget).length
      const next = getNextBehavior(id, agent.status || 'idle', new Date().getHours(), store.mood || 'normal', teamPulse, outTripCount)
      // Guard the re-schedule delay: a non-finite or non-positive duration would make
      // setTimeout(doSchedule, nextDelay) fire on the next tick, spinning the behavior
      // chain in a tight CPU loop. Fall back to the 8s default if the value is unusable.
      nextDelay = (Number.isFinite(next.duration) && next.duration > 0) ? next.duration : 8000

      // Walk to behavior location
      // For SOCIAL behaviors, pick the peer ONCE here and pass the SAME pick into
      // getTargetForBehavior (socialTargetOverride) — the walk destination and the
      // face-toward-on-arrival peer must be the same agent (two independent picks
      // would walk to B while facing A).
      const isSocialBehavior = SOCIAL_BEHAVIORS.has(next.behaviorId)
      const socialPick = isSocialBehavior ? pickSocialTarget(id, store.agents) : null
      const destination = getTargetForBehavior(id, next.behaviorId, store.agents, socialPick)
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
            nudgeCountRef.current = 0
            // Capture the social target so onWaypointReached can set facing on arrival.
            socialTargetRef.current = (isSocialBehavior && socialPick) ? socialPick : null
            store.setAgentJourney(id, destination)  // publish journey END (AVO-156 RC-3)
            startWalkTo(path[0])
          }
        }
      }
      // Walk aborted (same spot or no path) — clear any stale social target ref.
      if (!willWalk) socialTargetRef.current = null

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
        // L2 focusAnchor (spec living-office-events.md): a STATIONARY, UNTRACKED agent orients toward
        // the hottest live desk — the room "turns toward where the real work is" (honest; orientation
        // ≠ work-claim). All honesty guards (tracked→skip per R1, stale/idle/self bail, slug~role
        // fallback) live in the pure resolveFocusFacing helper so AC-4 is unit-testable without this loop.
        if (!willWalk && visualPosRef.current) {
          const dir = resolveFocusFacing(store, id, visualPosRef.current.x, visualPosRef.current.y)
          if (dir) store.setAgentFacing(id, dir)
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
        // Group event hijacks the walk — clear any pending social facing (R1: group event owns behavior)
        socialTargetRef.current = null
        movingRef.current = true
        pathRef.current = path.slice(1)
        nudgeCountRef.current = 0
        useOfficeStore.getState().setAgentJourney(id, gt)  // publish journey END (AVO-156 RC-3)
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
      // Behavior is held externally (group event or active session) — a frozen
      // behavior value is expected here, not a dead chain. Refresh the clock so
      // the watchdog resumes cleanly once the agent returns to an ambient state.
      if (shouldSkipBehaviorWatchdog(agent)) {
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
        // Explicitly drop any captured social peer — the abandoned walk's facing target
        // must never be applied to a LATER unrelated arrival (the next doSchedule resets
        // this anyway; the explicit clear keeps the invariant local and refactor-proof).
        socialTargetRef.current = null
        useOfficeStore.getState().setAgentJourney(id, null) // abort: release the claimed landing spot
        if (hasRafHandle(rafRef.current)) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
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

  // AVO-158 Poke (Model A, layered). The acknowledge reaction is purely visual + local —
  // it NEVER writes position or status (ADR-005 honesty contract). `pokeBob` drives a
  // re-mountable bob animateTransform (key=seq so each poke replays); `pokeQuip` shows a
  // transient real-status bubble. Escalation/quip selection lives in pure pokeReaction.js.
  const [pokeBob, setPokeBob] = useState(null)     // { seq, intensity } | null
  const [pokeQuip, setPokeQuip] = useState(null)   // string | null
  const pokeHistoryRef = useRef([])
  const pokeSeqRef = useRef(0)
  // Poke timers use dedicated refs (NOT the `scheduleDeferred` Set) on purpose: a re-poke must
  // CLEAR-and-REPLACE the in-flight timer by reference, which the fire-once Set pattern can't do
  // without leaving stale handles in the Set. Leak-safe: firePoke clears before re-arming, and this
  // unmount cleanup clears both. (Audit AVO-159 follow-up: divergence is deliberate, documented.)
  const pokeQuipTimerRef = useRef(null)
  const pokeBobTimerRef = useRef(null)
  useEffect(() => () => {
    if (pokeQuipTimerRef.current) clearTimeout(pokeQuipTimerRef.current)
    if (pokeBobTimerRef.current) clearTimeout(pokeBobTimerRef.current)
  }, [])

  const firePoke = useCallback(() => {
    const now = Date.now()
    // Read the agent's REAL status fresh from the store at call time (stable empty-deps
    // closure; never stale). Honest by construction — we only READ status, never write.
    const status = (useOfficeStore.getState().agents[id]?.status) || 'idle'
    const r = pickPokeReaction(status, pokeHistoryRef.current, now)
    pokeHistoryRef.current = r.nextHistory
    const pool = t(r.turnAway ? 'poke.turnaway' : `poke.quips.${r.poolKey}`, [])
    const quip = Array.isArray(pool) && pool.length ? pool[pickQuipIndex(pool.length, r.streak)] : null
    pokeSeqRef.current += 1
    setPokeQuip(quip)
    setPokeBob({ seq: pokeSeqRef.current, intensity: r.intensity })
    if (pokeQuipTimerRef.current) clearTimeout(pokeQuipTimerRef.current)
    pokeQuipTimerRef.current = setTimeout(() => setPokeQuip(null), 1200)
    if (pokeBobTimerRef.current) clearTimeout(pokeBobTimerRef.current)
    pokeBobTimerRef.current = setTimeout(() => setPokeBob(null), r.intensity === 'normal' ? 460 : 720)
  }, [id])

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    setSelectedAgent(id)   // inspector (idempotent if already selected → re-click = reaction only)
    firePoke()
  }, [id, setSelectedAgent, firePoke])

  // Right-click = poke-only (desktop bonus); suppress the browser context menu.
  const handleContextMenu = useCallback((e) => {
    e.preventDefault(); e.stopPropagation()
    firePoke()
  }, [firePoke])

  // Stable keyboard handler — the root <g> re-renders ~30fps while the character walks
  // (setRenderPos). A fresh inline `onKeyDown={(e) => ...}` arrow allocated a new closure
  // on every one of those frames; useCallback keeps one closure for the lifetime.
  // Enter = click (inspector + poke); Space = poke-only (re-poke without toggling inspector).
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleClick(e) }
    else if (e.key === ' ') { e.preventDefault(); firePoke() }
  }, [handleClick, firePoke])

  const state = agentState || {}
  const pos = renderPos || state.position || { x: 0, y: 0 }
  const session = state.session || null

  // Name tag dimensions — memoized on `name`. estimateTextWidth runs a per-codepoint
  // loop; AgentCharacter re-renders ~30fps while walking (setRenderPos) and `name`
  // changes only on a locale switch, so without this memo the char-width loop ran on
  // every walk frame for a result that is constant for the whole walk.
  const { tagW, tagHalfW } = useMemo(() => nameTagMetrics(name), [name])
  const statusVisual = characterStatusVisual({
    status: state.status,
    color,
    hovered,
    hasActiveHelper,
    effort,
  })
  const tagFill = statusVisual.tagFill
  const glowColor = statusVisual.glowColor
  const showName = statusVisual.showName
  const ring = statusVisual.ring
  const behaviorIconKey = behaviorIndicatorIconKey(state.behavior)

  return (
    <g transform={`translate(${pos.x}, ${pos.y}) scale(${CHAR_SCALE})`}
      style={{ cursor: 'pointer' }} onClick={handleClick} onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      data-agent-id={id}
      data-agent-status={state.status || 'idle'}
      data-agent-behavior={state.behavior || 'idle'}
      data-supervising={hasActiveHelper ? '1' : '0'}
      role="button" aria-label={`${name} — ${t(`statusLabels.${state.status || 'idle'}`, state.status || 'idle')}`} tabIndex={0}
      onKeyDown={handleKeyDown}>
      {/* AVO-158 Poke: a brief in-place acknowledge bob, additive on top of the base
          translate/scale. key={seq} remounts per poke so each click replays. Reduced-motion
          drops the motion (the quip bubble still acknowledges the poke). Decorative → aria-hidden. */}
      {!reducedMotion && pokeBob && (
        <animateTransform key={`poke-${pokeBob.seq}`} attributeName="transform" type="translate" additive="sum"
          values={pokeBob.intensity === 'turnaway' ? '0 0;-3 0;3 0;-2 0;0 0'
            : pokeBob.intensity === 'long' ? '0 0;0 -5;0 -2;0 -5;0 0'
            : '0 0;0 -4;0 0'}
          keyTimes={pokeBob.intensity === 'normal' ? '0;0.5;1' : '0;0.25;0.5;0.75;1'}
          dur={pokeBob.intensity === 'normal' ? '0.32s' : pokeBob.intensity === 'long' ? '0.6s' : '0.5s'}
          repeatCount="1" fill="freeze" aria-hidden="true" />
      )}
      {/* AVO-136: desk-slam → a brief LOCAL jitter on this agent only. `additive="sum"` composes the
          shake ON TOP of the base translate/scale (a CSS transform would override positioning). One
          play; mounts only while in desk-slam, so it fires once on onset (anti-nag). Gated off under
          reduced-motion — the desk-slam posture + confused expression remain the semantic tell. */}
      {shouldShakeDesk(state.behavior, reducedMotion) && (
        <animateTransform attributeName="transform" type="translate" additive="sum"
          values="0 0;-1.6 0;1.6 0;-1 0;1 0;0 0" keyTimes="0;0.2;0.4;0.6;0.8;1"
          dur="0.42s" repeatCount="1" fill="freeze" />
      )}
      {/* AVO-132: single working/planning glow ring; effort (high/xhigh/max) intensifies it
          (peak opacity + stroke width) instead of stacking a second concentric aura.
          Planning uses a calm violet ring at BASE_GLOW intensity (effort does not apply). */}
      {ring?.kind === 'active' && (() => {
        const g = ring
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
      {ring?.kind === 'supervising' && (
        <circle cx={0} cy={-18} r={22} fill="none" stroke={glowColor} strokeWidth={BASE_GLOW.sw}
          opacity={ring.op.toFixed(2)} data-supervise-halo="1">
          {!reducedMotion && (
            <animate attributeName="opacity"
              values={`${(BASE_GLOW.op * 0.3).toFixed(2)};${(BASE_GLOW.op * 0.6).toFixed(2)};${(BASE_GLOW.op * 0.3).toFixed(2)}`}
              dur="3s" repeatCount="indefinite" />
          )}
        </circle>
      )}
      {ring?.kind === 'blocked' && (
        <circle cx={0} cy={-18} r={22} fill="none" stroke={glowColor} strokeWidth="2" opacity="0.4">
          {!reducedMotion && <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1s" repeatCount="indefinite" />}
        </circle>
      )}
      {/* AVO-167: 'awaiting-approval' (waiting on the human) — a CALM slow breathe (2.4s), deliberately
          NOT the alarm-fast 1s blocked pulse: present but unhurried "I'm waiting for you". Honest (tied
          to the real awaiting-approval signal); distinct cool-cyan ring + name-pill via STATUS_COLORS. */}
      {ring?.kind === 'awaiting-approval' && (
        <circle cx={0} cy={-18} r={22} fill="none" stroke={glowColor} strokeWidth="2" opacity="0.45">
          {!reducedMotion && <animate attributeName="opacity" values="0.3;0.55;0.3" dur="2.4s" repeatCount="indefinite" />}
        </circle>
      )}
      {/* AVO-135: 'done' is a ONE-SHOT celebratory flash, not a standing ring — removes the
          last "status board" tell (a permanent done state). Expands + fades once, then gone;
          the ✓ status icon + green name carry the done state after. reducedMotion → no flash. */}
      {ring?.kind === 'done' && !reducedMotion && (
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
      {/* AVO-110: while blocked, the reason badge OVERRIDES the BehaviorIndicator glyph (a block is
          the dominant state). Keyed on reasonCode so a reason CHANGE replays the entry-pop, but a
          same-reason re-render reuses the element → no re-fire (ANTI-NAG). reducedMotion → static. */}
      {!isWalking && (
        state.status === 'blocked' ? (
          <g key={`reason-${reasonCode || 'unknown'}`}>
            {!reducedMotion && (
              <animateTransform attributeName="transform" type="scale"
                values="0.6 0.6;1.1 1.1;1 1" keyTimes="0;0.6;1" dur="0.35s" repeatCount="1" fill="freeze" />
            )}
            <BlockedReasonBadge
              reasonCode={reasonCode}
              recurring={!!(reasonCode && recurringLog
                && recurringInfo({ [id]: recurringLog }, { agentId: id, reasonCode, now: Date.now() }).recurring)}
            />
          </g>
        ) : (
          behaviorIconKey && <g key={state.behavior || 'idle'}>
            {!reducedMotion && (
              <animateTransform attributeName="transform" type="scale"
                values="0 0;1.15 0.9;1 1" keyTimes="0;0.6;1" dur="0.3s" repeatCount="1" fill="freeze" />
            )}
            <BehaviorIndicator behavior={state.behavior} />
          </g>
        )
      )}

      {/* Name tag + bubble: undo the 1.35 character scale, then grow each block IN PLACE by
          labelScale around its own anchor (POINT 2). Anchor-preserving (translate THEN scale, not
          scale-the-whole-group) so a counter-scaled label gets bigger without floating upward into
          the agent above it — that float was what made adjacent active agents' tags collide. At
          labelScale 1 (office ≥ native) this is byte-identical to the prior `scale(1/1.35)`. */}
      <g transform={`scale(${1 / CHAR_SCALE})`}>
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
          {/* Declutter: the corner status glyph (⚡/✓/✕/◷) was a 3rd redundant status channel — the
              name-pill FILL color (tagFill) and the glow RING already encode status. Removed to de-noise
              every active sprite; status now rides on color + ring (visual) + the group aria-label (a11y). */}
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
          const bubbleLayout = characterBubbleLayout({ position: pos, labelScale })
          const below = bubbleLayout.below
          // AVO-158: a live poke quip momentarily PREEMPTS the ambient bubble (reuses the same
          // slot → no overlap, inherits edge-clamping). When a quip is showing, mark the group
          // as a polite live region so the acknowledge is announced once (reaction bob is
          // aria-hidden separately). aria-atomic so the whole short quip reads as one unit.
          const bubbleMsg = characterBubbleMessage({ pokeQuip, bubbleVisible, bubble: state.bubble })
          return (
            <g transform={`translate(0, ${bubbleLayout.y}) scale(${labelScale})`}
              role={pokeQuip ? 'status' : undefined}
              aria-live={pokeQuip ? 'polite' : undefined}
              aria-atomic={pokeQuip ? 'true' : undefined}>
              {/* #47: pass the agent's absolute scene x + net local→scene scale (labelScale, since
                  the char's 1.35 scale is undone above) so the bubble self-clamps horizontally and
                  far-left/right desks no longer clip the bubble at the office edge. */}
              <BehaviorBubble x={0} y={0} below={below} message={bubbleMsg} absX={pos.x} scale={labelScale} sceneMinX={sceneMinX} sceneW={sceneW} />
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
