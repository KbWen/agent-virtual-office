import { describe, it, expect } from 'vitest'

// Import CommonJS hook helpers
const { toolToRole, skillToRole, shortFile, shortCommand, extractContext } = await import('../public/hooks/office-status-hook.js')

describe('toolToRole', () => {
  it('maps Edit/Write/NotebookEdit to dev', () => {
    expect(toolToRole('Edit')).toBe('dev')
    expect(toolToRole('Write')).toBe('dev')
    expect(toolToRole('NotebookEdit')).toBe('dev')
  })

  it('maps Bash to ops', () => {
    expect(toolToRole('Bash')).toBe('ops')
  })

  it('maps Read/Glob/Grep to res', () => {
    expect(toolToRole('Read')).toBe('res')
    expect(toolToRole('Glob')).toBe('res')
    expect(toolToRole('Grep')).toBe('res')
  })

  it('maps Agent to pm', () => {
    expect(toolToRole('Agent')).toBe('pm')
  })

  it('maps web tools to res', () => {
    expect(toolToRole('WebFetch')).toBe('res')
    expect(toolToRole('WebSearch')).toBe('res')
  })

  it('maps TodoWrite to pm', () => {
    expect(toolToRole('TodoWrite')).toBe('pm')
  })

  it('maps EnterPlanMode/ExitPlanMode to arch', () => {
    expect(toolToRole('EnterPlanMode')).toBe('arch')
    expect(toolToRole('ExitPlanMode')).toBe('arch')
  })

  it('maps AskUserQuestion to gate', () => {
    expect(toolToRole('AskUserQuestion')).toBe('gate')
  })

  it('defaults unknown tools to dev', () => {
    expect(toolToRole('UnknownTool')).toBe('dev')
  })
})

describe('skillToRole', () => {
  it('maps planning skills to pm', () => {
    expect(skillToRole('plan')).toBe('pm')
    expect(skillToRole('spec-intake')).toBe('pm')
    expect(skillToRole('bootstrap')).toBe('pm')
    expect(skillToRole('decide')).toBe('pm')
  })

  it('maps review/test skills to qa', () => {
    expect(skillToRole('review')).toBe('qa')
    expect(skillToRole('test')).toBe('qa')
    expect(skillToRole('test-classify')).toBe('qa')
  })

  it('maps implementation skills to dev', () => {
    expect(skillToRole('implement')).toBe('dev')
    expect(skillToRole('fix-bug')).toBe('dev')
  })

  it('maps shipping skills to ops', () => {
    expect(skillToRole('ship')).toBe('ops')
    expect(skillToRole('deploy')).toBe('ops')
    expect(skillToRole('handoff')).toBe('ops')
  })

  it('maps research skills to res', () => {
    expect(skillToRole('research')).toBe('res')
    expect(skillToRole('explore')).toBe('res')
  })

  it('maps architecture skills to arch', () => {
    expect(skillToRole('architect')).toBe('arch')
    expect(skillToRole('design')).toBe('arch')
  })

  it('maps security skills to gate', () => {
    expect(skillToRole('security')).toBe('gate')
    expect(skillToRole('audit')).toBe('gate')
  })

  it('defaults to dev for null/unknown', () => {
    expect(skillToRole(null)).toBe('dev')
    expect(skillToRole('random-skill')).toBe('dev')
  })
})

describe('shortFile', () => {
  it('extracts basename from full path', () => {
    expect(shortFile('/Users/x/project/src/App.jsx')).toBe('App.jsx')
    expect(shortFile('C:\\Users\\x\\project\\src\\store.js')).toBe('store.js')
  })

  it('returns null for null input', () => {
    expect(shortFile(null)).toBeNull()
  })

  it('handles bare filename', () => {
    expect(shortFile('App.jsx')).toBe('App.jsx')
  })
})

describe('shortCommand', () => {
  it('extracts last command from chained commands', () => {
    expect(shortCommand('cd /project && npm test')).toBe('npm test')
  })

  it('truncates long commands', () => {
    const long = 'npm run build:production --mode=staging --verbose --output-dir=/tmp'
    const result = shortCommand(long)
    expect(result.length).toBeLessThanOrEqual(30)
    expect(result).toMatch(/\.\.\./)
  })

  it('returns short commands as-is', () => {
    expect(shortCommand('git status')).toBe('git status')
  })

  it('returns null for null input', () => {
    expect(shortCommand(null)).toBeNull()
  })
})

describe('extractContext (hook)', () => {
  it('extracts file path from Edit input', () => {
    const result = extractContext('Edit', { file_path: '/project/src/App.jsx' })
    expect(result).toBe('App.jsx')
  })

  it('extracts command from Bash input', () => {
    const result = extractContext('Bash', { command: 'npm test' })
    expect(result).toBe('npm test')
  })

  it('extracts pattern from Grep input', () => {
    const result = extractContext('Grep', { pattern: 'useLocale' })
    expect(result).toBe('"useLocale"')
  })

  it('extracts pattern from Glob input', () => {
    const result = extractContext('Glob', { pattern: '**/*.test.js' })
    expect(result).toBe('**/*.test.js')
  })

  it('extracts description from Agent input', () => {
    const result = extractContext('Agent', { description: 'Search for tests' })
    expect(result).toBe('Search for tests')
  })

  it('handles string JSON input', () => {
    const result = extractContext('Edit', JSON.stringify({ file_path: '/src/App.jsx' }))
    expect(result).toBe('App.jsx')
  })

  it('returns null for null input', () => {
    expect(extractContext('Edit', null)).toBeNull()
  })

  it('returns null for invalid JSON string', () => {
    expect(extractContext('Edit', 'not json')).toBeNull()
  })

  it('returns null for unknown tool', () => {
    expect(extractContext('UnknownTool', { anything: 'here' })).toBeNull()
  })

  it('extracts task count from TodoWrite input', () => {
    const result = extractContext('TodoWrite', { todos: [{ content: 'a' }, { content: 'b' }] })
    expect(result).toBe('2 tasks')
  })

  it('returns null for TodoWrite with no todos', () => {
    expect(extractContext('TodoWrite', {})).toBeNull()
  })

  it('extracts question from AskUserQuestion input', () => {
    const result = extractContext('AskUserQuestion', { questions: [{ question: 'Which approach should we use for auth?' }] })
    expect(result).toBe('Which approach should we ')
  })

  it('returns null for EnterPlanMode/ExitPlanMode', () => {
    expect(extractContext('EnterPlanMode', {})).toBeNull()
    expect(extractContext('ExitPlanMode', {})).toBeNull()
  })
})

// Import skill context helpers for testing
const { skillContextPath, saveSkillContext, readSkillContext, clearSkillContext } = await import('../public/hooks/office-status-hook.js')

describe('skill context', () => {
  it('saves and reads skill context by agent_id', () => {
    const agentId = 'test-agent-123'
    saveSkillContext(agentId, 'qa', 'review')
    const ctx = readSkillContext(agentId)
    expect(ctx).toEqual({ role: 'qa', skillName: 'review' })
    clearSkillContext(agentId)
  })

  it('returns null for unknown agent_id', () => {
    expect(readSkillContext('nonexistent-agent-xyz')).toBeNull()
  })

  it('clears skill context on SubagentStop', () => {
    const agentId = 'test-agent-456'
    saveSkillContext(agentId, 'dev', 'implement')
    clearSkillContext(agentId)
    expect(readSkillContext(agentId)).toBeNull()
  })

  it('returns null for null agent_id', () => {
    expect(readSkillContext(null)).toBeNull()
  })
})
