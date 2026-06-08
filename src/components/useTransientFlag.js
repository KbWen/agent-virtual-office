import { useState, useEffect, useCallback } from 'react'

// useTransientFlag(ms) → [active, fire]
//
// A boolean that, once `fire()`d, stays true for `ms` then auto-clears. The clear timer is owned by
// the flag itself (one effect keyed on the flag + a fire-nonce), so re-firing or unrelated re-renders
// can NEVER leave it stuck on — that's the recurring "stuck transient" bug class the office pet hit
// three times (celebrate/alert/petted) and patched locally each time. Firing again while active
// RESTARTS the window (the nonce changes → the effect re-runs, clearing the old timeout first).
export function useTransientFlag(ms) {
  const [active, setActive] = useState(false)
  const [nonce, setNonce] = useState(0)
  const fire = useCallback(() => { setActive(true); setNonce((n) => n + 1) }, [])
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setActive(false), ms)
    return () => clearTimeout(t)
  }, [active, nonce, ms])
  return [active, fire]
}
