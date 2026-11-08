import React, { useSyncExternalStore } from 'react'
import { getAppearanceSnapshot, pixelAssetUrl, pixelBodyPlacement, resolvePixelRole, subscribeAppearance } from '../systems/characterAppearance'

// { requested, active, status, error } — `active` is what renders (only flips after a full preload).
export function useOfficeAppearance() {
  return useSyncExternalStore(subscribeAppearance, getAppearanceSnapshot, getAppearanceSnapshot)
}

// Decorative body only (spec: docs/specs/phased-pixel-character-refresh.md).
// The actor group around it owns position, status overlays, labels, bubbles and input.
// Classic → the existing procedural sprite (passed in as `classic`).
// Pixel   → the role's front master for every facing (Phase 1: no mirroring, no pasted
//           classic arms/face, unsupported expressions stay neutral).
// (Not memoised: `classic` is a fresh element every parent render; PixelBody itself is memoised.)
export function CharacterBody({ appearance, charId, isMoving = false, reducedMotion = false, classic }) {
  if (appearance !== 'pixel') return classic
  return <PixelBody charId={charId} isMoving={isMoving} reducedMotion={reducedMotion} />
}

export const PixelBody = React.memo(function PixelBody({ charId, isMoving = false, reducedMotion = false }) {
  const role = resolvePixelRole(charId)
  const place = pixelBodyPlacement(role)
  // Optional ~1-unit bob only while really walking; never on idle, never under reduced motion.
  const bob = isMoving && !reducedMotion
  return (
    <g data-body="pixel" data-pixel-role={role}>
      {/* Same ground cue as the classic body. */}
      <ellipse cx={0} cy={1} rx={10} ry={3} fill="rgba(0,0,0,0.15)" />
      {/* Keeps the classic body's pointer target; the image itself ignores pointer events. */}
      <rect x={-16} y={-40} width={32} height={40} fill="transparent" data-body-hit="1" />
      <g className={bob ? 'avo-pixel-walk-bob' : undefined} data-pixel-bob={bob ? '1' : '0'}>
        <image href={pixelAssetUrl(role)} x={place.x} y={place.y} width={place.width} height={place.height}
          preserveAspectRatio="none" style={{ imageRendering: 'pixelated', pointerEvents: 'none' }}
          aria-hidden="true" />
      </g>
    </g>
  )
})

export default CharacterBody
