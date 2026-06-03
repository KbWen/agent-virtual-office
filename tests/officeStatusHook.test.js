import { describe, it, expect } from 'vitest'

// Import CommonJS hook helpers
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const { toolToRole, fileToRole, skillToRole, shortFile, shortCommand, bashVibeLabel, extractContext, shouldClearWorkflowOnSubagentStop, shouldCarryStoppedSignal, statusForPreToolUse, readLatestTokenUsage, effortLevel } = await import('../public/hooks/office-status-hook.js')

describe('effortLevel — AVO-102 effort extraction', () => {
  it('returns the level for each known ordinal value', () => {
    for (const lvl of ['low', 'medium', 'high', 'xhigh', 'max']) {
      expect(effortLevel({ effort: { level: lvl } })).toBe(lvl)
    }
  })
  it('returns null for absent / malformed / unknown effort', () => {
    expect(effortLevel({})).toBeNull()
    expect(effortLevel({ effort: null })).toBeNull()
    expect(effortLevel({ effort: {} })).toBeNull()
    expect(effortLevel({ effort: { level: 'turbo' } })).toBeNull()
    expect(effortLevel(null)).toBeNull()
  })
})

describe('readLatestTokenUsage — AVO-108 transcript tail-read', () => {
  function tmpTranscript(lines) {
    const p = path.join(os.tmpdir(), `transcript-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`)
    fs.writeFileSync(p, lines.map(l => JSON.stringify(l)).join('\n'))
    return p
  }
  it('extracts ctx (input+cache) + output + model from the last usage-bearing line', () => {
    const p = tmpTranscript([
      { type: 'user', message: { role: 'user' } },
      { type: 'assistant', message: { model: 'claude-opus-4-8', usage: { input_tokens: 2, cache_creation_input_tokens: 4452, cache_read_input_tokens: 596779, output_tokens: 2348 } } },
    ])
    expect(readLatestTokenUsage(p)).toEqual({ ctx: 2 + 4452 + 596779, out: 2348, model: 'claude-opus-4-8' })
    fs.unlinkSync(p)
  })
  it('uses the LAST usage line when several are present', () => {
    const p = tmpTranscript([
      { type: 'assistant', message: { model: 'a', usage: { input_tokens: 1, output_tokens: 10 } } },
      { type: 'assistant', message: { model: 'b', usage: { input_tokens: 5, output_tokens: 99 } } },
    ])
    expect(readLatestTokenUsage(p)).toEqual({ ctx: 5, out: 99, model: 'b' })
    fs.unlinkSync(p)
  })
  it('returns null safely for missing path, missing file, or no usage', () => {
    expect(readLatestTokenUsage(null)).toBeNull()
    expect(readLatestTokenUsage('')).toBeNull()
    expect(readLatestTokenUsage('/no/such/file.jsonl')).toBeNull()
    const p = tmpTranscript([{ type: 'user', message: { role: 'user' } }])
    expect(readLatestTokenUsage(p)).toBeNull()
    fs.unlinkSync(p)
  })
  it('survives malformed JSON lines (skips them, never throws)', () => {
    const p = path.join(os.tmpdir(), `t-${Date.now()}.jsonl`)
    fs.writeFileSync(p, 'not json\n{bad\n' + JSON.stringify({ message: { usage: { input_tokens: 7, output_tokens: 3 } } }))
    expect(readLatestTokenUsage(p)).toEqual({ ctx: 7, out: 3, model: null })
    fs.unlinkSync(p)
  })
})

describe('statusForPreToolUse — plan-mode detection (AVO-101)', () => {
  it('maps plan mode to the distinct planning status', () => {
    expect(statusForPreToolUse('plan')).toBe('planning')
  })

  it('keeps every other permission mode as working', () => {
    expect(statusForPreToolUse('default')).toBe('working')
    expect(statusForPreToolUse('acceptEdits')).toBe('working')
    expect(statusForPreToolUse('bypassPermissions')).toBe('working')
    expect(statusForPreToolUse(undefined)).toBe('working')
    expect(statusForPreToolUse(null)).toBe('working')
  })
})

describe('shouldCarryStoppedSignal — no contradictory _stopped+active output', () => {
  it('does NOT carry _stopped when an agent is active (the >30s straggler PreToolUse bug)', () => {
    // straggler PreToolUse: recheckStopped still true, but it asserts a working agent → activeCount 1.
    // Old code emitted {_stopped:true, activeCount:1, working}; now we drop _stopped (office IS active).
    expect(shouldCarryStoppedSignal(true, 'PreToolUse', 1)).toBe(false)
    expect(shouldCarryStoppedSignal(true, 'PostToolUse', 2)).toBe(false)
  })

  it('DOES carry _stopped for a winding-down event with no active agents (race protection kept)', () => {
    // a PostToolUse 'done' that leaves 0 active must still protect Stop's idle signal.
    expect(shouldCarryStoppedSignal(true, 'PostToolUse', 0)).toBe(true)
    expect(shouldCarryStoppedSignal(true, 'SubagentStop', 0)).toBe(true)
  })

  it('never carries when not stopped, or for UserPromptSubmit (which ends the stopped state)', () => {
    expect(shouldCarryStoppedSignal(false, 'PostToolUse', 0)).toBe(false)
    expect(shouldCarryStoppedSignal(true, 'UserPromptSubmit', 0)).toBe(false)
  })
})

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
    expect(skillToRole('brainstorm')).toBe('arch')
  })

  it('maps security skills to gate', () => {
    expect(skillToRole('security')).toBe('gate')
    expect(skillToRole('audit')).toBe('gate')
  })

  it('maps designer skills to designer', () => {
    expect(skillToRole('design')).toBe('designer')
    expect(skillToRole('ui_review')).toBe('designer')
    expect(skillToRole('design_review')).toBe('designer')
  })

  it('routes compound review skills by domain (not generic /review/ match)', () => {
    expect(skillToRole('eng_review')).toBe('arch')
    expect(skillToRole('plan-eng-review')).toBe('arch')
    expect(skillToRole('technical-review')).toBe('arch')
    expect(skillToRole('ceo-review')).toBe('gate')
    expect(skillToRole('security_review')).toBe('gate')
    expect(skillToRole('product-review')).toBe('pm')
    expect(skillToRole('code-review')).toBe('qa')
    expect(skillToRole('review')).toBe('qa')
  })

  it('defaults to dev for null/unknown', () => {
    expect(skillToRole(null)).toBe('dev')
    expect(skillToRole('random-skill')).toBe('dev')
  })
})

describe('fileToRole', () => {
  it('maps test files to qa', () => {
    expect(fileToRole('/project/src/App.test.js')).toBe('qa')
    expect(fileToRole('/project/tests/store.spec.ts')).toBe('qa')
    expect(fileToRole('/project/__tests__/util.test.jsx')).toBe('qa')
  })

  it('maps CI/CD files to ops', () => {
    expect(fileToRole('/project/.github/workflows/ci.yml')).toBe('ops')
    expect(fileToRole('/project/Dockerfile')).toBe('ops')
    expect(fileToRole('/project/docker-compose.yml')).toBe('ops')
    expect(fileToRole('/project/deploy.yaml')).toBe('ops')
  })

  it('maps docs to res', () => {
    expect(fileToRole('/project/README.md')).toBe('res')
    expect(fileToRole('/project/docs/guide.mdx')).toBe('res')
    expect(fileToRole('/project/notes/todo.txt')).toBe('res')
  })

  it('maps ADR/architecture files to arch', () => {
    expect(fileToRole('/project/adr/001-auth.md')).toBe('res') // .md beats /adr/
    expect(fileToRole('/project/architecture/schema.puml')).toBe('arch')
    expect(fileToRole('/project/src/design.drawio')).toBe('arch')
  })

  it('maps CSS/design files to designer', () => {
    expect(fileToRole('/project/src/App.css')).toBe('designer')
    expect(fileToRole('/project/styles/theme.scss')).toBe('designer')
    expect(fileToRole('/project/assets/logo.svg')).toBe('designer')
    expect(fileToRole('/project/design/mockup.figma')).toBe('designer')
    expect(fileToRole('/project/public/icon.png')).toBe('designer')
  })

  it('returns null for plain source files (fall through)', () => {
    expect(fileToRole('/project/src/App.jsx')).toBeNull()
    expect(fileToRole('/project/src/store.js')).toBeNull()
    expect(fileToRole('/project/src/utils/format.ts')).toBeNull()
  })

  it('returns null for null/undefined input', () => {
    expect(fileToRole(null)).toBeNull()
    expect(fileToRole(undefined)).toBeNull()
    expect(fileToRole('')).toBeNull()
  })

  it('handles Windows-style backslash paths', () => {
    expect(fileToRole('C:\\project\\tests\\App.test.js')).toBe('qa')
    expect(fileToRole('C:\\project\\src\\styles\\main.css')).toBe('designer')
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

describe('bashVibeLabel (AVO-126 — no raw shell in bubbles)', () => {
  it('maps common dev commands to friendly nouns (en)', () => {
    expect(bashVibeLabel('npm test', 'en')).toBe('tests')
    expect(bashVibeLabel('cd /x && vitest run', 'en')).toBe('tests')
    expect(bashVibeLabel('npm run build', 'en')).toBe('the build')
    expect(bashVibeLabel('npm install', 'en')).toBe('deps')
    expect(bashVibeLabel('git status', 'en')).toBe('git')
    expect(bashVibeLabel('ls -lt /c/Users/wen', 'en')).toBe('files')
    expect(bashVibeLabel('curl http://x', 'en')).toBe('a fetch')
    expect(bashVibeLabel('node server.mjs', 'en')).toBe('a script')
  })

  it('maps to friendly nouns (zh-TW)', () => {
    expect(bashVibeLabel('npm test', 'zh-TW')).toBe('測試')
    expect(bashVibeLabel('ls -lt /c/Users/wen', 'zh-TW')).toBe('檔案')
    expect(bashVibeLabel('git push', 'zh-TW')).toBe('git')
  })

  it('falls back to a generic noun for unknown commands — never the raw string', () => {
    expect(bashVibeLabel('frobnicate --weird /c/Users/wen/secret', 'en')).toBe('a command')
    expect(bashVibeLabel('zzz', 'zh-TW')).toBe('指令')
  })

  it('NEVER returns a filesystem path or the raw command (invariant)', () => {
    const samples = ['ls -lt /c/Users/wen/.gemini', 'cat /etc/passwd', 'rm -rf ./dist',
      'cd "C:\\\\Users\\\\wen" && dir', 'grep -r token /var/log', 'unknowncmd /deep/secret/path']
    for (const cmd of samples) {
      const out = bashVibeLabel(cmd, 'en')
      expect(out).not.toMatch(/[/\\]/)        // no slashes
      expect(out.length).toBeLessThan(20)     // short office noun, not a command
      expect(cmd.includes(out)).toBe(false)   // not a substring of the raw command
    }
  })

  it('handles null / non-string defensively', () => {
    expect(bashVibeLabel(null, 'en')).toBe('a command')
    expect(bashVibeLabel(undefined, 'zh-TW')).toBe('指令')
    expect(bashVibeLabel(42, 'en')).toBe('a command')
  })
})

describe('extractContext (hook)', () => {
  it('extracts file path from Edit input', () => {
    const result = extractContext('Edit', { file_path: '/project/src/App.jsx' })
    expect(result).toBe('App.jsx')
  })

  it('maps Bash input to an office-vibe noun, never the raw command (AVO-126)', () => {
    const result = extractContext('Bash', { command: 'npm test' })
    expect(result).toBe('tests')
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
    // Label is bilingual ('2 tasks' en, '2 個任務' zh-TW) depending on ~/.claude/office-lang
    expect(result).toMatch(/^2 /)
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

// Import skill context helpers and sanitizeId for testing
const { skillContextPath, saveSkillContext, readSkillContext, clearSkillContext, sanitizeId } = await import('../public/hooks/office-status-hook.js')

describe('sanitizeId (path-traversal safety)', () => {
  it('allows safe alphanumeric IDs unchanged', () => {
    expect(sanitizeId('agent-review-001')).toBe('agent-review-001')
    expect(sanitizeId('agent_plan_2')).toBe('agent_plan_2')
  })

  it('replaces path traversal sequences with underscores', () => {
    const safe = sanitizeId('../../../etc/passwd')
    // Must not contain slashes or dots — path cannot escape ~/.claude/
    expect(safe).not.toMatch(/[./\\]/)
    // Each non-alphanumeric char becomes '_': '../../../' = 9 chars → 9 underscores
    expect(safe).toBe('_________etc_passwd')
  })

  it('truncates to 64 characters', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeId(long).length).toBe(64)
  })

  it('returns "unknown" for non-string input', () => {
    expect(sanitizeId(null)).toBe('unknown')
    expect(sanitizeId(undefined)).toBe('unknown')
    expect(sanitizeId(42)).toBe('unknown')
  })

  it('returns "unknown" for empty string (nothing left after sanitization)', () => {
    expect(sanitizeId('')).toBe('unknown')
  })
})

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

describe('shouldClearWorkflowOnSubagentStop — orphaned-workflow leak fix', () => {
  // Known-owner path (the normal, R45/R46-hardened case): clear only on exact id match.
  it('clears when the stopping agent_id matches the workflow owner', () => {
    expect(shouldClearWorkflowOnSubagentStop('agent-1', 'agent-1', 'review', 'review')).toBe(true)
  })

  it('does NOT clear when a straggler stop has a different agent_id (same type running)', () => {
    // a finished /review's straggler stop must not clobber a new /review's banner
    expect(shouldClearWorkflowOnSubagentStop('agent-1', 'agent-2', 'review', 'review')).toBe(false)
  })

  it('does NOT clear a known-owner banner when the straggler stop has no agent_id', () => {
    expect(shouldClearWorkflowOnSubagentStop('agent-1', null, 'review', 'review')).toBe(false)
  })

  // Orphaned path (existingWorkflowAgentId null — SubagentStart set a workflow with no
  // agent_id). The OLD code only cleared on an exact type-string match, so a stop with a
  // missing/different agent_type leaked the banner forever (the HIGH finding).
  it('clears an orphaned banner when the stopping type matches the workflow string', () => {
    expect(shouldClearWorkflowOnSubagentStop(null, null, 'review', 'review')).toBe(true)
  })

  it('clears an orphaned banner when the stop supplies NO agent_type (was the forever-leak)', () => {
    expect(shouldClearWorkflowOnSubagentStop(null, null, 'review', '')).toBe(true)
    expect(shouldClearWorkflowOnSubagentStop(null, null, 'review', undefined)).toBe(true)
  })

  it('does NOT clear an orphaned banner when a DIFFERENT-typed subagent stops (Stop backstop catches it)', () => {
    // A stop for a different subagent type shouldn't clear an orphaned banner that may still
    // be active; the unconditional `workflow: null` at Stop is the guaranteed terminal clear.
    expect(shouldClearWorkflowOnSubagentStop(null, null, 'review', 'implement')).toBe(false)
  })
})
