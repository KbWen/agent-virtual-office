// Pure label/format helpers used by ControlPanel (and NarrowRoster). Extracted out of the
// ControlPanel.jsx god-component so they're unit-testable WITHOUT importing the React/JSX module
// (engineering-retro debt cleanup). No React here — plain functions of plain data.
import { classifyTask, classifyBlockedReason } from '../systems/classify'

// Collapse a raw tool/task name into the same short chip the character's TaskLabel (AVO-103) shows,
// so the panel never displays the ugly `mcp__Server__tool` wire form. Built-ins stay short (`Bash`),
// MCP tools collapse to `server::tool`, unknowns are truncated. Returns null for an empty task so
// callers can fall back to the localized status label.
export function taskChipLabel(task) {
  if (!task) return null
  return classifyTask(task).visualLabel
}

// AVO-110: the RAW hook label ("❌ npm test failed") — kept as the HOVER/DECODE layer only (shown in
// ControlPanel row titles). It is NOT the glance label anymore: the visible glance label now comes
// from the structured reasonCode token (see agentLineLabel) so the panel never re-parses free text
// (NO-RENDER-SIDE-DERIVATION). Returns null for any non-blocked / label-less agent.
const BLOCKED_REASON_CAP = 28
export function blockedReasonLabel(ext) {
  if (!ext || ext.status !== 'blocked' || !ext.label) return null
  const l = ext.label
  return l.length > BLOCKED_REASON_CAP ? l.slice(0, BLOCKED_REASON_CAP - 1) + '…' : l
}

// AVO-110: the panel-row "icon" channel — a recognizable glyph per blocked-reason (HTML roster, so
// an emoji is fine here; the in-scene office badge uses bespoke SVG per AC-7). Derived from the
// reasonCode token via classifyBlockedReason; null for any non-blocked agent. Pairs with the i18n
// text from agentLineLabel so the row is icon + text (never icon-only, never colour-only).
const REASON_GLYPH = Object.freeze({
  'test-run-failed':  '🧪',
  'build-failed':     '🛠️',
  'deps-failed':      '📦',
  'blocked-unknown':  '❔',
  // AVO-148: structured-event reasons
  'permission-denied': '🚫',
  'api-rate-limit':    '⏳',
  'api-auth-failed':   '🔑',
})
export function blockedReasonGlyph(ext) {
  if (!ext || ext.status !== 'blocked') return null
  return REASON_GLYPH[classifyBlockedReason(ext.reasonCode).reason] || REASON_GLYPH['blocked-unknown']
}

// AVO-108: compact token formatter — 604937 → "605k", 1240000 → "1.2M", 842 → "842".
export function formatTokens(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return String(Math.round(n))
}

// The single label a ControlPanel agent row shows. AVO-110: for a blocked agent it is the localized
// REASON label derived from the structured reasonCode token (claims only what the signal proves —
// "Test run" / "卡在測試執行", never "test failed"), NOT a re-parse of the raw ext.label. Otherwise:
// the collapsed tool chip, then the localized status word. `t` is the i18n lookup.
export function agentLineLabel(ext, t) {
  if (!ext) return null
  if (ext.status === 'blocked') {
    const { reason } = classifyBlockedReason(ext.reasonCode)
    return t(`blockedReason.${reason}.label`, t('statusLabels.blocked', 'Blocked'))
  }
  return taskChipLabel(ext.task)
    || t(`statusLabels.${ext.status}`, ext.status)
}

// #28 — DEV-only diagnostics gate for the RAF-watchdog restart counter. Shown only in dev builds AND
// only once a stall has happened (count > 0), so it's invisible at rest and zero-cost in production
// (`import.meta.env.DEV` is a compile-time constant → the render branch is dead-code-eliminated from
// the prod bundle). Pure so it can be unit-tested without a DOM.
export function shouldShowWatchdogDiag(count, isDev = import.meta.env.DEV) {
  return !!isDev && typeof count === 'number' && count > 0
}
