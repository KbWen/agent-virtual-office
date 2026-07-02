function stripActivityPrefix(message) {
  return String(message ?? '').replace(/^✏️\s*/u, '').trim()
}

function basename(path) {
  const clean = stripActivityPrefix(path)
  const parts = clean.split(/[\\/]/)
  return parts[parts.length - 1] || clean
}

function isPlainNote(base) {
  return /\.(md|mdx|txt|rst)$/i.test(base)
}

function isAgentStatusLog(base) {
  return /^agent-[a-z0-9]+\.jsonl$/i.test(base)
}

function isStatusSnapshotArtifact(base) {
  return /(?:^|[-_.])(?:office-hook-capture|hook-capture|status-snapshot|status-capture)(?:[-_.]|$)/i.test(base)
}

function isTemporaryFile(base) {
  return /\.tmp(?:\.|$)/i.test(base)
}

export function activityFeedMessage(entry, { t = (_key, fallback) => fallback, eventName = (id) => id } = {}) {
  if (!entry) return { text: '', title: null }
  if (entry.type === 'event') {
    const text = eventName(entry.message) || String(entry.message ?? '')
    return { text, title: null }
  }

  const raw = String(entry.message ?? '')
  const base = basename(raw)
  if (isAgentStatusLog(base)) {
    return { text: t('activityFeed.agentStatusUpdated', 'Agent status updated'), title: raw }
  }
  if (isTemporaryFile(base)) {
    return { text: t('activityFeed.temporaryFileUpdated', 'Temporary file updated'), title: raw }
  }
  if (isStatusSnapshotArtifact(base)) {
    return { text: t('activityFeed.statusSnapshotUpdated', 'Status snapshot updated'), title: raw }
  }
  if (/\.jsonl$/i.test(base)) {
    return { text: t('activityFeed.sessionLogUpdated', 'Session log updated'), title: raw }
  }
  if (/worklog|codex-|product-audit/i.test(base)) {
    return { text: t('activityFeed.workNoteUpdated', 'Work note updated'), title: raw }
  }
  if (isPlainNote(base)) {
    return { text: t('activityFeed.noteUpdated', 'Note updated'), title: raw }
  }
  return { text: raw, title: null }
}
