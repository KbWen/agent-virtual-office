import { describe, expect, it, vi } from 'vitest'
import { buildCardModel, CARD_STICKERS, drawCardSticker } from '../src/systems/dailyCard.js'

describe('postcard decorations', () => {
  it('never changes the source model, caption, counts or date', () => {
    const input = { dayKey: '2026-10-23', doneTotal: 7, blockedTotal: 2, mood: 'smooth', locale: 'zh-TW' }
    for (const sticker of CARD_STICKERS) {
      expect(buildCardModel({ ...input, sticker })).toEqual(buildCardModel(input))
    }
  })
  it('keeps none and unknown choices completely undecorated', () => {
    const ctx = { save: vi.fn() }
    drawCardSticker(ctx, 'none')
    drawCardSticker(ctx, 'unknown')
    expect(ctx.save).not.toHaveBeenCalled()
  })
  it.each(['plant', 'cat'])('draws %s in the reserved sky corner with no text', sticker => {
    const rects = []
    const ctx = { save: vi.fn(), restore: vi.fn(), fillRect: (...rect) => rects.push(rect) }
    drawCardSticker(ctx, sticker)
    expect(rects.length).toBeGreaterThan(3)
    for (const [x, y, w, h] of rects) {
      expect(x).toBeGreaterThanOrEqual(654)
      expect(x + w).toBeLessThanOrEqual(702)
      expect(y).toBeGreaterThanOrEqual(64)
      expect(y + h).toBeLessThanOrEqual(112)
    }
    expect(ctx.restore).toHaveBeenCalledOnce()
  })
})
