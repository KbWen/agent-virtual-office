import { describe, expect, it, vi } from 'vitest'
import { SETTINGS_POPOVER_STYLE, isOutsideSettings, focusFirstItem, handleSettingsKey } from '../src/components/settingsPopover.js'

const node = (inside = []) => ({ contains: (t) => inside.includes(t), focus: vi.fn() })

describe('settings popover (AVO-208/209)', () => {
  it('gear mousedown is not outside, so the gear click can close an open menu', () => {
    const gearBtn = {}, item = {}, other = {}
    const menu = node([item]), gear = node([gearBtn])
    expect(isOutsideSettings(gearBtn, menu, gear)).toBe(false)
    expect(isOutsideSettings(item, menu, gear)).toBe(false)
    expect(isOutsideSettings(other, menu, gear)).toBe(true)
  })
  it('open moves focus to first focusable item in the menu', () => {
    const first = { focus: vi.fn() }
    const menu = { querySelector: vi.fn(() => first) }
    expect(focusFirstItem(menu)).toBe(true)
    expect(first.focus).toHaveBeenCalledOnce()
    expect(focusFirstItem({ querySelector: () => null })).toBe(false)
    expect(focusFirstItem(null)).toBe(false)
  })
  it('Escape closes and returns focus to gear; other keys do nothing', () => {
    const close = vi.fn(), gear = node()
    expect(handleSettingsKey({ key: 'a' }, close, gear)).toBe(false)
    expect(close).not.toHaveBeenCalled()
    const esc = { key: 'Escape', stopPropagation: vi.fn() }
    expect(handleSettingsKey(esc, close, gear)).toBe(true)
    expect(esc.stopPropagation).toHaveBeenCalledOnce() // the inspector's window listener must not also close
    expect(close).toHaveBeenCalledOnce()
    expect(gear.focus).toHaveBeenCalledOnce()
  })
  it('popover is viewport-bounded and scrolls', () => {
    expect(SETTINGS_POPOVER_STYLE.maxHeight).toMatch(/100d?vh/)
    expect(SETTINGS_POPOVER_STYLE.overflowY).toBe('auto')
  })
})
