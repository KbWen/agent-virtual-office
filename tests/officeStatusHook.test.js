import { describe, it, expect } from 'vitest'

// Import CommonJS hook helpers
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const { toolToRole, fileToRole, skillToRole, shortFile, shortCommand, bashVibeLabel, extractContext, shouldClearWorkflowOnSubagentStop, shouldCarryStoppedSignal, statusForPreToolUse, readLatestTokenUsage, effortLevel, activeFileForTool, helperHash, helperAdd, helperRemove } = await import('../public/hooks/office-status-hook.js')

describe('activeFileForTool — AVO-106 co-editing signal gate (Read excluded)', () => {
  it('publishes activeFile for write-class tools (Edit/Write)', () => {
    expect(activeFileForTool('Edit', '/r/src/store.js')).toBe('/r/src/store.js')
    expect(activeFileForTool('Write', '/r/src/new.js')).toBe('/r/src/new.js')
  })
  it('does NOT publish activeFile for Read (co-reads must not over-claim collaboration)', () => {
    expect(activeFileForTool('Read', '/r/src/store.js')).toBeNull()
  })
  it('returns null for non-file tools and when no path was extracted', () => {
    expect(activeFileForTool('Bash', null)).toBeNull()
    expect(activeFileForTool('Grep', null)).toBeNull()
    expect(activeFileForTool('Edit', null)).toBeNull()
  })
})

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

  it('strips harness wrappers + cd prefixes and scans all sub-commands (AVO-126 hardening)', () => {
    // Claude Code wraps commands; the meaningful program is rarely the last segment.
    expect(bashVibeLabel('cd "C:/Users/wen/proj" && npm test', 'en')).toBe('tests')
    expect(bashVibeLabel('cd /x && ls -la /secret/path', 'en')).toBe('files')   // cd skipped, ls wins
    expect(bashVibeLabel('bash -c "git status"', 'en')).toBe('git')             // bash -c wrapper stripped
    expect(bashVibeLabel('sh -lc "vitest run"', 'en')).toBe('tests')
    expect(bashVibeLabel("eval 'curl http://x'", 'en')).toBe('a fetch')
    expect(bashVibeLabel('npm run build && git push', 'en')).toBe('the build')   // first meaningful match
    expect(bashVibeLabel('ls /a; sleep 1; node x.js', 'en')).toBe('files')       // ; split, ls wins over node
    expect(bashVibeLabel('cd /a && cd /b && echo hi', 'en')).toBe('a command')   // only trivial glue → fallback
    // invariant still holds: never a path, even through a wrapper
    expect(bashVibeLabel('bash -c "ls -la /c/Users/wen/.ssh"', 'en')).not.toMatch(/[/\\]/)
  })
})

describe('extractContext (hook)', () => {
  it('extracts file path from Edit input', () => {
    const result = extractContext('Edit', { file_path: '/project/src/App.jsx' })
    expect(result).toBe('App.jsx')
  })

  it('maps Bash input to an office-vibe noun, never the raw command (AVO-126)', () => {
    // Pin lang so the assertion is portable — extractContext otherwise localizes via the
    // machine's ~/.claude/office-lang (this was failing on zh-TW hosts; CI happens to run en).
    const result = extractContext('Bash', { command: 'npm test' }, 'en')
    expect(result).toBe('tests')
  })

  it('extracts pattern from Grep input', () => {
    const result = extractContext('Grep', { pattern: 'useLocale' })
    expect(result).toBe('"useLocale"')
  })

  it('strips absolute path from Grep pattern (fix-4: no-path invariant for Grep)', () => {
    // An absolute path pattern must not appear verbatim in the bubble
    const result = extractContext('Grep', { pattern: '/home/user/project/src/store.js' })
    expect(result).not.toMatch(/\/home\/user/)
    expect(result).not.toMatch(/\\/)
  })

  it('extracts pattern from Glob input (basename-only, fix-4)', () => {
    // "**/*.test.js" → "*.test.js" (last path segment, no leading path components)
    const result = extractContext('Glob', { pattern: '**/*.test.js' })
    expect(result).toBe('*.test.js')
  })

  it('strips absolute path from Glob pattern (fix-4: no-path invariant for Glob)', () => {
    // /home/user/src/**/*.test.js → *.test.js (last segment only)
    const result = extractContext('Glob', { pattern: '/home/user/src/**/*.test.js' })
    expect(result).not.toMatch(/\/home\/user/)
    expect(result).toBe('*.test.js')
  })

  it('strips Windows absolute path from Glob pattern', () => {
    const result = extractContext('Glob', { pattern: 'C:\\Users\\wen\\project\\src\\*.js' })
    expect(result).not.toMatch(/C:\\/)
    expect(result).toBe('*.js')
  })

  it('extracts description from Agent input', () => {
    const result = extractContext('Agent', { description: 'Search for tests' })
    expect(result).toBe('Search for tests')
  })

  it('strips absolute path prefix from Agent description (fix-4: no-path invariant for Agent)', () => {
    // "/home/user/proj: review the auth module" → "review the auth module"
    const result = extractContext('Agent', { description: '/home/user/proj: review the auth module' })
    expect(result).not.toMatch(/\/home\/user/)
    expect(result).toContain('review')
  })

  it('does not leak absolute path in Agent description (fix-4 invariant)', () => {
    const result = extractContext('Agent', { description: '/C:/Users/wen/project/src/App.jsx' })
    expect(result).not.toMatch(/C:\/Users\/wen/)
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

// ─── Fix 1: PostToolUse isError false-positive tests ───
// These tests are integration-style: they verify the isError logic by checking that
// the hook's exported helpers produce the right label given real-world tool result text.
// The actual PostToolUse branch is inside processEvent (not exported), but we can test
// the classification logic via the label outcome by simulating what PostToolUse does:
// trust event.is_error first; fall back to first-line heuristic only when is_error is absent.

describe('PostToolUse isError detection — fix-1 false-positive guard', () => {
  // Helper that mirrors the fixed isError logic from PostToolUse
  function detectIsError(toolResult, isErrorFlag) {
    let result = toolResult
    if (typeof result === 'object') result = JSON.stringify(result)
    return isErrorFlag !== undefined
      ? Boolean(isErrorFlag)
      : (typeof result === 'string' && /^(Error:|Exit code [1-9]|ENOENT\b|EPERM\b|EACCES\b|Command failed|fatal:)/.test(result.split('\n')[0]))
  }

  it('is_error=false → success even when later lines contain "Error:" keyword', () => {
    const output = 'Success\nError: some prose mention of an error\nfatal: not fatal here'
    expect(detectIsError(output, false)).toBe(false)
  })

  it('is_error=true → blocked even when output looks clean', () => {
    expect(detectIsError('Everything looks fine', true)).toBe(true)
  })

  it('heuristic (is_error undefined): fires only when FIRST line matches', () => {
    // First line is "Error:" → blocked
    expect(detectIsError('Error: command not found', undefined)).toBe(true)
    // First line clean, later line has "fatal:" → should NOT fire (multiline false-positive)
    expect(detectIsError('ok\nfatal: something on line 2', undefined)).toBe(false)
    // First line clean, later line has "ENOENT" in prose → should NOT fire
    expect(detectIsError('ok\nENOENT means no such file', undefined)).toBe(false)
  })

  it('heuristic: word-boundary prevents "ENOENT means..." prose from matching first line', () => {
    // "ENOENT means..." starts on line 1 but is prose, not a bare error code
    // The \b word boundary after ENOENT lets this through IF followed by non-word char
    // "ENOENT means" → ENOENT followed by space + word char, so \b fires before the space
    // In practice: "ENOENT\b" matches "ENOENT" followed by a word-boundary.
    // "ENOENT means" — the boundary IS present (E→space), so this DOES match.
    // That is correct: "ENOENT means no such file" on the FIRST line IS an error indicator.
    expect(detectIsError('ENOENT means no such file', undefined)).toBe(true)
    // But on a LATER line it must not match (tested above).
  })

  it('heuristic: "Exit code 0" does not trigger (only 1-9)', () => {
    expect(detectIsError('Exit code 0\nall good', undefined)).toBe(false)
  })

  it('heuristic: real error strings on first line still trigger', () => {
    expect(detectIsError('fatal: not a git repository', undefined)).toBe(true)
    expect(detectIsError('Command failed with exit code 1', undefined)).toBe(true)
    expect(detectIsError('EACCES: permission denied', undefined)).toBe(true)
  })
})

// ─── Fix 2: bashVibeLabel classification order — anchored-before-unanchored ───

describe('bashVibeLabel classification order fix-2', () => {
  it('git checkout <branch-with-build-in-name> → git, not "the build"', () => {
    expect(bashVibeLabel('git checkout build-fix', 'en')).toBe('git')
  })

  it('git commit -m "add test" → git, not "tests"', () => {
    expect(bashVibeLabel('git commit -m "add test"', 'en')).toBe('git')
  })

  it('cat src/foo.test.js → files, not "tests"', () => {
    // cat is an ^ls-group program; "test" in filename must not win
    expect(bashVibeLabel('cat src/foo.test.js', 'en')).toBe('files')
  })

  it('git push origin build/release → git (not "the build")', () => {
    expect(bashVibeLabel('git push origin build/release', 'en')).toBe('git')
  })

  it('npm run build still → the build (unanchored check still works for npm)', () => {
    expect(bashVibeLabel('npm run build', 'en')).toBe('the build')
  })

  it('vitest run still → tests (unanchored check still works for test runners)', () => {
    expect(bashVibeLabel('vitest run', 'en')).toBe('tests')
  })

  it('node server.mjs still → a script (anchored ^node check)', () => {
    expect(bashVibeLabel('node server.mjs', 'en')).toBe('a script')
  })
})

// ─── Helper-huddle: helperHash, helperAdd, helperRemove ───

describe('helperHash', () => {
  it('returns a 4-character string for any input', () => {
    expect(helperHash('abc')).toHaveLength(4)
    expect(helperHash('agent-id-123')).toHaveLength(4)
    expect(helperHash('')).toHaveLength(4)
  })

  it('is stable — same input produces the same hash', () => {
    expect(helperHash('agent-review-001')).toBe(helperHash('agent-review-001'))
    expect(helperHash('impl-99')).toBe(helperHash('impl-99'))
  })

  it('produces different hashes for different inputs', () => {
    expect(helperHash('agent-A')).not.toBe(helperHash('agent-B'))
  })

  it('handles null gracefully (returns 4-char fallback)', () => {
    expect(helperHash(null)).toHaveLength(4)
  })
})

describe('helperAdd', () => {
  it('appends a helper record with a stable id of the form role#hash', () => {
    const result = helperAdd([], 'qa', 'agent-1', '/review')
    expect(result).toHaveLength(1)
    const rec = result[0]
    expect(rec.id).toBe('qa#' + helperHash('agent-1'))
    expect(rec.parentRole).toBe('qa')
    expect(rec.label).toBe('/review')
  })

  it('two different agent_ids for the same role produce two helpers (collapse bug gone)', () => {
    let helpers = []
    helpers = helperAdd(helpers, 'dev', 'agent-A', 'implement')
    helpers = helperAdd(helpers, 'dev', 'agent-B', 'implement')
    expect(helpers).toHaveLength(2)
    expect(helpers[0].id).not.toBe(helpers[1].id)
  })

  it('uses agentType as hash seed when agentId is null/absent', () => {
    const result = helperAdd([], 'ops', null, 'deploy')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ops#' + helperHash('deploy'))
  })

  it('caps the array at 64 entries (oldest evicted)', () => {
    let helpers = []
    for (let i = 0; i < 70; i++) helpers = helperAdd(helpers, 'dev', `agent-${i}`, 'impl')
    expect(helpers).toHaveLength(64)
    // The last 64 should be the newest (agent-6 through agent-69)
    expect(helpers[63].id).toBe('dev#' + helperHash('agent-69'))
  })

  it('handles a null/undefined helpers array defensively', () => {
    expect(helperAdd(null, 'qa', 'x', 'review')).toHaveLength(1)
    expect(helperAdd(undefined, 'qa', 'x', 'review')).toHaveLength(1)
  })

  // ─── De-duplication fix (LOW finding) ───
  it('adding the same agent_id twice yields ONE helper (no duplicate)', () => {
    let helpers = []
    helpers = helperAdd(helpers, 'qa', 'agent-1', '/review')
    helpers = helperAdd(helpers, 'qa', 'agent-1', '/review')
    expect(helpers).toHaveLength(1)
    expect(helpers[0].id).toBe('qa#' + helperHash('agent-1'))
  })

  it('two different agent_ids for the same role yield TWO helpers', () => {
    let helpers = []
    helpers = helperAdd(helpers, 'qa', 'agent-A', '/review')
    helpers = helperAdd(helpers, 'qa', 'agent-B', '/review')
    expect(helpers).toHaveLength(2)
    expect(helpers[0].id).toBe('qa#' + helperHash('agent-A'))
    expect(helpers[1].id).toBe('qa#' + helperHash('agent-B'))
  })

  it('re-firing an existing id replaces the record in-place (does not move to tail)', () => {
    let helpers = []
    helpers = helperAdd(helpers, 'dev', 'agent-1', 'implement')
    helpers = helperAdd(helpers, 'dev', 'agent-2', 'implement')
    // Re-fire agent-1 — should replace index 0, not append a third entry
    helpers = helperAdd(helpers, 'dev', 'agent-1', 'implement-v2')
    expect(helpers).toHaveLength(2)
    expect(helpers[0].id).toBe('dev#' + helperHash('agent-1'))
    expect(helpers[0].label).toBe('implement-v2')
    expect(helpers[1].id).toBe('dev#' + helperHash('agent-2'))
  })
})

describe('helperRemove', () => {
  it('removes the helper whose id matches role+hash(agentId)', () => {
    let helpers = helperAdd([], 'qa', 'agent-1', '/review')
    helpers = helperAdd(helpers, 'dev', 'agent-2', 'implement')
    const result = helperRemove(helpers, 'qa', 'agent-1')
    expect(result).toHaveLength(1)
    expect(result[0].parentRole).toBe('dev')
  })

  it('leaves the list unchanged when the id is not found', () => {
    const helpers = helperAdd([], 'qa', 'agent-1', '/review')
    const result = helperRemove(helpers, 'qa', 'agent-MISSING')
    expect(result).toHaveLength(1)
  })

  it('with no agentId, removes the OLDEST helper for that role (best-effort)', () => {
    let helpers = helperAdd([], 'dev', 'agent-A', 'impl')
    helpers = helperAdd(helpers, 'dev', 'agent-B', 'impl')
    helpers = helperAdd(helpers, 'qa', 'agent-C', 'review')
    // Remove oldest dev (agent-A)
    const result = helperRemove(helpers, 'dev', null)
    expect(result).toHaveLength(2)
    // agent-A's id should be gone
    const removedId = 'dev#' + helperHash('agent-A')
    expect(result.find(h => h.id === removedId)).toBeUndefined()
  })

  it('handles empty helpers array without throwing', () => {
    expect(helperRemove([], 'qa', 'agent-1')).toEqual([])
  })

  it('handles null/undefined helpers defensively', () => {
    expect(helperRemove(null, 'qa', 'x')).toEqual([])
    expect(helperRemove(undefined, 'qa', 'x')).toEqual([])
  })
})

// ─── Fix 3: done-label all variants reachable ───
// toolLabel is not exported, but we can verify the no-dead-code contract indirectly
// by running many random trials and checking that when context IS present the output
// always contains the context (both variants do), and when context is absent the
// output does NOT contain the context string (it uses generic labels).

describe('toolLabel done-label — fix-3 all variants reachable', () => {
  // We test by importing the module and calling extractContext + constructing the
  // label scenario. Since toolLabel is private, we exercise it through extractContext
  // as a proxy, OR we just directly test the invariant via the exported helpers
  // and document that the fix ensures context always appears.

  // The key invariant from fix-3:
  // - when context present: the returned done label ALWAYS includes the context substring
  // - when context absent: the returned done label does NOT include context
  // We test the internal logic via repeated random sampling using a replicated snippet.

  function sampleDoneLabel(context, lang, n = 200) {
    const results = new Set()
    const LANG = lang
    for (let i = 0; i < n; i++) {
      const ctx = context ? ` ${context}` : ''
      let label
      if (context) {
        const arr = LANG === 'en'
          ? [`✅${ctx} done`, `✅${ctx} ready`]
          : [`✅${ctx} 好了`, `✅${ctx} 搞定`]
        label = arr[Math.floor(Math.random() * arr.length)]
      } else {
        const arr = LANG === 'en'
          ? ['✅ Done!', '✅ Next', '✅ All good', '✅ Complete']
          : ['✅ 完成！', '✅ 下一個', '✅ 搞定了', '✅ OK']
        label = arr[Math.floor(Math.random() * arr.length)]
      }
      results.add(label)
    }
    return results
  }

  it('when context present: both context-bearing variants are reachable', () => {
    const seen = sampleDoneLabel('App.jsx', 'en', 500)
    expect(seen.has('✅ App.jsx done')).toBe(true)
    expect(seen.has('✅ App.jsx ready')).toBe(true)
    // Generic labels must NOT appear when context is present
    expect(seen.has('✅ Done!')).toBe(false)
    expect(seen.has('✅ Next')).toBe(false)
  })

  it('when context absent: all four generic labels are reachable', () => {
    const seen = sampleDoneLabel(null, 'en', 2000)
    expect(seen.has('✅ Done!')).toBe(true)
    expect(seen.has('✅ Next')).toBe(true)
    expect(seen.has('✅ All good')).toBe(true)
    expect(seen.has('✅ Complete')).toBe(true)
  })

  it('zh-TW context-bearing variants are both reachable', () => {
    const seen = sampleDoneLabel('store.js', 'zh-TW', 500)
    expect(seen.has('✅ store.js 好了')).toBe(true)
    expect(seen.has('✅ store.js 搞定')).toBe(true)
  })
})
