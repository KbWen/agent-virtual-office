import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const hook = require('../public/hooks/office-status-hook.js')
const { processEvent, saveSkillContext, skillContextPath } = hook

let home, statusFile, priorEnv, originalCwd
const agent = (role, status = 'working', extra = {}) => ({
  role, status, task: 'working', label: 'working', hint: null, reasonCode: null,
  activeFile: null, ...extra,
})

function readStatus() {
  return JSON.parse(fs.readFileSync(statusFile, 'utf8'))
}

function sessionHash(sessionId) {
  return crypto.createHash('sha256').update(sessionId).digest('hex')
}

function seed(agents = [agent('ops')], extra = {}) {
  fs.writeFileSync(statusFile, JSON.stringify({
    type: 'office-status', source: 'claude-cli', _seq: String(Date.now()),
    agents, activeCount: agents.filter(a => ['working', 'planning', 'blocked'].includes(a.status)).length,
    workflow: 'review', _workflowAgentId: 'sub-1', helpers: [{ id: 'qa#abc', parentRole: 'qa', label: 'review' }],
    ...extra,
  }))
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-claude-lifecycle-'))
  statusFile = path.join(home, 'office-status.json')
  originalCwd = process.cwd()
  priorEnv = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    OFFICE_STATUS_FILE: process.env.OFFICE_STATUS_FILE,
  }
  process.env.HOME = home
  process.env.USERPROFILE = home
  process.env.OFFICE_STATUS_FILE = statusFile
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  seed()
})

afterEach(() => {
  process.chdir(originalCwd)
  for (const key of ['HOME', 'USERPROFILE', 'OFFICE_STATUS_FILE']) {
    if (priorEnv[key] === undefined) delete process.env[key]
    else process.env[key] = priorEnv[key]
  }
  fs.rmSync(home, { recursive: true, force: true })
})

describe('Claude lifecycle compatibility', () => {
  it('does not echo malformed stdin content in standalone diagnostics', () => {
    const childHome = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-claude-invalid-input-'))
    const sentinel = 'PRIVACY_SENTINEL_CLAUDE_INVALID_JSON'
    try {
      const result = spawnSync(process.execPath, [path.resolve('public/hooks/office-status-hook.js')], {
        cwd: childHome,
        env: { ...process.env, HOME: childHome, USERPROFILE: childHome },
        input: sentinel,
        encoding: 'utf8',
      })

      expect(result.status).toBe(0)
      expect(`${result.stdout}${result.stderr}`).not.toContain(sentinel)
      expect(result.stderr).toContain('[office-hook] invalid status input')
    } finally {
      fs.rmSync(childHome, { recursive: true, force: true })
    }
  })

  it('routes PostToolUseFailure like PreToolUse and records a generic blocked reason', () => {
    seed([agent('qa'), agent('ops')])
    processEvent({
      hook_event_name: 'PostToolUseFailure', tool_name: 'PowerShell',
      tool_input: { command: 'npm test' }, error: 'private command output', is_interrupt: false,
    })
    const status = readStatus()
    expect(status.agents.find(a => a.role === 'ops').status).toBe('blocked')
    expect(status.agents.find(a => a.role === 'ops').reasonCode).toBe('blocked-unknown')
    expect(status.agents.find(a => a.role === 'ops').label).not.toContain('private command output')
  })

  it('uses file routing and saved skill context for failed tool attribution', () => {
    seed([agent('qa'), agent('res')])
    saveSkillContext('agent-1', 'res', 'research')
    processEvent({
      hook_event_name: 'PostToolUseFailure', tool_name: 'Edit', agent_id: 'agent-1',
      tool_input: { file_path: 'tests/example.test.js' },
    })
    const status = readStatus()
    expect(status.agents.find(a => a.role === 'res').status).toBe('blocked')
    expect(status.agents.find(a => a.role === 'qa').status).toBe('working')
  })

  it('treats interrupted failed tool callbacks as neutral idle without a reason', () => {
    seed([agent('dev')])
    processEvent({
      hook_event_name: 'PostToolUseFailure', tool_name: 'Edit',
      tool_input: { file_path: 'src/current.js' }, is_interrupt: true,
    })
    const item = readStatus().agents.find(a => a.role === 'dev')
    expect(item.status).toBe('idle')
    expect(item.reasonCode).toBeNull()
    expect(item.activeFile).toBeNull()
  })

  it('reads StopFailure.error enum first; present unknown error cannot fall through to matcher', () => {
    seed([agent('dev')])
    processEvent({ hook_event_name: 'StopFailure', error: 'rate_limit', matcher: 'authentication_failed' })
    expect(readStatus().agents.find(a => a.role === 'dev').reasonCode).toBe('api-rate-limit')

    seed([agent('dev')])
    processEvent({ hook_event_name: 'StopFailure', error: 'vendor_private_detail', matcher: 'rate_limit' })
    const item = readStatus().agents.find(a => a.role === 'dev')
    expect(item.reasonCode).toBe('blocked-unknown')
    expect(JSON.stringify(readStatus())).not.toContain('vendor_private_detail')
  })

  it('maps the documented authentication_failed enum to the existing auth reason', () => {
    processEvent({ hook_event_name: 'StopFailure', error: 'authentication_failed' })
    expect(readStatus().agents.find(a => a.role === 'ops').reasonCode).toBe('api-auth-failed')
  })

  it('marks the attributable PermissionRequest as awaiting approval without a decision payload', () => {
    seed([agent('ops')])
    const event = { hook_event_name: 'PermissionRequest', tool_name: 'PowerShell', tool_input: { command: 'npm test' } }
    expect(processEvent(event)).toBeUndefined()
    const item = readStatus().agents.find(a => a.role === 'ops')
    expect(item.status).toBe('awaiting-approval')
    expect(item.reasonCode).toBeNull()
  })

  it('does not attribute permission_prompt notifications without a reliable tool', () => {
    const before = readStatus()
    processEvent({ hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'approve?' })
    expect(readStatus()).toEqual(before)
  })

  it('SessionEnd idles the session, clears workflow and helpers, and never marks completion', () => {
    const owner = sessionHash('session-clear')
    seed([agent('dev'), agent('qa', 'planning')], { _sessionOwnerHash: owner })
    processEvent({ hook_event_name: 'SessionEnd', session_id: 'session-clear', reason: 'clear' })
    const status = readStatus()
    expect(status.agents.map(a => a.status)).toEqual(['idle', 'idle'])
    expect(status.agents.some(a => a.status === 'done')).toBe(false)
    expect(status.workflow).toBeNull()
    expect(status.helpers).toEqual([])
    expect(status._sessionOwnerHash).toBe(owner)
    expect(JSON.stringify(status)).not.toContain('session-clear')
  })

  it('does not let an old same-cwd SessionEnd clear the current session', () => {
    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'session-a' })
    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'session-b' })
    processEvent({
      hook_event_name: 'PreToolUse', session_id: 'session-b', tool_name: 'Bash',
      tool_input: { command: 'npm test' },
    })
    const sessionBBytes = fs.readFileSync(statusFile)
    expect(readStatus()._sessionOwnerHash).toBe(sessionHash('session-b'))
    expect(sessionBBytes.toString()).not.toContain('session-b')

    processEvent({ hook_event_name: 'SessionEnd', session_id: 'session-a' })
    expect(fs.readFileSync(statusFile)).toEqual(sessionBBytes)

    processEvent({ hook_event_name: 'SessionEnd', session_id: 'session-b' })
    expect(readStatus().agents.every(a => a.status === 'idle')).toBe(true)
  })

  it('retires old-session roles and helpers at a verified owner handoff', () => {
    seed([], { workflow: null, _workflowAgentId: null, _workflowPromptId: null, helpers: [] })
    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'handoff-a', prompt_id: 'prompt-a' })
    processEvent({
      hook_event_name: 'SubagentStart', session_id: 'handoff-a',
      agent_type: 'review', agent_id: 'agent-a',
    })
    expect(readStatus().helpers).toHaveLength(1)
    expect(readStatus().agents.find(a => a.role === 'qa').status).toBe('working')

    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'handoff-b', prompt_id: 'prompt-b' })
    let status = readStatus()
    expect(status.helpers).toEqual([])
    expect(status.workflow).toBeNull()
    expect(status.agents.find(a => a.role === 'qa')).toMatchObject({
      status: 'idle', task: null, hint: null, reasonCode: null, activeFile: null,
    })
    expect(status.agents.find(a => a.role === 'pm').status).toBe('working')
    expect(status._sessionOwnerHash).toBe(sessionHash('handoff-b'))

    processEvent({
      hook_event_name: 'SubagentStart', session_id: 'handoff-b',
      agent_type: 'review', agent_id: 'agent-b',
    })
    expect(readStatus().helpers.some(helper => helper.id.includes('agent-a'))).toBe(false)
    expect(readStatus().helpers).toHaveLength(1)
    const currentSessionBytes = fs.readFileSync(statusFile)
    for (const hook_event_name of ['Stop', 'SubagentStop', 'SessionEnd']) {
      processEvent({ hook_event_name, session_id: 'handoff-a', agent_type: 'review', agent_id: 'agent-a' })
      expect(fs.readFileSync(statusFile)).toEqual(currentSessionBytes)
    }

    processEvent({
      hook_event_name: 'SubagentStop', session_id: 'handoff-b',
      agent_type: 'review', agent_id: 'agent-b',
    })
    status = readStatus()
    expect(status.helpers).toEqual([])
    expect(status.agents.find(a => a.role === 'qa').status).toBe('done')
  })

  it('preserves valid helpers across a new prompt from the same session owner', () => {
    seed([], { workflow: null, _workflowAgentId: null, _workflowPromptId: null, helpers: [] })
    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'same-owner', prompt_id: 'prompt-one' })
    processEvent({
      hook_event_name: 'SubagentStart', session_id: 'same-owner',
      agent_type: 'review', agent_id: 'same-agent',
    })
    const helperBefore = readStatus().helpers

    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'same-owner', prompt_id: 'prompt-two' })

    expect(readStatus().helpers).toEqual(helperBefore)
    expect(readStatus().agents.find(a => a.role === 'qa').status).toBe('working')
  })

  it('preserves the verifiable session owner across Stop for a later SessionEnd', () => {
    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'session-stop' })
    processEvent({ hook_event_name: 'PreToolUse', session_id: 'session-stop', tool_name: 'Bash' })
    processEvent({ hook_event_name: 'Stop', session_id: 'session-stop' })
    expect(readStatus()._sessionOwnerHash).toBe(sessionHash('session-stop'))
    processEvent({ hook_event_name: 'SessionEnd', session_id: 'session-stop' })
    expect(readStatus().agents.every(a => a.status === 'idle')).toBe(true)
  })

  it('rejects late mutations from an older session while the current owner can continue', () => {
    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'session-a' })
    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'session-b' })
    processEvent({ hook_event_name: 'PreToolUse', session_id: 'session-b', tool_name: 'Bash' })
    const sessionBBytes = fs.readFileSync(statusFile)
    const staleEvents = [
      { hook_event_name: 'PreToolUse', tool_name: 'Edit' },
      { hook_event_name: 'PostToolUse', tool_name: 'Bash', is_error: false },
      { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash' },
      { hook_event_name: 'PermissionRequest', tool_name: 'Bash' },
      { hook_event_name: 'SubagentStart', agent_type: 'review', agent_id: 'old-agent' },
      { hook_event_name: 'SubagentStop', agent_type: 'review', agent_id: 'old-agent' },
      { hook_event_name: 'StopFailure', error: 'overloaded' },
      { hook_event_name: 'Stop' },
    ]
    for (const event of staleEvents) {
      processEvent({ ...event, session_id: 'session-a' })
      expect(fs.readFileSync(statusFile)).toEqual(sessionBBytes)
    }
    expect(fs.existsSync(skillContextPath('old-agent'))).toBe(false)

    processEvent({ hook_event_name: 'PostToolUse', session_id: 'session-b', tool_name: 'Bash', is_error: false })
    expect(readStatus().agents.find(a => a.role === 'ops').status).toBe('done')
    expect(readStatus()._sessionOwnerHash).toBe(sessionHash('session-b'))
  })

  it('rejects ownerless late callbacks when a current session owner is known', () => {
    processEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'session-current' })
    processEvent({ hook_event_name: 'PreToolUse', session_id: 'session-current', tool_name: 'Bash' })
    const before = fs.readFileSync(statusFile)
    processEvent({ hook_event_name: 'Stop', session_id: null })
    expect(fs.readFileSync(statusFile)).toEqual(before)
  })

  it('keeps failure, approval wait, and interrupted idle states truthful across Stop', () => {
    seed([agent('ops'), agent('dev'), agent('res'), agent('qa', 'planning')])
    processEvent({ hook_event_name: 'PostToolUseFailure', tool_name: 'Bash' })
    processEvent({ hook_event_name: 'PermissionRequest', tool_name: 'Edit' })
    processEvent({
      hook_event_name: 'PostToolUseFailure', tool_name: 'Read', is_interrupt: true,
    })

    processEvent({ hook_event_name: 'Stop' })
    const status = readStatus()
    expect(status.agents.find(a => a.role === 'ops')).toMatchObject({
      status: 'blocked', reasonCode: 'blocked-unknown',
    })
    expect(status.agents.find(a => a.role === 'dev').status).toBe('awaiting-approval')
    expect(status.agents.find(a => a.role === 'res').status).toBe('idle')
    expect(status.agents.find(a => a.role === 'qa').status).toBe('done')
    expect(status.activeCount).toBe(2)
    expect(status._stopped).toBe(true)
  })

  it('does not neutralize a session when SessionEnd has no verifiable owner', () => {
    const before = fs.readFileSync(statusFile)
    processEvent({ hook_event_name: 'SessionEnd', session_id: 'unknown-session' })
    expect(fs.readFileSync(statusFile)).toEqual(before)
    expect(fs.existsSync(statusFile + '.lock')).toBe(false)
  })

  it('does not write SessionEnd state when the status lock is held', () => {
    seed([agent('dev')], { _sessionOwnerHash: sessionHash('session-locked') })
    const before = fs.readFileSync(statusFile)
    fs.mkdirSync(statusFile + '.lock')
    fs.writeFileSync(path.join(statusFile + '.lock', 'owner'), 'test-owner')
    processEvent({ hook_event_name: 'SessionEnd', session_id: 'session-locked' })
    expect(fs.readFileSync(statusFile)).toEqual(before)
  })

  it('ignores stale failure callbacks after a new prompt and its PreToolUse', () => {
    processEvent({ hook_event_name: 'UserPromptSubmit', prompt_id: 'new-prompt-secret' })
    processEvent({
      hook_event_name: 'PreToolUse', tool_name: 'Bash', prompt_id: 'new-prompt-secret',
      tool_input: { command: 'npm test' },
    })
    const before = fs.readFileSync(statusFile)
    processEvent({
      hook_event_name: 'PostToolUseFailure', tool_name: 'Edit', prompt_id: 'old-prompt-secret',
      tool_input: { file_path: 'src/old.js' },
    })
    expect(fs.readFileSync(statusFile)).toEqual(before)
    expect(readStatus()._upstreamPromptHash).toBe(crypto.createHash('sha256').update('new-prompt-secret').digest('hex'))
    expect(fs.readFileSync(statusFile, 'utf8')).not.toContain('new-prompt-secret')
    expect(fs.readFileSync(statusFile, 'utf8')).not.toContain('old-prompt-secret')
  })

  it('ignores stale permission callbacks after a new prompt and its PreToolUse', () => {
    processEvent({ hook_event_name: 'UserPromptSubmit', prompt_id: 'new-permission-prompt' })
    processEvent({
      hook_event_name: 'PreToolUse', tool_name: 'Bash', prompt_id: 'new-permission-prompt',
      tool_input: { command: 'npm test' },
    })
    const before = fs.readFileSync(statusFile)
    processEvent({
      hook_event_name: 'PermissionRequest', tool_name: 'PowerShell', prompt_id: 'old-permission-prompt',
      tool_input: { command: 'private stale request' },
    })
    expect(fs.readFileSync(statusFile)).toEqual(before)
    expect(readStatus().agents.find(a => a.role === 'ops').status).toBe('working')
  })

  it.each([
    null, {}, { hook_event_name: 'Notification', notification_type: 'idle_prompt' },
    { hook_event_name: 'PreCompact' }, { hook_event_name: 'PostToolUseFailure', tool_name: 42 },
  ])('keeps malformed or unrelated lifecycle payloads as no-op: %j', payload => {
    const before = readStatus()
    expect(() => processEvent(payload)).not.toThrow()
    expect(readStatus()).toEqual(before)
  })

  it('keeps callbacks arriving after Stop from overwriting the stopped state', () => {
    processEvent({ hook_event_name: 'Stop' })
    const before = readStatus()
    processEvent({ hook_event_name: 'PostToolUseFailure', tool_name: 'Bash' })
    expect(readStatus()).toEqual(before)
  })
})
