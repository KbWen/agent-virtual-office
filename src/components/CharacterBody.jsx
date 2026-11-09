import React, { useSyncExternalStore } from 'react'
import { getAppearanceSnapshot, pixelActionView, pixelAssetUrl, pixelBodyPlacement, resolvePixelRole, subscribeAppearance } from '../systems/characterAppearance'
import { SEAT_CLIP_Y, SEAT_SHIFT, isWorkingStatus } from '../systems/seating.js'

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
// Pixel pose priority: walking -> front master; stationary doing the role's own signature behavior
// (work-claiming poses only with a live working status) -> that action, facing the viewer, even at
// the desk; seated at desk (working) -> back; otherwise front master.
export function pixelViewFor({ charId, isMoving = false, seated = false, behavior = null, status = 'idle' }) {
  if (isMoving) return 'front'
  const action = pixelActionView(resolvePixelRole(charId), behavior, { working: isWorkingStatus(status) })
  if (action) return action
  return seated ? 'back' : 'front'
}

export function CharacterBody({ appearance, charId, isMoving = false, reducedMotion = false, classic, seated = false, seatClipId = 'seat-clip', behavior = null, status = 'idle' }) {
  if (appearance !== 'pixel') return <SeatedFrame seated={seated} clipId={seatClipId}>{classic}</SeatedFrame>
  const view = pixelViewFor({ charId, isMoving, seated, behavior, status })
  // A standing action pose at the desk is drawn standing (unclipped); only the back view sits.
  return <SeatedFrame seated={seated && view === 'back'} clipId={seatClipId} pixel><PixelBody charId={charId} isMoving={isMoving} reducedMotion={reducedMotion} view={view} /></SeatedFrame>
}

// Seated at desk (R1 option C): the body is drawn SEAT_SHIFT lower (hips on the seat) and clipped
// below the waist; a chair back drawn IN FRONT of the body covers the cut and joins the desk
// chair's seat painted underneath, so the agent reads as sitting, not as a cut-off half body
// (owner review 2026-11-09, option B "low chair back"). Body-local only: the actor's world feet,
// hit target and overlays do not move.
export function SeatedFrame({ seated, clipId, pixel = false, children }) {
  if (!seated) return children
  return (
    <g data-seated="1">
      <clipPath id={clipId}><rect x={-40} y={-80} width={80} height={80 + SEAT_CLIP_Y} /></clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(0, ${SEAT_SHIFT})`}>{children}</g>
      </g>
      <ChairBack pixel={pixel} />
      {/* Same pointer target as a standing body. */}
      <rect x={-16} y={-40} width={32} height={40} fill="transparent" data-body-hit="1" />
    </g>
  )
}

// Low chair back in actor-local units (world / 1.35), colours of the desk chair (#444 seat).
// Top edge at waist height so shoulders and upper back stay visible; bottom overlaps the seat.
// Pixel: square, stepped corners on whole units; Classic: soft rounded shapes like the furniture.
export const CHAIR_BACK_TOP = -8
export function ChairBack({ pixel = false }) {
  if (pixel) {
    return (
      <g data-chair-back="pixel" pointerEvents="none">
        <rect x={-9} y={CHAIR_BACK_TOP} width={18} height={12} fill="#3b3b44" />
        <rect x={-10} y={CHAIR_BACK_TOP + 1} width={20} height={9} fill="#3b3b44" />
        <rect x={-8} y={CHAIR_BACK_TOP + 1} width={16} height={2} fill="#5a5a66" />
        <rect x={-6} y={CHAIR_BACK_TOP + 4} width={12} height={5} fill="#4a4a55" />
      </g>
    )
  }
  return (
    <g data-chair-back="classic" pointerEvents="none">
      <rect x={-10} y={CHAIR_BACK_TOP - 1} width={20} height={14} rx={4} fill="#4a4a52" />
      <rect x={-7} y={CHAIR_BACK_TOP + 1} width={14} height={7} rx={2.5} fill="#5e5e68" />
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
