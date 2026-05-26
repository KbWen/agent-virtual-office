import { describe, it, expect } from 'vitest'
import events from '../src/config/officeEvents.json'

// Valid participant selector strings accepted by pickParticipants in officeLife.js.
const VALID_SELECTOR_STRINGS = new Set(['all', 'random-2-3', 'random-1-neighbor'])

// Valid role ids accepted as array participants (must exist in the static roster).
const VALID_ROLES = new Set(['dev', 'qa', 'arch', 'pm', 'ops', 'res', 'gate', 'designer'])

const allEvents = [...(events.daily || []), ...(events.rare || [])]

describe('officeEvents.json — structural schema', () => {
  it('daily and rare event arrays are non-empty', () => {
    expect(Array.isArray(events.daily)).toBe(true)
    expect(events.daily.length).toBeGreaterThan(0)
    expect(Array.isArray(events.rare)).toBe(true)
    expect(events.rare.length).toBeGreaterThan(0)
  })

  it('every event has non-empty string id, name, description', () => {
    for (const ev of allEvents) {
      expect(typeof ev.id,          `[${ev.id}] id type`         ).toBe('string')
      expect(ev.id.length,          `[${ev.id}] id empty`        ).toBeGreaterThan(0)
      expect(typeof ev.name,        `[${ev.id}] name type`       ).toBe('string')
      expect(ev.name.length,        `[${ev.id}] name empty`      ).toBeGreaterThan(0)
      expect(typeof ev.description, `[${ev.id}] description type`).toBe('string')
    }
  })

  it('every event has a positive finite duration (milliseconds)', () => {
    for (const ev of allEvents) {
      expect(typeof ev.duration,          `[${ev.id}] duration type`    ).toBe('number')
      expect(Number.isFinite(ev.duration), `[${ev.id}] duration finite` ).toBe(true)
      expect(ev.duration,                  `[${ev.id}] duration > 0`    ).toBeGreaterThan(0)
    }
  })

  it('every event has a valid participants field (selector string or role array)', () => {
    for (const ev of allEvents) {
      const p = ev.participants
      if (typeof p === 'string') {
        expect(
          VALID_SELECTOR_STRINGS.has(p),
          `[${ev.id}] participants string "${p}" not in valid set`,
        ).toBe(true)
      } else {
        expect(Array.isArray(p), `[${ev.id}] participants must be string or array`).toBe(true)
        expect(p.length,         `[${ev.id}] participants array empty`             ).toBeGreaterThan(0)
        for (const role of p) {
          expect(
            VALID_ROLES.has(role),
            `[${ev.id}] participants array contains unknown role "${role}"`,
          ).toBe(true)
        }
      }
    }
  })

  it('event ids are unique across daily + rare', () => {
    const ids = allEvents.map((e) => e.id)
    expect(new Set(ids).size, 'duplicate event id detected').toBe(ids.length)
  })

  it('bubbleMessages (if present) contains only arrays of strings', () => {
    const bm = events.bubbleMessages
    if (!bm) return // optional field
    for (const [key, pool] of Object.entries(bm)) {
      expect(Array.isArray(pool), `bubbleMessages.${key} must be array`).toBe(true)
      for (const msg of pool) {
        expect(typeof msg, `bubbleMessages.${key}[] must be string`).toBe('string')
      }
    }
  })
})
