export function localDayKey(now = Date.now()) {
  const date = new Date(now)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function cleanCounts(counts = {}) {
  const clean = {}
  for (const [agentId, value] of Object.entries(counts || {})) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      clean[agentId] = value
    }
  }
  return clean
}

export function createDailyDoneLedger(now = Date.now(), seed = {}) {
  return {
    dayKey: localDayKey(now),
    counts: seed.counts && typeof seed.counts === 'object' ? { ...seed.counts } : {},
    seenEventKeys: Array.isArray(seed.seenEventKeys) ? [...seed.seenEventKeys] : [],
  }
}

export function ensureCurrentDailyDoneLedger(ledger, now = Date.now()) {
  const dayKey = localDayKey(now)
  if (!ledger || ledger.dayKey !== dayKey) return createDailyDoneLedger(now)
  return createDailyDoneLedger(now, ledger)
}

export function createDailyBlockedLedger(now = Date.now(), seed = {}) {
  return {
    dayKey: localDayKey(now),
    counts: seed.counts && typeof seed.counts === 'object' ? { ...seed.counts } : {},
  }
}

export function ensureCurrentDailyBlockedLedger(ledger, now = Date.now()) {
  const dayKey = localDayKey(now)
  if (!ledger || ledger.dayKey !== dayKey) return createDailyBlockedLedger(now)
  return createDailyBlockedLedger(now, ledger)
}

export function buildDoneEventKey(update, meta = {}) {
  if (!update?.agentId) return null
  if (meta.eventKey) return `${meta.eventKey}:${update.agentId}`
  if (meta.source && meta.seq) return `${meta.source}:${meta.seq}:${update.agentId}`
  return null
}

export function validatePersistedDailyDoneLedger(saved, now = Date.now()) {
  if (!saved || typeof saved !== 'object') return null
  const dayKey = typeof saved.dayKey === 'string' ? saved.dayKey : null
  if (!dayKey) return null
  if (dayKey !== localDayKey(now)) return createDailyDoneLedger(now)

  return {
    dayKey,
    counts: cleanCounts(saved.counts),
    seenEventKeys: Array.isArray(saved.seenEventKeys)
      ? saved.seenEventKeys.filter((value) => typeof value === 'string').slice(-500)
      : [],
  }
}

export function validatePersistedDailyBlockedLedger(saved, now = Date.now()) {
  if (!saved || typeof saved !== 'object') return null
  const dayKey = typeof saved.dayKey === 'string' ? saved.dayKey : null
  if (!dayKey) return null
  if (dayKey !== localDayKey(now)) return createDailyBlockedLedger(now)

  return {
    dayKey,
    counts: cleanCounts(saved.counts),
  }
}
