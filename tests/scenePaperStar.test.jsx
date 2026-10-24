import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// spec_ref: docs/specs/cozy-interactions.md — scene-native paper star amendment.
const hooks = vi.hoisted(() => ({ slots: [], index: 0, effects: [], cleanups: [] }))
vi.mock('../src/i18n', () => ({ t: (_key, fallback) => fallback, useLocale: () => 'en' }))
vi.mock('react', async (original) => {
  const real = await original()
  return { ...real,
    useState: (initial) => {
      const index = hooks.index++
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === 'function' ? initial() : initial
      return [hooks.slots[index], (next) => { hooks.slots[index] = typeof next === 'function' ? next(hooks.slots[index]) : next }]
    },
    useRef: (initial) => hooks.slots[hooks.index++] ??= { current: initial },
    useEffect: (effect, dependencies) => {
      const index = hooks.index++
      if (!hooks.slots[index] || dependencies.some((next, i) => !Object.is(next, hooks.slots[index][i]))) {
        hooks.effects.push(() => { hooks.cleanups[index]?.(); hooks.cleanups[index] = effect() })
        hooks.slots[index] = dependencies
      }
    },
  }
})
import ScenePaperStar from '../src/components/ScenePaperStar.jsx'

function render(props = {}) {
  hooks.index = 0
  const tree = ScenePaperStar(props)
  hooks.effects.splice(0).forEach(effect => effect())
  return tree
}
const markup = (tree) => renderToStaticMarkup(<svg>{tree}</svg>)
const target = () => ({ setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() })
const pointer = (currentTarget, extra = {}) => ({ currentTarget, pointerId: 7, button: 0, isPrimary: true, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extra })
const key = (value, extra = {}) => ({ key: value, repeat: false, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extra })
beforeEach(() => { hooks.slots = []; hooks.index = 0; hooks.effects = []; hooks.cleanups = [] })
afterEach(() => { hooks.cleanups.forEach(cleanup => cleanup?.()); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('scene paper star', () => {
  it.each([[449, 'short', '240ms'], [450, 'medium', '460ms'], [1199, 'medium', '460ms'], [1200, 'long', '680ms'], [12000, 'long', '680ms']])(
    'a %ims gesture releases the %s response for %s', (duration, tier, animationDuration) => {
      vi.useFakeTimers()
      render().props.onKeyDown(key(' '))
      vi.advanceTimersByTime(duration)
      render().props.onKeyUp(key(' '))
      const tree = render()
      expect(tree.props['data-scene-star-tier']).toBe(tier)
      expect(markup(tree)).toContain(`cozy-star-${tier} ${animationDuration}`)
      vi.advanceTimersByTime(700)
      expect(render().props['data-scene-star-state']).toBe('idle')
      expect(vi.getTimerCount()).toBe(0)
    })

  it('shows three distinct held poses and faces, saturates, and clears thresholds on cancellation', () => {
    vi.useFakeTimers()
    render().props.onPointerDown(pointer(target()))
    const short = markup(render())
    vi.advanceTimersByTime(450)
    const medium = markup(render())
    expect(medium).not.toBe(short)
    expect(medium).toContain('data-scene-star-face="squeezed"')
    vi.advanceTimersByTime(750)
    expect(markup(render())).toContain('data-scene-star-face="puffed"')
    expect(render().props['data-scene-star-tier']).toBe('long')
    expect(vi.getTimerCount()).toBe(0)
    render().props.onPointerCancel(pointer(target()))
    expect(render().props['data-scene-star-state']).toBe('idle')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('classifies elapsed time even when threshold callbacks have been delayed', () => {
    vi.useFakeTimers()
    const now = vi.spyOn(performance, 'now').mockReturnValue(100)
    render().props.onKeyDown(key('Enter'))
    now.mockReturnValue(1500)
    render().props.onKeyUp(key('Enter'))
    expect(render().props['data-scene-star-tier']).toBe('long')
    expect(markup(render())).toContain('cozy-star-long')
  })

  it('reduced motion distinguishes release tiers statically and rapid replay clears old feedback', () => {
    vi.useFakeTimers()
    const props = { reducedMotion: true }
    render(props).props.onKeyDown(key(' '))
    vi.advanceTimersByTime(1200)
    render(props).props.onKeyUp(key(' '))
    expect(render(props).props['data-scene-star-tier']).toBe('long')
    expect(markup(render(props))).toContain('data-scene-star-face="puffed"')
    expect(markup(render(props))).not.toContain('cozy-star-long')
    render(props).props.onKeyDown(key('Enter'))
    expect(render(props).props['data-scene-star-tier']).toBe('short')
    render(props).props.onBlur()
    vi.advanceTimersByTime(1500)
    expect(render(props).props['data-scene-star-state']).toBe('idle')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('is directly operable on the lounge table and expands its touch target at narrow scales', () => {
    const tree = render({ sceneScale: .4 })
    expect(tree.props.role).toBe('button')
    expect(tree.props.tabIndex).toBe(0)
    expect(tree.props.transform).toBe('translate(175 487)')
    const html = markup(tree)
    expect(html).toContain('data-scene-star-hit="true"')
    expect(html).toContain('width="110" height="110"')
    expect(html).toContain('Squeeze the paper star on the lounge table')
    expect(html).not.toContain('dialog')
    expect(markup(render({ x: 190, y: 480, sceneScale: .1 }))).toContain('width="120" height="120"')
  })

  it('primary pointer visibly compresses with a different face and releases one bounded rebound', () => {
    const node = target()
    const down = pointer(node)
    render().props.onPointerDown(down)
    expect(node.setPointerCapture).toHaveBeenCalledWith(7)
    expect(down.stopPropagation).toHaveBeenCalledOnce()
    let tree = render()
    expect(tree.props['aria-pressed']).toBe(true)
    expect(markup(tree)).toContain('scale(1.05 .88)')
    expect(markup(tree)).toContain('data-scene-star-face="squished"')
    tree.props.onPointerUp(pointer(node))
    tree = render()
    expect(tree.props['data-scene-star-state']).toBe('release')
    expect(markup(tree)).toContain('cozy-star-short 240ms')
    expect(node.releasePointerCapture).toHaveBeenCalledWith(7)
    // The browser's capture-loss acknowledgement after release must not cancel rebound.
    tree.props.onLostPointerCapture(pointer(node))
    expect(render().props['data-scene-star-state']).toBe('release')
    const art = render().props.children.find(child => child?.props?.['data-scene-star-art'])
    art.props.onAnimationEnd({ currentTarget: node, target: node })
    expect(render().props['data-scene-star-state']).toBe('idle')
  })

  it('ignores secondary/multi-touch presses and mismatched releases', () => {
    const node = target()
    render().props.onPointerDown(pointer(node, { button: 2 }))
    render().props.onPointerDown(pointer(node, { isPrimary: false }))
    expect(render().props['aria-pressed']).toBe(false)
    render().props.onPointerDown(pointer(node))
    render().props.onPointerDown(pointer(node, { pointerId: 8 }))
    render().props.onPointerUp(pointer(node, { pointerId: 8 }))
    expect(render().props['aria-pressed']).toBe(true)
    expect(node.setPointerCapture).toHaveBeenCalledTimes(1)
  })

  it.each(['onPointerCancel', 'onLostPointerCapture', 'onBlur'])('%s cancels a held star without leaving a pose or rebound', (handler) => {
    const node = target()
    render().props.onPointerDown(pointer(node))
    render().props[handler](pointer(node))
    expect(render().props['data-scene-star-state']).toBe('idle')
    expect(render().props['aria-pressed']).toBe(false)
  })

  it('owns only its Space or Enter press, prevents page pause, and ignores repeats', () => {
    const down = key(' ')
    render().props.onKeyDown(down)
    expect(down.preventDefault).toHaveBeenCalledOnce()
    expect(down.stopPropagation).toHaveBeenCalledOnce()
    render().props.onKeyDown(key(' ', { repeat: true }))
    render().props.onKeyUp(key('Enter'))
    expect(render().props['aria-pressed']).toBe(true)
    render().props.onKeyUp(key(' '))
    expect(render().props['data-scene-star-state']).toBe('release')
    render().props.onBlur()
    render().props.onKeyDown(key('Enter'))
    expect(render().props['aria-pressed']).toBe(true)
    render().props.onKeyUp(key('Enter'))
    expect(render().props['aria-pressed']).toBe(false)
  })

  it('reduced motion keeps the expressive acknowledgement without transform or animation', () => {
    vi.useFakeTimers()
    const props = { reducedMotion: true }
    render(props).props.onKeyDown(key('Enter'))
    expect(markup(render(props))).toContain('data-scene-star-face="squished"')
    expect(markup(render(props))).not.toContain('scale(1.05 .88)')
    render(props).props.onKeyUp(key('Enter'))
    expect(markup(render(props))).not.toContain('cozy-star-short')
    expect(render(props).props['data-scene-star-state']).toBe('release')
    vi.advanceTimersByTime(500)
    expect(render(props).props['data-scene-star-state']).toBe('idle')
  })

  it('shows a local game hint on hover and keyboard focus, then dismisses it', () => {
    expect(markup(render())).not.toContain('data-scene-star-hint')
    render().props.onPointerEnter()
    expect(markup(render())).toContain('Tap or hold — try both!')
    render().props.onPointerLeave()
    expect(markup(render())).not.toContain('data-scene-star-hint')
    render().props.onFocus()
    expect(markup(render())).toContain('data-scene-star-hint')
    render().props.onBlur()
    expect(markup(render())).not.toContain('data-scene-star-hint')
  })

  it('window blur releases capture and unmount removes the listener and any held pointer', () => {
    const listeners = new Map()
    const removeEventListener = vi.fn()
    vi.stubGlobal('window', { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener })
    const node = target()
    render().props.onPointerDown(pointer(node))
    listeners.get('blur')()
    expect(render().props['data-scene-star-state']).toBe('idle')
    expect(node.releasePointerCapture).toHaveBeenCalledOnce()
    render().props.onPointerDown(pointer(node))
    hooks.cleanups.forEach(cleanup => cleanup?.())
    hooks.cleanups = []
    expect(node.releasePointerCapture).toHaveBeenCalledTimes(2)
    expect(removeEventListener).toHaveBeenCalledWith('blur', listeners.get('blur'))
  })

  it.each(['pointerup', 'pointercancel'])('failed capture observes the failure and cleans up after an outside %s', (eventName) => {
    const listeners = new Map()
    const removeEventListener = vi.fn((name) => listeners.delete(name))
    vi.stubGlobal('window', { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = target()
    node.setPointerCapture.mockImplementation(() => { throw new Error('Capture not supported') })
    render().props.onPointerDown(pointer(node))
    expect(warning).toHaveBeenCalledWith('[Office] Scene star: setPointerCapture failed')
    expect(typeof listeners.get(eventName)).toBe('function')
    listeners.get(eventName)({ pointerId: 8 })
    expect(render().props['aria-pressed']).toBe(true)
    listeners.get(eventName)({ pointerId: 7 })
    expect(render().props['aria-pressed']).toBe(false)
    expect(render().props['data-scene-star-state']).toBe(eventName === 'pointerup' ? 'release' : 'idle')
    expect(listeners.has('pointerup')).toBe(false)
    expect(listeners.has('pointercancel')).toBe(false)
  })

  it('failed capture fallback listeners are removed on blur or unmount', () => {
    const listeners = new Map()
    vi.stubGlobal('window', { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = target()
    node.setPointerCapture.mockImplementation(() => { throw new Error('Capture unavailable') })
    render().props.onPointerDown(pointer(node))
    expect(listeners.has('pointerup')).toBe(true)
    render().props.onBlur()
    expect(listeners.has('pointerup')).toBe(false)
    render().props.onPointerDown(pointer(node))
    hooks.cleanups.forEach(cleanup => cleanup?.())
    hooks.cleanups = []
    expect(listeners.size).toBe(0)
  })

  it('a failed release is observable and cannot leave a held pose', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = target()
    node.releasePointerCapture.mockImplementation(() => { throw new Error('Release unavailable') })
    render().props.onPointerDown(pointer(node))
    render().props.onBlur()
    expect(warning).toHaveBeenCalledWith('[Office] Scene star: releasePointerCapture failed')
    expect(render().props['aria-pressed']).toBe(false)
  })
})
