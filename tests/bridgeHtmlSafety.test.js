import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const bridgeHtml = readFileSync(join(process.cwd(), 'public', 'bridge.html'), 'utf-8')
const bridgeUiJs = readFileSync(join(process.cwd(), 'public', 'bridge-ui.js'), 'utf-8')

describe('bridge.html dynamic rendering safety', () => {
  it('does not build dynamic UI with inline handlers or innerHTML assignments', () => {
    expect(bridgeHtml).not.toMatch(/\.innerHTML\s*=/)
    expect(bridgeHtml).not.toMatch(/\son[a-z]+\s*=/i)
    expect(bridgeHtml).toContain('<script src="/bridge-ui.js" defer></script>')
  })

  it('renders bridge log entries with text nodes', () => {
    expect(bridgeUiJs).not.toMatch(/\.innerHTML\s*=/)
    expect(bridgeUiJs).toContain('document.createTextNode(` ${agents}`)')
    expect(bridgeUiJs).toContain('document.createTextNode(` | ${msg.workflow}`)')
  })

  it('provides buttons for working, blocked, done, planning, and awaiting-approval', () => {
    for (const status of ['working', 'blocked', 'done', 'planning', 'awaiting-approval']) {
      expect(bridgeUiJs).toContain(`'${status}'`)
      expect(bridgeHtml).toContain(`.active-${status}`)
    }
  })

  it('cleans kebab-case active status classes without leaving trailing fragments', () => {
    // Regression test for 10th-man finding: \w does not match hyphen in awaiting-approval
    expect(bridgeUiJs).not.toMatch(/replace\(\/active-\\w\+\//)
    expect(bridgeUiJs).toMatch(/replace\(\/active-\[\\w-\]\+\/g/)

    // Simulate class clearing on all statuses including kebab-case awaiting-approval
    const regex = /active-[\w-]+/g
    const testCases = [
      'active-working',
      'active-blocked',
      'active-done',
      'active-planning',
      'active-awaiting-approval',
      'btn active-awaiting-approval primary',
    ]
    for (const cls of testCases) {
      const cleaned = cls.replace(regex, '').trim()
      expect(cleaned).not.toContain('-approval')
      expect(cleaned).not.toContain('active-')
    }
  })

  it('supports planning and awaiting-approval in applyUrlParams isStatus check', () => {
    expect(bridgeUiJs).toContain("['working', 'blocked', 'done', 'planning', 'awaiting-approval'].includes(v)")
  })
})
