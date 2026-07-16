const DEFAULT_JITTER_RATIO = 0.005
const MIN_ALLOWED_MISSES = 5

export function assessSoakCoverage(actualSamples, minutes, intervalMs, jitterRatio = DEFAULT_JITTER_RATIO) {
  const expectedSamples = Math.max(1, Math.floor((minutes * 60000) / intervalMs))
  const allowedMisses = Math.max(MIN_ALLOWED_MISSES, Math.ceil(expectedSamples * jitterRatio))
  const minSamples = Math.max(1, expectedSamples - allowedMisses)

  return {
    actualSamples,
    expectedSamples,
    allowedMisses,
    minSamples,
    sufficient: actualSamples >= minSamples,
  }
}
