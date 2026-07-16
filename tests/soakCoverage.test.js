import { describe, expect, it } from 'vitest'
import { assessSoakCoverage } from '../scripts/soakCoverage.mjs'

describe('assessSoakCoverage', () => {
  it('accepts bounded timer jitter observed in the 10-minute CI soak', () => {
    expect(assessSoakCoverage(2393, 10, 250)).toMatchObject({
      expectedSamples: 2400,
      minSamples: 2388,
      allowedMisses: 12,
      sufficient: true,
    })
  })

  it('still rejects a materially undersampled run', () => {
    expect(assessSoakCoverage(2387, 10, 250)).toMatchObject({
      minSamples: 2388,
      sufficient: false,
    })
  })

  it('allows the fixed timer overhead observed in short diagnostic runs', () => {
    expect(assessSoakCoverage(235, 1, 250)).toMatchObject({
      expectedSamples: 240,
      minSamples: 235,
      allowedMisses: 5,
      sufficient: true,
    })
    expect(assessSoakCoverage(234, 1, 250).sufficient).toBe(false)
  })
})
