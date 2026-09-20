import React, { useEffect, useRef } from 'react'

// AVO-197: a one-shot SMIL animation that actually runs.
//
// SMIL resolves `begin="0s"` against the DOCUMENT timeline, not against the moment the element is
// inserted. Every one-shot animation in this app mounts LATE — on a status change, a behaviour
// change, a poke — so by then t=0 is in the past, the animation is beyond its active duration, and
// the attribute snaps straight to its end value. Nothing errors; the markup looks correct.
// Measured before this fix: the AVO-135 "celebratory flash" was mounted for 60 frames and visible
// on exactly 1 (opacity 0.393 on the mount frame, then 0.000 for the other 59).
//
// `begin="indefinite"` parks the animation until something starts it; `beginElement()` in a mount
// effect is that something. This is deliberately NOT a CSS rewrite: AVO-136 and AVO-158 use
// `additive="sum"` on a root <g> that already carries `translate(...) scale(CHAR_SCALE)`, and a CSS
// transform would replace that base transform while the CSS `translate` property would apply
// outside it, silently changing how far the agent bobs. See the work log for the full comparison.
//
// `repeatCount="indefinite"` animations do NOT need this — they are always mid-cycle. Wrapping one
// would restart it for no reason, so this is for one-shots only.
//
// Remounting replays: give the wrapper the same key the animation's own feature uses (the poke
// sequence, the behaviour, the reason code), and the mount effect fires again.
export default function OneShotSmil({ children }) {
  const elements = useRef([])

  useEffect(() => {
    for (const el of elements.current) el?.beginElement?.()
  }, [])

  return React.Children.map(children, (child, i) => (
    React.isValidElement(child)
      ? React.cloneElement(child, {
        begin: 'indefinite',
        ref: (el) => { elements.current[i] = el },
      })
      : child
  ))
}
