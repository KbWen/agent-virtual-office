// Local decorative gesture only. Callers supply the real status and both movement sources.
export function canIdleWave({ enabled, status, isMoving, reducedMotion }) {
  return Boolean(enabled && status === 'idle' && !isMoving && !reducedMotion)
}

// Replace the lowered right arm rather than drawing another arm over the sprite.
// The 16x20 footprint, face, torso and foot rows stay fixed; facing is applied by
// the existing renderer after this transform, so left-facing sprites mirror naturally.
export function applyIdleWave(grid, { phase = 0, skin, sleeve }) {
  const wave = grid.map(row => [...row])
  wave[12][11] = null
  wave[11][11] = sleeve
  wave[11][12] = sleeve
  wave[10][12] = skin
  wave[10][13] = skin
  if (phase === 1) {
    wave[10][14] = skin
    wave[9][14] = skin
  } else {
    wave[9][13] = skin
  }
  return wave
}
