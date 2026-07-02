export const STATUS_COLORS = Object.freeze({
  idle: '#888',
  working: '#EF9F27',
  done: '#5CB88A',
  blocked: '#E24B4A',
  planning: '#8B7FD6',
  'awaiting-approval': '#1E9FD4',
})

export function statusColor(status, fallback = '#888') {
  return STATUS_COLORS[status] || fallback
}

export function statusVisualState(status, { fallbackColor = '#888' } = {}) {
  const normalized = status || 'idle'
  const known = Object.prototype.hasOwnProperty.call(STATUS_COLORS, normalized)
  return {
    status: normalized,
    color: known ? STATUS_COLORS[normalized] : fallbackColor,
    tone: known ? normalized : 'unknown',
    known,
  }
}
