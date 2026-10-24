import React, { useEffect, useRef, useState } from 'react'
import { t, useLocale } from '../i18n'

const holdTier = elapsed => elapsed >= 1200 ? 'long' : elapsed >= 450 ? 'medium' : 'short'
const releaseMs = { short: 240, medium: 460, long: 680 }
const poses = { short: 'scale(1.05 .88)', medium: 'scale(1.14 .64)', long: 'scale(1.24 .45)' }

// A tabletop fidget: its input ownership is local and never touches office state.
export default function ScenePaperStar({ x = 175, y = 487, reducedMotion = false, sceneScale = 1 }) {
  useLocale()
  const [pressed, setPressed] = useState(false)
  const [release, setRelease] = useState(0)
  const [tier, setTier] = useState('short')
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const input = useRef(null)
  const captureFallback = useRef(null)
  const holdTimers = useRef([])
  const releaseTimer = useRef(null)
  const motionPreference = useRef(reducedMotion)
  motionPreference.current = reducedMotion
  const sequence = useRef(0)
  const scale = Number.isFinite(sceneScale) && sceneScale > 0 ? sceneScale : 1
  const hitSize = Math.min(120, Math.max(36, 44 / scale))
  const hintScale = Math.min(2.5, Math.max(1, 1 / scale))
  const responding = pressed || Boolean(release)
  const face = responding ? tier === 'long' ? 'puffed' : tier === 'medium' ? 'squeezed' : 'squished' : 'smile'
  const hint = pressed
    ? t(`cozy.sceneStarHold${tier}`, { short: 'A little squeeze…', medium: 'Getting flatter…', long: 'Ready? Let go!' }[tier])
    : release
      ? t(`cozy.sceneStarRelease${tier}`, { short: 'Pop!', medium: 'Wobble~', long: 'Boing! Phew~' }[tier])
      : t('cozy.sceneStarHint', 'Tap or hold — try both!')

  function clearTimers() {
    holdTimers.current.forEach(clearTimeout)
    holdTimers.current = []
    clearTimeout(releaseTimer.current)
    releaseTimer.current = null
  }

  function begin(owner) {
    clearTimers()
    input.current = { ...owner, started: performance.now() }
    setTier('short')
    setRelease(0)
    setPressed(true)
    const active = input.current
    holdTimers.current = [450, 1200].map(delay => setTimeout(() => {
      if (input.current === active) setTier(delay === 450 ? 'medium' : 'long')
    }, delay))
  }

  function releaseCapture(owner) {
    if (owner?.kind !== 'pointer') return
    try {
      if (owner.target.hasPointerCapture?.(owner.id)) owner.target.releasePointerCapture(owner.id)
    } catch { console.warn('[Office] Scene star: releasePointerCapture failed') }
  }

  function clearCaptureFallback() {
    captureFallback.current?.()
    captureFallback.current = null
  }

  function finish(animate = false) {
    const owner = input.current
    input.current = null
    clearTimers()
    clearCaptureFallback()
    releaseCapture(owner)
    setPressed(false)
    if (animate && owner) {
      const releasedTier = holdTier(Math.max(0, performance.now() - owner.started))
      setTier(releasedTier)
      setRelease(++sequence.current)
      releaseTimer.current = setTimeout(() => {
        setRelease(0)
        releaseTimer.current = null
      }, motionPreference.current ? 500 : releaseMs[releasedTier])
    } else {
      setRelease(0)
      setTier('short')
    }
  }

  function listenForOutsideRelease() {
    if (typeof window === 'undefined') return
    const up = event => {
      if (input.current?.kind === 'pointer' && input.current.id === event.pointerId) finish(true)
    }
    const cancel = event => {
      if (input.current?.kind === 'pointer' && input.current.id === event.pointerId) finish()
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    captureFallback.current = () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }

  useEffect(() => {
    const blur = () => { finish(); setFocused(false); setHovered(false) }
    if (typeof window !== 'undefined') window.addEventListener('blur', blur)
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('blur', blur)
      clearCaptureFallback()
      clearTimers()
      releaseCapture(input.current)
      input.current = null
    }
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      clearTimeout(releaseTimer.current)
      releaseTimer.current = null
      setRelease(0)
    }
  }, [reducedMotion])

  return (
    <g transform={`translate(${x} ${y})`} role="button" tabIndex={0}
      aria-label={t('cozy.sceneStarAria', 'Squeeze the paper star on the lounge table')}
      aria-pressed={pressed} data-scene-cozy="star" data-scene-star-state={pressed ? 'pressed' : release ? 'release' : 'idle'}
      data-scene-star-tier={tier}
      style={{ cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}
      onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={() => { finish(); setFocused(false) }}
      onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary || input.current) return
        event.preventDefault()
        event.stopPropagation()
        begin({ kind: 'pointer', id: event.pointerId, target: event.currentTarget })
        try { event.currentTarget.setPointerCapture(event.pointerId) } catch {
          console.warn('[Office] Scene star: setPointerCapture failed')
          listenForOutsideRelease()
        }
      }}
      onPointerUp={event => {
        if (input.current?.kind !== 'pointer' || input.current.id !== event.pointerId) return
        event.preventDefault()
        event.stopPropagation()
        finish(true)
      }}
      onPointerCancel={event => {
        if (input.current?.kind === 'pointer' && input.current.id === event.pointerId) finish()
      }}
      onLostPointerCapture={event => {
        if (input.current?.kind === 'pointer' && input.current.id === event.pointerId) finish()
      }}
      onKeyDown={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        event.stopPropagation()
        if (event.repeat || input.current) return
        begin({ kind: 'key', key: event.key })
      }}
      onKeyUp={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        event.stopPropagation()
        if (input.current?.kind === 'key' && input.current.key === event.key) finish(true)
      }}>
      <title>{hint}</title>
      <rect data-scene-star-hit="true" x={-hitSize / 2} y={-hitSize / 2} width={hitSize} height={hitSize} rx={hitSize / 2} fill="transparent" />
      <ellipse data-scene-star-focus="true" cx="0" cy="3" rx="19" ry="16" fill={hovered || focused ? '#FFF0A6' : 'none'}
        fillOpacity=".24" stroke={hovered || focused ? '#F5D77D' : 'none'} strokeWidth="1.5" strokeDasharray="3 3" pointerEvents="none" />
      <ellipse cx="0" cy="12" rx={pressed ? tier === 'long' ? 16 : 13 : 11} ry="3" fill="#745331" opacity=".22" pointerEvents="none" />
      <g key={`star-${release}`} data-scene-star-art="true"
        transform={pressed && !reducedMotion ? poses[tier] : undefined}
        style={{ animation: release && !reducedMotion ? `cozy-star-${tier} ${releaseMs[tier]}ms ease-out both` : 'none', transformOrigin: '0 0', transformBox: 'view-box' }}
        onAnimationEnd={event => {
          if (event.target === event.currentTarget) { clearTimeout(releaseTimer.current); releaseTimer.current = null; setRelease(0) }
        }} pointerEvents="none">
        <g transform="scale(.4) translate(-40 -40)">
          <path d="M40 6 50 27 73 30 56 47 60 71 40 60 20 71 24 47 7 30 30 27Z"
            fill={responding ? { short: '#FFDB89', medium: '#F4CB76', long: '#F5B66B' }[tier] : '#FFE6A2'} stroke={responding ? '#A96F35' : '#B78A4F'} strokeWidth={responding && reducedMotion ? 4 : 2.5} strokeLinejoin="round" />
          <path d="M40 6 40 40 7 30M40 40 60 71M40 40 73 30M40 40 20 71" fill="none" stroke="#CDA05C" strokeWidth="1.5" opacity=".6" />
          <g data-scene-star-face={face}>
            {responding ? <path d={tier === 'long' ? 'm29 36 7 3-7 3m22-6-7 3 7 3' : tier === 'medium' ? 'm29 37 7 2-7 2m22-4-7 2 7 2' : 'm29 38 4 2 4-2m6 0 4 2 4-2'} fill="none" stroke="#795737" strokeWidth="2.5" strokeLinecap="round" />
              : <><circle cx="33" cy="38" r="2.4" fill="#795737" /><circle cx="47" cy="38" r="2.4" fill="#795737" /></>}
            <ellipse cx="27" cy="44" rx={responding ? tier === 'long' ? 7 : 5 : 3} ry={responding && tier === 'long' ? 4 : 2} fill="#DD8D77" opacity={responding ? '.9' : '.45'} />
            <ellipse cx="53" cy="44" rx={responding ? tier === 'long' ? 7 : 5 : 3} ry={responding && tier === 'long' ? 4 : 2} fill="#DD8D77" opacity={responding ? '.9' : '.45'} />
            <path d={responding && tier === 'long' ? 'M38 46Q40 43 42 46Q40 50 38 46' : responding ? 'M36 46Q40 51 44 46' : 'M37 46Q40 49 43 46'} fill="none" stroke="#795737" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      </g>
      {Boolean(release) && tier === 'long' && !reducedMotion && <g data-scene-star-glints="true" pointerEvents="none" fill="#FFE8A4" stroke="#B38445" strokeWidth=".8">
        <path d="m-21-19 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5ZM19-24l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5ZM25-2l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
      </g>}
      <g pointerEvents="none" fill="#FFE6A2" stroke="#AE8045" strokeWidth=".6" opacity={hovered || focused ? 1 : .7}>
        <path d="M18-18v6m-3-3h6M-19-8v4m-2-2h4" />
      </g>
      {(hovered || focused || responding) && <g data-scene-star-hint="true" transform={`translate(0 -30) scale(${hintScale})`} pointerEvents="none">
        <rect x="-64" y="-20" width="128" height="23" rx="7" fill="#FFF5D9" stroke="#CBA76A" strokeWidth="1" />
        <path d="m-4 3 4 4 4-4" fill="#FFF5D9" stroke="#CBA76A" strokeWidth="1" />
        <text x="0" y="-5" textAnchor="middle" fontSize="10" fill="#745331" fontFamily="system-ui, sans-serif">{hint}</text>
      </g>}
    </g>
  )
}
