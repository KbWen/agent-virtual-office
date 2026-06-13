import { describe, it, expect } from 'vitest'
import { extractContext, toolToAction, generateContextBubble, skillBubbleText } from '../src/systems/contextBubble.js'

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

describe('generateContextBubble — guard conditions', () => {
  it('returns null for null update', () => {
    expect(generateContextBubble('dev', null, {})).toBeNull()
  })

  it('returns null for non-string agentId', () => {
    expect(generateContextBubble(42, { status: 'working', task: 'Edit', label: null, hint: null }, {})).toBeNull()
    expect(generateContextBubble(null, { status: 'working', task: 'Edit', label: null, hint: null }, {})).toBeNull()
  })

  it('blocked status routes through error templates — bubble is non-null', () => {
    const bubble = generateContextBubble('dev', { status: 'blocked', task: null, label: null, hint: null }, {})
    // dev-error or any-error pool must produce a string.
    expect(bubble).toBeTruthy()
    expect(typeof bubble).toBe('string')
  })

  it('hint=error routes through error templates even when status is "working"', () => {
    const bubble = generateContextBubble('qa', { status: 'working', task: null, label: null, hint: 'error' }, {})
    expect(bubble).toBeTruthy()
    expect(typeof bubble).toBe('string')
  })

  it('done status routes through done templates — bubble is non-null', () => {
    const bubble = generateContextBubble('dev', { status: 'done', task: null, label: '✏️ store.js', hint: null }, {})
    // dev-done or any-done pool must produce a string.
    expect(bubble).toBeTruthy()
    expect(typeof bubble).toBe('string')
    expect(bubble).not.toContain('{ctx}')
  })

  it('composite agentId (feat-x~dev) extracts base role — generates a bubble from dev templates', () => {
    const composite = generateContextBubble(
      'feat-x~dev',
      { status: 'working', task: 'Edit', label: 'index.js', hint: null },
      {},
    )
    const bare = generateContextBubble(
      'dev',
      { status: 'working', task: 'Edit', label: 'index.js', hint: null },
      {},
    )
    // Both should be truthy — composite gets the same pool as the bare dev role.
    expect(composite).toBeTruthy()
    expect(bare).toBeTruthy()
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

describe('skillBubbleText (AVO-104)', () => {
  it('maps each skill family to its localized bubble (en)', () => {
    expect(skillBubbleText('plan')).toBe('📊 Planning')
    expect(skillBubbleText('review')).toBe('🧐 Reviewing')
    expect(skillBubbleText('test')).toBe('🧪 Testing')
    expect(skillBubbleText('implement')).toBe('⌨️ Coding')
    expect(skillBubbleText('ship')).toBe('🚀 Deploying')
    expect(skillBubbleText('bootstrap')).toBe('📋 Writing spec')
    expect(skillBubbleText('research')).toBe('🔬 Researching')
    expect(skillBubbleText('security')).toBe('🛡️ Security check')
  })
  it('falls back to generic with the raw skill name', () => {
    const b = skillBubbleText('some-custom-agent')
    expect(b).toBe('💼 some-custom-agent')
    expect(b).not.toContain('{ctx}')
  })
  it('returns null for missing / non-string skill', () => {
    expect(skillBubbleText(null)).toBeNull()
    expect(skillBubbleText(undefined)).toBeNull()
    expect(skillBubbleText(123)).toBeNull()
  })
  it('keeps $-sequences in a raw name literal (no replace-pattern injection)', () => {
    expect(skillBubbleText('$&-weird')).toBe('💼 $&-weird')
  })
})

describe('generateContextBubble — skill branch (AVO-104)', () => {
  it('fires a skill bubble on a working activation', () => {
    const b = generateContextBubble('qa', { status: 'working', task: 'review', label: null, hint: null, skill: 'review' }, {})
    expect(b).toBe('🧐 Reviewing')
  })
  it('does NOT emit a skill bubble for a blocked update (honesty: skill is working-phase only)', () => {
    const b = generateContextBubble('qa', { status: 'blocked', task: 'review', label: null, hint: null, skill: 'review' }, {})
    // blocked → error/colleague bubble path, never the skill text
    expect(b).not.toBe('🧐 Reviewing')
  })
  it('does NOT emit a skill bubble for a done update', () => {
    const b = generateContextBubble('qa', { status: 'done', task: 'review', label: null, hint: null, skill: 'review' }, {})
    expect(b).not.toBe('🧐 Reviewing')
  })
  it('no skill field → ordinary bubble path (byte-identical behavior)', () => {
    const withSkill = generateContextBubble('dev', { status: 'working', task: 'Edit', label: '✏️ App.jsx', hint: null }, {})
    expect(withSkill).toBeTruthy()
    expect(withSkill).not.toBe('🧐 Reviewing')
  })
})
