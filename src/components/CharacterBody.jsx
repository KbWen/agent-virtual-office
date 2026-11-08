import React, { useSyncExternalStore } from 'react'
import { getAppearanceSnapshot, pixelAssetUrl, pixelBodyPlacement, resolvePixelRole, subscribeAppearance } from '../systems/characterAppearance'
import { SEAT_CLIP_Y, SEAT_SHIFT } from '../systems/seating.js'

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
export function CharacterBody({ appearance, charId, isMoving = false, reducedMotion = false, classic, seated = false, seatClipId = 'seat-clip' }) {
  const body = appearance !== 'pixel' ? classic
    : <PixelBody charId={charId} isMoving={isMoving} reducedMotion={reducedMotion} view={seated ? 'back' : 'front'} />
  return <SeatedFrame seated={seated} clipId={seatClipId}>{body}</SeatedFrame>
}

// Seated at desk (R1 option C): the body is drawn SEAT_SHIFT lower (hips on the seat) and clipped
// at the chair's top edge, so the chair already painted underneath shows where the legs were.
// Body-local only: the actor's world feet, hit target and overlays do not move.
export function SeatedFrame({ seated, clipId, children }) {
  if (!seated) return children
  return (
    <g data-seated="1">
      <clipPath id={clipId}><rect x={-40} y={-80} width={80} height={80 + SEAT_CLIP_Y} /></clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(0, ${SEAT_SHIFT})`}>{children}</g>
      </g>
      {/* Same pointer target as a standing body. */}
      <rect x={-16} y={-40} width={32} height={40} fill="transparent" data-body-hit="1" />
    </g>
  )
}

export const PixelBody = React.memo(function PixelBody({ charId, isMoving = false, reducedMotion = false, view = 'front' }) {
  const role = resolvePixelRole(charId)
  const place = pixelBodyPlacement(role, undefined, undefined, view)
  // Optional ~1-unit bob only while really walking; never on idle, never under reduced motion.
  const bob = isMoving && !reducedMotion
  return (
    <g data-body="pixel" data-pixel-role={role} data-pixel-view={view}>
      {/* Same ground cue as the classic body. */}
      <ellipse cx={0} cy={1} rx={10} ry={3} fill="rgba(0,0,0,0.15)" />
      {/* Keeps the classic body's pointer target; the image itself ignores pointer events. */}
      <rect x={-16} y={-40} width={32} height={40} fill="transparent" data-body-hit="1" />
      <g className={bob ? 'avo-pixel-walk-bob' : undefined} data-pixel-bob={bob ? '1' : '0'}>
        <image href={pixelAssetUrl(role, undefined, undefined, view)} x={place.x} y={place.y} width={place.width} height={place.height}
          preserveAspectRatio="none" style={{ imageRendering: 'pixelated', pointerEvents: 'none' }}
          aria-hidden="true" />
      </g>
    </g>
  )
})

export default CharacterBody
