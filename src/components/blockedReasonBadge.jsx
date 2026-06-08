// AVO-110 / #29 — the over-head "status-effect" badge for a blocked agent.
// Game surface: a small RPG-debuff glyph in the pixel-office idiom. Real info: each glyph is a
// 1:1 map of the hook-derived `reasonCode` (a pure table lookup — NO second classifier), and the
// localized a11y string rides in an SVG <title> so screen readers + hover get the words.
//
// COLOR-NEVER-ONLY: each reason is a DISTINCT silhouette; `hue` is the 3rd redundant channel only.
// `blocked-unknown` is a neutral grey '?' (honest uncertainty) — deliberately NOT a red failure ✗,
// which would over-claim an assertion-level outcome (AC-4). The entry-pop + reduced-motion handling
// live in the PARENT (AgentCharacter), keyed on reasonCode, so this component is a pure glyph.
import { classifyBlockedReason } from '../systems/classify'
import { t } from '../i18n'

const STROKE = '#2a2a2a'

// Each glyph is drawn in a ~ -5..5 box, sitting inside a rounded chip with a 1px dark outline so it
// reads on any office wall colour. Shapes are intentionally distinct in SILHOUETTE.
function Glyph({ iconId, hue }) {
  switch (iconId) {
    case 'beaker-crack': // test run — a flask/beaker with a crack slash
      return (
        <g stroke={STROKE} strokeWidth={0.7} strokeLinejoin="round">
          <path d="M-1.5,-4 L1.5,-4 M-1,-4 L-1,-0.5 L-3,3 Q-3.2,4 -2,4 L2,4 Q3.2,4 3,3 L1,-0.5 L1,-4" fill={hue} />
          <line x1={-2.4} y1={2} x2={2.4} y2={-1} stroke="#fff" strokeWidth={0.8} />
        </g>
      )
    case 'hammer-crack': // build — a hammer head + handle
      return (
        <g stroke={STROKE} strokeWidth={0.7} strokeLinejoin="round">
          <rect x={-3.5} y={-4} width={7} height={2.6} rx={0.6} fill={hue} />
          <rect x={-0.8} y={-1.4} width={1.6} height={5.4} rx={0.4} fill={hue} />
        </g>
      )
    case 'box-open-x': // deps — an open package box
      return (
        <g stroke={STROKE} strokeWidth={0.7} strokeLinejoin="round">
          <path d="M-3.5,-1 L0,-3 L3.5,-1 L0,1 Z" fill="#fff" />
          <path d="M-3.5,-1 L-3.5,3.2 L0,4.4 L0,1 Z" fill={hue} />
          <path d="M3.5,-1 L3.5,3.2 L0,4.4 L0,1 Z" fill={hue} opacity={0.82} />
        </g>
      )
    default: // 'q-neutral' — honest uncertainty: a hollow '?' in a muted ring (lowest chroma)
      return (
        <g stroke={STROKE} strokeWidth={0.7}>
          <circle cx={0} cy={0} r={4.2} fill={hue} />
          <text x={0} y={2.4} textAnchor="middle" fontSize={6} fontWeight="bold" fill="#fff" stroke="none">?</text>
        </g>
      )
  }
}

// Pure glyph group. `reasonCode` is the hook-stamped token; anything unknown/absent → blocked-unknown
// (the honest floor) via classifyBlockedReason. Positioned over the head, mirroring BehaviorIndicator.
// AVO-117: when `recurring` is true (the SAME specific kind has recurred ≥N times in the window — see
// recurringFailure.js), escalate with a small ↻ loop mark + the recurring a11y wording. The wording
// claims only the recurring PATTERN of a kind ("tests keep failing"), NEVER a specific root cause.
export function BlockedReasonBadge({ reasonCode, recurring = false }) {
  const { reason, iconId, hue, a11yKey } = classifyBlockedReason(reasonCode)
  // recurring only escalates the 3 specific reasons (blocked-unknown never recurs — see recurringFailure)
  const escalate = recurring && reason !== 'blocked-unknown'
  const label = escalate ? t(`recurringFailure.${reason}.a11y`, t(a11yKey, 'Blocked')) : t(a11yKey, 'Blocked')
  return (
    <g transform="translate(13, -9)" role="img" aria-label={label}>
      <title>{label}</title>
      {/* effect-chip backdrop: 1px dark outline so the glyph reads on any wall colour */}
      <rect x={-6} y={-6} width={12} height={12} rx={3} fill="#fdfdfd" stroke={STROKE} strokeWidth={0.8} opacity={0.96} />
      <Glyph iconId={iconId} hue={hue} />
      {escalate && (
        // quiet escalation (calm-tech: no alarm) — a small ↻ loop mark in the corner saying "again".
        <g transform="translate(5, -5)" aria-hidden="true">
          <circle cx={0} cy={0} r={3.2} fill="#c0392b" stroke="#fff" strokeWidth={0.6} />
          <text x={0} y={1.6} textAnchor="middle" fontSize={4.4} fontWeight="bold" fill="#fff" stroke="none">↻</text>
        </g>
      )}
    </g>
  )
}
