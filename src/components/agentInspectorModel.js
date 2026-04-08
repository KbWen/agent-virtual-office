export function countAgentDoneToday(activityLog, agentId, now = Date.now()) {
  if (!agentId) return 0

  if (activityLog && !Array.isArray(activityLog) && typeof activityLog === 'object') {
    const today = new Date(now)
    const dayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')

    if (activityLog.dayKey !== dayKey || !activityLog.counts) return 0
    return Number(activityLog.counts[agentId] || 0)
  }

  if (!Array.isArray(activityLog) || activityLog.length === 0) return 0

  const today = new Date(now)
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime()

  return activityLog.filter((entry) =>
    entry?.agentId === agentId
    && entry?.type === 'status'
    && entry?.status === 'done'
    && typeof entry?.timestamp === 'number'
    && entry.timestamp >= startOfDay
    && entry.timestamp <= now
  ).length
}

export function buildAgentInspectorMeta(activityLog, agentId, mood, activeWorkflow, now = Date.now()) {
  return {
    doneToday: countAgentDoneToday(activityLog, agentId, now),
    mood: mood || 'normal',
    activeWorkflow: activeWorkflow || null,
  }
}
