import { describe, it, expect } from 'vitest'
import { extractContext, toolToAction, generateContextBubble } from '../src/systems/contextBubble.js'

describe('extractContext', () => {
  it('returns null for null/empty input', () => {
    expect(extractContext(null)).toBeNull()
    expect(extractContext('')).toBeNull()
    expect(extractContext(undefined)).toBeNull()
  })

  it('strips emoji prefix', () => {
    expect(extractContext('✏️ App.jsx')).toBe('App.jsx')
    expect(extractContext('⚡ npm test')).toBe('npm test')
    expect(extractContext('🔎 useLocale')).toBe('useLocale')
  })

  it('strips Chinese verb prefix', () => {
    expect(extractContext('改 App.jsx')).toBe('App.jsx')
    expect(extractContext('寫 store.js')).toBe('store.js')
    expect(extractContext('讀 config.json')).toBe('config.json')
    expect(extractContext('找 pattern')).toBe('pattern')
    expect(extractContext('搜 useLocale')).toBe('useLocale')
    expect(extractContext('跑 npm test')).toBe('npm test')
  })

  it('strips English verb prefix', () => {
    expect(extractContext('editing App.jsx')).toBe('App.jsx')
    expect(extractContext('writing store.js')).toBe('store.js')
    expect(extractContext('reading config.json')).toBe('config.json')
    expect(extractContext('searching pattern')).toBe('pattern')
    expect(extractContext('running npm test')).toBe('npm test')
  })

  it('strips combined emoji + Chinese verb', () => {
    expect(extractContext('✏️ 改 App.jsx')).toBe('App.jsx')
    expect(extractContext('⚡ 跑 npm test')).toBe('npm test')
    expect(extractContext('🔎 搜 useLocale')).toBe('useLocale')
  })

  it('returns plain text unchanged', () => {
    expect(extractContext('App.jsx')).toBe('App.jsx')
    expect(extractContext('npm test')).toBe('npm test')
  })

  it('preserves plain ASCII digits (not treated as emoji)', () => {
    expect(extractContext('3 files changed')).toBe('3 files changed')
    expect(extractContext('42 errors found')).toBe('42 errors found')
  })

  it('strips keycap emoji prefix (digit + VS16 + enclosing keycap)', () => {
    expect(extractContext('1️⃣ first task')).toBe('first task')
    expect(extractContext('#️⃣ hashtag')).toBe('hashtag')
    expect(extractContext('*️⃣ wildcard')).toBe('wildcard')
  })
})

describe('toolToAction', () => {
  it('returns null for null/undefined', () => {
    expect(toolToAction(null)).toBeNull()
    expect(toolToAction(undefined)).toBeNull()
  })

  it('maps known tools correctly', () => {
    expect(toolToAction('Edit')).toBe('edit')
    expect(toolToAction('Write')).toBe('write')
    expect(toolToAction('Read')).toBe('read')
    expect(toolToAction('Bash')).toBe('bash')
    expect(toolToAction('Grep')).toBe('search')
    expect(toolToAction('Glob')).toBe('search')
    expect(toolToAction('Agent')).toBe('delegate')
    expect(toolToAction('WebFetch')).toBe('web')
    expect(toolToAction('WebSearch')).toBe('web')
  })

  it('returns "generic" for unknown tools', () => {
    expect(toolToAction('UnknownTool')).toBe('generic')
    expect(toolToAction('TodoWrite')).toBe('generic')
  })

  it('maps NotebookEdit to "edit"', () => {
    expect(toolToAction('NotebookEdit')).toBe('edit')
  })
})

describe('generateContextBubble — {ctx} substitution safety (R64)', () => {
  // String.prototype.replace interprets `$`-sequences in a *string* replacement
  // ($&, $1, $`, $') as substitution patterns. A filename or task containing
  // those characters must be inserted literally — these tests would fail with the
  // old string-replacement path.
  const dangerous = [
    ['$&', 'tool$&.js'],
    ['dollar-amp', 'price$&total.md'],
    ['$1', 'capture$1group.js'],
    ['backtick', 'weird$`name.js'],
    ['quote', "odd$'file.js"],
    ['plain', 'cost$5report.md'],
  ]

  for (const [name, ctx] of dangerous) {
    it(`inserts ctx literally when it contains a $-sequence (${name})`, () => {
      const bubble = generateContextBubble(
        'dev',
        { status: 'working', task: 'Edit', label: ctx, hint: null },
        {},
      )
      // dev-edit templates all embed {ctx}; the literal ctx must survive verbatim.
      expect(bubble).toBeTruthy()
      expect(bubble).toContain(ctx)
      // The placeholder token must be fully consumed — no leftover braces.
      expect(bubble).not.toContain('{ctx}')
    })
  }
})
