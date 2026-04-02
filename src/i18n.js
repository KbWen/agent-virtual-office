// Lightweight i18n — no dependencies, ~30 lines
// Usage: import { t, locale, setLocale } from './i18n'
//   t('behaviorLabels.typing')  → "Typing" or "打字中"
//   t('bubbles.typing')         → ["hmm...", ...] (array)
//   locale()                    → "en" | "zh-TW"

import { useState, useEffect } from 'react'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'

const LOCALES = { en, 'zh-TW': zhTW }

// Detect language: ?lang= > localStorage > navigator > 'en'
function detectLang() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const param = params.get('lang')
    if (param && LOCALES[param]) return param
    const saved = localStorage.getItem('office-lang')
    if (saved && LOCALES[saved]) return saved
    // Check browser language — only map Traditional Chinese variants
    const nav = navigator.language
    if (nav === 'zh-TW' || nav === 'zh-Hant' || nav?.startsWith('zh-Hant')) return 'zh-TW'
  }
  return 'en'
}

let currentLang = detectLang()
let currentLocale = LOCALES[currentLang] || en
let listeners = []

export function locale() { return currentLang }
export function availableLocales() { return Object.keys(LOCALES) }

export function setLocale(lang) {
  if (!LOCALES[lang]) return
  currentLang = lang
  currentLocale = LOCALES[lang]
  if (typeof window !== 'undefined') {
    localStorage.setItem('office-lang', lang)
    document.documentElement.lang = lang
  }
  listeners.forEach(fn => fn(lang))
}

export function onLocaleChange(fn) {
  listeners.push(fn)
  return () => { listeners = listeners.filter(f => f !== fn) }
}

// React hook: re-renders component when locale changes
export function useLocale() {
  const [lang, setLang] = useState(currentLang)
  useEffect(() => onLocaleChange(setLang), [])
  return lang
}

// Get a nested value by dot path: t('bubbles.typing') → array
export function t(path, fallback) {
  const keys = path.split('.')
  let val = currentLocale
  for (const k of keys) {
    if (val == null) break
    val = val[k]
  }
  if (val != null) return val
  // Fallback to English
  val = en
  for (const k of keys) {
    if (val == null) break
    val = val[k]
  }
  return val ?? fallback ?? path
}

// Convenience: get behavior label for the status bar
export function behaviorLabel(behaviorId) {
  return t(`behaviorLabels.${behaviorId}`, behaviorId)
}

// ─── Custom name resolver (set by store to avoid circular dep) ───
let _nameResolver = null
export function setNameResolver(fn) { _nameResolver = fn }

// Convenience: get character name (custom profile overrides i18n)
export function charName(charId) {
  if (_nameResolver) {
    const custom = _nameResolver(charId)
    if (custom) return custom
  }
  // Strip session prefix: "feat-x~dev" → look up "dev", return "開發者"
  const baseRole = charId.includes('~') ? charId.split('~')[1] : charId
  return t(`characters.${baseRole}.name`, baseRole)
}

// Convenience: get event display name
export function eventName(eventId) {
  return t(`events.${eventId}.name`, eventId)
}

// Convenience: get a random bubble from a pool
export function randomBubble(poolKey) {
  const pool = t(`bubbles.${poolKey}`)
  if (Array.isArray(pool) && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)]
  }
  return null
}

// Convenience: get event-specific bubble
export function eventBubble(key) {
  const val = t(`eventBubbles.${key}`)
  if (Array.isArray(val)) {
    return val[Math.floor(Math.random() * val.length)]
  }
  return typeof val === 'string' ? val : null
}
