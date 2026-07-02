import { BLOCKED_REASONS } from '../utils/statusContract.mjs'

// Node-safe presentation metadata for blocked reason codes.
//
// The hook stamps a language-neutral reasonCode; renderers can use this model to pick
// an icon, hue, and i18n/a11y key without importing the full task classifier or React UI.
const BLOCKED_REASON_TABLE = Object.freeze({
  'test-run-failed': { iconId: 'beaker-crack', hue: '#d98a2b', a11yKey: 'blockedReason.test-run-failed.a11y' },
  'build-failed': { iconId: 'hammer-crack', hue: '#c96f3a', a11yKey: 'blockedReason.build-failed.a11y' },
  'deps-failed': { iconId: 'box-open-x', hue: '#d98a2b', a11yKey: 'blockedReason.deps-failed.a11y' },
  'blocked-unknown': { iconId: 'q-neutral', hue: '#8a8f99', a11yKey: 'blockedReason.blocked-unknown.a11y' },
  'permission-denied': { iconId: 'slash-circle', hue: '#a0522d', a11yKey: 'blockedReason.permission-denied.a11y' },
  'api-rate-limit': { iconId: 'hourglass', hue: '#5b7fa6', a11yKey: 'blockedReason.api-rate-limit.a11y' },
  'api-auth-failed': { iconId: 'key-broken', hue: '#7a5c99', a11yKey: 'blockedReason.api-auth-failed.a11y' },
})

export { BLOCKED_REASONS }
export const BLOCKED_REASON_TABLE_CODES = Object.freeze(Object.keys(BLOCKED_REASON_TABLE))

export function blockedReasonState(reasonCode) {
  const code = (typeof reasonCode === 'string' && BLOCKED_REASON_TABLE[reasonCode])
    ? reasonCode
    : 'blocked-unknown'
  return { family: 'blocked', reason: code, ...BLOCKED_REASON_TABLE[code] }
}

export const classifyBlockedReason = blockedReasonState
