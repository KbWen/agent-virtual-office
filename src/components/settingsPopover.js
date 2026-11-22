// AVO-208 / AVO-209: pure helpers for the settings popover (kept DOM-framework-free so they are unit-testable).

// Bounded to the viewport (the popover is bottom-anchored above the bar) and scrollable when short.
export const SETTINGS_POPOVER_STYLE = { maxHeight: 'calc(100dvh - 4.5rem)', overflowY: 'auto' }

const FOCUSABLE = 'button, [href], input, select, [tabindex]:not([tabindex="-1"])'

// A mousedown on the gear is NOT "outside": the gear's own click toggles, so pre-closing would re-open it.
export function isOutsideSettings(target, menu, gear) {
  if (!menu) return false
  if (menu.contains(target)) return false
  if (gear && gear.contains(target)) return false
  return true
}

export function focusFirstItem(menu) {
  const first = menu && menu.querySelector(FOCUSABLE)
  if (first && typeof first.focus === 'function') { first.focus(); return true }
  return false
}

// Escape closes the menu and hands focus back to the gear.
export function handleSettingsKey(e, close, gear) {
  if (e.key !== 'Escape') return false
  // Settings listens on document, the agent inspector on window: stop here so one Escape closes
  // only the menu, not an inspector that is open underneath it.
  if (typeof e.stopPropagation === 'function') e.stopPropagation()
  close()
  if (gear && typeof gear.focus === 'function') gear.focus()
  return true
}
