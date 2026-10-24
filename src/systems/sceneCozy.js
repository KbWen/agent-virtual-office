import { classifyMood } from './classify.js'
import { todayKey } from './dailyCard.js'

// Snapshot only when the real scene card is picked up; subsequent work stays live.
export function captureSceneCardInput(state, locale, dayKey = todayKey()) {
  return {
    dayKey,
    doneTotal: Object.values(state.dailyDoneLedger?.counts || {}).reduce((sum, value) => sum + value, 0),
    blockedTotal: Object.values(state.dailyBlockedLedger?.counts || {}).reduce((sum, value) => sum + value, 0),
    mood: state.mood,
    weather: classifyMood(state.mood).family,
    locale,
  }
}
