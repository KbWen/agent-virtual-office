// AVO-117 — recurring escalation on the over-head badge (SSR render contract).
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BlockedReasonBadge } from '../src/components/blockedReasonBadge.jsx'

const render = (reasonCode, recurring) => renderToStaticMarkup(<BlockedReasonBadge reasonCode={reasonCode} recurring={recurring} />)

describe('BlockedReasonBadge recurring escalation (AVO-117)', () => {
  it('recurring=true → recurring a11y wording (claims the PATTERN, not a bug) + ↻ mark', () => {
    const html = render('test-run-failed', true)
    expect(html).toContain('Recurring: the test run keeps failing for this agent')
    expect(html).toContain('↻')
    expect(html).not.toContain('test failed') // never over-claims a specific bug
  })

  it('recurring=false → base single-block a11y, no ↻', () => {
    const html = render('test-run-failed', false)
    expect(html).toContain('Blocked on the test run')
    expect(html).not.toContain('Recurring')
    expect(html).not.toContain('↻')
  })

  it('recurring escalation differs structurally from the base badge (sign is visible)', () => {
    expect(render('build-failed', true)).not.toBe(render('build-failed', false))
  })

  it('blocked-unknown never escalates even if recurring is passed true (SPECIFIC-ONLY)', () => {
    const html = render('blocked-unknown', true)
    expect(html).not.toContain('↻')
    expect(html).toContain('Blocked, cause unknown')
  })
})
