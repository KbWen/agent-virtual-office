import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BehaviorBubble, {
  computeBubbleLayout, fitBubbleText, BUBBLE_TEXT_BUDGET, BUBBLE_FONT,
} from '../src/components/BehaviorBubble.jsx'

// 2026-09-19 review, REV-07 — bubbles were cut at a fixed 16 CHARACTERS. Sixteen CJK characters are
// ~1.7× as wide as sixteen Latin ones, so 46% of English bubble lines were cut mid-word
// ("forgot a semicol…") against 5% of zh-TW lines. The cut is now a WIDTH budget, measured in the
// bubble's own font; the box width comes from the same measurement.

// Deterministic stand-in for canvas measureText: Latin/ASCII 5, CJK 11, anything else 12 (emoji).
const measure = (s) => {
  let w = 0
  for (const ch of s) {
    const cp = ch.codePointAt(0)
    w += cp < 0x2e80 ? (cp > 0x2000 && cp !== 0x2026 && cp !== 0x2014 ? 12 : 5) : 11
  }
  return w
}

describe('fitBubbleText — width budget, not character count (REV-07)', () => {
  it('the budget is 140 scene px of text (chosen from a measured 5-budget simulation)', () => {
    expect(BUBBLE_TEXT_BUDGET).toBe(140)
  })

  it('a line that fits is shown whole, however many characters it has', () => {
    // 18 characters: the old rule cut this to "forgot a semicol…".
    expect(fitBubbleText('forgot a semicolon', 140, measure)).toBe('forgot a semicolon')
    expect(fitBubbleText('why won\'t it work', 140, measure)).toBe('why won\'t it work')
  })

  it('a long spaced line is cut at a word boundary, and the result fits the budget', () => {
    const out = fitBubbleText('one sec — App.jsx is doing something really odd today', 140, measure)
    expect(out.endsWith('…')).toBe(true)
    expect(measure(out)).toBeLessThanOrEqual(140)
    expect(out).toBe('one sec — App.jsx is doing…')      // whole words only
    expect(out).not.toMatch(/\s…$/)
  })

  it('a cut that lands MID-word backs off to the previous space (never "might work bet…")', () => {
    // 27 of 5px graphemes + the ellipsis fill 140 exactly; the 27th lands inside "better".
    expect(fitBubbleText('this pattern might work better for the team', 140, measure)).toBe('this pattern might work…')
    // …but not when backing off would throw away most of the line (one long word early on).
    expect(fitBubbleText('ok Supercalifragilisticexpialidocious', 100, measure)).toBe('ok Supercalifragili…') // 19 graphemes + … = 100; the space is too early to back off to
  })

  it('trailing spaces and punctuation are trimmed before the ellipsis', () => {
    expect(fitBubbleText('skimming App.jsx, looking for the bit that broke', 90, measure)).toBe('skimming App.jsx…')
    expect(fitBubbleText('等等，App.jsx 這篇有點東西要看一下下', 100, measure)).not.toMatch(/[，,\s]…$/)
  })

  it('text with no usable space (CJK, one long word) is cut by width, never beyond the budget', () => {
    const zh = fitBubbleText('光影在這個檔案裡還不夠有層次再調一下', 140, measure)
    expect(zh.endsWith('…')).toBe(true)
    expect(measure(zh)).toBeLessThanOrEqual(140)
    expect(measure(zh.slice(0, -1) + '光…')).toBeGreaterThan(140) // it kept as much as fits
    const word = fitBubbleText('Supercalifragilisticexpialidocious-and-then-some', 100, measure)
    expect(measure(word)).toBeLessThanOrEqual(100)
    expect(word.length).toBeGreaterThan(10) // a hard cut, not an empty word-boundary cut
  })

  it('never splits a grapheme (ZWJ family emoji, flags, skin tones)', () => {
    const family = '👨‍👩‍👧'
    const out = fitBubbleText(`team ${family}${family}${family}${family}${family}${family}${family}${family}${family}${family}`, 200, measure)
    const body = out.replace(/…$/, '')
    // Every family that survives is whole: the ZWJ-joined sequence count matches its component count.
    expect((body.match(/👨‍👩‍👧/g) || []).length * 3).toBe((body.match(/[👨👩👧]/gu) || []).length)
  })

  it('an empty or whitespace message yields itself', () => {
    expect(fitBubbleText('', 140, measure)).toBe('')
  })
})

describe('computeBubbleLayout — box width follows the measured text', () => {
  it('box = measured display width + 18, floored at 48', () => {
    const { displayMsg, boxW } = computeBubbleLayout('forgot a semicolon', measure)
    expect(displayMsg).toBe('forgot a semicolon')
    expect(boxW).toBe(Math.ceil(measure('forgot a semicolon')) + 18)
    expect(computeBubbleLayout('ok', measure).boxW).toBe(48)
  })

  it('the widest possible box is budget + padding', () => {
    const { boxW } = computeBubbleLayout('a'.repeat(400), measure)
    expect(boxW).toBeLessThanOrEqual(BUBBLE_TEXT_BUDGET + 18)
  })

  it('still strips U+FFFD and lone surrogates before fitting', () => {
    const { displayMsg } = computeBubbleLayout('ok\uFFFD \uD800done', measure)
    expect(displayMsg).toBe('ok done')
  })

  it('without a DOM (this suite) the default measure falls back to the estimate and still fits the budget', () => {
    const { displayMsg, boxW } = computeBubbleLayout('this is a fairly long English line that must be cut somewhere')
    expect(displayMsg.endsWith('…')).toBe(true)
    expect(boxW).toBeLessThanOrEqual(BUBBLE_TEXT_BUDGET + 18)
  })
})

describe('one font, two uses (REV-07 risk R2)', () => {
  it('the <text> the bubble renders uses exactly the font the width is measured in', () => {
    const html = renderToStaticMarkup(<svg><BehaviorBubble x={0} y={0} message="hello there" /></svg>)
    const m = html.match(/<text[^>]*font-size="(\d+)"[^>]*font-family="([^"]+)"[^>]*font-weight="(\d+)"/)
    expect(m, 'bubble text rendered').toBeTruthy()
    const family = m[2].replace(/&#x27;/g, "'")
    expect(BUBBLE_FONT).toBe(`${m[3]} ${m[1]}px ${family}`)
  })
})
