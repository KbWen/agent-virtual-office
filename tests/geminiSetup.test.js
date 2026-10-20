import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const cliSource = path.resolve('bin/cli.js')
const tempRoots = []

function makeTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempRoots.push(dir)
  return dir
}

function makePackageRoot({ failGeminiSettingsWrite = false } = {}) {
  const packageRoot = makeTempDir('avo-gemini-package-')
  fs.mkdirSync(path.join(packageRoot, 'bin'), { recursive: true })
  fs.mkdirSync(path.join(packageRoot, 'public', 'hooks'), { recursive: true })
  let cliText = fs.readFileSync(cliSource, 'utf8').replace(/\r\n/g, '\n')
  if (failGeminiSettingsWrite) {
    const start = cliText.indexOf('function atomicWriteGeminiSettings(target, contents) {')
    const end = cliText.indexOf('\n}\n', start)
    if (start === -1 || end === -1) throw new Error('Could not inject settings write failure')
    cliText = cliText.slice(0, start) +
      'function atomicWriteGeminiSettings(target, contents) { return false }' +
      cliText.slice(end + 2)
  }
  fs.writeFileSync(path.join(packageRoot, 'bin', 'cli.js'), cliText)
  // A synthetic package hook keeps these CLI tests independent of the separately-owned hook.
  fs.writeFileSync(
    path.join(packageRoot, 'public', 'hooks', 'office-status-gemini.js'),
    'process.stdout.write(JSON.stringify({ executable: process.execPath, script: __filename }))\n',
  )
  return packageRoot
}

function makeProjectDir(prefix = 'avo-gemini-project-') {
  return makeTempDir(prefix)
}

function cliEnv(home) {
  return { ...process.env, HOME: home, USERPROFILE: home }
}

function runCli(packageRoot, projectRoot, args, home) {
  return spawnSync(process.execPath, [path.join(packageRoot, 'bin', 'cli.js'), ...args], {
    cwd: projectRoot,
    env: cliEnv(home),
    encoding: 'utf8',
  })
}

function readSettings(projectRoot) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, '.gemini', 'settings.json'), 'utf8'))
}

const events = ['BeforeAgent', 'BeforeTool', 'AfterTool', 'AfterAgent', 'Notification', 'SessionEnd']

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

describe('Gemini project hook setup', () => {
  it('merges six uniquely named event hooks, preserves foreign settings, and is idempotent', () => {
    const packageRoot = makePackageRoot()
    const projectRoot = makeProjectDir()
    const home = makeTempDir('avo-gemini-home-')
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json')
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
    const original = {
      security: { folderTrust: { enabled: true } },
      hooksConfig: { enabled: true },
      hooks: {
        BeforeTool: [{ matcher: 'read_file', hooks: [{ name: 'foreign', type: 'command', command: 'echo foreign' }] }],
        BeforeAgent: [{ matcher: 'startup', hooks: [{ name: 'other', type: 'command', command: 'echo other' }] }],
      },
    }
    const originalBytes = Buffer.from(JSON.stringify(original, null, 2))
    fs.writeFileSync(settingsPath, originalBytes)

    const first = runCli(packageRoot, projectRoot, ['setup', '--platform', 'gemini'], home)
    expect(first.status, first.stderr).toBe(0)
    const installed = readSettings(projectRoot)
    expect(installed.security).toEqual(original.security)
    expect(installed.hooksConfig).toEqual(original.hooksConfig)
    for (const event of events) {
      const owned = installed.hooks[event].flatMap(group => group.hooks || [])
        .filter(hook => hook.name === `avo-office-status-gemini-${event}`)
      expect(owned).toHaveLength(1)
      expect(owned[0]).toMatchObject({ type: 'command', timeout: 2000 })
      expect(owned[0].command).toContain(path.join(projectRoot, '.gemini', 'hooks', 'office-status-gemini.js'))
    }
    expect(installed.hooks.BeforeTool.some(group => group.hooks?.some(hook => hook.name === 'foreign'))).toBe(true)
    expect(installed.hooks.BeforeAgent.some(group => group.hooks?.some(hook => hook.name === 'other'))).toBe(true)
    expect(fs.readFileSync(settingsPath + '.avo-gemini-backup')).toEqual(originalBytes)
    const firstBytes = fs.readFileSync(settingsPath)

    const second = runCli(packageRoot, projectRoot, ['setup', '--platform', 'gemini'], home)
    expect(second.status, second.stderr).toBe(0)
    expect(fs.readFileSync(settingsPath)).toEqual(firstBytes)
    expect(readSettings(projectRoot).hooks.BeforeTool).toHaveLength(installed.hooks.BeforeTool.length)
  })

  it('rejects malformed settings without creating or changing project files', () => {
    const packageRoot = makePackageRoot()
    const projectRoot = makeProjectDir()
    const home = makeTempDir('avo-gemini-home-')
    const geminiDir = path.join(projectRoot, '.gemini')
    fs.mkdirSync(geminiDir)
    const settingsPath = path.join(geminiDir, 'settings.json')
    const malformed = '{ "hooks": { "BeforeAgent": {} } }\n'
    fs.writeFileSync(settingsPath, malformed)

    const result = runCli(packageRoot, projectRoot, ['setup', '--platform=gemini'], home)
    expect(result.status).toBe(1)
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe(malformed)
    expect(fs.existsSync(path.join(geminiDir, 'hooks'))).toBe(false)
    expect(fs.existsSync(settingsPath + '.avo-gemini-backup')).toBe(false)
  })

  it('leaves original settings intact and removes the staged script when the atomic write fails', () => {
    const packageRoot = makePackageRoot({ failGeminiSettingsWrite: true })
    const projectRoot = makeProjectDir()
    const home = makeTempDir('avo-gemini-home-')
    const geminiDir = path.join(projectRoot, '.gemini')
    fs.mkdirSync(geminiDir)
    const settingsPath = path.join(geminiDir, 'settings.json')
    const original = Buffer.from('{\n  "trust": { "folder": true }\n}\n')
    fs.writeFileSync(settingsPath, original)

    const result = runCli(packageRoot, projectRoot, ['setup', '--platform', 'gemini'], home)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('atomic settings write failed')
    expect(fs.readFileSync(settingsPath)).toEqual(original)
    expect(fs.existsSync(settingsPath + '.avo-gemini-backup')).toBe(false)
    expect(fs.existsSync(path.join(geminiDir, 'hooks', 'office-status-gemini.js'))).toBe(false)
    expect(fs.existsSync(path.join(geminiDir, 'hooks'))).toBe(false)
  })

  it('writes through settings symlinks and retains the link target', () => {
    const packageRoot = makePackageRoot()
    const projectRoot = makeProjectDir()
    const home = makeTempDir('avo-gemini-home-')
    const geminiDir = path.join(projectRoot, '.gemini')
    fs.mkdirSync(geminiDir)
    const target = path.join(projectRoot, 'outside-settings.json')
    fs.writeFileSync(target, '{}')
    const settingsPath = path.join(geminiDir, 'settings.json')
    try {
      fs.symlinkSync(target, settingsPath, 'file')
    } catch {
      return
    }

    const result = runCli(packageRoot, projectRoot, ['setup', '--platform', 'gemini'], home)
    expect(result.status, result.stderr).toBe(0)
    expect(fs.lstatSync(settingsPath).isSymbolicLink()).toBe(true)
    expect(fs.readFileSync(target + '.avo-gemini-backup')).toEqual(Buffer.from('{}'))
    expect(readSettings(projectRoot).hooks.BeforeAgent).toHaveLength(1)
  })

  it('uninstalls only owned entries and an unmodified owned script', () => {
    const packageRoot = makePackageRoot()
    const projectRoot = makeProjectDir()
    const home = makeTempDir('avo-gemini-home-')
    fs.mkdirSync(path.join(projectRoot, '.gemini'), { recursive: true })
    fs.writeFileSync(path.join(projectRoot, '.gemini', 'settings.json'), '{}')
    const result = runCli(packageRoot, projectRoot, ['setup', '--platform', 'gemini'], home)
    expect(result.status, result.stderr).toBe(0)
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json')
    const scriptPath = path.join(projectRoot, '.gemini', 'hooks', 'office-status-gemini.js')
    const settings = readSettings(projectRoot)
    const ownedGroup = settings.hooks.BeforeTool.find(group =>
      group.hooks?.some(hook => hook.name === 'avo-office-status-gemini-BeforeTool'),
    )
    ownedGroup.hooks.push({ name: 'foreign-tool', type: 'command', command: 'echo keep' })
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

    const uninstall = runCli(packageRoot, projectRoot, ['uninstall', '--platform', 'gemini'], home)
    expect(uninstall.status, uninstall.stderr).toBe(0)
    const after = readSettings(projectRoot)
    for (const event of events) {
      expect((after.hooks[event] || []).flatMap(group => group.hooks || [])
        .some(hook => hook.name === `avo-office-status-gemini-${event}`)).toBe(false)
    }
    expect(after.hooks.BeforeTool.some(group => group.hooks?.some(hook => hook.name === 'foreign-tool'))).toBe(true)
    expect(fs.existsSync(settingsPath)).toBe(true)
    expect(fs.existsSync(scriptPath)).toBe(false)
    expect(fs.existsSync(settingsPath + '.avo-gemini-backup')).toBe(true)
  })

  it('preserves a user-edited hook script on uninstall', () => {
    const packageRoot = makePackageRoot()
    const projectRoot = makeProjectDir()
    const home = makeTempDir('avo-gemini-home-')
    expect(runCli(packageRoot, projectRoot, ['setup', '--platform', 'gemini'], home).status).toBe(0)
    const scriptPath = path.join(projectRoot, '.gemini', 'hooks', 'office-status-gemini.js')
    fs.appendFileSync(scriptPath, '// user change\n')

    const uninstall = runCli(packageRoot, projectRoot, ['uninstall', '--platform', 'gemini'], home)
    expect(uninstall.status, uninstall.stderr).toBe(0)
    expect(fs.existsSync(scriptPath)).toBe(true)
  })

  it('preserves an edited AVO registration and its referenced script on setup and uninstall', () => {
    const packageRoot = makePackageRoot()
    const projectRoot = makeProjectDir()
    const home = makeTempDir('avo-gemini-home-')
    expect(runCli(packageRoot, projectRoot, ['setup', '--platform', 'gemini'], home).status).toBe(0)
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json')
    const scriptPath = path.join(projectRoot, '.gemini', 'hooks', 'office-status-gemini.js')
    const settings = readSettings(projectRoot)
    const ownedHook = settings.hooks.BeforeTool[0].hooks
      .find(hook => hook.name === 'avo-office-status-gemini-BeforeTool')
    ownedHook.command += ' --user-edit'
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    const editedBytes = fs.readFileSync(settingsPath)

    const setup = runCli(packageRoot, projectRoot, ['setup', '--platform', 'gemini'], home)
    expect(setup.status).toBe(1)
    expect(fs.readFileSync(settingsPath)).toEqual(editedBytes)

    const uninstall = runCli(packageRoot, projectRoot, ['uninstall', '--platform', 'gemini'], home)
    expect(uninstall.status, uninstall.stderr).toBe(0)
    const after = readSettings(projectRoot)
    expect(after.hooks.BeforeTool[0].hooks.find(hook => hook.name === 'avo-office-status-gemini-BeforeTool').command)
      .toBe(ownedHook.command)
    expect(fs.existsSync(scriptPath)).toBe(true)
  })

  it('executes the registered command through the host shell with quoted Unicode and metacharacter paths', () => {
    const packageRoot = makePackageRoot()
    const projectRoot = makeProjectDir("avo ' 雪 & (tools) $x ")
    const home = makeTempDir('avo-gemini-home-')
    const setup = runCli(packageRoot, projectRoot, ['setup', '--platform', 'gemini'], home)
    expect(setup.status, setup.stderr).toBe(0)
    const command = readSettings(projectRoot).hooks.BeforeAgent[0].hooks
      .find(hook => hook.name === 'avo-office-status-gemini-BeforeAgent').command

    let shell
    let shellArgs
    if (process.platform === 'win32') {
      shell = 'powershell.exe'
      shellArgs = ['-NoProfile', '-NonInteractive', '-Command', command]
    } else {
      shell = '/bin/bash'
      shellArgs = ['-c', command]
    }
    const executed = spawnSync(shell, shellArgs, { cwd: projectRoot, encoding: 'utf8' })
    expect(executed.status, executed.stderr).toBe(0)
    const output = JSON.parse(executed.stdout.trim())
    expect(output.executable).toBe(process.execPath)
    expect(output.script).toBe(path.join(projectRoot, '.gemini', 'hooks', 'office-status-gemini.js'))
  })

  it('rejects unknown platform selectors instead of falling through to Claude setup', () => {
    const packageRoot = makePackageRoot()
    const projectRoot = makeProjectDir()
    const home = makeTempDir('avo-gemini-home-')
    const result = runCli(packageRoot, projectRoot, ['setup', '--platform', 'unknown'], home)
    expect(result.status).toBe(1)
    expect(fs.existsSync(path.join(home, '.claude'))).toBe(false)
    expect(fs.existsSync(path.join(projectRoot, '.gemini'))).toBe(false)
  })

  it('keeps bare setup on the existing Claude path', () => {
    const home = makeTempDir('avo-claude-home-')
    const result = spawnSync(process.execPath, [cliSource, 'setup'], { env: cliEnv(home), encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    expect(fs.existsSync(path.join(home, '.claude', 'office-status-hook.js'))).toBe(true)
    expect(fs.existsSync(path.join(home, '.gemini'))).toBe(false)
  })

  it('keeps explicit Claude setup on the existing user settings path', () => {
    const home = makeTempDir('avo-claude-home-')
    const result = spawnSync(process.execPath, [cliSource, 'setup', '--platform', 'claude'], {
      env: cliEnv(home),
      encoding: 'utf8',
    })
    expect(result.status, result.stderr).toBe(0)
    expect(fs.existsSync(path.join(home, '.claude', 'office-status-hook.js'))).toBe(true)
    expect(fs.existsSync(path.join(home, '.gemini'))).toBe(false)
  })
})
