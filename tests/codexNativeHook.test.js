import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { scanAndMerge } from '../src/server/scanSessions.mjs'
import { isNumericSeq } from '../src/inference/inferStatus.js'
import { normalizeStatusMessage } from '../src/inference/inferStatus.js'
import { routeExternalAgents } from '../src/inference/agentRouter.js'
import { useOfficeStore } from '../src/systems/store.js'

const ROOT = path.resolve('public/hooks/office-status-codex-hook.js')
const nativeHook = createRequire(import.meta.url)('../public/hooks/office-status-codex-hook.js')
const sandboxes = []

function setup() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-codex-native-'))
  sandboxes.push(base)
  const cwd = path.join(base, 'project')
  const home = path.join(base, 'home')
  const statusDir = path.join(home, '.claude')
  fs.mkdirSync(cwd, { recursive: true })
  fs.mkdirSync(statusDir, { recursive: true })
  return { base, cwd, home, statusDir }
}

function invoke(box, event, { raw, timeout = 2000 } = {}) {
  return spawnSync(process.execPath, [ROOT], {
    cwd: box.cwd,
    input: raw ?? JSON.stringify({ session_id: 'root-1', cwd: box.cwd, turn_id: 'turn-1', ...event }),
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    env: { ...process.env, HOME: box.home, USERPROFILE: box.home, OFFICE_STATUS_DIR: box.statusDir },
  })
}

function invokeAsync(box, event) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [ROOT], {
      cwd: box.cwd, encoding: 'utf8', windowsHide: true,
      env: { ...process.env, HOME: box.home, USERPROFILE: box.home, OFFICE_STATUS_DIR: box.statusDir },
    })
    let stderr = ''
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
    const timer = setTimeout(() => { child.kill(); reject(new Error('hook callback timeout')) }, 2000)
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', code => { clearTimeout(timer); resolve({ code, stderr }) })
    child.stdin.end(JSON.stringify(event))
  })
}

function files(box) {
  return fs.readdirSync(box.statusDir).filter(name => name.endsWith('.json') && fs.statSync(path.join(box.statusDir, name)).isFile()).sort()
}

function payload(box) {
  return JSON.parse(fs.readFileSync(path.join(box.statusDir, files(box)[0]), 'utf8'))
}

function roleStatus(box, role) {
  return payload(box).agents.find(agent => agent.role === role)
}

afterEach(() => {
  for (const base of sandboxes.splice(0)) fs.rmSync(base, { recursive: true, force: true })
})

describe('native Codex lifecycle adapter', () => {
  it('writes one scanner-readable canonical status per cwd and root session identity', () => {
    const box = setup()
    expect(invoke(box, { hook_event_name: 'UserPromptSubmit' }).status).toBe(0)
    const names = files(box)
    const canonical = fs.realpathSync.native(box.cwd)
    const hashCwd = process.platform === 'win32' ? canonical.replace(/\\/g, '/').toLowerCase() : canonical
    const expected = crypto.createHash('sha256').update(`${hashCwd}\0root-1`).digest('hex').slice(0, 24)
    expect(names).toEqual([`office-status-codex-hook-${expected}.json`])
    const out = payload(box)
    expect(out).toMatchObject({ type: 'office-status', source: 'codex-cli', _cwd: canonical })
    expect(typeof out._seq).toBe('string')
    expect(isNumericSeq(out._seq)).toBe(true)
    expect(out.agents).toEqual([expect.objectContaining({ role: 'pm', status: 'working' })])
    expect(scanAndMerge(box.statusDir, box.cwd)?.agents[0].role).toBe('pm')
  })

  it('maps plan prompts, fixed tool classes, approval waits, post-tool callbacks, and turn end honestly', () => {
    const box = setup()
    invoke(box, { hook_event_name: 'UserPromptSubmit', permission_mode: 'plan' })
    expect(roleStatus(box, 'pm')).toMatchObject({ status: 'planning' })
    invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'Bash' })
    expect(roleStatus(box, 'ops')).toMatchObject({ status: 'planning', task: 'Run command' })
    invoke(box, { hook_event_name: 'PermissionRequest', tool_name: 'apply_patch' })
    expect(roleStatus(box, 'dev')).toMatchObject({ status: 'awaiting-approval', task: 'Edit files' })
    expect(invoke(box, { hook_event_name: 'PermissionRequest', tool_name: 'Bash' }).stdout).toBe('')
    invoke(box, { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_response: 'COMMAND_FAILURE_SENTINEL' })
    expect(roleStatus(box, 'res')).toMatchObject({ status: 'planning' })
    invoke(box, { hook_event_name: 'Stop' })
    expect(payload(box).agents.every(agent => agent.status === 'idle')).toBe(true)
  })

  it('retires prior root roles through the real scanner and incremental store lifecycle', () => {
    const box = setup()
    useOfficeStore.setState({ externalStatus: {} })
    const applySnapshot = () => {
      const message = normalizeStatusMessage(scanAndMerge(box.statusDir, box.cwd))
      useOfficeStore.getState().applyExternalStatus(routeExternalAgents(message.agents), { source: message.source })
    }

    try {
      invoke(box, { hook_event_name: 'UserPromptSubmit' })
      applySnapshot()
      expect(useOfficeStore.getState().externalStatus.pm.status).toBe('working')

      invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'Bash' })
      applySnapshot()
      expect(useOfficeStore.getState().externalStatus.pm.status).toBe('idle')
      expect(useOfficeStore.getState().externalStatus.ops.status).toBe('working')
      invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'Bash' })
      applySnapshot()
      expect(useOfficeStore.getState().externalStatus.pm.status).toBe('idle')

      invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'unknown-tool' })
      applySnapshot()
      expect(useOfficeStore.getState().externalStatus.ops.status).toBe('idle')
      expect(useOfficeStore.getState().externalStatus.dev.status).toBe('working')

      invoke(box, { hook_event_name: 'Stop' })
      applySnapshot()
      expect(useOfficeStore.getState().externalStatus.pm.status).toBe('idle')
      expect(useOfficeStore.getState().externalStatus.ops.status).toBe('idle')
      expect(useOfficeStore.getState().externalStatus.dev.status).toBe('idle')
      expect(payload(box).agents.some(agent => agent.status === 'done')).toBe(false)

      invoke(box, { hook_event_name: 'UserPromptSubmit', turn_id: 'turn-2' })
      invoke(box, { hook_event_name: 'PreToolUse', turn_id: 'turn-2', tool_name: 'Bash' })
      applySnapshot()
      invoke(box, { hook_event_name: 'SessionEnd', turn_id: 'turn-2' })
      applySnapshot()
      expect(useOfficeStore.getState().externalStatus.pm.status).toBe('idle')
      expect(useOfficeStore.getState().externalStatus.ops.status).toBe('idle')
      expect(useOfficeStore.getState().externalStatus.dev.status).toBe('idle')
    } finally {
      useOfficeStore.setState({ externalStatus: {} })
    }
  })

  it('keeps a peer Codex session active when another same-project session stops', () => {
    const box = setup()
    useOfficeStore.setState({ externalStatus: {} })
    const applySnapshot = () => {
      const message = normalizeStatusMessage(scanAndMerge(box.statusDir, box.cwd))
      useOfficeStore.getState().applyExternalStatus(routeExternalAgents(message.agents), { source: message.source })
      return message
    }

    try {
      invoke(box, { hook_event_name: 'UserPromptSubmit', session_id: 'root-pm' })
      invoke(box, { hook_event_name: 'UserPromptSubmit', session_id: 'root-ops' })
      invoke(box, { hook_event_name: 'PreToolUse', session_id: 'root-ops', tool_name: 'Bash' })
      const beforeStop = applySnapshot()
      const peerId = beforeStop.agents.find(agent => agent.role.endsWith('~ops')).role
      expect(useOfficeStore.getState().externalStatus[peerId].status).toBe('working')

      invoke(box, { hook_event_name: 'Stop', session_id: 'root-pm' })
      const afterStop = applySnapshot()
      expect(afterStop.agents).toHaveLength(1)
      expect(afterStop.agents[0].role).toBe(peerId)
      expect(useOfficeStore.getState().externalStatus[peerId].status).toBe('working')
    } finally {
      useOfficeStore.setState({ externalStatus: {} })
    }
  })

  it('migrates a legacy sidecar without roles by retaining its current role for retirement', () => {
    const box = setup()
    invoke(box, { hook_event_name: 'UserPromptSubmit' })
    invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'Bash' })
    const canonical = fs.realpathSync.native(box.cwd)
    const hashCwd = process.platform === 'win32' ? canonical.replace(/\\/g, '/').toLowerCase() : canonical
    const digest = crypto.createHash('sha256').update(`${hashCwd}\0root-1`).digest('hex').slice(0, 24)
    const statePath = path.join(box.statusDir, `.office-status-codex-hook-${digest}.state`)
    const legacyState = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    delete legacyState.roles
    fs.writeFileSync(statePath, JSON.stringify(legacyState))

    invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'unknown-tool' })

    expect(roleStatus(box, 'ops').status).toBe('idle')
    expect(roleStatus(box, 'dev').status).toBe('working')
  })

  it('clears planning when a later explicit permission mode is default or acceptEdits', () => {
    const box = setup()
    invoke(box, { hook_event_name: 'UserPromptSubmit', permission_mode: 'plan' })
    invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'Bash', permission_mode: 'default' })
    expect(roleStatus(box, 'ops').status).toBe('working')
    invoke(box, { hook_event_name: 'UserPromptSubmit', turn_id: 'turn-2', permission_mode: 'plan' })
    invoke(box, { hook_event_name: 'PostToolUse', turn_id: 'turn-2', tool_name: 'Read', permission_mode: 'acceptEdits' })
    expect(roleStatus(box, 'res').status).toBe('working')
  })

  it('neutralizes a stopped session on SessionEnd and keeps Interrupt non-completing', () => {
    const box = setup()
    invoke(box, { hook_event_name: 'UserPromptSubmit' })
    invoke(box, { hook_event_name: 'Stop' })
    const stopSeq = payload(box)._seq
    invoke(box, { hook_event_name: 'SessionEnd', turn_id: 'different-turn' })
    expect(payload(box)._seq).toBe(stopSeq)
    expect(payload(box).agents.every(agent => agent.status === 'idle')).toBe(true)
    invoke(box, { hook_event_name: 'SessionEnd' })
    expect(payload(box).agents.every(agent => agent.status === 'idle')).toBe(true)
    invoke(box, { hook_event_name: 'UserPromptSubmit', turn_id: 'turn-2' })
    invoke(box, { hook_event_name: 'Interrupt', turn_id: 'turn-2' })
    expect(payload(box).agents.every(agent => agent.status === 'idle')).toBe(true)
  })

  it('uses safe generic labels and never persists payload text or tool names', () => {
    const box = setup()
    const privateValues = ['PROMPT_SECRET_SENTINEL', 'COMMAND_SECRET_SENTINEL', 'PATCH_SECRET_SENTINEL', 'OUTPUT_SECRET_SENTINEL', 'tool-MCP-SECRET']
    invoke(box, { hook_event_name: 'UserPromptSubmit' })
    invoke(box, { hook_event_name: 'PreToolUse', tool_name: privateValues[4], tool_input: { command: privateValues[1], patch: privateValues[2] }, prompt: privateValues[0] })
    invoke(box, { hook_event_name: 'PostToolUse', tool_name: privateValues[4], tool_response: privateValues[3] })
    const all = fs.readdirSync(box.statusDir).map(name => fs.readFileSync(path.join(box.statusDir, name), 'utf8')).join('\n')
    for (const secret of privateValues) expect(all).not.toContain(secret)
    expect(roleStatus(box, 'dev')).toMatchObject({ status: 'working', task: 'Work on task' })
  })

  it('isolates different root sessions in the same project and identical ids in different projects', () => {
    const first = setup()
    invoke(first, { hook_event_name: 'UserPromptSubmit' })
    invoke(first, { hook_event_name: 'UserPromptSubmit' }, { raw: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'root-2', cwd: first.cwd, turn_id: 't' }) })
    const second = setup()
    invoke(second, { hook_event_name: 'UserPromptSubmit' })
    expect(files(first)).toHaveLength(2)
    expect(files(second)).toHaveLength(1)
    expect(files(first)[0]).not.toBe(files(second)[0])
  })

  it('requires a valid absolute cwd and non-empty session id; unknown or malformed events are no-ops', () => {
    const box = setup()
    expect(invoke(box, { hook_event_name: 'FutureEvent' }).status).toBe(0)
    expect(files(box)).toHaveLength(0)
    for (const event of [
      { hook_event_name: 'UserPromptSubmit', session_id: '', cwd: box.cwd },
      { hook_event_name: 'UserPromptSubmit', session_id: 'root-1', cwd: 'relative' },
    ]) invoke(box, event)
    expect(files(box)).toHaveLength(0)
    expect(invoke(box, {}, { raw: '{bad json' }).status).toBe(0)
    expect(files(box)).toHaveLength(0)
  })

  it('requires valid turn ids on turn events and never lets callbacks attach a missing prompt turn', () => {
    const box = setup()
    for (const turn_id of [undefined, null, 23, '', '   ', 'has whitespace', 'x'.repeat(2049)]) {
      const raw = JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'root-1', cwd: box.cwd, turn_id })
      invoke(box, {}, { raw })
    }
    expect(files(box)).toHaveLength(0)

    const stale = JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'root-1', cwd: box.cwd, turn_id: 'old-turn', tool_name: 'Bash' })
    invoke(box, {}, { raw: stale })
    expect(files(box)).toHaveLength(0)

    invoke(box, { hook_event_name: 'UserPromptSubmit', turn_id: 'current-turn' })
    const before = payload(box)._seq
    for (const turn_id of [undefined, null, 23, '', '   ', 'has whitespace', 'x'.repeat(2049)]) {
      const raw = JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'root-1', cwd: box.cwd, turn_id, tool_name: 'Bash' })
      invoke(box, {}, { raw })
    }
    expect(payload(box)._seq).toBe(before)
    expect(roleStatus(box, 'pm')).toMatchObject({ status: 'working' })
  })

  it('allows SessionEnd without a turn id but rejects a malformed supplied id', () => {
    const box = setup()
    invoke(box, { hook_event_name: 'UserPromptSubmit', turn_id: 'current-turn' })
    const before = payload(box)._seq
    const malformed = JSON.stringify({ hook_event_name: 'SessionEnd', session_id: 'root-1', cwd: box.cwd, turn_id: '   ' })
    invoke(box, {}, { raw: malformed })
    expect(payload(box)._seq).toBe(before)
    const noTurnId = JSON.stringify({ hook_event_name: 'SessionEnd', session_id: 'root-1', cwd: box.cwd })
    invoke(box, {}, { raw: noTurnId })
    expect(payload(box).agents.every(agent => agent.status === 'idle')).toBe(true)
  })

  it('ignores tool events without a non-empty string tool_name', () => {
    const box = setup()
    invoke(box, { hook_event_name: 'UserPromptSubmit' })
    const seq = payload(box)._seq
    for (const hook_event_name of ['PreToolUse', 'PostToolUse', 'PermissionRequest']) {
      invoke(box, { hook_event_name, tool_name: undefined })
      invoke(box, { hook_event_name, tool_name: 17 })
    }
    expect(payload(box)._seq).toBe(seq)
    expect(roleStatus(box, 'pm')).toMatchObject({ status: 'working' })
  })

  it('bounds input and callback time without logging payloads', () => {
    const box = setup()
    const oversized = JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'root-1', cwd: box.cwd, prompt: 'x'.repeat(70_000) })
    const result = invoke(box, {}, { raw: oversized, timeout: 1500 })
    expect(result.status).toBe(0)
    expect(files(box)).toHaveLength(0)
    expect(`${result.stdout}${result.stderr}`).not.toContain('x'.repeat(100))
  })

  it('neutralizes stopped and ended turns against late callbacks, reopening only on a prompt', () => {
    const box = setup()
    invoke(box, { hook_event_name: 'UserPromptSubmit' })
    invoke(box, { hook_event_name: 'Stop' })
    const stopSeq = payload(box)._seq
    invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'Bash' })
    expect(payload(box).agents.every(agent => agent.status === 'idle')).toBe(true)
    expect(payload(box)._seq).toBe(stopSeq)
    invoke(box, { hook_event_name: 'UserPromptSubmit', turn_id: 'turn-2' })
    invoke(box, { hook_event_name: 'SessionEnd', turn_id: 'turn-2' })
    invoke(box, { hook_event_name: 'PostToolUse', tool_name: 'Bash', turn_id: 'turn-2' })
    expect(payload(box).agents.every(agent => agent.status === 'idle')).toBe(true)
    invoke(box, { hook_event_name: 'UserPromptSubmit', turn_id: 'turn-3' })
    expect(roleStatus(box, 'pm').status).toBe('working')
  })

  it('ignores unattributable subagent events and mismatched late turn ids', () => {
    const box = setup()
    invoke(box, { hook_event_name: 'UserPromptSubmit' })
    const seq = payload(box)._seq
    invoke(box, { hook_event_name: 'SubagentStart', agent_id: 'child-1' })
    invoke(box, { hook_event_name: 'SubagentStop', agent_id: 'child-1' })
    invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'Bash', turn_id: 'old-turn' })
    expect(payload(box)._seq).toBe(seq)
    expect(roleStatus(box, 'pm')).toMatchObject({ status: 'working' })
  })

  it('serializes concurrent callbacks with fresh numeric-string sequence values', () => {
    const box = setup()
    const events = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop']
    const results = events.map((hook_event_name, i) => invokeAsync(box, {
      hook_event_name, session_id: 'root-1', cwd: box.cwd, turn_id: 'turn-1', tool_name: i % 2 ? 'Bash' : 'Read',
    }))
    return Promise.all(results).then(resolved => {
      expect(resolved.every(result => result.code === 0)).toBe(true)
      expect(files(box).filter(name => name.endsWith('.json'))).toHaveLength(1)
      expect(typeof payload(box)._seq).toBe('string')
      expect(isNumericSeq(payload(box)._seq)).toBe(true)
    })
  })

  it('does not advance lifecycle state when the canonical status write fails', () => {
    const box = setup()
    const digest = crypto.createHash('sha256')
      .update(`${process.platform === 'win32' ? fs.realpathSync.native(box.cwd).replace(/\\/g, '/').toLowerCase() : fs.realpathSync.native(box.cwd)}\0root-1`)
      .digest('hex').slice(0, 24)
    const blockedStatusPath = path.join(box.statusDir, `office-status-codex-hook-${digest}.json`)
    fs.mkdirSync(blockedStatusPath)
    invoke(box, { hook_event_name: 'UserPromptSubmit' })
    fs.rmSync(blockedStatusPath, { recursive: true })
    invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'Bash' })
    expect(files(box)).toHaveLength(0)
    expect(fs.existsSync(path.join(box.statusDir, `.office-status-codex-hook-${digest}.state`))).toBe(false)
  })

  it('rolls back a new canonical status if committing the lifecycle sidecar fails', () => {
    const box = setup()
    const canonical = fs.realpathSync.native(box.cwd)
    const hashCwd = process.platform === 'win32' ? canonical.replace(/\\/g, '/').toLowerCase() : canonical
    const digest = crypto.createHash('sha256').update(`${hashCwd}\0root-1`).digest('hex').slice(0, 24)
    const statePath = path.join(box.statusDir, `.office-status-codex-hook-${digest}.state`)
    fs.mkdirSync(statePath)
    invoke(box, { hook_event_name: 'UserPromptSubmit' })
    expect(files(box)).toHaveLength(0)
    expect(fs.readdirSync(box.statusDir).some(name => name.includes('.rollback.'))).toBe(false)
  })

  it('rejects corrupt or future persisted sequence values and ignores event-supplied sequence values', () => {
    for (const badSeq of [String(Date.now() + 600_000), '9007199254740992', 'not-a-sequence']) {
      const box = setup()
      invoke(box, { hook_event_name: 'UserPromptSubmit' })
      const statusPath = path.join(box.statusDir, files(box)[0])
      const prior = JSON.parse(fs.readFileSync(statusPath, 'utf8'))
      fs.writeFileSync(statusPath, JSON.stringify({ ...prior, _seq: badSeq }))
      const before = Date.now()
      invoke(box, { hook_event_name: 'PreToolUse', tool_name: 'Bash', _seq: '999999999999999999999' })
      const output = payload(box)
      expect(typeof output._seq).toBe('string')
      expect(Number(output._seq)).toBeGreaterThanOrEqual(before)
      expect(Number(output._seq)).toBeLessThanOrEqual(Date.now())
      expect(scanAndMerge(box.statusDir, box.cwd)?.agents.find(agent => agent.status === 'working').role).toBe('ops')
    }
  })

  it('waits on a held lock and will not release a replaced successor lock', () => {
    const box = setup()
    const lockPath = path.join(box.statusDir, 'test.lock')
    fs.writeFileSync(lockPath, 'held-owner')
    expect(nativeHook.waitForLock(lockPath)).toBeNull()
    expect(fs.readFileSync(lockPath, 'utf8')).toBe('held-owner')
    fs.unlinkSync(lockPath)
    const release = nativeHook.waitForLock(lockPath)
    expect(typeof release).toBe('function')
    fs.unlinkSync(lockPath)
    fs.writeFileSync(lockPath, 'successor-owner')
    release()
    expect(fs.readFileSync(lockPath, 'utf8')).toBe('successor-owner')
  })
})
