import { blockedReasonState } from './blockedReasonModel.mjs'

const BLOCKED_REASON_CAP = 28

export function formatTokens(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return String(Math.round(n))
}

export function blockedReasonPreview(ext, cap = BLOCKED_REASON_CAP) {
  if (!ext || ext.status !== 'blocked' || !ext.label) return null
  const limit = Number.isFinite(cap) ? Math.max(1, Math.floor(cap)) : BLOCKED_REASON_CAP
  const label = String(ext.label)
  return label.length > limit ? `${label.slice(0, limit - 1)}...` : label
}

export function agentLineToken(ext) {
  if (!ext) return null
  if (ext.status === 'blocked') {
    const { reason } = blockedReasonState(ext.reasonCode)
    return {
      kind: 'blocked-reason',
      reason,
      labelKey: `blockedReason.${reason}.label`,
      fallbackStatus: 'blocked',
    }
  }
  if (ext.task) {
    return {
      kind: 'task',
      task: ext.task,
    }
  }
  const status = ext.status || 'idle'
  return {
    kind: 'status',
    status,
    labelKey: `statusLabels.${status}`,
  }
}
