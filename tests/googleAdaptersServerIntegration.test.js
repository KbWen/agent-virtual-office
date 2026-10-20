/** AVO-198: actual observer -> status directory -> production/Vite GET and SSE. */
import { afterEach, describe, expect, it } from 'vitest'
import { createServer as createViteServer } from 'vite'
import { createServer as createNetServer } from 'node:net'
import http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanAndMerge } from '../src/server/scanSessions.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cleanups = []
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function until(read, predicate, timeout = 12_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await read()
    if (predicate(value)) return value
    await delay(100)
  }
  throw new Error('Synthetic Google adapter observation did not reach its expected boundary')
}

async function freePort() {
  const server = createNetServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

async function boot(kind, useProjectAlias = false, emptyHistory = false) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-google-server-'))
  cleanups.push(() => fs.rmSync(scratch, { recursive: true, force: true }))
  let project = path.join(scratch, 'invoking project')
  const status = path.join(scratch, 'status')
  const data = path.join(scratch, 'source')
  const logDir = path.join(data, 'brain', 'synthetic-session', '.system_generated', 'logs')
  for (const dir of [project, status, logDir]) fs.mkdirSync(dir, { recursive: true })
  if (useProjectAlias) {
    const alias = path.join(scratch, 'project alias')
    fs.symlinkSync(project, alias, process.platform === 'win32' ? 'junction' : 'dir')
    project = alias
  }
  fs.writeFileSync(path.join(project, 'index.html'), '<!doctype html><body>fixture</body>')
  const transcript = path.join(logDir, 'transcript.jsonl')
  // Startup history can establish binding, but must never publish work.
  const record = (step, time = Date.now()) => JSON.stringify({
    created_at: new Date(time).toISOString(), step_index: step,
    type: 'GENERIC', source: 'MODEL', status: 'DONE',
    tool_calls: [{ name: 'run_command', args: { Cwd: project, CommandLine: 'synthetic-not-executed' } }],
  }) + '\n'
  fs.writeFileSync(transcript, emptyHistory ? '' : record(0, Date.now() - 60_000))
  const env = {
    OFFICE_STATUS_DIR: status, OFFICE_PROJECT_ROOT: project,
    OFFICE_ANTIGRAVITY_ROOT: data, OFFICE_ANTIGRAVITY_MODE: 'auto',
    OFFICE_DISABLE_FILE_WATCHER: '1', OFFICE_API_TOKEN: '', OFFICE_ALLOWED_HOSTS: '',
  }
  let base
  if (kind === 'production') {
    const port = await freePort()
    const proc = spawn(process.execPath, ['server.mjs', `--port=${port}`, '--no-open'], {
      cwd: ROOT, env: { ...process.env, ...env }, stdio: 'ignore', windowsHide: true,
    })
    cleanups.push(async () => {
      if (proc.exitCode !== null) return
      const exited = new Promise(resolve => proc.once('exit', resolve))
      proc.kill('SIGTERM')
      await Promise.race([exited, delay(3000)])
      if (proc.exitCode === null) { proc.kill('SIGKILL'); await exited }
    })
    base = `http://127.0.0.1:${port}`
  } else {
    const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
    try {
      Object.assign(process.env, env)
      const server = await createViteServer({
        configFile: path.join(ROOT, 'vite.config.mjs'), root: project, logLevel: 'silent',
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { port: 0, strictPort: false, host: '127.0.0.1' },
      })
      cleanups.push(() => server.close())
      await server.listen()
      base = `http://127.0.0.1:${server.httpServer.address().port}`
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  }
  await until(async () => {
    try { return (await fetch(`${base}/api/health`)).status } catch { return 0 }
  }, status => status === 200)
  return { base, project, status, transcript, record, env }
}

function subscribe(base) {
  const events = []
  const request = http.get(`${base}/api/status/stream`, response => {
    let pending = ''
    response.on('data', chunk => {
      pending += chunk.toString()
      const frames = pending.split('\n\n')
      pending = frames.pop()
      for (const frame of frames) {
        const data = frame.split('\n').find(line => line.startsWith('data: '))
        if (data) events.push(JSON.parse(data.slice(6)))
      }
    })
  })
  request.on('error', () => { /* expected on explicit test teardown */ })
  cleanups.push(() => request.destroy())
  return events
}

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()()
}, 15_000)

describe.each(['production', 'vite'])('Google adapters on actual %s transport', kind => {
  it('accepts the live-observed quoted Path/read_file shape without a prior Cwd binding', async () => {
    const { base, project, transcript } = await boot(kind, false, true)
    const events = subscribe(base)
    await delay(1400)
    fs.appendFileSync(transcript, JSON.stringify({
      created_at: new Date().toISOString(), step_index: 1,
      type: 'PLANNER_RESPONSE', source: 'MODEL', status: 'DONE',
      tool_calls: [{ name: 'read_file', args: { Path: JSON.stringify(path.join(project, 'index.html')), StartLine: '1', EndLine: '1' } }],
    }) + '\n')
    const status = await until(async () => (await fetch(`${base}/api/status`)).json(), body => body?.source === 'antigravity')
    expect(status.agents[0]).toMatchObject({ role: 'res', status: 'working', task: 'Read', activeFile: null })
    expect(status._sourceEventKey).toBeUndefined()
    await until(() => events, values => values.some(body => body?.source === 'antigravity' && body.agents?.[0]?.task === 'Read'))
  }, 20_000)

  it('ignores startup history, then serves both independent producers over GET and SSE', async () => {
    const fixture = await boot(kind)
    const { base, project, status, transcript, record, env } = fixture
    const events = subscribe(base)
    await delay(1400)
    expect(fs.readdirSync(status).filter(file => file.startsWith('office-status-antigravity-'))).toEqual([])
    fs.appendFileSync(transcript, record(1))
    await until(() => fs.readdirSync(status), files => files.some(file => /^office-status-antigravity-[a-f0-9]{24}\.json$/.test(file)))
    const read = async () => (await fetch(`${base}/api/status`)).json()
    const first = await until(read, body => body?.source === 'antigravity')
    expect(first.agents.some(agent => agent.status === 'working' && agent.task === 'Bash')).toBe(true)
    expect(first._sourceEventKey).toBeUndefined()
    expect(first._sourceTimestamp).toBeUndefined()
    expect(first._sourceIdle).toBeUndefined()
    await until(() => events, values => values.some(body => body?.source === 'antigravity'))

    const hook = spawnSync(process.execPath, [path.join(ROOT, 'public/hooks/office-status-gemini.js')], {
      cwd: project, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 3000, windowsHide: true,
      input: JSON.stringify({
        session_id: 'synthetic-session', cwd: project, hook_event_name: 'BeforeTool',
        timestamp: new Date().toISOString(), tool_name: 'read_file',
        tool_input: { file_path: path.join(project, 'example.js') },
      }),
    })
    expect(hook.status).toBe(0)
    expect(hook.stdout.trim()).toBe('{}')
    const merged = await until(read, body => body?.sessionCount === 2)
    expect(merged.agents).toHaveLength(2)
    expect(new Set(merged.agents.map(agent => agent.role.split('~').pop()))).toEqual(new Set(['ops', 'res']))
    expect(merged.agents.every(agent => agent.status === 'working' && agent.activeFile == null)).toBe(true)
    await until(() => events, values => values.some(body => body?.sessionCount === 2))
    expect(fs.readdirSync(status).filter(file => /^office-status-(antigravity|gemini)-[a-f0-9]{24}\.json$/.test(file))).toHaveLength(2)
    for (const file of fs.readdirSync(status).filter(file => /^office-status-antigravity-[a-f0-9]{24}\.json$/.test(file))) fs.unlinkSync(path.join(status, file))
    const geminiOnly = await until(read, body => body?.source === 'gemini-cli')
    expect(geminiOnly._geminiOrder).toBeUndefined()
    await until(() => events, values => values.some(body => body?.source === 'gemini-cli'))
    for (const body of events.filter(Boolean)) {
      for (const key of ['_sourceEventKey', '_sourceTimestamp', '_sourceIdle', '_geminiOrder']) expect(body[key]).toBeUndefined()
    }
  }, 35_000)

  it('matches both canonical adapter identities through a symlinked invoking root', async () => {
    const { base, project, transcript, record, env } = await boot(kind, true)
    await delay(1400)
    fs.appendFileSync(transcript, record(1))
    const read = async () => (await fetch(`${base}/api/status`)).json()
    await until(read, body => body?.source === 'antigravity')
    const child = spawnSync(process.execPath, [path.join(ROOT, 'public/hooks/office-status-gemini.js')], {
      cwd: project, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 3000, windowsHide: true,
      input: JSON.stringify({ session_id: 'alias-session', cwd: project, hook_event_name: 'BeforeAgent', timestamp: new Date().toISOString() }),
    })
    expect(child.status).toBe(0)
    const merged = await until(read, body => body?.sessionCount === 2)
    expect(merged.agents).toHaveLength(2)
  }, 35_000)
})

it('keeps Claude, Codex, Gemini and Antigravity sessions independent in the real scanner', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-google-coexist-'))
  cleanups.push(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const [source, role] of [['claude-cli', 'pm'], ['codex', 'dev'], ['gemini-cli', 'res'], ['antigravity', 'ops']]) {
    fs.writeFileSync(path.join(root, `office-status-${source}-synthetic.json`), JSON.stringify({
      type: 'office-status', _cwd: root, _seq: String(Date.now()), source,
      agents: [{ role, status: 'working', task: 'Task' }], activeCount: 1, workflow: null,
    }))
  }
  const merged = scanAndMerge(root, root)
  expect(merged.sessionCount).toBe(4)
  expect(merged.agents.map(agent => agent.role.split('~').pop()).sort()).toEqual(['dev', 'ops', 'pm', 'res'])
})

it('executes both adapters from an extracted npm tarball without repository imports', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-google-packed-'))
  cleanups.push(() => fs.rmSync(scratch, { recursive: true, force: true }))
  const npmCandidates = [
    process.env.npm_execpath && path.join(path.dirname(process.env.npm_execpath), 'npm-cli.js'),
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ].filter(Boolean)
  const npmCli = npmCandidates.find(candidate => fs.existsSync(candidate))
  expect(npmCli, 'installed npm CLI is required for the package boundary test').toBeTruthy()
  const packed = spawnSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', scratch], {
    cwd: ROOT, encoding: 'utf8', timeout: 20_000, windowsHide: true,
  })
  expect(packed.status, 'npm pack must succeed without lifecycle scripts').toBe(0)
  const archive = path.join(scratch, JSON.parse(packed.stdout)[0].filename)
  const extracted = spawnSync('tar', ['-xf', archive, '-C', scratch], { encoding: 'utf8', timeout: 10_000, windowsHide: true })
  expect(extracted.status, 'system tar must extract the locally created package').toBe(0)
  const runtime = path.join(scratch, 'package')
  const project = path.join(scratch, 'project')
  const status = path.join(scratch, 'status')
  const data = path.join(scratch, 'data')
  const logs = path.join(data, 'brain', 'packed-session', '.system_generated', 'logs')
  for (const dir of [project, status, logs]) fs.mkdirSync(dir, { recursive: true })
  const transcript = path.join(logs, 'transcript.jsonl')
  fs.writeFileSync(transcript, '')
  const env = { ...process.env, OFFICE_STATUS_DIR: status, OFFICE_PROJECT_ROOT: project, OFFICE_ANTIGRAVITY_MODE: 'auto' }
  const childProgram = `
    const { pathToFileURL } = await import('node:url');
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const [modulePath, projectRoot, statusDir, dataRoot, transcript] = process.argv.slice(1);
    const { startAntigravityWatcher } = await import(pathToFileURL(modulePath).href);
    const observer = startAntigravityWatcher({ projectRoot, statusDir, dataRoot });
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    try {
      await delay(1400);
      await fs.appendFile(transcript, JSON.stringify({created_at:new Date().toISOString(),step_index:1,type:'GENERIC',source:'MODEL',status:'DONE',tool_calls:[{name:'run_command',args:{Cwd:projectRoot}}]})+'\\n');
      for(let attempt=0;attempt<60;attempt++) {
        if((await fs.readdir(statusDir)).some(name=>/^office-status-antigravity-[a-f0-9]{24}\\.json$/.test(name))) { console.log('packed-observer-ok'); break; }
        await delay(100);
      }
    } finally { observer.stop(); }
  `
  const observed = spawnSync(process.execPath, ['--input-type=module', '-e', childProgram,
    path.join(runtime, 'src/server/antigravityWatcher.mjs'), project, status, data, transcript], {
    cwd: project, env, encoding: 'utf8', timeout: 12_000, windowsHide: true,
  })
  expect(observed.status).toBe(0)
  expect(observed.stdout.trim()).toBe('packed-observer-ok')
  const hooked = spawnSync(process.execPath, [path.join(runtime, 'public/hooks/office-status-gemini.js')], {
    cwd: project, env, encoding: 'utf8', timeout: 3000, windowsHide: true,
    input: JSON.stringify({ session_id: 'packed-session', cwd: project, timestamp: new Date().toISOString(), hook_event_name: 'BeforeAgent' }),
  })
  expect(hooked.status).toBe(0)
  expect(hooked.stdout.trim()).toBe('{}')
  const merged = scanAndMerge(status, project)
  expect(merged.sessionCount).toBe(2)
  expect(merged.agents.every(agent => agent.status === 'working')).toBe(true)
}, 35_000)
