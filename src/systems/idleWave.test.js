import { describe, expect, it } from 'vitest'
import { applyIdleWave, canIdleWave } from './idleWave.js'

describe('idle wave eligibility', () => {
  const idle = { enabled: true, status: 'idle', isMoving: false, reducedMotion: false }

  it('requires an enabled, stationary, explicitly idle agent and full motion', () => {
    expect(canIdleWave(idle)).toBe(true)
    for (const override of [
      { enabled: false }, { isMoving: true }, { reducedMotion: true },
      ...['working', 'planning', 'blocked', 'awaiting-approval', 'done', undefined].map(status => ({ status })),
    ]) expect(canIdleWave({ ...idle, ...override })).toBe(false)
  })
})

describe('idle wave pixel geometry', () => {
  const skin = '#FFE0C0'
  const shirt = '#378ADD'
  const base = () => {
    const grid = Array.from({ length: 20 }, () => Array(16).fill(null))
    for (let y = 0; y <= 9; y++) for (let x = 3; x <= 12; x++) grid[y][x] = '#hair-and-face'
    for (let y = 11; y <= 14; y++) for (let x = 5; x <= 10; x++) grid[y][x] = shirt
    grid[11][11] = skin
    grid[12][11] = skin
    grid[17][5] = '#feet'
    grid[17][10] = '#feet'
    return grid
  }

  it('replaces the hanging arm with a connected raised hand, preserving source and footprint', () => {
    const original = base()
    const saved = structuredClone(original)
    const wave = applyIdleWave(original, { phase: 0, skin, sleeve: shirt })
    expect(original).toEqual(saved)
    expect(wave).toHaveLength(20)
    expect(wave.every(row => row.length === 16)).toBe(true)
    expect(wave[12][11]).toBeNull() // no third arm left dangling
    expect(wave[11][11]).toBe(shirt) // sleeve joins the shoulder
    expect(wave[10][12]).toBe(skin)
    expect(wave[9][13]).toBe(skin)
    expect(wave.slice(0, 9)).toEqual(original.slice(0, 9))
    expect(wave.slice(14)).toEqual(original.slice(14))
    for (let y = 9; y < 14; y++) expect(wave[y].slice(0, 11)).toEqual(original[y].slice(0, 11))
    expect(new Set(wave.flat().filter(Boolean))).toEqual(new Set(original.flat().filter(Boolean)))
  })

  it('uses two hand phases without moving the head, torso, skirt or feet', () => {
    const original = base()
    const first = applyIdleWave(original, { phase: 0, skin, sleeve: shirt })
    const second = applyIdleWave(original, { phase: 1, skin, sleeve: shirt })
    expect(first).not.toEqual(second)
    expect(first[9][13]).toBe(skin)
    expect(second[9][14]).toBe(skin)
    expect(second[9][13]).toBe(original[9][13])
    expect(first.slice(14)).toEqual(second.slice(14))
  })
})
