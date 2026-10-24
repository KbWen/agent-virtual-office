import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// spec_ref: docs/specs/cozy-interactions.md C2/C3. Inspect real render output and
// exercise the component's actual handlers with a small, DOM-free hook runner.
const env = vi.hoisted(() => ({ enabled: false, reducedMotion: false, externalStatus: {}, slots: [], index: 0, effects: [], cleanups: [] }))
vi.mock('../src/components/useCozyInteractions.js', () => ({ useCozyInteractions: () => env.enabled }))
vi.mock('../src/systems/store.js', () => ({ useOfficeStore: (select) => select({
  reducedMotion: env.reducedMotion,
  officePet: true, mood: 'normal', externalStatus: env.externalStatus,
  agents: {}, activeEvent: null, sceneScale: 1, petType: 'cat',
}) }))
vi.mock('react', async (original) => {
  const real = await original()
  return { ...real,
    useState: (init) => {
      const i = env.index++
      if (!(i in env.slots)) env.slots[i] = typeof init === 'function' ? init() : init
      return [env.slots[i], (value) => { env.slots[i] = typeof value === 'function' ? value(env.slots[i]) : value }]
    },
    useRef: (init) => {
      const i = env.index++
      return env.slots[i] ??= { current: init }
    },
    useEffect: (fn, deps) => {
      const i = env.index++
      if (!env.slots[i] || deps.some((value, n) => !Object.is(value, env.slots[i][n]))) {
        env.effects.push(() => { env.cleanups[i]?.(); env.cleanups[i] = fn() })
        env.slots[i] = deps
      }
    },
    useCallback: (fn, deps) => {
      const i = env.index++
      if (!env.slots[i] || deps.some((value, n) => !Object.is(value, env.slots[i].deps[n]))) env.slots[i] = { fn, deps }
      return env.slots[i].fn
    },
  }
})
import { Plant } from '../src/components/TopDownFurniture.jsx'
import PetSprite from '../src/components/petSprites.jsx'
import OfficePet from '../src/components/OfficePet.jsx'
import { PET_MODES } from '../src/systems/petState.js'

const plant = () => {
  env.index = 0
  const tree = Plant.type({ x: 24, y: 100 })
  env.effects.splice(0).forEach((effect) => effect())
  return tree
}
const markup = (tree) => renderToStaticMarkup(<svg>{tree}</svg>)
const officePet = () => {
  env.index = 0
  const tree = OfficePet()
  env.effects.splice(0).forEach((effect) => effect())
  return tree
}
beforeEach(() => {
  env.cleanups.forEach((fn) => fn?.())
  env.enabled = false; env.reducedMotion = false; env.externalStatus = {}; env.slots = []; env.cleanups = []; env.effects = []
  vi.useRealTimers()
})

describe('optional plant reaction', () => {
  it('off remains decorative with the exact original pot and leaf footprint', () => {
    const tree = plant()
    expect(tree.props.role).toBeUndefined()
    expect(tree.props.tabIndex).toBeUndefined()
    expect(markup(tree).match(/<ellipse/g)).toHaveLength(4)
    expect(markup(tree)).toContain('x="19" y="100" width="10" height="9"')
  })
  it('on supports click, Enter and Space; each restarts one bounded reaction', () => {
    vi.useFakeTimers(); env.enabled = true
    let tree = plant()
    expect(tree.props.role).toBe('button')
    expect(tree.props.tabIndex).toBe(0)
    expect(markup(tree)).toContain('data-cozy-hit-area="1"')
    tree.props.onClick()
    expect(markup(plant())).toContain('cozy-plant-sway')
    expect(markup(plant())).toContain('data-cozy-feedback="plant"')
    vi.advanceTimersByTime(600)
    tree = plant()
    const preventDefault = vi.fn()
    tree.props.onKeyDown({ key: ' ', preventDefault, repeat: false })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(700)
    expect(markup(plant())).toContain('cozy-plant-sway')
    vi.advanceTimersByTime(100)
    expect(markup(plant())).not.toContain('cozy-plant-sway')
    tree.props.onKeyDown({ key: 'Enter', preventDefault, repeat: false })
    expect(markup(plant())).toContain('cozy-plant-sway')
  })
  it('reduced motion highlights leaves and disabling cancels timers', () => {
    vi.useFakeTimers(); env.enabled = true; env.reducedMotion = true
    plant().props.onClick()
    expect(markup(plant())).toContain('data-cozy-leaves="active"')
    expect(markup(plant())).not.toContain('cozy-plant-sway')
    env.enabled = false
    expect(markup(plant())).not.toContain('data-cozy-leaves="active"')
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('type-specific pet acknowledgement', () => {
  const pet = (type, reaction, mode = PET_MODES.WANDER, reducedMotion = false) => markup(
    <PetSprite type={type} mode={mode} reaction={reaction} reducedMotion={reducedMotion} />,
  )
  it('only cat, dog and vacuum add their species reaction; other skins retain baseline', () => {
    for (const type of ['cat', 'dog', 'vacuum']) {
      expect(pet(type, true)).toContain(`data-cozy-pet-reaction="${type}"`)
      expect(pet(type, false)).not.toContain('data-cozy-pet-reaction')
    }
    for (const type of ['rabbit', 'bird', 'hamster']) expect(pet(type, true)).toBe(pet(type, false))
  })
  it('real blockers and alert/celebrate poses cannot draw a cosmetic overlay', () => {
    for (const type of ['cat', 'dog', 'vacuum']) {
      for (const mode of [PET_MODES.HIDE, PET_MODES.ALERT, PET_MODES.CELEBRATE]) {
        expect(pet(type, true, mode)).toBe(pet(type, false, mode))
      }
    }
  })
  it('reduced motion keeps a static acknowledgement without tail/brush animation', () => {
    expect(pet('dog', true, PET_MODES.NAP, true)).toContain('data-cozy-pet-reaction="dog"')
    expect(pet('dog', true, PET_MODES.NAP, true)).not.toContain('cozy-pet-tail')
    expect(pet('vacuum', true, PET_MODES.NAP, true)).not.toContain('cozy-vacuum-brush')
  })
  it('click keeps the baseline heart and never changes the pet mode or floor anchor', () => {
    vi.useFakeTimers(); env.enabled = true; env.reducedMotion = true
    const before = officePet()
    before.props.onClick()
    const after = officePet()
    expect(after.props.transform).toBe(before.props.transform)
    expect(after.props['data-office-pet']).toBe(before.props['data-office-pet'])
    expect(markup(after)).toContain('♥')
    expect(markup(after)).toContain('data-cozy-pet-reaction="cat"')
    vi.advanceTimersByTime(850)
    expect(markup(officePet())).not.toContain('data-cozy-pet-reaction')
    expect(markup(officePet())).toContain('♥')
  })
  it.each(['blocked', 'awaiting-approval'])('%s immediately cancels an active click reaction', (status) => {
    vi.useFakeTimers(); env.enabled = true; env.reducedMotion = true
    officePet().props.onClick()
    expect(markup(officePet())).toContain('data-cozy-pet-reaction="cat"')
    env.externalStatus = { dev: { status } }
    expect(markup(officePet())).not.toContain('data-cozy-pet-reaction')
    // Even a subsequent click while waiting must not re-add a cosmetic pose.
    officePet().props.onClick()
    expect(markup(officePet())).not.toContain('data-cozy-pet-reaction')
  })
  it('off still shows only the baseline heart and exposes no new keyboard target', () => {
    vi.useFakeTimers(); env.reducedMotion = true
    const tree = officePet()
    expect(tree.props.role).toBeUndefined()
    tree.props.onClick()
    const html = markup(officePet())
    expect(html).toContain('♥')
    expect(html).not.toContain('data-cozy-pet-reaction')
  })
})
