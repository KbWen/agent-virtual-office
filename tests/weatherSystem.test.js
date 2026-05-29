import { describe, it, expect } from 'vitest'
import { moodToWeather } from '../src/components/TopDownFurniture'

describe('moodToWeather — pure mood→weather mapping (#14)', () => {
  it('stuck → thunderstorm (escalation from frustrated)', () => {
    expect(moodToWeather('stuck')).toBe('thunderstorm')
  })

  it('frustrated → rain (per backlog spec)', () => {
    expect(moodToWeather('frustrated')).toBe('rain')
  })

  it('rushing → cloudy', () => {
    expect(moodToWeather('rushing')).toBe('cloudy')
  })

  it('smooth → clear', () => {
    expect(moodToWeather('smooth')).toBe('clear')
  })

  it('intense → clear', () => {
    expect(moodToWeather('intense')).toBe('clear')
  })

  it('normal → clear', () => {
    expect(moodToWeather('normal')).toBe('clear')
  })

  it('idle → clear', () => {
    expect(moodToWeather('idle')).toBe('clear')
  })

  it('undefined → clear (graceful default for missing mood)', () => {
    expect(moodToWeather(undefined)).toBe('clear')
  })

  it('null → clear', () => {
    expect(moodToWeather(null)).toBe('clear')
  })

  it('unknown garbage string → clear (no crash on future mood values)', () => {
    expect(moodToWeather('hyperventilating')).toBe('clear')
    expect(moodToWeather('')).toBe('clear')
    expect(moodToWeather('STUCK')).toBe('clear') // case-sensitive: distinct from 'stuck'
  })

  it('non-string input → clear (defensive)', () => {
    expect(moodToWeather(42)).toBe('clear')
    expect(moodToWeather({})).toBe('clear')
    expect(moodToWeather([])).toBe('clear')
    expect(moodToWeather(true)).toBe('clear')
  })

  it('covers every mood enum value documented in store.js', () => {
    // store.js:831 documents: normal | rushing | frustrated | stuck | smooth | intense | idle
    const allMoods = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
    const weathers = allMoods.map(moodToWeather)
    // No mood ever yields undefined / falsy weather — every input maps to a defined string
    for (const w of weathers) {
      expect(typeof w).toBe('string')
      expect(['clear', 'cloudy', 'rain', 'thunderstorm']).toContain(w)
    }
  })
})
