// Cosmetic preferences live outside the agent/status store.
const STORAGE_KEY = 'avo.cozyInteractions'

export function createCozyPreferences(storage, warn = console.warn) {
  let enabled = false
  let warned = false
  const listeners = new Set()
  const storageUnavailable = () => {
    if (warned) return
    warned = true
    warn('[Office] Small interactions preference is available for this session only.')
  }
  try { enabled = storage?.getItem(STORAGE_KEY) === '1' } catch { storageUnavailable() }
  return {
    getSnapshot: () => enabled,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setEnabled(value) {
      const next = value === true
      if (enabled === next) return
      enabled = next
      try { storage?.setItem(STORAGE_KEY, next ? '1' : '0') } catch { storageUnavailable() }
      listeners.forEach(listener => listener())
    },
  }
}

let storage
try { storage = typeof window === 'undefined' ? undefined : window.localStorage } catch {
  console.warn('[Office] Small interactions storage access denied; using this session only.')
}
const preferences = createCozyPreferences(storage)
export const getCozyInteractionsEnabled = preferences.getSnapshot
export const subscribeCozyInteractions = preferences.subscribe
export const setCozyInteractionsEnabled = preferences.setEnabled
