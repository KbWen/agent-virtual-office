// AVO-210: browser storage can throw (SecurityError when cookies/site data are blocked, e.g. in a
// third-party iframe) — even *reading* `window.localStorage` can throw, not only getItem/setItem.
// Every startup/UI-path preference access goes through these helpers: reads fall back to the
// supplied default, writes fail silently. Preferences are a convenience, never a requirement.

export function safeGet(key, fallback = null) {
  try {
    if (typeof window === 'undefined') return fallback
    const v = window.localStorage.getItem(key)
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

export function safeSet(key, value) {
  try {
    if (typeof window === 'undefined') return false
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeRemove(key) {
  try {
    if (typeof window === 'undefined') return false
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
