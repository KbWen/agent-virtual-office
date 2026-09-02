import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { eventBubble } from '../src/i18n'
import en from '../src/locales/en.json'
import zh from '../src/locales/zh-TW.json'

/**
 * An eventBubbles key applied to MANY agents at once must hold a POOL, not one line.
 *
 * `eventBubble(key)` returns the string as-is when the key is a single string, so a key used
 * inside a `participants.forEach` / `.map` gives every reacting agent the IDENTICAL bubble.
 * Caught on screen: a Food Delivery event rendered two side-by-side "awesome! let's e…" bubbles.
 * Seven sibling keys (boss-visit, dog-visit, ac-broken, group-stretch, lunch-nap, deploy-celebrate,
 * pm-meeting-react) already had pools — the singles were an inconsistency, not a design choice.
 *
 * The multi-agent set is DERIVED from officeLife.js rather than hard-coded, so a NEW key added to
 * a fan-out call site is covered without anyone remembering to update this list.
 */

const SRC = readFileSync(new URL('../src/systems/officeLife.js', import.meta.url), 'utf8')

// A setAgentGroupEvent('pm', …) / setAgentBehavior('dev', …) targets ONE agent by construction,
// even when a nearby .map() put it in the lookback window. Without this, pm-meeting-lead — a
// single-agent line sitting eight lines under otherIds.map() — is a false positive.
const LITERAL_TARGET = /set(?:AgentGroupEvent|AgentBehavior)\(\s*'/

function deriveMultiAgentKeys() {
  const lines = SRC.split('\n')
  const keys = new Set()
  for (let i = 0; i < lines.length; i++) {
    const m = /eventBubble\('([^']+)'\)/.exec(lines[i])
    if (!m) continue
    const inFanOut = /\.forEach\(|\.map\(/.test(lines.slice(Math.max(0, i - 10), i + 1).join('\n'))
    if (!inFanOut) continue
    if (LITERAL_TARGET.test(lines.slice(Math.max(0, i - 6), i + 1).join('\n'))) continue
    keys.add(m[1])
  }
  return [...keys]
}

describe('multi-agent reaction bubbles', () => {
  const multi = deriveMultiAgentKeys()

  it('the derivation actually finds the fan-out call sites', () => {
    // Without this the suite passes vacuously the day the scan stops matching.
    expect(multi.length).toBeGreaterThanOrEqual(10)
    expect(multi).toEqual(expect.arrayContaining(['food-react', 'ac-fan', 'dog-woof', 'lunch-nap']))
  })

  it('excludes single-agent sites that merely sit near a fan-out', () => {
    expect(multi).not.toContain('pm-meeting-lead')
  })

  for (const locale of [['en', en], ['zh-TW', zh]]) {
    it(`[${locale[0]}] every fan-out key holds a pool of distinct lines`, () => {
      for (const key of multi) {
        const val = locale[1].eventBubbles?.[key]
        expect(Array.isArray(val), `${locale[0]} eventBubbles.${key} must be an array, got ${JSON.stringify(val)}`).toBe(true)
        expect(val.length, `${locale[0]} eventBubbles.${key} needs >= 3 lines`).toBeGreaterThanOrEqual(3)
        expect(new Set(val).size, `${locale[0]} eventBubbles.${key} has duplicate lines`).toBe(val.length)
        for (const line of val) expect(typeof line).toBe('string')
      }
    })
  }

  it('eventBubble actually VARIES for a pooled key — shape in the JSON is not the same as wiring', () => {
    // A pool nothing reads is still one line on screen. Draw enough times that a working pool
    // cannot plausibly return one value: P(all 40 draws identical | 5 lines) = 5^-39.
    const draws = new Set()
    for (let i = 0; i < 40; i++) draws.add(eventBubble('food-react'))
    expect(draws.size).toBeGreaterThan(1)
    for (const d of draws) expect(en.eventBubbles['food-react']).toContain(d)
  })

  it('en and zh-TW agree on which eventBubbles keys are pools', () => {
    // A locale that keeps a single string where its twin has a pool reintroduces the defect for
    // half the users, and nothing else would notice.
    const shape = (o) => Object.fromEntries(Object.entries(o.eventBubbles).map(([k, v]) => [k, Array.isArray(v)]))
    expect(shape(zh)).toEqual(shape(en))
  })
})
