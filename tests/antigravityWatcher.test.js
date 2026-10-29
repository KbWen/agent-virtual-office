import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { setTimeout as realDelay } from 'node:timers/promises'
import { setTimeout as realTimeout } from 'node:timers'
import { startAntigravityWatcher } from '../src/server/antigravityWatcher.mjs'

const roots = []
const observedWatchers = new Set()
async function makeRoots() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'avo-antigravity-'))
  roots.push(base)
  const projectRoot = path.join(base, 'project')
  const dataRoot = path.join(base, 'data')
  const statusDir = path.join(base, 'status')
  await fs.mkdir(projectRoot)
  await fs.mkdir(path.join(dataRoot, 'brain', 'session-a', '.system_generated', 'logs'), { recursive: true })
  await fs.mkdir(statusDir)
  return { base, projectRoot, dataRoot, statusDir, transcript: path.join(dataRoot, 'brain', 'session-a', '.system_generated', 'logs', 'transcript.jsonl') }
}

async function transcriptFor(dirs, id) {
  const file = path.join(dirs.dataRoot, 'brain', id, '.system_generated', 'logs', 'transcript.jsonl')
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, '')
  return file
}

function row({ step = 1, time = new Date(Date.now()).toISOString(), status = 'RUNNING', name = 'run_command', args = {}, tools } = {}) {
  return JSON.stringify({ created_at: time, step_index: step, status, type: 'GENERIC', source: 'MODEL', tool_calls: tools ?? [{ name, args }] }) + '\n'
}

function sessionFile(projectRoot, sessionId) {
  const slug = createHash('sha256').update(`antigravity\0${projectRoot}\0${sessionId}`).digest('hex').slice(0, 24)
  return `office-status-antigravity-${slug}.json`
}

function observedWatcher(options) {
  const state = { active: true, waiters: [] }
  observedWatchers.add(state)
  const suppliedTimer = options.setTimeout
  const watcher = startAntigravityWatcher({ ...options, setTimeout(callback, ms) {
    const schedule = suppliedTimer ?? setTimeout
    if (ms < 1000) return (suppliedTimer ?? realTimeout)(callback, ms)
    const timer = schedule(callback, ms)
    const waiter = state.waiters.splice(0)
    if (waiter.length) queueMicrotask(() => waiter.forEach(resolve => resolve()))
    return timer
  } })
  return { ...watcher, stop() {
    state.active = false
    watcher.stop()
    observedWatchers.delete(state)
  }, state }
}

async function advanceObservedTick() {
  const states = [...observedWatchers].filter(state => state.active)
  const completions = states.map(state => new Promise(resolve => state.waiters.push(resolve)))
  await vi.advanceTimersByTimeAsync(1000)
  await Promise.all(completions)
}

async function flushTicks(count = 3) {
  for (let tick = 0; tick < count; tick += 1) await advanceObservedTick()
}

function steppedWatcher(options) {
  let finished
  const watcher = startAntigravityWatcher({ ...options, setTimeout(callback, ms) {
    if (ms < 1000) return realTimeout(callback, ms)
    const timer = setTimeout(callback, ms)
    const complete = finished
    finished = null
    complete?.()
    return timer
  } })
  return { watcher, async tick() {
    const completion = new Promise(resolve => { finished = resolve })
    await vi.advanceTimersByTimeAsync(1000)
    await completion
  } }
}

afterEach(async () => {
  await realDelay(100)
  observedWatchers.clear()
  vi.useRealTimers()
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('Antigravity passive watcher', () => {
  it('uses EOF as the live boundary, then publishes only fresh exact-root work', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, row({ time: new Date(now - 60_000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private startup command' } }))
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir))).toEqual([])

    await fs.appendFile(dirs.transcript, row({ step: 5, time: new Date(now).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private new command' } }))
    await flushTicks()
    const files = (await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-'))
    expect(files).toHaveLength(1)
    const output = JSON.parse(await fs.readFile(path.join(dirs.statusDir, files[0]), 'utf8'))
    expect(output).toMatchObject({ type: 'office-status', source: 'antigravity', _cwd: dirs.projectRoot, activeCount: 1 })
    expect(output.agents).toEqual([expect.objectContaining({ role: 'ops', status: 'working', task: 'Bash', label: 'Run command' })])
    expect(JSON.stringify(output)).not.toContain('private')
    watcher.stop()
  })

  it('does not publish foreign-root work or turn DONE into completion', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript,
      row({ step: 1, time: new Date(now).toISOString(), args: { Cwd: path.join(dirs.base, 'elsewhere'), CommandLine: 'secret' } }) +
      JSON.stringify({ created_at: new Date(now).toISOString(), step_index: 2, status: 'DONE', type: 'PLANNER_RESPONSE', source: 'MODEL' }) + '\n')
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))).toHaveLength(0)
    await fs.appendFile(dirs.transcript, row({ step: 3, time: new Date(Date.now()).toISOString(), status: 'DONE', args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }))
    await flushTicks()
    const files = (await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-'))
    const doneObservation = JSON.parse(await fs.readFile(path.join(dirs.statusDir, files[0]), 'utf8'))
    expect(doneObservation.agents[0].status).toBe('working')
    expect(doneObservation.agents[0].status).not.toBe('done')
    watcher.stop()
  })

  it('clears activity once after 15 seconds and never repeats a step', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const live = row({ step: 8, time: new Date(now).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } })
    await fs.appendFile(dirs.transcript, live)
    await flushTicks()
    const file = (await fs.readdir(dirs.statusDir)).find((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))
    expect(file).toBeTruthy()
    const liveOutput = JSON.parse(await fs.readFile(path.join(dirs.statusDir, file), 'utf8'))
    expect(liveOutput.agents[0].status).toBe('working')
    await fs.appendFile(dirs.transcript, live)
    await flushTicks(16)
    const idleOutput = JSON.parse(await fs.readFile(path.join(dirs.statusDir, file), 'utf8'))
    expect(idleOutput.agents[0]).toMatchObject({ status: 'idle', task: null, label: null, activeFile: null })
    expect(idleOutput._seq).not.toBe(liveOutput._seq)
    watcher.stop()
  })

  it('keeps partial UTF-8 and >4-KiB rows until newline, then omits source text', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()

    const record = row({ time: new Date(now + 1000).toISOString(), name: 'run_command', args: { Cwd: dirs.projectRoot, CommandLine: `echo café ${'x'.repeat(5000)}` } })
    const bytes = Buffer.from(record, 'utf8')
    const split = bytes.indexOf(Buffer.from('é', 'utf8')) + 1
    await fs.appendFile(dirs.transcript, '{malformed}\n')
    await fs.appendFile(dirs.transcript, bytes.subarray(0, split))
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-'))).toHaveLength(0)
    await fs.appendFile(dirs.transcript, bytes.subarray(split))
    await flushTicks()
    const file = (await fs.readdir(dirs.statusDir)).find((name) => name.startsWith('office-status-antigravity-'))
    expect(file).toBeTruthy()
    const output = await fs.readFile(path.join(dirs.statusDir, file), 'utf8')
    expect(output).toContain('"task":"Bash"')
    expect(output).not.toContain('café')
    expect(output).not.toContain('xxxxx')
    watcher.stop()
  })

  it('drops >1-MiB rows through newline and recovers on the next complete record', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, `{"oversized":"${'s'.repeat(1024 * 1024 + 32)}"}\n`)
    await flushTicks(20)
    const liveTime = new Date(Date.now()).toISOString()
    await fs.appendFile(dirs.transcript, row({ step: 44, time: liveTime, args: { Cwd: dirs.projectRoot, CommandLine: 'private sentinel' } }))
    await flushTicks()
    const files = (await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-'))
    expect(files).toHaveLength(1)
    const output = await fs.readFile(path.join(dirs.statusDir, files[0]), 'utf8')
    expect(output).not.toContain('oversized')
    expect(output).not.toContain('private sentinel')
    watcher.stop()
  })

  it('accepts the exact 15-second age boundary and rejects older and over-skew records', async () => {
    vi.useFakeTimers()
    let clock = Date.now()
    vi.setSystemTime(clock)
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto', now: () => clock })
    await flushTicks()
    const observedAt = clock + 1000
    await fs.appendFile(dirs.transcript,
      row({ step: 1, time: new Date(observedAt - 15_000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }) +
      row({ step: 2, time: new Date(observedAt - 15_001).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }) +
      row({ step: 3, time: new Date(observedAt + 5001).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }))
    clock = observedAt
    await flushTicks(1)
    const file = (await fs.readdir(dirs.statusDir)).find((name) => name.startsWith('office-status-antigravity-'))
    expect(file).toBeTruthy()
    const output = JSON.parse(await fs.readFile(path.join(dirs.statusDir, file), 'utf8'))
    expect(output._sourceEventKey).toBeTruthy()
    expect(output.agents[0].status).toBe('working')
    await flushTicks(1)
    const after = JSON.parse(await fs.readFile(path.join(dirs.statusDir, file), 'utf8'))
    expect(after._sourceEventKey).toBe(output._sourceEventKey)
    watcher.stop()
  })

  it('accepts exactly five seconds of future skew and rejects the next millisecond', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const firstObserved = Date.now() + 1000
    await fs.appendFile(dirs.transcript, row({ step: 20, time: new Date(firstObserved + 5000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }))
    await flushTicks(1)
    const file = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    const accepted = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(accepted.agents[0].status).toBe('working')
    const rejectedAt = Date.now() + 1000
    await fs.appendFile(dirs.transcript, row({ step: 21, time: new Date(rejectedAt + 5001).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }))
    await flushTicks(1)
    const after = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(after._sourceEventKey).toBe(accepted._sourceEventKey)
    watcher.stop()
  })

  it('deduplicates repeated step rows, resets at shrink EOF, then accepts a new generation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    let watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const same = row({ step: 7, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private' } })
    await fs.appendFile(dirs.transcript, same)
    await flushTicks()
    const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    const first = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    await fs.appendFile(dirs.transcript, same)
    await flushTicks()
    const repeated = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(repeated._sourceEventKey).toBe(first._sourceEventKey)
    watcher.stop()
    watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, same)
    await flushTicks()
    const afterRestart = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(afterRestart._sourceEventKey).toBe(first._sourceEventKey)
    expect(afterRestart._seq).toBe(first._seq)
    await fs.writeFile(dirs.transcript, '')
    await flushTicks(1)
    await fs.appendFile(dirs.transcript, row({ step: 8, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'new generation' } }))
    await flushTicks()
    const recovered = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(recovered._sourceEventKey).not.toBe(first._sourceEventKey)
    expect(recovered.agents[0].status).toBe('working')
    watcher.stop()
  })

  it('does not publish a pending write after stop fences a stalled temporary write', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const destination = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    let announceWrite
    let releaseWrite
    const writeStarted = new Promise((resolve) => { announceWrite = resolve })
    const writeGate = new Promise((resolve) => { releaseWrite = resolve })
    let announceLockCleanup
    const lockCleanup = new Promise((resolve) => { announceLockCleanup = resolve })
    let publicationAttempts = 0
    const fsWithStall = new Proxy(fs, {
      get(target, property) {
        if (property === 'writeFile') return async (...args) => {
          announceWrite()
          await writeGate
          return target.writeFile(...args)
        }
        if (property === 'rename') return async (from, to) => {
          if (to === destination) publicationAttempts += 1
          return target.rename(from, to)
        }
        if (property === 'unlink') return async (candidate, ...args) => {
          const result = await target.unlink(candidate, ...args)
          if (candidate === `${destination}.antigravity-lock`) announceLockCleanup()
          return result
        }
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const watcher = observedWatcher({ ...dirs, mode: 'auto', fs: fsWithStall })
    await flushTicks()
    await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }))
    await vi.advanceTimersByTimeAsync(1000)
    await writeStarted
    watcher.stop()
    releaseWrite()
    await lockCleanup
    expect(publicationAttempts).toBe(0)
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-'))).toHaveLength(0)
  })

  it('uses file-only ownership for one write row and does not retain it for the next row', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const target = path.join(dirs.projectRoot, 'src', 'tests', 'new.test.js')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, row({ step: 1, name: 'write_to_file', args: { TargetFile: target } }))
    await flushTicks()
    const file = (await fs.readdir(dirs.statusDir)).find((name) => name.startsWith('office-status-antigravity-'))
    expect(file).toBeTruthy()
    const first = JSON.parse(await fs.readFile(path.join(dirs.statusDir, file), 'utf8'))
    expect(first.agents[0]).toMatchObject({ role: 'qa', activeFile: 'src/tests/new.test.js' })
    await flushTicks(1)
    await fs.appendFile(dirs.transcript, row({ step: 2, name: 'view_file', args: {} }))
    await flushTicks()
    const second = JSON.parse(await fs.readFile(path.join(dirs.statusDir, file), 'utf8'))
    expect(second._sourceEventKey).toBe(first._sourceEventKey)
    watcher.stop()
  })

  it('accepts multiple in-root tool paths and scopes activeFile to the representative write', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now()).toISOString(), tools: [
      { name: 'write_to_file', args: { TargetFile: path.join(dirs.projectRoot, 'tests', 'first.test.js') } },
      { name: 'write_to_file', args: { TargetFile: path.join(dirs.projectRoot, 'docs', 'second.md') } },
    ] }))
    await flushTicks()
    const file = (await fs.readdir(dirs.statusDir)).find((name) => name.startsWith('office-status-antigravity-'))
    expect(file).toBeTruthy()
    const output = JSON.parse(await fs.readFile(path.join(dirs.statusDir, file), 'utf8'))
    expect(output.agents[0]).toMatchObject({ role: 'qa', activeFile: 'tests/first.test.js' })
    expect(JSON.stringify(output)).not.toContain('docs/second.md')
    watcher.stop()
  })

  it('omits a too-long activeFile while retaining file-scoped write observation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const relative = `${'a'.repeat(110)}/${'b'.repeat(110)}.js`
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now()).toISOString(), name: 'write_to_file', args: { TargetFile: path.join(dirs.projectRoot, relative) } }))
    await flushTicks()
    const file = (await fs.readdir(dirs.statusDir)).find((name) => name.startsWith('office-status-antigravity-'))
    expect(file).toBeTruthy()
    const output = JSON.parse(await fs.readFile(path.join(dirs.statusDir, file), 'utf8'))
    expect(output.agents[0]).toMatchObject({ role: 'dev', activeFile: null, task: 'Write' })
    expect(JSON.stringify(output)).not.toContain(relative)
    watcher.stop()
  })

  it('decodes one JSON string layer for read_file Path and maps it to a safe read state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const absolutePath = path.join(dirs.projectRoot, 'src', 'reader.js')
    const encodedPath = JSON.stringify(absolutePath)
    await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now()).toISOString(), name: 'read_file', args: { Path: encodedPath } }))
    await flushTicks()
    const file = (await fs.readdir(dirs.statusDir)).find((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))
    expect(file).toBeTruthy()
    const output = JSON.parse(await fs.readFile(path.join(dirs.statusDir, file), 'utf8'))
    expect(output.agents[0]).toMatchObject({ role: 'res', task: 'Read', activeFile: null })
    watcher.stop()
  })

  it('maps write_file and edit_file path aliases with role-safe active files', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    const encodedTarget = JSON.stringify(path.join(dirs.projectRoot, 'tests', 'aliased.test.js'))
    await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now() + 1000).toISOString(), name: 'write_file', args: { Path: encodedTarget } }))
    await flushTicks()
    const written = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(written.agents[0]).toMatchObject({ role: 'qa', task: 'Write', activeFile: 'tests/aliased.test.js' })

    await fs.appendFile(dirs.transcript, row({ step: 2, time: new Date(Date.now() + 1000).toISOString(), name: 'edit_file', args: { path: path.join(dirs.projectRoot, 'docs', 'change.md') } }))
    await flushTicks()
    const edited = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(edited.agents[0]).toMatchObject({ role: 'res', task: 'Edit', activeFile: 'docs/change.md' })
    watcher.stop()
  })

  it('rejects foreign encoded paths and prevents later pathless tools inheriting ownership', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private' } }))
    await flushTicks()
    const established = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    const foreignPath = JSON.stringify(path.join(dirs.base, 'foreign', 'secret.md'))
    await fs.appendFile(dirs.transcript,
      row({ step: 2, time: new Date(Date.now() + 1000).toISOString(), name: 'read_file', args: { Path: foreignPath } }) +
      row({ step: 3, time: new Date(Date.now() + 1000).toISOString(), name: 'run_command', args: { CommandLine: 'private' } }))
    await flushTicks()
    const after = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(after._sourceEventKey).toBe(established._sourceEventKey)
    watcher.stop()
  })

  it('invalidates startup Cwd binding when a foreign encoded Path is in the tail', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    const foreignPath = JSON.stringify(path.join(dirs.base, 'foreign', 'startup.md'))
    await fs.writeFile(dirs.transcript,
      row({ step: 1, time: new Date(now - 2000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private' } }) +
      row({ step: 2, time: new Date(now - 1000).toISOString(), name: 'read_file', args: { Path: foreignPath } }))
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, row({ step: 3, time: new Date(Date.now()).toISOString(), name: 'run_command', args: { CommandLine: 'private' } }))
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))).toHaveLength(0)
    watcher.stop()
  })

  it('does not turn an in-root Path-only startup row into sticky Cwd binding', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    const projectFile = JSON.stringify(path.join(dirs.projectRoot, 'docs', 'startup.md'))
    await fs.writeFile(dirs.transcript, row({ step: 1, time: new Date(now - 1000).toISOString(), name: 'read_file', args: { Path: projectFile } }))
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, row({ step: 2, time: new Date(Date.now()).toISOString(), name: 'run_command', args: { CommandLine: 'private' } }))
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))).toHaveLength(0)
    watcher.stop()
  })

  it('fails neutral for relative and malformed Path wrappers', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const malformed = String.raw`"C:\bad\q"`
    await fs.appendFile(dirs.transcript,
      row({ step: 1, time: new Date(Date.now()).toISOString(), name: 'read_file', args: { Path: 'relative\\file.js' } }) +
      row({ step: 2, time: new Date(Date.now()).toISOString(), name: 'read_file', args: { Path: malformed } }) +
      row({ step: 3, time: new Date(Date.now()).toISOString(), name: 'read_file', args: { Path: `${dirs.projectRoot}\\bad\nname.js` } }))
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))).toHaveLength(0)
    watcher.stop()
  })

  it('invalidates startup binding when a later foreign file appears in the bounded tail', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript,
      row({ step: 1, time: new Date(now - 2000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private' } }) +
      row({ step: 2, time: new Date(now - 1000).toISOString(), name: 'view_file', args: { AbsolutePath: path.join(dirs.base, 'foreign', 'secret.txt') } }))
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, row({ step: 3, time: new Date(Date.now()).toISOString(), name: 'view_file', args: {} }))
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-'))).toHaveLength(0)
    watcher.stop()
  })

  it('rejects a row with both project and foreign tool paths and clears its binding', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript,
      row({ step: 1, time: new Date(now).toISOString(), tools: [
        { name: 'run_command', args: { Cwd: dirs.projectRoot, CommandLine: 'private' } },
        { name: 'write_to_file', args: { TargetFile: path.join(dirs.base, 'foreign', 'secret.js') } },
      ] }) +
      row({ step: 2, time: new Date(now).toISOString(), name: 'view_file', args: {} }))
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))).toHaveLength(0)
    watcher.stop()
  })

  it('lets a replayed step with foreign path evidence invalidate an existing binding', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const exact = row({ step: 1, time: new Date(now).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private' } })
    await fs.appendFile(dirs.transcript, exact)
    await flushTicks()
    const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    const first = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    await flushTicks(1)
    await fs.appendFile(dirs.transcript,
      row({ step: 1, time: new Date(now).toISOString(), name: 'view_file', args: { AbsolutePath: path.join(dirs.base, 'foreign', 'private.txt') } }) +
      row({ step: 2, time: new Date(now).toISOString(), name: 'view_file', args: {} }))
    await flushTicks()
    const after = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(after._sourceEventKey).toBe(first._sourceEventKey)
    watcher.stop()
  })

  it('does not derive startup binding from a malformed or unverified envelope', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    const malformed = JSON.stringify({
      created_at: 'not-a-timestamp', step_index: 1, status: 'RUNNING', type: 'UNVERIFIED', source: 'MODEL',
      tool_calls: [{ name: 'run_command', args: { Cwd: dirs.projectRoot } }],
    }) + '\n'
    await fs.writeFile(dirs.transcript, malformed)
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, row({ step: 2, time: new Date(Date.now()).toISOString(), name: 'view_file', args: {} }))
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))).toHaveLength(0)
    watcher.stop()
  })

  it('keeps a step replay deduplicated after more than 256 newer rows', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const eventTime = new Date(Date.now() + 4000).toISOString()
    const firstRow = row({ step: 1, time: eventTime, args: { Cwd: dirs.projectRoot, CommandLine: 'private' } })
    await fs.appendFile(dirs.transcript, firstRow)
    await flushTicks()
    const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    const first = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    const laterRows = Array.from({ length: 260 }, (_, index) => row({
      step: index + 2, time: eventTime, args: { Cwd: dirs.projectRoot, CommandLine: 'private' },
    })).join('')
    await fs.appendFile(dirs.transcript, laterRows)
    await flushTicks()
    await flushTicks(4)
    const later = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    await fs.appendFile(dirs.transcript, firstRow)
    await flushTicks()
    const replay = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(replay._sourceEventKey).toBe(later._sourceEventKey)
    expect(replay._seq).toBe(later._seq)
    expect(replay._sourceEventKey).not.toBe(first._sourceEventKey)
    watcher.stop()
  })

  it('discovers a 33rd conversation on the next bounded round-robin pass', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    const transcripts = []
    for (let index = 0; index < 33; index += 1) transcripts.push(await transcriptFor(dirs, `session-${String(index).padStart(2, '0')}`))
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await flushTicks(25)
    await fs.appendFile(transcripts[32], row({ step: 99, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }))
    await flushTicks()
    const names = (await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))
    expect(names).toContain(sessionFile(await fs.realpath(dirs.projectRoot), 'session-32'))
    watcher.stop()
  })

  it('keeps a low-lex conversation after fair reattachment so fresh work is observed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    const transcripts = []
    for (let index = 0; index < 33; index += 1) transcripts.push(await transcriptFor(dirs, `session-${String(index).padStart(2, '0')}`))
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await flushTicks(20)
    await fs.appendFile(transcripts[0], row({ step: 999, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private' } }))
    await flushTicks()
    const expected = sessionFile(await fs.realpath(dirs.projectRoot), 'session-00')
    const files = (await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))
    expect(files).toContain(expected)
    watcher.stop()
  })

  it('protects accepted active work before attachment-order eviction ties', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    const transcripts = []
    for (let index = 0; index < 33; index += 1) transcripts.push(await transcriptFor(dirs, `session-${String(index).padStart(2, '0')}`))
    const { watcher, tick } = steppedWatcher({ ...dirs, mode: 'auto' })
    try {
      await tick()
      await fs.appendFile(transcripts[0], row({ step: 1, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private' } }))
      await tick()
      const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-00'))
      const first = JSON.parse(await fs.readFile(outputPath, 'utf8'))
      for (let second = 0; second < 20; second++) await tick()
      await fs.appendFile(transcripts[0], row({ step: 2, time: new Date(Date.now() + 1000).toISOString(), name: 'view_file', args: {} }))
      await tick()
      const after = JSON.parse(await fs.readFile(outputPath, 'utf8'))
      expect(after._sourceEventKey).not.toBe(first._sourceEventKey)
      expect(after.agents[0].status).toBe('working')
    } finally { watcher.stop() }
  })

  it('neutralizes a quiet tail session even while four earlier sources use the read budget', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    const transcripts = []
    for (let index = 0; index < 31; index += 1) transcripts.push(await transcriptFor(dirs, `session-${String(index).padStart(2, '0')}`))
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await flushTicks(1)
    await fs.appendFile(transcripts[30], row({ step: 99, time: new Date(Date.now()).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private' } }))
    await flushTicks()
    const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-30'))
    const active = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(active.agents[0].status).toBe('working')
    const fullBudgetChunk = `${'x'.repeat(65_535)}\n`
    const saturated = fullBudgetChunk.repeat(16)
    for (let index = 0; index < 4; index += 1) await fs.appendFile(transcripts[index], saturated)
    for (let tick = 0; tick < 16; tick += 1) {
      await flushTicks(1)
    }
    const idle = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(idle.agents[0]).toMatchObject({ status: 'idle', task: null, activeFile: null })
    expect(idle._sourceEventKey).toBe(active._sourceEventKey)
    watcher.stop()
  })

  it('serializes two observers and lets a newer event defeat an older idle edge', async () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const firstWatcher = observedWatcher({ ...dirs, mode: 'auto' })
    const secondWatcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }))
    await flushTicks()
    const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    const first = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    const highSequence = String(Date.now() + 5000)
    await fs.writeFile(outputPath, JSON.stringify({ ...first, _seq: highSequence }))
    await fs.appendFile(dirs.transcript, row({ step: 2, time: new Date(Date.now() + 1000).toISOString(), name: 'view_file', args: { AbsolutePath: path.join(dirs.projectRoot, 'readme.md') } }))
    await flushTicks()
    const newer = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(newer._sourceEventKey).not.toBe(first._sourceEventKey)
    expect(Number(newer._seq)).toBeGreaterThan(Number(highSequence))
    const injectedNewer = { ...newer, _sourceEventKey: 'newer-event', _sourceTimestamp: Date.now(), agents: [{ role: 'res', status: 'working', task: 'Read', label: 'Read file' }] }
    await fs.writeFile(outputPath, JSON.stringify(injectedNewer))
    await flushTicks(16)
    const preserved = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(preserved._sourceEventKey).toBe('newer-event')
    firstWatcher.stop()
    secondWatcher.stop()
  })

  it('mirrors the established file-role precedence and limits activeFile to write tools', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    const cases = [
      ['tests/unit.test.js', 'qa'],
      ['Dockerfile', 'ops'],
      ['docs/readme.md', 'res'],
      ['architecture/overview.puml', 'arch'],
      ['src/theme.css', 'designer'],
    ]
    for (let index = 0; index < cases.length; index += 1) {
      const [relative, role] = cases[index]
      await fs.appendFile(dirs.transcript, row({ step: 100 + index, time: new Date(Date.now() + 1000).toISOString(), name: 'write_to_file', args: { TargetFile: path.join(dirs.projectRoot, relative) } }))
      await flushTicks(1)
      const output = JSON.parse(await fs.readFile(outputPath, 'utf8'))
      expect(output.agents[0]).toMatchObject({ role, activeFile: relative.replace(/\\/g, '/') })
      await flushTicks(1)
    }
    await fs.appendFile(dirs.transcript, row({ step: 200, time: new Date(Date.now() + 1000).toISOString(), name: 'view_file', args: { AbsolutePath: path.join(dirs.projectRoot, 'tests/unit.test.js') } }))
    await flushTicks(1)
    const readOutput = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(readOutput.agents[0]).toMatchObject({ role: 'res', activeFile: null })
    watcher.stop()
  })

  it('maps subagent and question tools to generic safe states', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'private' } }))
    await flushTicks(1)
    await flushTicks(1)
    await fs.appendFile(dirs.transcript, row({ step: 2, time: new Date(Date.now() + 1000).toISOString(), name: 'invoke_subagent', args: { prompt: 'secret prompt' } }))
    await flushTicks(1)
    const delegated = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(delegated.agents[0]).toMatchObject({ role: 'dev', status: 'working', task: 'Task', label: 'Delegate work' })
    expect(JSON.stringify(delegated)).not.toContain('secret prompt')
    await flushTicks(1)
    await fs.appendFile(dirs.transcript, row({ step: 3, time: new Date(Date.now() + 1000).toISOString(), name: 'ask_question', args: { question: 'private question' } }))
    await flushTicks(1)
    const question = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(question.agents[0]).toMatchObject({ role: 'dev', status: 'awaiting-approval', task: 'AskUserQuestion' })
    expect(JSON.stringify(question)).not.toContain('private question')
    watcher.stop()
  })

  it('rejects a transcript whose canonical path escapes the data root', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    const outside = path.join(dirs.base, 'outside.jsonl')
    await fs.writeFile(outside, row({ args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }))
    const realFs = new Proxy(fs, {
      get(target, property) {
        if (property === 'realpath') return async (candidate) => path.resolve(candidate) === path.resolve(dirs.transcript) ? outside : target.realpath(candidate)
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const watcher = observedWatcher({ ...dirs, mode: 'auto', fs: realFs })
    await flushTicks()
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))).toHaveLength(0)
    watcher.stop()
  })

  it.each(['ENOENT', 'EACCES'])('recovers from a transient %s transcript read without publishing partial state', async (code) => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    let armed = false
    let failures = 0
    const injectedFs = new Proxy(fs, {
      get(target, property) {
        if (property === 'open') return async (candidate, ...args) => {
          if (armed && candidate === dirs.transcript) {
            armed = false; failures++
            throw Object.assign(new Error('synthetic-private-read-error'), { code })
          }
          return target.open(candidate, ...args)
        }
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { watcher, tick } = steppedWatcher({ ...dirs, mode: 'auto', fs: injectedFs })
    try {
      await tick()
      armed = true
      await fs.appendFile(dirs.transcript, row({ time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot } }))
      await tick()
      expect(failures).toBe(1)
      expect(await fs.readdir(dirs.statusDir)).toEqual([])
      await tick()
      const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
      expect(JSON.parse(await fs.readFile(outputPath, 'utf8')).agents[0].status).toBe('working')
      expect(stderr.mock.calls.flat().join(' ')).not.toContain('synthetic-private-read-error')
    } finally { watcher.stop(); stderr.mockRestore() }
  })

  it.each([{ code: 'EPERM', attempts: 4 }, { code: 'EIO', attempts: 1 }])('preserves prior JSON after bounded $code rename failure and accepts later work', async ({ code, attempts }) => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const destination = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    let armed = false
    let failedRenames = 0
    const preserved = []
    const injectedFs = new Proxy(fs, {
      get(target, property) {
        if (property === 'rename') return async (from, to) => {
          if (armed && to === destination) {
            failedRenames++
            preserved.push(await target.readFile(destination, 'utf8'))
            throw Object.assign(new Error('synthetic-private-rename-error'), { code })
          }
          return target.rename(from, to)
        }
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { watcher, tick } = steppedWatcher({ ...dirs, mode: 'auto', fs: injectedFs })
    try {
      await tick()
      await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot } }))
      await tick()
      const previous = await fs.readFile(destination, 'utf8')
      armed = true
      await fs.appendFile(dirs.transcript, row({ step: 2, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot } }))
      await tick()
      expect(failedRenames).toBe(attempts)
      expect(preserved.every(value => value === previous)).toBe(true)
      expect(await fs.readFile(destination, 'utf8')).toBe(previous)
      expect((await fs.readdir(dirs.statusDir)).filter(name => name.includes('.tmp-') || name.endsWith('-lock'))).toEqual([])
      armed = false
      await fs.appendFile(dirs.transcript, row({ step: 3, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot } }))
      await tick()
      expect(JSON.parse(await fs.readFile(destination, 'utf8'))._sourceEventKey).not.toBe(JSON.parse(previous)._sourceEventKey)
      expect(stderr.mock.calls.flat().join(' ')).not.toContain('synthetic-private-rename-error')
    } finally { watcher.stop(); stderr.mockRestore() }
  })

  it('retries EBUSY rename three times without exposing partial JSON', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    let renames = 0
    const injectedFs = new Proxy(fs, {
      get(target, property) {
        if (property === 'rename') return async (from, to) => {
          renames++
          if (renames < 4) throw Object.assign(new Error('synthetic-busy'), { code: 'EBUSY' })
          return target.rename(from, to)
        }
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const { watcher, tick } = steppedWatcher({ ...dirs, mode: 'auto', fs: injectedFs })
    try {
      await tick()
      await fs.appendFile(dirs.transcript, row({ time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot } }))
      await tick()
      const outputPath = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
      expect(JSON.parse(await fs.readFile(outputPath, 'utf8')).agents[0].status).toBe('working')
      expect(renames).toBe(4)
      expect((await fs.readdir(dirs.statusDir)).filter(name => name.includes('.tmp-') || name.endsWith('-lock'))).toEqual([])
    } finally { watcher.stop() }
  })

  it('coalesces one-tick bursts to first and latest work, then neutralizes only once', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const destination = path.join(dirs.statusDir, sessionFile(await fs.realpath(dirs.projectRoot), 'session-a'))
    const publications = []
    const injectedFs = new Proxy(fs, {
      get(target, property) {
        if (property === 'writeFile') return async (candidate, contents, ...args) => {
          if (candidate.startsWith(destination + '.tmp-')) publications.push(JSON.parse(contents))
          return target.writeFile(candidate, contents, ...args)
        }
        const value = Reflect.get(target, property)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const { watcher, tick } = steppedWatcher({ ...dirs, mode: 'auto', fs: injectedFs })
    try {
      await tick()
      const time = new Date(Date.now() + 1000).toISOString()
      const burst = [row({ step: 1, time, args: { Cwd: dirs.projectRoot } })]
      for (let step = 2; step < 9; step++) burst.push(row({ step, time, name: 'view_file', args: {} }))
      burst.push(row({ step: 9, time, name: 'write_file', args: { Path: path.join(dirs.projectRoot, 'latest.js') } }))
      await fs.appendFile(dirs.transcript, burst.join(''))
      await tick()
      expect(publications).toHaveLength(1)
      expect(publications[0].agents[0].task).toBe('Bash')
      await tick()
      expect(publications).toHaveLength(2)
      expect(publications[1].agents[0]).toMatchObject({ task: 'Write', activeFile: 'latest.js' })
      expect(publications[1]._sourceEventKey).not.toBe(publications[0]._sourceEventKey)
      await tick()
      expect(publications).toHaveLength(2)
      for (let second = 0; second < 15; second++) await tick()
      expect(publications).toHaveLength(3)
      expect(publications[2].agents[0]).toMatchObject({ status: 'idle', task: null, activeFile: null })
      await tick()
      expect(publications).toHaveLength(3)
    } finally { watcher.stop() }
  })

  it('drops an event on a live ownership-lock collision without stealing the lock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.now())
    const dirs = await makeRoots()
    await fs.writeFile(dirs.transcript, '')
    const watcher = observedWatcher({ ...dirs, mode: 'auto' })
    await flushTicks()
    const lockPath = path.join(dirs.statusDir, `${sessionFile(await fs.realpath(dirs.projectRoot), 'session-a')}.antigravity-lock`)
    await fs.writeFile(lockPath, 'another-owner')
    await fs.appendFile(dirs.transcript, row({ step: 1, time: new Date(Date.now() + 1000).toISOString(), args: { Cwd: dirs.projectRoot, CommandLine: 'secret' } }))
    await flushTicks()
    expect(await fs.readFile(lockPath, 'utf8')).toBe('another-owner')
    expect((await fs.readdir(dirs.statusDir)).filter((name) => name.startsWith('office-status-antigravity-') && name.endsWith('.json'))).toHaveLength(0)
    watcher.stop()
    await fs.unlink(lockPath)
  })
})
