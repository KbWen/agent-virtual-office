// AVO-213: predictable keyboard focus path for the agent inspector.
// Pure helpers over a duck-typed document so they are unit-testable without a DOM.

// The element that opened the inspector: the focused agent <g> when it is the selected agent
// (keyboard Enter, or a mouse click that focused it), else a lookup by data-agent-id.
export function findInspectorOpener(doc, agentId) {
  if (!doc || !agentId) return null
  const active = doc.activeElement
  if (active && typeof active.getAttribute === 'function' && active.getAttribute('data-agent-id') === agentId) return active
  const id = String(agentId).replace(/["\\]/g, '\\$&')
  return doc.querySelector ? doc.querySelector(`[data-agent-id="${id}"]`) : null
}

export function focusElement(el) {
  if (!el || typeof el.focus !== 'function') return false
  try { el.focus({ preventScroll: true }) } catch { try { el.focus() } catch { return false } }
  return true
}

// Give focus back to the opener on close — only if it is still in the DOM and focus has not been
// moved somewhere deliberate (focus is on body/nothing, or still inside the closing dialog).
export function restoreInspectorFocus(doc, opener, dialog) {
  if (!doc || !opener || !doc.contains(opener)) return false
  const active = doc.activeElement
  const stranded = !active || active === doc.body || active === doc.documentElement
    || (dialog && typeof dialog.contains === 'function' && dialog.contains(active))
  return stranded ? focusElement(opener) : false
}
