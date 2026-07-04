import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  PORTABLE_CORE_CAPABILITIES,
  PORTABLE_CORE_VERSION,
  portableCoreCapabilitiesByLayer,
  portableCoreCapabilityBySubpath,
  portableCoreSubpaths,
} from '../src/systems/portableCoreManifest.mjs'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

function exportedLibrarySubpaths() {
  return Object.keys(pkg.exports)
    .filter((subpath) => subpath !== '.' && subpath !== './package.json' && subpath !== './src/*')
    .sort()
}

describe('portableCoreManifest', () => {
  it('lists every public library subpath exactly once', () => {
    const manifestSubpaths = portableCoreSubpaths().sort()

    expect(manifestSubpaths).toEqual(exportedLibrarySubpaths())
    expect(new Set(manifestSubpaths).size).toBe(manifestSubpaths.length)
  })

  it('describes the core reusable layers for alternate renderers', () => {
    const layers = portableCoreCapabilitiesByLayer()

    expect(PORTABLE_CORE_VERSION).toBe('portable-core-v1')
    expect(layers.transport.map((capability) => capability.subpath)).toEqual([
      './status-contract',
      './normalize-post',
    ])
    expect(layers['view-model'].map((capability) => capability.subpath)).toContain('./workflow-handoff-model')
    expect(portableCoreCapabilityBySubpath('./pet-state-model')).toMatchObject({
      layer: 'view-model',
      category: 'companion',
    })
  })

  it('keeps manifest entries immutable and marks aggregate-safe APIs', () => {
    expect(Object.isFrozen(PORTABLE_CORE_CAPABILITIES)).toBe(true)
    expect(Object.isFrozen(PORTABLE_CORE_CAPABILITIES[0])).toBe(true)
    expect(portableCoreSubpaths({ aggregateOnly: true })).toContain('./portable-core-manifest')
    expect(portableCoreSubpaths({ aggregateOnly: true })).not.toContain('./normalize-post')
  })
})
