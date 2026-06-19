import { describe, it, expect } from 'vitest'
import { classifyTitle } from '../src/inference/inferStatus.js'

// AVO-174 — the document-title channel is a WEAK heuristic. It must only ever HINT that a role is
// working; it must NEVER fabricate the most-alarming state (blocked) or a completion (done) from a
// page title (a browser tab titled "build failed" or "all done" is not a real agent signal).
describe('AVO-174 title inference never fabricates blocked/done', () => {
  it('still classifies the working role-hints (regression)', () => {
    expect(classifyTitle('Implementing the auth flow')).toEqual({ role: 'dev', status: 'working' })
    expect(classifyTitle('Linting the project')).toEqual({ role: 'qa', status: 'working' })
    expect(classifyTitle('Planning the spec')).toEqual({ role: 'pm', status: 'working' })
    expect(classifyTitle('Deploying to prod')).toEqual({ role: 'ops', status: 'working' })
    expect(classifyTitle('Analyzing the data')).toEqual({ role: 'res', status: 'working' })
    expect(classifyTitle('Architecting the system')).toEqual({ role: 'arch', status: 'working' })
  })

  it('never returns blocked or done — even for alarming/conclusive title words', () => {
    const titles = [
      'error', 'Tests failed', 'blocked on review', 'stuck',
      'all done', 'success', 'finished', 'task complete', 'Build complete',
    ]
    for (const t of titles) {
      const r = classifyTitle(t)
      // either no hint at all, or (if a working keyword also appears) a 'working' hint — never blocked/done
      expect(r === null || r.status === 'working').toBe(true)
      if (r) {
        expect(r.status).not.toBe('blocked')
        expect(r.status).not.toBe('done')
      }
    }
  })

  it('returns null for unmatched titles and non-strings', () => {
    expect(classifyTitle('some random page title')).toBeNull()
    expect(classifyTitle('')).toBeNull()
    expect(classifyTitle(null)).toBeNull()
    expect(classifyTitle(undefined)).toBeNull()
    expect(classifyTitle(123)).toBeNull()
  })
})
