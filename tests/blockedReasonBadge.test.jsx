// AVO-110 / #29 — over-head blocked-reason badge render contract (SSR; no jsdom needed).
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BlockedReasonBadge } from '../src/components/blockedReasonBadge.jsx'
import { BLOCKED_REASONS } from '../src/systems/classify.js'

const render = (reasonCode) => renderToStaticMarkup(<BlockedReasonBadge reasonCode={reasonCode} />)

describe('BlockedReasonBadge (AVO-110)', () => {
  it('renders a localized a11y label in an SVG <title> + aria-label (not aria-hidden)', () => {
    const html = render('test-run-failed')
    expect(html).toContain('<title>')
    expect(html).toContain('Blocked on the test run') // en a11y string from locales (default locale)
    expect(html).toContain('aria-label="Blocked on the test run"')
    expect(html).not.toContain('aria-hidden')
  })

  it('COLOR-NEVER-ONLY: each reason renders a DISTINCT markup (silhouette), not color-only', () => {
    const markups = BLOCKED_REASONS.map(render)
    expect(new Set(markups).size).toBe(BLOCKED_REASONS.length) // all 4 differ structurally
    // and each carries a words a11y label (never icon/colour only)
    for (const html of markups) expect(html).toMatch(/aria-label="[^"]+"/)
  })

  it('UNKNOWN-ON-UNRECOGNIZED: garbage / absent reasonCode → the neutral blocked-unknown badge', () => {
    const unknown = render('blocked-unknown')
    expect(render('not-a-real-code')).toBe(unknown)
    expect(render(undefined)).toBe(unknown)
    expect(render(null)).toBe(unknown)
  })

  it('blocked-unknown is neutral (a "?" glyph), NOT a red failure mark (AC-4 honesty)', () => {
    const html = render('blocked-unknown')
    expect(html).toContain('Blocked, cause unknown') // honest a11y wording
    expect(html).toContain('?')                       // hollow question glyph
    expect(html).not.toContain('#d9') // not the recoverable-failure amber/orange hues
    expect(html).not.toContain('#c9')
  })

  it('the specific reasons claim only the RUN/build/install, never an assertion outcome', () => {
    expect(render('test-run-failed')).toContain('Blocked on the test run')
    expect(render('build-failed')).toContain('Blocked on the build')
    expect(render('deps-failed')).toContain('Blocked on installing dependencies')
    // never the over-claiming wording
    expect(render('test-run-failed')).not.toContain('test failed')
  })
})
