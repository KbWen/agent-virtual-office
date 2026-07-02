import { AGENT_CARRY_FIELDS } from '../utils/statusContract.mjs'

// Build the externalStatus entry for one routed agent update.
//
// This is intentionally renderer-agnostic: no store, React, pixel movement, bubbles, ledgers, or
// i18n. Consumers that render status in another UI can still share the exact truth-maintenance rules:
// - changedAt moves only on status/task signature changes, not on every poll refresh.
// - activeFileAt moves independently when activeFile changes, even if task remains "Edit".
// - done expires quickly; active working/blocked/planning-style states get the longer backstop.
export function buildExternalStatusEntry(prevExt, update, now) {
  const sigChanged = !prevExt || prevExt.status !== update.status || (prevExt.task || '') !== (update.task || '')
  const nextActiveFile = update.activeFile || null
  const fileChanged = !prevExt || (prevExt.activeFile || null) !== nextActiveFile
  const activeFileAt = nextActiveFile == null
    ? null
    : (fileChanged ? now : (Number.isFinite(prevExt.activeFileAt) ? prevExt.activeFileAt : now))
  const carryFields = {}
  for (const field of AGENT_CARRY_FIELDS) {
    if (field === 'activeFile') continue
    carryFields[field] = update[field] || null
  }
  return {
    entry: {
      status: update.status,
      ...carryFields,
      activeFile: nextActiveFile,
      activeFileAt,
      expiresAt: update.status === 'done' ? now + 10000 : now + 300000,
      changedAt: sigChanged ? now : (Number.isFinite(prevExt?.changedAt) ? prevExt.changedAt : now),
    },
    sigChanged,
  }
}
