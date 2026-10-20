import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, spawnSync } from 'node:child_process'
import { PassThrough, Writable } from 'node:stream'
import {
  VALID_ROLES, VALID_STATUSES, VALID_MOODS, BLOCKED_REASONS, AGENT_CARRY_FIELDS, normalizePost,
} from '../src/utils/statusContract.mjs'

const require = createRequire(import.meta.url)
const hook = require('../public/hooks/office-status-gemini.js')
const testTempRoot = path.join(process.cwd(), `.gemini-hook-tests-${process.pid}`)
function makeTempDir(prefix) {
  fs.mkdirSync(testTempRoot, { recursive: true })
  return fs.mkdtempSync(path.join(testTempRoot, prefix))
}
afterAll(() => { if (fs.existsSync(testTempRoot)) fs.rmSync(testTempRoot, { recursive: true, force: true }) })

describe('Gemini CLI standalone hook', () => {
  it('exports a pure event mapper and runner without starting stdin on import', () => {
    expect(typeof hook.mapGeminiEvent).toBe('function')
    expect(typeof hook.runHook).toBe('function')
  })
})

describe('Gemini hook contract, mapping and privacy', () => {
  it.each([
    ['VALID_ROLES', VALID_ROLES], ['VALID_STATUSES', VALID_STATUSES], ['VALID_MOODS', VALID_MOODS],
    ['BLOCKED_REASONS', BLOCKED_REASONS], ['AGENT_CARRY_FIELDS', AGENT_CARRY_FIELDS],
  ])('mirrors canonical %s', (name, values) => expect(hook[name]).toEqual([...values]))

  it('counts active statuses exactly as the canonical contract does', () => {
    for (const status of VALID_STATUSES) {
      expect(hook.isActiveStatus(status)).toBe(normalizePost({ type: 'office-status', agents: [{ role: 'dev', status }] }).activeCount === 1)
    }
  })

  it.each([
    ['BeforeAgent', 'working'], ['BeforeTool', 'working'], ['AfterTool', 'working'],
    ['AfterAgent', 'idle'], ['SessionEnd', 'idle'],
  ])('maps %s conservatively to %s', (event, status) => {
    const payload = { hook_event_name: event, tool_name: 'read_file', tool_input: { file_path: '/repo/README.md' } }
    expect(hook.mapGeminiEvent(payload, { root: '/repo' }).status).toBe(status)
  })

  it('maps ToolPermission without reading or returning notification text', () => {
    const mapped = hook.mapGeminiEvent({
      hook_event_name: 'Notification', notification_type: 'ToolPermission',
      message: 'SYNTHETIC_SECRET_NOTIFICATION_SENTINEL', details: { path: '/private/sentinel' },
    })
    expect(mapped.status).toBe('awaiting-approval')
    expect(JSON.stringify(mapped)).not.toContain('SYNTHETIC_SECRET_NOTIFICATION_SENTINEL')
    expect(JSON.stringify(mapped)).not.toContain('/private/sentinel')
  })

  it('rejects unsupported events and Antigravity-shaped payloads', () => {
    expect(hook.mapGeminiEvent({ hook_event_name: 'AfterModel' })).toBeNull()
    expect(hook.mapGeminiEvent({ event: 'PreToolUse', toolCall: { name: 'write_file', args: {} } })).toBeNull()
  })

  it('decodes the hand-authored Gemini fixture and excludes its sentinels', () => {
    const fixturePath = path.resolve('tests/fixtures/google-adapters/gemini-notification.json')
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
    const mapped = hook.mapGeminiEvent(fixture)
    expect(mapped).toMatchObject({ status: 'awaiting-approval', label: 'Permission required' })
    expect(JSON.stringify(mapped)).not.toContain('SYNTHETIC_SECRET_NOTIFICATION_SENTINEL')
    expect(JSON.stringify(mapped)).not.toContain('SYNTHETIC_SECRET_SEARCH_SENTINEL')
  })

  it('routes exact known test commands to qa without substring guessing', () => {
    expect(hook.classifyShellCommand('npm test -- --run')).toBe('qa')
    expect(hook.classifyShellCommand('python -m pytest -q')).toBe('qa')
    expect(hook.classifyShellCommand('echo test')).toBe('ops')
    expect(hook.classifyShellCommand('npm run contest')).toBe('ops')
    expect(hook.classifyShellCommand('npm test && deploy')).toBe('ops')
    expect(hook.classifyShellCommand('npm test; curl example.invalid')).toBe('ops')
    expect(hook.classifyShellCommand('npm test\nthen deploy')).toBe('ops')
  })

  it('uses the existing file role precedence and only exposes proven write targets', () => {
    const parityCases = [
      ['tests/example.test.js', 'qa'], ['.github/workflows/check.yml', 'ops'],
      ['notes/plan.md', 'res'], ['architecture/flow.puml', 'arch'],
      ['ui/theme.css', 'designer'], ['src/app.js', null], ['docs/architecture/overview.md', 'res'],
      ['package.toml', null], ['Dockerfile.dev', 'ops'],
    ]
    for (const [file, expected] of parityCases) {
      const absolute = path.join(path.parse(process.cwd()).root, 'file-to-role-parity', file)
      expect(hook.fileToRole(absolute), file).toBe(expected)
    }
    const mapRoot = makeTempDir('gemini-map-')
    try {
      fs.mkdirSync(path.join(mapRoot, 'tests'))
      fs.mkdirSync(path.join(mapRoot, 'src'))
      fs.writeFileSync(path.join(mapRoot, 'tests', 'example.test.js'), '')
      const read = hook.mapTool('read_file', { file_path: path.join(mapRoot, 'tests', 'example.test.js') }, mapRoot)
      expect(read.role).toBe('qa')
      expect(read.activeFile).toBeNull()
      const write = hook.mapTool('write_file', { file_path: path.join(mapRoot, 'src', 'new.js') }, mapRoot)
      expect(write).toMatchObject({ role: 'dev', task: 'Write', activeFile: 'src/new.js' })
      expect(hook.mapTool('write_file', { file_path: `${mapRoot}-escape/src/main.js` }, mapRoot).activeFile).toBeNull()
      expect(hook.mapTool('write_file', { file_path: 'src/main.js' }, mapRoot).activeFile).toBeNull()
    } finally { fs.rmSync(mapRoot, { recursive: true, force: true }) }
  })
})

describe('Gemini hook isolated atomic publication', () => {
  let root, statusDir, now, env
  beforeEach(() => {
    root = makeTempDir('gemini-hook-')
    statusDir = path.join(root, 'office-status')
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src', 'app.js'), 'synthetic fixture')
    now = Date.now()
    env = { OFFICE_STATUS_DIR: statusDir, OFFICE_PROJECT_ROOT: root }
  })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  const event = (eventName, offset = 0, extra = {}) => ({
    session_id: 'synthetic-session-1', cwd: root, hook_event_name: eventName,
    timestamp: new Date(now + offset).toISOString(), ...extra,
  })
  const options = () => ({ cwd: root, env, now: now + 10_000 })
  const outputFiles = () => fs.existsSync(statusDir) ? fs.readdirSync(statusDir).filter((name) => /^office-status-gemini-[a-f0-9]{24}\.json$/.test(name)) : []
  const readOutput = () => JSON.parse(fs.readFileSync(path.join(statusDir, outputFiles()[0]), 'utf8'))

  it('writes the canonical source, digest namespace and one current representative', async () => {
    expect(await hook.runHook(event('BeforeTool', 0, { tool_name: 'write_file', tool_input: { file_path: path.join(root, 'src', 'app.js'), content: 'SYNTHETIC_SECRET_BODY' } }), options())).toBe(true)
    const files = outputFiles()
    expect(files).toHaveLength(1)
    const digest = hook.digestSession('gemini-cli', hook.canonicalRoot(root), 'synthetic-session-1')
    expect(files[0]).toBe(`office-status-gemini-${digest}.json`)
    const output = readOutput()
    expect(output).toMatchObject({ type: 'office-status', source: 'gemini-cli', _cwd: path.resolve(root), workflow: null, activeCount: 1 })
    expect(output.agents).toHaveLength(1)
    expect(output.agents[0]).toMatchObject({ role: 'dev', status: 'working', task: 'Write', activeFile: 'src/app.js' })
    expect(fs.readFileSync(path.join(statusDir, files[0]), 'utf8')).not.toContain('SYNTHETIC_SECRET_BODY')
    expect(fs.readdirSync(statusDir)).not.toContain('office-status.json')
  })

  it('keeps independent sessions and roots separate', async () => {
    await hook.runHook(event('BeforeAgent'), options())
    await hook.runHook({ ...event('BeforeAgent'), session_id: 'synthetic-session-2' }, options())
    expect(outputFiles()).toHaveLength(2)
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-other-root-'))
    try {
      const otherEnv = { ...env, OFFICE_PROJECT_ROOT: other }
      const payload = { ...event('BeforeAgent'), cwd: other, session_id: 'synthetic-session-1' }
      expect(await hook.runHook(payload, { cwd: other, env: otherEnv, now: now + 10_000 })).toBe(true)
      expect(outputFiles()).toHaveLength(3)
      expect(fs.readdirSync(statusDir).filter((name) => /^office-status-gemini-[a-f0-9]{24}\.json$/.test(name))).toHaveLength(3)
    } finally { fs.rmSync(other, { recursive: true, force: true }) }
  })

  it('rejects mismatched root, invalid ID, and invalid or implausible timestamps without writing', async () => {
    const base = event('BeforeAgent')
    expect(await hook.runHook({ ...base, cwd: path.dirname(root) }, options())).toBe(false)
    expect(await hook.runHook({ ...base, session_id: '../raw-path' }, options())).toBe(false)
    expect(await hook.runHook({ ...base, timestamp: 'tomorrow' }, options())).toBe(false)
    expect(await hook.runHook({ ...base, timestamp: '2001-01-01T00:00:00.000Z' }, options())).toBe(false)
    expect(outputFiles()).toHaveLength(0)
  })

  it('reports only a fixed diagnostic code when status-directory I/O fails', async () => {
    const io = Object.create(fs)
    io.mkdirSync = () => { throw new Error('SYNTHETIC_SECRET_IO_DETAIL') }
    let code = null
    expect(await hook.runHook(event('BeforeAgent'), { ...options(), io, onDiagnostic: (value) => { code = value } })).toBe(false)
    expect(code).toBe('io_failure')
    expect(outputFiles()).toHaveLength(0)
  })

  it('rejects older and equal active events while allowing equal-time terminal events to win', async () => {
    await hook.runHook(event('BeforeTool', 100, { tool_name: 'write_file', tool_input: { file_path: path.join(root, 'src', 'app.js') } }), options())
    expect(await hook.runHook(event('BeforeAgent', 50), options())).toBe(false)
    expect(await hook.runHook(event('AfterAgent', 100), options())).toBe(true)
    expect(readOutput().agents[0]).toMatchObject({ role: 'dev', status: 'idle', task: null, label: null, activeFile: null })
    expect(await hook.runHook(event('BeforeAgent', 100), options())).toBe(false)
  })

  it('orders equal-time permission, working, and terminal edges conservatively', async () => {
    await hook.runHook(event('Notification', 100, { notification_type: 'ToolPermission', message: 'SYNTHETIC_SECRET' }), options())
    expect(readOutput().agents[0].status).toBe('awaiting-approval')
    expect(await hook.runHook(event('BeforeTool', 100, { tool_name: 'read_file' }), options())).toBe(true)
    expect(readOutput().agents[0].status).toBe('working')
    expect(await hook.runHook(event('AfterAgent', 100), options())).toBe(true)
    expect(readOutput().agents[0].status).toBe('idle')
    expect(await hook.runHook(event('BeforeTool', 100, { tool_name: 'read_file' }), options())).toBe(false)
    expect(await hook.runHook(event('SessionEnd', 100), options())).toBe(true)
    expect(await hook.runHook(event('AfterTool', 100, { tool_name: 'read_file' }), options())).toBe(false)
    expect(readOutput().agents[0].status).toBe('idle')
    expect(await hook.runHook(event('AfterTool', 101, { tool_name: 'read_file' }), options())).toBe(true)
    expect(readOutput().agents[0].status).toBe('working')
  })

  it('emits no raw prompt, search, command, result, MCP tool name, or notification sentinel', async () => {
    const payload = event('BeforeTool', 1, {
      tool_name: 'mcp_private_secret_server_do_not_show',
      tool_input: { prompt: 'SYNTHETIC_SECRET_PROMPT', query: 'SYNTHETIC_SECRET_SEARCH', command: 'SYNTHETIC_SECRET_COMMAND', result: 'SYNTHETIC_SECRET_RESULT' },
    })
    await hook.runHook(payload, options())
    const text = fs.readFileSync(path.join(statusDir, outputFiles()[0]), 'utf8')
    for (const secret of ['SYNTHETIC_SECRET_PROMPT', 'SYNTHETIC_SECRET_SEARCH', 'SYNTHETIC_SECRET_COMMAND', 'SYNTHETIC_SECRET_RESULT', 'mcp_private_secret_server']) {
      expect(text).not.toContain(secret)
    }
  })

  it('does not steal a held lock and preserves the last valid status on rename failure', async () => {
    const first = event('BeforeAgent', 1)
    await hook.runHook(first, options())
    const statusName = outputFiles()[0]
    const statusPath = path.join(statusDir, statusName)
    const original = fs.readFileSync(statusPath, 'utf8')
    const digest = hook.digestSession('gemini-cli', hook.canonicalRoot(root), 'synthetic-session-1')
    const lockPath = path.join(statusDir, `office-status-gemini-${digest}.json.lock`)
    fs.writeFileSync(lockPath, JSON.stringify({ token: 'synthetic-existing-lock' }))
    expect(await hook.runHook(event('BeforeTool', 2, { tool_name: 'write_file', tool_input: { file_path: path.join(root, 'src', 'app.js') } }), options())).toBe(false)
    expect(fs.readFileSync(statusPath, 'utf8')).toBe(original)
    fs.unlinkSync(lockPath)

    const io = Object.create(fs)
    io.renameSync = () => { const error = new Error('synthetic contention'); error.code = 'EBUSY'; throw error }
    expect(await hook.runHook(event('BeforeTool', 3, { tool_name: 'write_file', tool_input: { file_path: path.join(root, 'src', 'app.js') } }), { ...options(), io })).toBe(false)
    expect(fs.readFileSync(statusPath, 'utf8')).toBe(original)
  })

  it('spawns with one JSON stdout object and exits cleanly on malformed or oversized input', () => {
    const script = path.resolve('public/hooks/office-status-gemini.js')
    for (const input of ['{bad json', 'x'.repeat(1024 * 1024 + 1)]) {
      const proc = spawnSync(process.execPath, [script], { input, encoding: 'utf8', env: { ...process.env, OFFICE_STATUS_DIR: statusDir } })
      expect(proc.status).toBe(0)
      expect(proc.stdout.trim()).toBe('{}')
      expect(proc.stderr).not.toContain('x'.repeat(64))
    }
  })

  it('runs all six supported lifecycle events through the spawned acceptance script', () => {
    const script = path.resolve('public/hooks/office-status-gemini.js')
    const events = [
      ['BeforeAgent', {}],
      ['BeforeTool', { tool_name: 'read_file', tool_input: { file_path: path.join(root, 'src', 'app.js') } }],
      ['AfterTool', { tool_name: 'read_file', tool_input: { file_path: path.join(root, 'src', 'app.js') } }],
      ['AfterAgent', {}],
      ['Notification', { notification_type: 'ToolPermission', message: 'SYNTHETIC_SECRET' }],
      ['SessionEnd', {}],
    ]
    for (let i = 0; i < events.length; i++) {
      const [hook_event_name, extra] = events[i]
      const payload = { session_id: 'spawned-lifecycle', cwd: root, hook_event_name, timestamp: new Date(now + i * 250).toISOString(), ...extra }
      const proc = spawnSync(process.execPath, [script], {
        cwd: root, input: JSON.stringify(payload), encoding: 'utf8',
        env: { ...process.env, OFFICE_PROJECT_ROOT: root, OFFICE_STATUS_DIR: statusDir },
      })
      expect(proc.status).toBe(0)
      expect(proc.stdout.trim()).toBe('{}')
    }
    expect(outputFiles()).toHaveLength(1)
    expect(readOutput().agents[0].status).toBe('idle')
  })

  it('serializes concurrent spawned writers and rejects the older equal-time event', async () => {
    const script = path.resolve('public/hooks/office-status-gemini.js')
    const timestamp = new Date(now + 1000).toISOString()
    const payloads = [
      { session_id: 'concurrent-session', cwd: root, hook_event_name: 'BeforeTool', timestamp, tool_name: 'write_file', tool_input: { file_path: path.join(root, 'src', 'app.js') } },
      { session_id: 'concurrent-session', cwd: root, hook_event_name: 'AfterAgent', timestamp },
    ]
    const runs = payloads.map((payload) => new Promise((resolve) => {
      const child = spawn(process.execPath, [script], {
        cwd: root, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, OFFICE_PROJECT_ROOT: root, OFFICE_STATUS_DIR: statusDir },
      })
      let stdout = ''
      child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
      child.on('exit', (code) => resolve({ code, stdout }))
      child.stdin.end(JSON.stringify(payload))
    }))
    const results = await Promise.all(runs)
    expect(results).toEqual([{ code: 0, stdout: '{}\n' }, { code: 0, stdout: '{}\n' }])
    expect(readOutput().agents[0].status).toBe('idle')
  }, 5000)

  it('rejects a write path whose in-project symlink resolves outside the project', () => {
    const outside = makeTempDir('gemini-outside-')
    const link = path.join(root, 'src', 'linked')
    try {
      fs.symlinkSync(outside, link, 'junction')
    } catch {
      fs.rmSync(outside, { recursive: true, force: true })
      return // Symlink creation may be unavailable on a restricted Windows host.
    }
    try { expect(hook.safeRelativeFile(hook.canonicalRoot(root), path.join(link, 'secret.txt'))).toBeNull() }
    finally { fs.rmSync(link, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }) }
  })

  it('can be required with stdin left open without installing listeners or writing output', async () => {
    const script = path.resolve('public/hooks/office-status-gemini.js')
    const child = spawn(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    const code = await new Promise((resolve) => {
      const timer = setTimeout(() => { child.kill(); resolve(null) }, 2500)
      child.on('exit', (exitCode) => { clearTimeout(timer); resolve(exitCode) })
    })
    expect(code).toBe(0)
    expect(stdout).toBe('')
  }, 4000)

  it('times out with one empty JSON response when stdin never closes', async () => {
    const script = path.resolve('public/hooks/office-status-gemini.js')
    const child = spawn(process.execPath, [script], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    const code = await new Promise((resolve) => {
      const timer = setTimeout(() => { child.kill(); resolve(null) }, 2500)
      child.on('exit', (exitCode) => { clearTimeout(timer); resolve(exitCode) })
    })
    expect(code).toBe(0)
    expect(stdout.trim()).toBe('{}')
    expect(stderr.trim()).toBe('[office-status-gemini] deadline')
  }, 4000)

  it('keeps the one-second deadline from stdin start through processing and publication', async () => {
    const stdin = new PassThrough()
    let stdoutText = ''
    let stderrText = ''
    const stdout = new Writable({ write(chunk, _encoding, callback) { stdoutText += chunk.toString(); callback() } })
    const stderr = new Writable({ write(chunk, _encoding, callback) { stderrText += chunk.toString(); callback() } })
    const io = Object.create(fs)
    let delayed = false
    io.realpathSync = (target) => {
      if (!delayed && path.resolve(target) === path.resolve(root)) {
        delayed = true
        const end = Date.now() + 600
        while (Date.now() < end) {}
      }
      return fs.realpathSync(target)
    }
    hook.runMain({ stdin, stdout, stderr, cwd: root, env, io })
    setTimeout(() => stdin.end(JSON.stringify(event('BeforeAgent'))), 500)
    await new Promise((resolve) => setTimeout(resolve, 1250))
    expect(stdoutText.trim()).toBe('{}')
    expect(stderrText.trim()).toBe('[office-status-gemini] deadline')
    expect(outputFiles()).toHaveLength(0)
  }, 2500)

  it('does not rename a completed temp file after the shared deadline expires during its write', async () => {
    const io = Object.create(fs)
    let tempFd = null
    let tempWrites = 0
    let renameCalls = 0
    let clock = now
    const sampledClock = vi.spyOn(Date, 'now').mockImplementation(() => clock)
    const originalOpen = fs.openSync
    io.openSync = (filePath, ...args) => {
      const fd = originalOpen(filePath, ...args)
      if (String(filePath).endsWith('.tmp')) tempFd = fd
      return fd
    }
    io.writeFileSync = (fd, ...args) => {
      if (fd === tempFd) {
        tempWrites++
        clock += 100
      }
      return fs.writeFileSync(fd, ...args)
    }
    io.renameSync = (...args) => { renameCalls++; return fs.renameSync(...args) }
    let diagnostic = null
    const deadlineAt = now + 50
    try {
      expect(await hook.runHook(event('BeforeAgent'), { ...options(), io, deadlineAt, onDiagnostic: (code) => { diagnostic = code } })).toBe(false)
      expect(diagnostic).toBe('deadline')
      expect(tempWrites).toBe(1)
      expect(renameCalls).toBe(0)
      expect(outputFiles()).toHaveLength(0)
    } finally { sampledClock.mockRestore() }
  })

  it('stops EBUSY rename retries when the shared deadline expires during backoff', async () => {
    const io = Object.create(fs)
    let renameCalls = 0
    const sampledClock = vi.spyOn(Date, 'now').mockImplementation(() => now + (renameCalls > 0 ? 80 : 0))
    io.renameSync = () => {
      renameCalls++
      const error = new Error('synthetic contention')
      error.code = 'EBUSY'
      throw error
    }
    let diagnostic = null
    const deadlineAt = now + 50
    try {
      expect(await hook.runHook(event('BeforeAgent'), { ...options(), io, deadlineAt, onDiagnostic: (code) => { diagnostic = code } })).toBe(false)
      expect(diagnostic).toBe('deadline')
      expect(renameCalls).toBe(1)
      expect(outputFiles()).toHaveLength(0)
    } finally { sampledClock.mockRestore() }
  })

  it('discards corrupt previous roles and implausible sequence values on neutralization', async () => {
    await hook.runHook(event('BeforeAgent'), options())
    const file = path.join(statusDir, outputFiles()[0])
    const corrupt = readOutput()
    corrupt._seq = String(Number.MAX_VALUE)
    corrupt.agents[0].role = 'SYNTHETIC_INVALID_ROLE'
    fs.writeFileSync(file, JSON.stringify(corrupt))
    expect(await hook.runHook(event('AfterAgent', 10), options())).toBe(true)
    const output = readOutput()
    expect(output.agents[0]).toMatchObject({ role: 'dev', status: 'idle' })
    expect(Number(output._seq)).toBeLessThan(Date.now() + 300_000)
  })

  it('caps lock contention waiting at the remaining shared deadline', async () => {
    const digest = hook.digestSession('gemini-cli', hook.canonicalRoot(root), 'synthetic-session-1')
    const lockPath = path.join(statusDir, `office-status-gemini-${digest}.json.lock`)
    fs.mkdirSync(statusDir, { recursive: true })
    fs.writeFileSync(lockPath, JSON.stringify({ token: 'synthetic-held-lock' }))
    const deadlineAt = Date.now() + 50
    const started = Date.now()
    let diagnostic = null
    expect(await hook.runHook(event('BeforeAgent'), { ...options(), deadlineAt, onDiagnostic: (code) => { diagnostic = code } })).toBe(false)
    expect(diagnostic).toBe('deadline')
    expect(Date.now() - started).toBeLessThan(140)
    expect(outputFiles()).toHaveLength(0)
  })
})
