import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  buildCardModel,
  captionKeyFor,
  resolveCardStrings,
  shareOrDownloadCard,
  todayKey,
} from './dailyCard.js'

// These tests cover the PURE model + the feature-detected share fallback. The actual
// canvas→PNG render (renderDailyCard) needs a DOM and is verified live/Playwright, not here
// (vitest runs in a node env with no canvas — see Work Log Known Risk).

describe('captionKeyFor — derived purely from done + mood (no event counting)', () => {
  it('returns the quiet empty-day variant when nothing was done', () => {
    expect(captionKeyFor(0, 'smooth')).toBe('empty')
    expect(captionKeyFor(0, 'stuck')).toBe('empty')
  })
  it('maps mood to a cozy phrase when there is real done activity', () => {
    expect(captionKeyFor(5, 'smooth')).toBe('smooth')
    expect(captionKeyFor(5, 'rushing')).toBe('busy')
    expect(captionKeyFor(5, 'frustrated')).toBe('rainy')
    expect(captionKeyFor(5, 'stuck')).toBe('stormy')
    expect(captionKeyFor(5, 'intense')).toBe('headsdown')
    expect(captionKeyFor(5, 'whatever-unknown')).toBe('smooth')
  })
})

describe('buildCardModel — AC-3 honest empty day / AC-6 cozy not stats / AC-4 metadata', () => {
  it('AC-3: empty day renders quietly with NO fabricated number', () => {
    const m = buildCardModel({ dayKey: '2026-06-14', doneTotal: 0, blockedTotal: 0, mood: 'idle', weather: 'clear', locale: 'en' })
    expect(m.isEmptyDay).toBe(true)
    expect(/\d/.test(m.caption)).toBe(false)       // no count in the quiet caption
    expect(m.numericTokenCount).toBe(0)
    expect(m.blockedTail).toBeNull()
  })

  it('AC-6: a busy day weaves in exactly ONE number, never a stats grid', () => {
    const m = buildCardModel({ dayKey: '2026-06-14', doneTotal: 7, blockedTotal: 0, mood: 'smooth', weather: 'clear', locale: 'en' })
    expect(m.caption).toContain('7')
    expect(m.numericTokenCount).toBe(1)
    expect(m.numericTokenCount).toBeLessThanOrEqual(2)
  })

  it('AC-6: blocked is a qualitative tail with NO number (count stays 1 = done only)', () => {
    const few = buildCardModel({ doneTotal: 3, blockedTotal: 1, mood: 'frustrated', weather: 'rain', locale: 'en' })
    expect(few.blockedTail).toBeTruthy()
    expect(/\d/.test(few.blockedTail)).toBe(false)
    expect(few.numericTokenCount).toBe(1)
    const many = buildCardModel({ doneTotal: 3, blockedTotal: 9, mood: 'stuck', weather: 'thunderstorm', locale: 'en' })
    expect(many.blockedTail).not.toBe(few.blockedTail) // few vs many wording differs
  })

  it('AC-4: footer carries the date + source so a shared image is unambiguous', () => {
    const m = buildCardModel({ dayKey: '2026-06-14', doneTotal: 2, mood: 'normal', weather: 'clear', locale: 'en' })
    expect(m.footer).toContain('2026-06-14')
    expect(m.footer).toContain('Agent Virtual Office')
  })

  it('defaults an unknown weather to the clear hero (defensive)', () => {
    expect(buildCardModel({ weather: 'volcano' }).hero).toBe('clear')
    expect(buildCardModel({ weather: 'thunderstorm', doneTotal: 1, mood: 'stuck' }).hero).toBe('thunderstorm')
  })

  it('renders zh-TW copy when locale is zh-TW (no English leakage)', () => {
    const m = buildCardModel({ dayKey: '2026-06-14', doneTotal: 4, mood: 'smooth', weather: 'clear', locale: 'zh-TW' })
    expect(m.caption).toContain('件')
    expect(m.caption).toContain('4')
  })
})

describe('resolveCardStrings — locale with en fallback', () => {
  it('falls back to en for an unknown locale', () => {
    const s = resolveCardStrings('xx-YY')
    expect(s.source).toBe('Agent Virtual Office')
    expect(s.caption.empty).toBe('A quiet day at the office.')
  })
})

describe('shareOrDownloadCard — AC-7 feature-detected with download fallback', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('falls back to download when Web Share is unavailable (no throw)', async () => {
    // node's default navigator has no canShare/share, and there is no document →
    // downloadBlob is a guarded no-op. The path taken is still reported.
    const blob = new Blob(['x'], { type: 'image/png' })
    const result = await shareOrDownloadCard(blob, 'card.png', {})
    expect(result).toBe('downloaded')
  })

  it('uses Web Share when canShare reports file support', async () => {
    let shared = null
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data) => { shared = data },
    })
    const blob = new Blob(['x'], { type: 'image/png' })
    const result = await shareOrDownloadCard(blob, 'card.png', { title: 'T', text: 'X' })
    expect(result).toBe('shared')
    expect(shared.title).toBe('T')
    expect(Array.isArray(shared.files)).toBe(true)
  })
})

describe('todayKey — local YYYY-MM-DD', () => {
  it('formats a fixed timestamp consistently', () => {
    const key = todayKey(new Date(2026, 5, 14, 10, 0, 0).getTime()) // month is 0-based → June
    expect(key).toBe('2026-06-14')
  })
})
