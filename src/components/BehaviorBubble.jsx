import React, { useEffect, useState, useRef, useMemo } from 'react'

function BehaviorBubble({ x, y, message, below = false, absX = null, scale = 1, sceneMinX = 0, sceneW = 800, edgePad = 4 }) {
  const [visible, setVisible] = useState(false)
  const [currentMsg, setCurrentMsg] = useState(message)
  const fadeTimerRef = useRef(null)

  useEffect(() => {
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null }
    if (message) {
      setCurrentMsg(message)
      setVisible(true)
    } else {
      setVisible(false)
      // SVG <g> doesn't fire transitionend — use timeout matching transition duration
      fadeTimerRef.current = setTimeout(() => setCurrentMsg(null), 350)
    }
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current) }
  }, [message])

  // Derive display text + box width ONCE per message. Without this memo the three
  // surrogate-cleaning regexes and the width fitting (a few canvas measureText calls)
  // re-ran on every render — and BehaviorBubble re-renders on every x/y change while
  // its parent AgentCharacter walks (~30fps). The result depends only on currentMsg,
  // which changes a few times per minute, so x/y movement must not retrigger it.
  const derived = useMemo(() => {
    if (!currentMsg) return null
    return computeBubbleLayout(currentMsg)
  }, [currentMsg])

  if (!derived) return null

  const { displayMsg, boxW } = derived
  const boxH = 26
  // #47 — horizontal edge clamp. The bubble renders in character-local coords centered on x, but
  // an agent at a far-left/right desk would draw a wide bubble PAST the scene's x-edge (the office
  // svg clips its viewBox), cutting the bubble off. When the parent supplies the agent's absolute
  // scene x (`absX`) + the net local→scene scale, we shift the box horizontally so it stays inside
  // [edgePad, sceneW−edgePad] while the TAIL stays anchored on the agent (see tailAnchor below).
  // absX===null (back-compat / no scene context) → shift 0, byte-identical to the old centered box.
  const shift = computeEdgeShift({ boxW, absX, scale, sceneMinX, sceneW, edgePad })
  const bx = x - boxW / 2 + shift
  const textX = x + shift
  // Tail tip points at the agent (x); its base attaches to the shifted box, inset from the box edges
  // so a large shift slants the tail back to the speaker instead of detaching from it. The inset is
  // capped at boxW/2-1 so the clamp can't invert for a hypothetical sub-12px box (today boxW≥48).
  const tailInset = Math.min(6, boxW / 2 - 1)
  const tailAnchor = Math.max(bx + tailInset, Math.min(x, bx + boxW - tailInset))
  // `below`: for agents at the very top of the office, the default (above-the-head) bubble draws
  // past the SVG's top edge and gets clipped. The parent flips it BELOW the agent and the tail
  // points up instead of down.
  const by = below ? y + 8 : y - boxH - 8
  const tailBaseY = below ? by : by + boxH         // edge of the box the tail grows from
  const tailTipY = below ? by - 6 : by + boxH + 6  // the pointed tip (toward the agent)

  return (
    <g
      className="speech-bubble"
      data-bubble-visible={visible ? '1' : '0'}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-5px)',
        transition: 'opacity 0.3s, transform 0.3s',
      }}
    >
      {/* Bubble body */}
      <rect
        x={bx} y={by}
        width={boxW} height={boxH}
        rx={8}
        fill="white"
        stroke="#DDD"
        strokeWidth="1"
        filter="url(#bubble-shadow)"
      />
      {/* Triangle pointer: base on the (possibly shifted) box, tip at the agent (x) */}
      <polygon
        points={`${tailAnchor - 5},${tailBaseY} ${tailAnchor + 5},${tailBaseY} ${x},${tailTipY}`}
        fill="white"
        stroke="#DDD"
        strokeWidth="0.6"
      />
      {/* Cover the line where triangle meets rect */}
      <line x1={tailAnchor - 5} y1={tailBaseY} x2={tailAnchor + 5} y2={tailBaseY} stroke="white" strokeWidth="1.5" />
      {/* Text */}
      <text
        x={textX}
        y={by + boxH / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={BUBBLE_FONT_SIZE}
        fontFamily={BUBBLE_FONT_FAMILY}
        fontWeight={BUBBLE_FONT_WEIGHT}
        fill="#333"
      >
        {displayMsg}
      </text>
    </g>
  )
}

// React.memo: AgentCharacter (the parent) re-renders ~30fps while the character walks
// because its renderPos state updates every other RAF frame. BehaviorBubble's props are
// x=0 / y=-68 (constant literals) and message (changes a few times per minute), so on a
// walk-tick re-render none of its props change — memo skips the whole render + the JSX
// reconciliation of its ~5 SVG elements. The inner useMemo only guards the layout math;
// React.memo additionally elides the component invocation itself.
export default React.memo(BehaviorBubble)

// ─── Bubble text fitting (2026-09-19 review, REV-07) ─────────────────────────────────────────────
// The bubble used to cut every message at 16 CHARACTERS. Sixteen CJK characters are ~1.7× as wide as
// sixteen Latin ones, so 46% of English lines were cut mid-word ("forgot a semicol…") against 5% of
// zh-TW lines, and the box width came from a fixed per-character estimate that over-padded English by
// ~22%. The cut is now a WIDTH budget, measured in the bubble's own font, and the box is sized from the
// same measurement. Chosen by simulating five budgets over every locale line in a real browser: at 140
// both languages show more whole lines (en 52%→85%, zh 92%→95%) while the average bubble gets
// narrower in both and the widest one in the office shrinks (187→158).
export const BUBBLE_FONT_SIZE = 11
export const BUBBLE_FONT_FAMILY = "'Segoe UI', system-ui, sans-serif"
export const BUBBLE_FONT_WEIGHT = 500
// The canvas font string for exactly the <text> above — one source, so the measurement cannot drift.
export const BUBBLE_FONT = `${BUBBLE_FONT_WEIGHT} ${BUBBLE_FONT_SIZE}px ${BUBBLE_FONT_FAMILY}`
export const BUBBLE_TEXT_BUDGET = 140
const BOX_PADDING = 18
const BOX_MIN = 48

// Fallback when there is no DOM (tests, SSR): the previous fixed estimate — CJK ~11 units, other ~6.5.
function estimateBubbleText(s) {
  let w = 0
  for (const ch of s) w += ch.codePointAt(0) > 0x2E7F ? 11 : 6.5
  return w
}

// Real width in the bubble's font via canvas measureText (correct on every platform's fonts).
let measureCtx = null
function measureBubbleText(s) {
  if (typeof document === 'undefined') return estimateBubbleText(s)
  if (measureCtx === null) {
    measureCtx = document.createElement('canvas').getContext('2d') || false
    if (measureCtx) measureCtx.font = BUBBLE_FONT
  }
  return measureCtx ? measureCtx.measureText(s).width : estimateBubbleText(s)
}

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null
// User-perceived characters, so a cut never splits a ZWJ emoji, a flag or a skin-tone sequence.
const graphemes = (s) => (segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s))

// Longest prefix that fits `budget` with its ellipsis. When the cut would split a Latin word, it backs
// off to the previous space if that keeps most of the text; CJK has no spaces to back off to and is cut
// by width. Trailing spaces/punctuation are dropped before the ellipsis ("App.jsx,…" → "App.jsx…").
export function fitBubbleText(text, budget = BUBBLE_TEXT_BUDGET, measure = measureBubbleText) {
  if (!text || measure(text) <= budget) return text
  const g = graphemes(text)
  let k = 0
  while (k < g.length && measure(g.slice(0, k + 1).join('') + '…') <= budget) k++
  let kept = g.slice(0, k).join('')
  const next = g[k]
  if (next !== undefined && !/\s/u.test(next)) {
    const sp = kept.lastIndexOf(' ')
    const partialWord = kept.slice(sp + 1)
    if (sp > 0 && sp >= kept.length * 0.65 && /^[\p{Script=Latin}\p{N}'’.-]*$/u.test(partialWord)) {
      kept = kept.slice(0, sp)
    }
  }
  kept = kept.replace(/[\s,，、;；:：—–-]+$/u, '')
  return kept + '…'
}

// Pure layout derivation — extracted so the memo body stays small and the text-fitting work is
// unambiguously a function of the message string alone.
export function computeBubbleLayout(currentMsg, measure = measureBubbleText) {
  // Clean garbled characters: U+FFFD and unpaired surrogates only.
  // Full surrogate range strip destroyed non-BMP emoji (\uD83D\uDE80 etc.) \u2014 keep paired surrogates.
  const cleanMsg = currentMsg
    .replace(/\uFFFD/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')   // lone high surrogate
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')  // lone low surrogate

  const displayMsg = fitBubbleText(cleanMsg, BUBBLE_TEXT_BUDGET, measure)
  return { displayMsg, boxW: Math.max(Math.ceil(measure(displayMsg)) + BOX_PADDING, BOX_MIN) }
}

// #47 — pure horizontal-edge shift (local units) so a bubble centered on an agent at absolute scene
// x `absX` stays inside the VISIBLE viewBox x-range [sceneMinX+edgePad, sceneMinX+sceneW−edgePad].
// `sceneMinX` is 0 in the default office (viewBox 0..800) and non-zero in panel mode (cropped
// viewBox). `scale` is the net local→scene factor (so a local shift of `s` moves the box `s·scale`
// in scene units). Returns 0 when no scene context is given (absX null / non-finite scale) — the
// bubble then renders centered as before.
//   box scene span = absX + (localX ± boxW/2 + shift)·scale, with localX = 0 (bubble is centered on
//   the agent). Solve each edge for shift, then pick the value closest to 0 (no shift) that satisfies
//   both — pushing right when it would clip the left edge, left when it would clip the right.
// FLIP-BELOW (2026-09-19 review, REV-02): the above-the-head bubble's projected top is
// posY − 68 − 34·labelScale (scene units). When that crosses the VISIBLE top (+6px) the parent anchors
// the bubble just below the agent instead. `sceneMinY` is 0 in the default office and the crop's top
// in panel mode (e.g. 135) — testing against a literal 6 let top-aisle agents (y≈176–180) draw their
// whole bubble above a panel crop. Orphan guard (both axes): an agent whose anchor is itself outside
// the visible crop — above its top, or beyond its left/right edge (meeting-room chairs at x 645–765
// lie right of every panel crop) — is not on screen, and flipping would pull its speech into view
// with no visible speaker (ADR-007: the bubble is that agent's voice), so it keeps the default placement.
export function shouldFlipBubbleBelow({ posX, posY, labelScale = 1, sceneMinX = 0, sceneMinY = 0, sceneW = 800 }) {
  if (!isInsideX(posX, sceneMinX, sceneW) || !(posY >= sceneMinY)) return false
  const bubbleTopAbove = posY - 68 - 34 * labelScale
  return bubbleTopAbove < sceneMinY + 6
}

const isInsideX = (x, sceneMinX, sceneW) => Number.isFinite(x) && x >= sceneMinX && x <= sceneMinX + sceneW

export function computeEdgeShift({ boxW, absX, scale = 1, sceneMinX = 0, sceneW = 800, edgePad = 4 }) {
  if (absX == null || !Number.isFinite(absX) || !Number.isFinite(scale) || scale <= 0) return 0
  // Same orphan guard as the flip: a speaker outside the crop's x-range is off screen, so its bubble
  // is not dragged sideways into view (2026-09-19 review, round 1 / H1).
  if (!isInsideX(absX, sceneMinX, sceneW)) return 0
  const half = boxW / 2
  const minEdge = sceneMinX + edgePad           // left visible edge (+pad); 0-based in default mode
  const maxEdge = sceneMinX + sceneW - edgePad  // right visible edge (−pad)
  const leftBound = (minEdge - absX) / scale + half   // minimum shift to clear the left edge
  const rightBound = (maxEdge - absX) / scale - half  // maximum shift before clipping right
  // closest-to-zero shift within [leftBound, rightBound]. If the box is wider than the available
  // span (leftBound > rightBound) this yields rightBound — best effort that keeps the right edge in.
  return Math.min(Math.max(0, leftBound), rightBound)
}
