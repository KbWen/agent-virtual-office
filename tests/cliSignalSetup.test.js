import { afterEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const cliSource = path.resolve('bin/cli.js')
const repoRoot = path.resolve('.')
const roots = []
const temp = prefix => { const p = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); roots.push(p); return p }
const safeTemp = prefix => { const p = fs.mkdtempSync(path.join(repoRoot, `.${prefix}`)); roots.push(p); return p }
const env = home => ({ ...process.env, HOME: home, USERPROFILE: home })
function packageRoot({ failSettingsWrite = false, failNativeStageWrite = false } = {}) {
  const root = temp('avo-codex-package-')
  fs.mkdirSync(path.join(root, 'bin'), { recursive: true })
  fs.mkdirSync(path.join(root, 'public', 'hooks'), { recursive: true })
  let cli = fs.readFileSync(cliSource, 'utf8')
  if (failSettingsWrite) {
    const start = cli.indexOf('function writeCodexHooks(file, contents) {')
    const end = cli.indexOf('\n}', start)
    if (start < 0 || end < 0) throw new Error('Could not inject Codex settings write failure')
    cli = cli.slice(0, start) + 'function writeCodexHooks(file, contents) { return false }' + cli.slice(end + 2)
  }
  if (failNativeStageWrite) {
    const stageWrite = "fs.writeFileSync(temp, contents, { flag: 'wx', mode: 0o600 })"
    if (!cli.includes(stageWrite)) throw new Error('Could not inject partial Codex staged write')
    cli = cli.replace(stageWrite, "fs.writeFileSync(temp, Buffer.from(String(contents).slice(0, 8)), { flag: 'wx' }); throw new Error('injected partial write')")
  }
  fs.writeFileSync(path.join(root, 'bin', 'cli.js'), cli)
  for (const file of ['office-status-codex.js', 'office-status-codex-hook.js']) {
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', file), path.join(root, 'public', 'hooks', file))
  }
  return root
}
function run(root, project, home, args) {
  return spawnSync(process.execPath, [path.join(root, 'bin', 'cli.js'), ...args], { cwd: project, env: env(home), encoding: 'utf8' })
}
afterEach(() => { for (const root of roots.splice(0)) { try { fs.rmSync(root, { recursive: true, force: true }) } catch {} } })

describe('Codex native project hook setup', () => {
  it('installs both scripts, merges core events with foreign hooks, and is byte-idempotent', () => {
    const pkg = packageRoot(), project = temp("avo project ' 雪 & "), home = temp('avo-home-')
    const codex = path.join(project, '.codex')
    fs.mkdirSync(codex, { recursive: true })
    const initial = { notify: ['keep-me'], model: 'test-model', hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'foreign-handler' }] }],
      UnrelatedEvent: [{ matcher: '*', hooks: [{ type: 'command', command: 'foreign-event' }] }],
    } }
    fs.writeFileSync(path.join(codex, 'hooks.json'), JSON.stringify(initial, null, 2))
    const first = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(first.status, first.stderr).toBe(0)
    const settingsPath = path.join(codex, 'hooks.json')
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    expect(settings.notify).toEqual(initial.notify)
    expect(settings.model).toBe(initial.model)
    expect(settings.hooks.UnrelatedEvent).toEqual(initial.hooks.UnrelatedEvent)
    const events = ['UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'Stop', 'SessionEnd']
    for (const event of events) expect(settings.hooks[event].flatMap(g => g.hooks || []).filter(h => h.command?.includes('office-status-codex-hook.js'))).toHaveLength(1)
    expect(settings.hooks.PreToolUse.some(g => g.hooks?.some(h => h.command === 'foreign-handler'))).toBe(true)
    expect(fs.existsSync(path.join(codex, 'hooks', 'office-status-codex-hook.js'))).toBe(true)
    expect(fs.existsSync(path.join(codex, 'hooks', 'office-status-codex.js'))).toBe(true)
    const bytes = fs.readFileSync(settingsPath)
    const second = run(pkg, project, home, ['setup', '--platform=codex'])
    expect(second.status, second.stderr).toBe(0)
    expect(fs.readFileSync(settingsPath)).toEqual(bytes)
  })

  it('rejects malformed configuration without partial script installation', () => {
    const pkg = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    const codex = path.join(project, '.codex')
    fs.mkdirSync(codex, { recursive: true })
    const malformed = '{"hooks":{"PreToolUse":{}}}'
    fs.writeFileSync(path.join(codex, 'hooks.json'), malformed)
    const result = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(result.status).toBe(1)
    expect(fs.readFileSync(path.join(codex, 'hooks.json'), 'utf8')).toBe(malformed)
    expect(fs.existsSync(path.join(codex, 'hooks'))).toBe(false)
  })

  it('rolls back newly installed scripts and backup when writing hooks.json fails', () => {
    const pkg = packageRoot({ failSettingsWrite: true }), project = temp('avo-project-'), home = temp('avo-home-')
    const codex = path.join(project, '.codex')
    fs.mkdirSync(codex, { recursive: true })
    const settingsPath = path.join(codex, 'hooks.json')
    const original = Buffer.from('{"notify":["keep"]}\n')
    fs.writeFileSync(settingsPath, original)
    const result = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(result.status).toBe(1)
    expect(fs.readFileSync(settingsPath)).toEqual(original)
    expect(fs.existsSync(settingsPath + '.avo-codex-backup')).toBe(false)
    expect(fs.existsSync(path.join(codex, 'hooks', 'office-status-codex-hook.js'))).toBe(false)
    expect(fs.existsSync(path.join(codex, 'hooks'))).toBe(false)
  })

  it('refuses a mismatched pre-existing Codex settings backup before installing anything', () => {
    const pkg = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    const codex = path.join(project, '.codex')
    fs.mkdirSync(codex, { recursive: true })
    const settingsPath = path.join(codex, 'hooks.json')
    const original = Buffer.from('{"notify":["current"]}\n')
    const backup = Buffer.from('{"notify":["different"]}\n')
    fs.writeFileSync(settingsPath, original)
    fs.writeFileSync(settingsPath + '.avo-codex-backup', backup)
    const result = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(result.status).toBe(1)
    expect(fs.readFileSync(settingsPath)).toEqual(original)
    expect(fs.readFileSync(settingsPath + '.avo-codex-backup')).toEqual(backup)
    expect(fs.existsSync(path.join(codex, 'hooks'))).toBe(false)
  })

  it('cleans a partially written staged adapter without touching settings', () => {
    const pkg = packageRoot({ failNativeStageWrite: true }), project = temp('avo-project-'), home = temp('avo-home-')
    const codex = path.join(project, '.codex')
    fs.mkdirSync(codex, { recursive: true })
    const settingsPath = path.join(codex, 'hooks.json')
    const original = Buffer.from('{"notify":["keep"]}\n')
    fs.writeFileSync(settingsPath, original)
    const result = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(result.status).toBe(1)
    expect(fs.readFileSync(settingsPath)).toEqual(original)
    expect(fs.existsSync(path.join(codex, 'hooks', 'office-status-codex-hook.js'))).toBe(false)
    expect(fs.existsSync(path.join(codex, 'hooks', '.avo-codex-owned.json'))).toBe(false)
    expect(fs.existsSync(path.join(codex, 'hooks'))).toBe(false)
    expect(fs.readdirSync(codex).some(file => file.includes('.tmp.'))).toBe(false)
  })

  it('rejects an edited owned registration without writing settings or scripts', () => {
    const pkg = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    const result = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(result.status).toBe(0)
    const settingsPath = path.join(project, '.codex', 'hooks.json')
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    settings.hooks.Stop[0].hooks[0].timeout = 10
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    const edited = fs.readFileSync(settingsPath)
    const retry = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(retry.status).toBe(1)
    expect(fs.readFileSync(settingsPath)).toEqual(edited)
    const hookPath = path.join(project, '.codex', 'hooks', 'office-status-codex-hook.js')
    const helperPath = path.join(project, '.codex', 'hooks', 'office-status-codex.js')
    expect(fs.existsSync(hookPath)).toBe(true)
    const uninstall = run(pkg, project, home, ['uninstall', '--platform', 'codex'])
    expect(uninstall.status, uninstall.stderr).toBe(0)
    const afterUninstall = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    expect(afterUninstall.hooks.Stop[0].hooks[0].timeout).toBe(10)
    expect(afterUninstall.hooks.PreToolUse).toBeUndefined()
    expect(fs.existsSync(hookPath)).toBe(true)
    expect(fs.existsSync(helperPath)).toBe(true)
  })

  it('rejects symlinked settings paths before installing scripts', () => {
    const pkg = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    const codex = path.join(project, '.codex')
    fs.mkdirSync(codex, { recursive: true })
    const target = path.join(project, 'settings-target.json')
    fs.writeFileSync(target, '{}')
    try { fs.symlinkSync(target, path.join(codex, 'hooks.json'), 'file') } catch { return }
    const result = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(result.status).toBe(1)
    expect(fs.readFileSync(target, 'utf8')).toBe('{}')
    expect(fs.existsSync(path.join(codex, 'hooks'))).toBe(false)
  })

  it('preserves an edited adapter file on uninstall', () => {
    const pkg = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    expect(run(pkg, project, home, ['setup', '--platform', 'codex']).status).toBe(0)
    const hookPath = path.join(project, '.codex', 'hooks', 'office-status-codex-hook.js')
    fs.appendFileSync(hookPath, '\n// user edit\n')
    const result = run(pkg, project, home, ['uninstall', '--platform', 'codex'])
    expect(result.status, result.stderr).toBe(0)
    expect(fs.existsSync(hookPath)).toBe(true)
    expect(fs.readFileSync(hookPath, 'utf8')).toContain('// user edit')
  })

  it('updates recorded v1 scripts with v2 and uninstalls them using v2 ownership metadata', () => {
    const v1 = packageRoot(), v2 = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    const codex = path.join(project, '.codex')
    fs.mkdirSync(codex, { recursive: true })
    const initialSettings = Buffer.from('{"notify":["pre-install"]}\n')
    fs.writeFileSync(path.join(codex, 'hooks.json'), initialSettings)
    const v1Hook = path.join(v1, 'public', 'hooks', 'office-status-codex-hook.js')
    const v1Helper = path.join(v1, 'public', 'hooks', 'office-status-codex.js')
    const oldHook = fs.readFileSync(v1Hook), oldHelper = fs.readFileSync(v1Helper)
    for (const file of ['office-status-codex-hook.js', 'office-status-codex.js']) {
      fs.appendFileSync(path.join(v2, 'public', 'hooks', file), '\n// package v2\n')
    }
    expect(run(v1, project, home, ['setup', '--platform', 'codex']).status).toBe(0)
    const settingsBackup = path.join(codex, 'hooks.json.avo-codex-backup')
    expect(fs.readFileSync(settingsBackup)).toEqual(initialSettings)
    const settingsBackupHash = crypto.createHash('sha256').update(initialSettings).digest('hex')
    expect(JSON.parse(fs.readFileSync(path.join(codex, 'hooks', '.avo-codex-owned.json'), 'utf8')).settingsBackupHash).toBe(settingsBackupHash)
    const hooksDir = path.join(project, '.codex', 'hooks')
    const scriptHook = path.join(hooksDir, 'office-status-codex-hook.js')
    const scriptHelper = path.join(hooksDir, 'office-status-codex.js')
    const update = run(v2, project, home, ['setup', '--platform', 'codex'])
    expect(update.status, update.stderr).toBe(0)
    expect(fs.readFileSync(settingsBackup)).toEqual(initialSettings)
    expect(fs.readFileSync(scriptHook)).toEqual(fs.readFileSync(path.join(v2, 'public', 'hooks', 'office-status-codex-hook.js')))
    expect(fs.readFileSync(scriptHelper)).toEqual(fs.readFileSync(path.join(v2, 'public', 'hooks', 'office-status-codex.js')))
    expect(fs.readFileSync(scriptHook + `.avo-codex-backup.${crypto.createHash('sha256').update(oldHook).digest('hex')}`)).toEqual(oldHook)
    expect(fs.readFileSync(scriptHelper + `.avo-codex-backup.${crypto.createHash('sha256').update(oldHelper).digest('hex')}`)).toEqual(oldHelper)
    const uninstall = run(v2, project, home, ['uninstall', '--platform', 'codex'])
    expect(uninstall.status, uninstall.stderr).toBe(0)
    expect(fs.existsSync(scriptHook)).toBe(false)
    expect(fs.existsSync(scriptHelper)).toBe(false)
    expect(JSON.parse(fs.readFileSync(path.join(hooksDir, '.avo-codex-owned.json'), 'utf8')).files).toEqual({})
    expect(fs.readFileSync(settingsBackup)).toEqual(initialSettings)
  })

  it('restores recorded scripts and ownership metadata when an update cannot commit settings', () => {
    const v1 = packageRoot(), v2 = packageRoot({ failSettingsWrite: true }), project = temp('avo-project-'), home = temp('avo-home-')
    for (const file of ['office-status-codex-hook.js', 'office-status-codex.js']) {
      fs.appendFileSync(path.join(v2, 'public', 'hooks', file), '\n// package v2\n')
    }
    expect(run(v1, project, home, ['setup', '--platform', 'codex']).status).toBe(0)
    const hooksDir = path.join(project, '.codex', 'hooks')
    const settingsPath = path.join(project, '.codex', 'hooks.json')
    const scripts = ['office-status-codex-hook.js', 'office-status-codex.js']
      .map(file => [file, fs.readFileSync(path.join(hooksDir, file))])
    const ownership = fs.readFileSync(path.join(hooksDir, '.avo-codex-owned.json'))
    const settings = fs.readFileSync(settingsPath)
    const update = run(v2, project, home, ['setup', '--platform', 'codex'])
    expect(update.status).toBe(1)
    for (const [file, bytes] of scripts) expect(fs.readFileSync(path.join(hooksDir, file))).toEqual(bytes)
    expect(fs.readFileSync(path.join(hooksDir, '.avo-codex-owned.json'))).toEqual(ownership)
    expect(fs.readFileSync(settingsPath)).toEqual(settings)
    expect(fs.readdirSync(hooksDir).some(file => file.includes('.tmp.') || file.includes('.restore.'))).toBe(false)
  })

  it('refuses an edited recorded adapter during package update', () => {
    const v1 = packageRoot(), v2 = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    for (const file of ['office-status-codex-hook.js', 'office-status-codex.js']) {
      fs.appendFileSync(path.join(v2, 'public', 'hooks', file), '\n// package v2\n')
    }
    expect(run(v1, project, home, ['setup', '--platform', 'codex']).status).toBe(0)
    const script = path.join(project, '.codex', 'hooks', 'office-status-codex-hook.js')
    fs.appendFileSync(script, '\n// user edit\n')
    const edited = fs.readFileSync(script)
    const update = run(v2, project, home, ['setup', '--platform', 'codex'])
    expect(update.status).toBe(1)
    expect(fs.readFileSync(script)).toEqual(edited)
  })

  it('uses only the six supported core events and a shell-safe command for apostrophe paths', () => {
    const pkg = packageRoot(), project = temp("avo ' Codex 雪 & "), home = temp('avo-home-')
    const result = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(result.status, result.stderr).toBe(0)
    const settings = JSON.parse(fs.readFileSync(path.join(project, '.codex', 'hooks.json'), 'utf8'))
    const events = Object.keys(settings.hooks).sort()
    expect(events).toEqual(['PostToolUse', 'PreToolUse', 'PermissionRequest', 'SessionEnd', 'Stop', 'UserPromptSubmit'].sort())
    const entry = settings.hooks.UserPromptSubmit[0].hooks[0]
    expect(entry.timeout).toBe(2)
    const command = entry.command
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
    const shellArgs = process.platform === 'win32' ? ['-NoProfile', '-NonInteractive', '-Command', command] : ['-c', command]
    const dataDir = temp('avo-codex-data-')
    const event = JSON.stringify({ hook_event_name: 'UserPromptSubmit', cwd: project, session_id: 'safe-session-id', turn_id: 'turn-1' })
    const executed = spawnSync(shell, shellArgs, {
      cwd: project,
      env: { ...env(home), OFFICE_STATUS_DIR: dataDir },
      input: event,
      encoding: 'utf8',
    })
    expect(executed.status, executed.stderr).toBe(0)
    expect(fs.readdirSync(dataDir).some(file => file.startsWith('office-status-codex-hook-') && file.endsWith('.json'))).toBe(true)
  })

  it('uninstalls only exact owned registrations and unchanged scripts', () => {
    const pkg = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    const result = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(result.status, result.stderr).toBe(0)
    const settingsPath = path.join(project, '.codex', 'hooks.json')
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    settings.hooks.PreToolUse[0].hooks.push({ type: 'command', command: 'foreign-handler' })
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    const uninstall = run(pkg, project, home, ['uninstall', '--platform', 'codex'])
    expect(uninstall.status, uninstall.stderr).toBe(0)
    const remaining = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    expect(remaining.hooks.PreToolUse.some(g => g.hooks?.some(h => h.command === 'foreign-handler'))).toBe(true)
    expect(remaining.hooks.PreToolUse.some(g => g.hooks?.some(h => h.command?.includes('office-status-codex-hook.js')))).toBe(false)
    expect(fs.existsSync(path.join(project, '.codex', 'hooks', 'office-status-codex-hook.js'))).toBe(false)
    expect(fs.existsSync(path.join(project, '.codex', 'hooks', '.avo-codex-owned.json'))).toBe(false)
    expect(fs.existsSync(settingsPath + '.avo-codex-backup')).toBe(false)
  })

  it('round-trips compact existing hooks through setup, uninstall, and setup again', () => {
    const pkg = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    const codex = path.join(project, '.codex')
    fs.mkdirSync(codex, { recursive: true })
    const settingsPath = path.join(codex, 'hooks.json')
    const original = Buffer.from('{"notify":["keep"],"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"foreign"}]}]}}')
    fs.writeFileSync(settingsPath, original)
    const first = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(first.status, first.stderr).toBe(0)
    const backupPath = settingsPath + '.avo-codex-backup'
    expect(fs.readFileSync(backupPath)).toEqual(original)
    const uninstall = run(pkg, project, home, ['uninstall', '--platform', 'codex'])
    expect(uninstall.status, uninstall.stderr).toBe(0)
    const ownershipPath = path.join(codex, 'hooks', '.avo-codex-owned.json')
    expect(JSON.parse(fs.readFileSync(ownershipPath, 'utf8'))).toEqual({ version: 1, files: {}, settingsBackupHash: crypto.createHash('sha256').update(original).digest('hex') })
    expect(fs.readFileSync(backupPath)).toEqual(original)
    const second = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(second.status, second.stderr).toBe(0)
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    expect(settings.notify).toEqual(['keep'])
    expect(settings.hooks.PreToolUse.flatMap(group => group.hooks).some(hook => hook.command === 'foreign')).toBe(true)
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1)
    expect(fs.readFileSync(backupPath)).toEqual(original)
  })

  it('refreshes Claude events and removes only exact known project-local duplicate hooks', () => {
    const pkg = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const settingsPath = path.join(project, '.claude', 'settings.json')
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
    const events = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop', 'PermissionDenied', 'StopFailure']
    const originalSettings = { hooks: Object.fromEntries(events.map(event => [event, [{ hooks: [
      { type: 'command', command: 'node public/hooks/office-status-hook.js' },
      { type: 'command', command: 'echo foreign' },
    ] }]])) }
    fs.writeFileSync(settingsPath, JSON.stringify(originalSettings, null, 2))
    const result = run(pkg, project, home, ['setup'])
    expect(result.status, result.stderr).toBe(0)
    const projectSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    const globalSettings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'))
    for (const event of ['PostToolUseFailure', 'PermissionRequest', 'SessionEnd']) expect(globalSettings.hooks[event]).toBeTruthy()
    for (const event of events) {
      expect(projectSettings.hooks[event].some(group => group.hooks?.some(hook => hook.command === 'echo foreign'))).toBe(true)
      expect(projectSettings.hooks[event].flatMap(group => group.hooks || []).some(hook => hook.command === 'node public/hooks/office-status-hook.js')).toBe(false)
    }
  })

  it('deduplicates exact safe unquoted absolute Claude hook commands while preserving group metadata', () => {
    const pkg = packageRoot(), project = temp('avo-claude-project-'), home = safeTemp('avo-claude-home-')
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const script = path.join(claude, 'office-status-hook.js')
    const bareCommand = `node ${script.replace(/\\/g, '/')}`
    const events = ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'Stop']
    const settings = { hooks: Object.fromEntries(events.map(event => [event, [{ matcher: '*', policy: 'keep', hooks: [
      { type: 'command', command: bareCommand },
      { type: 'command', command: 'echo foreign' },
    ] }]])) }
    fs.writeFileSync(path.join(claude, 'settings.json'), JSON.stringify(settings, null, 2))
    const first = run(pkg, project, home, ['setup'])
    expect(first.status, first.stderr).toBe(0)
    for (const event of events) {
      const group = JSON.parse(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8')).hooks[event][0]
      expect(group.policy).toBe('keep')
      expect(group.hooks.filter(hook => hook.command?.includes('office-status-hook.js'))).toHaveLength(1)
      expect(group.hooks.some(hook => hook.command === 'echo foreign')).toBe(true)
    }
    const second = run(pkg, project, home, ['setup'])
    expect(second.status, second.stderr).toBe(0)
    const final = JSON.parse(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8'))
    for (const event of events) expect(final.hooks[event].flatMap(group => group.hooks).filter(hook => hook.command?.includes('office-status-hook.js'))).toHaveLength(1)
  })

  it('refuses a mismatched existing project Claude migration backup without changing settings', () => {
    const pkg = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const projectSettingsPath = path.join(project, '.claude', 'settings.json')
    fs.mkdirSync(path.dirname(projectSettingsPath), { recursive: true })
    const projectSettings = Buffer.from(JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { type: 'command', command: 'node public/hooks/office-status-hook.js' },
      { type: 'command', command: 'echo foreign' },
    ] }] } }, null, 2))
    fs.writeFileSync(projectSettingsPath, projectSettings)
    const backup = Buffer.from('{"hooks":{}}\n')
    fs.writeFileSync(projectSettingsPath + '.avo-claude-backup', backup)
    const result = run(pkg, project, home, ['setup'])
    expect(result.status).toBe(1)
    expect(fs.readFileSync(projectSettingsPath)).toEqual(projectSettings)
    expect(fs.readFileSync(projectSettingsPath + '.avo-claude-backup')).toEqual(backup)
    expect(fs.existsSync(path.join(home, '.claude', 'office-status-hook.js'))).toBe(false)
  })

  it('preserves an unknown installed Claude script and its settings on setup', () => {
    const pkg = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const script = path.join(claude, 'office-status-hook.js')
    const custom = Buffer.from('#!/usr/bin/env node\nprocess.exit(0)\n')
    const settings = Buffer.from('{"hooks":{"PreToolUse":[]}}')
    fs.writeFileSync(script, custom)
    fs.writeFileSync(path.join(claude, 'settings.json'), settings)
    const result = run(pkg, project, home, ['setup'])
    expect(result.status).toBe(1)
    expect(fs.readFileSync(script)).toEqual(custom)
    expect(fs.readFileSync(path.join(claude, 'settings.json'))).toEqual(settings)
  })

  it('refreshes a versioned AVO Claude script with a verified backup', () => {
    const pkg = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const script = path.join(claude, 'office-status-hook.js')
    const old = Buffer.from('#!/usr/bin/env node\n/**\n * Agent Virtual Office — Claude Code Hook\n */\nconst HOOK_ID = \'agent-virtual-office/claude-hook\'\nconst HOOK_VERSION = \'1.0.0\'\n')
    fs.writeFileSync(script, old)
    const result = run(pkg, project, home, ['setup'])
    expect(result.status, result.stderr).toBe(0)
    expect(fs.readFileSync(script)).toEqual(fs.readFileSync(path.join(pkg, 'public', 'hooks', 'office-status-hook.js')))
    expect(fs.readFileSync(script + '.avo-claude-backup')).toEqual(old)
  })

  it('requires the nominated exact SHA-256 before migrating a recognizable legacy Claude hook', () => {
    const pkg = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const script = path.join(claude, 'office-status-hook.js')
    const legacy = Buffer.from('#!/usr/bin/env node\n/**\n * Agent Virtual Office — Claude Code Hook\n */\nconst HOOK_VERSION = \'1.0.0\'\n')
    fs.writeFileSync(script, legacy)
    const noHash = run(pkg, project, home, ['setup'])
    expect(noHash.status).toBe(1)
    expect(fs.readFileSync(script)).toEqual(legacy)
    const wrongHash = run(pkg, project, home, ['setup', '--migrate-legacy-claude=' + '0'.repeat(64)])
    expect(wrongHash.status).toBe(1)
    expect(fs.readFileSync(script)).toEqual(legacy)
    const sha256 = crypto.createHash('sha256').update(legacy).digest('hex')
    const migrated = run(pkg, project, home, ['setup', `--migrate-legacy-claude=${sha256}`])
    expect(migrated.status, migrated.stderr).toBe(0)
    expect(fs.readFileSync(script)).toEqual(fs.readFileSync(path.join(pkg, 'public', 'hooks', 'office-status-hook.js')))
    expect(fs.readFileSync(script + '.avo-claude-backup')).toEqual(legacy)
  })

  it('recognizes CRLF Claude hook headers while hashing and backing up exact raw bytes', () => {
    const pkg = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const script = path.join(claude, 'office-status-hook.js')
    const legacy = Buffer.from('#!/usr/bin/env node\r\n/**\r\n * Agent Virtual Office — Claude Code Hook\r\n */\r\nconst HOOK_VERSION = \'1.0.0\'\r\n')
    fs.writeFileSync(script, legacy)
    const sha256 = crypto.createHash('sha256').update(legacy).digest('hex')
    const migrated = run(pkg, project, home, ['setup', `--migrate-legacy-claude=${sha256}`])
    expect(migrated.status, migrated.stderr).toBe(0)
    expect(fs.readFileSync(script + '.avo-claude-backup')).toEqual(legacy)

    const currentHome = temp('avo-claude-current-home-')
    const currentClaude = path.join(currentHome, '.claude')
    fs.mkdirSync(currentClaude, { recursive: true })
    const currentScript = path.join(currentClaude, 'office-status-hook.js')
    const current = Buffer.from('#!/usr/bin/env node\r\n/**\r\n * Agent Virtual Office — Claude Code Hook\r\n */\r\nconst HOOK_ID = \'agent-virtual-office/claude-hook\'\r\nconst HOOK_VERSION = \'1.0.0\'\r\n')
    fs.writeFileSync(currentScript, current)
    const refreshed = run(pkg, project, currentHome, ['setup'])
    expect(refreshed.status, refreshed.stderr).toBe(0)
    expect(fs.readFileSync(currentScript + '.avo-claude-backup')).toEqual(current)
    expect(fs.readFileSync(currentScript)).toEqual(fs.readFileSync(path.join(pkg, 'public', 'hooks', 'office-status-hook.js')))
  })

  it('preserves legacy and prior-version backups across a legitimate Claude upgrade', () => {
    const v1 = packageRoot(), v2 = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    for (const pkg of [v1, v2]) fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const v2Source = path.join(v2, 'public', 'hooks', 'office-status-hook.js')
    const v1Bytes = fs.readFileSync(path.join(v1, 'public', 'hooks', 'office-status-hook.js'))
    fs.writeFileSync(v2Source, fs.readFileSync(v2Source, 'utf8').replace("HOOK_VERSION = '1.1.0'", "HOOK_VERSION = '1.2.0'"))
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const script = path.join(claude, 'office-status-hook.js')
    const legacy = Buffer.from('#!/usr/bin/env node\r\n/**\r\n * Agent Virtual Office — Claude Code Hook\r\n */\r\nconst HOOK_VERSION = \'1.0.0\'\r\n')
    fs.writeFileSync(script, legacy)
    const hash = crypto.createHash('sha256').update(legacy).digest('hex')
    const migrated = run(v1, project, home, ['setup', `--migrate-legacy-claude=${hash}`])
    expect(migrated.status, migrated.stderr).toBe(0)
    expect(fs.readFileSync(script)).toEqual(v1Bytes)
    const updated = run(v2, project, home, ['setup'])
    expect(updated.status, updated.stderr).toBe(0)
    const v1Backup = script + `.avo-claude-backup.${crypto.createHash('sha256').update(v1Bytes).digest('hex')}`
    expect(fs.readFileSync(script)).toEqual(fs.readFileSync(v2Source))
    expect(fs.readFileSync(script + '.avo-claude-backup')).toEqual(legacy)
    expect(fs.readFileSync(v1Backup)).toEqual(v1Bytes)
  })

  it('rolls back only the newly created version backup when later setup migration fails', () => {
    const v1 = packageRoot(), v2 = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    for (const pkg of [v1, v2]) fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const v2Source = path.join(v2, 'public', 'hooks', 'office-status-hook.js')
    fs.writeFileSync(v2Source, fs.readFileSync(v2Source, 'utf8').replace("HOOK_VERSION = '1.1.0'", "HOOK_VERSION = '1.2.0'"))
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const script = path.join(claude, 'office-status-hook.js')
    const legacy = Buffer.from('#!/usr/bin/env node\n/**\n * Agent Virtual Office — Claude Code Hook\n */\nconst HOOK_VERSION = \'1.0.0\'\n')
    fs.writeFileSync(script, legacy)
    const migrated = run(v1, project, home, ['setup', `--migrate-legacy-claude=${crypto.createHash('sha256').update(legacy).digest('hex')}`])
    expect(migrated.status, migrated.stderr).toBe(0)
    const v1Bytes = fs.readFileSync(script)
    const versionBackup = script + `.avo-claude-backup.${crypto.createHash('sha256').update(v1Bytes).digest('hex')}`

    const projectSettingsPath = path.join(project, '.claude', 'settings.json')
    fs.mkdirSync(path.dirname(projectSettingsPath), { recursive: true })
    const projectSettings = Buffer.from(JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
      { type: 'command', command: 'node public/hooks/office-status-hook.js' },
    ] }] } }, null, 2))
    fs.writeFileSync(projectSettingsPath, projectSettings)
    const mismatchedBackup = Buffer.from('{"hooks":{}}\n')
    fs.writeFileSync(projectSettingsPath + '.avo-claude-backup', mismatchedBackup)
    const failed = run(v2, project, home, ['setup'])
    expect(failed.status).toBe(1)
    expect(fs.readFileSync(script)).toEqual(v1Bytes)
    expect(fs.readFileSync(script + '.avo-claude-backup')).toEqual(legacy)
    expect(fs.existsSync(versionBackup)).toBe(false)
    expect(fs.readFileSync(projectSettingsPath)).toEqual(projectSettings)
    expect(fs.readFileSync(projectSettingsPath + '.avo-claude-backup')).toEqual(mismatchedBackup)
  })

  it('does not let a matching nominated hash overwrite a non-AVO Claude script', () => {
    const pkg = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const script = path.join(claude, 'office-status-hook.js')
    const custom = Buffer.from('#!/usr/bin/env node\nprocess.exit(0)\n')
    fs.writeFileSync(script, custom)
    const sha256 = crypto.createHash('sha256').update(custom).digest('hex')
    const result = run(pkg, project, home, ['setup', `--migrate-legacy-claude=${sha256}`])
    expect(result.status).toBe(1)
    expect(fs.readFileSync(script)).toEqual(custom)
    expect(fs.existsSync(script + '.avo-claude-backup')).toBe(false)
  })

  it('refuses a valid non-object Claude settings root without installing a script', () => {
    const pkg = packageRoot(), project = temp('avo-claude-project-'), home = temp('avo-claude-home-')
    fs.copyFileSync(path.join(repoRoot, 'public', 'hooks', 'office-status-hook.js'), path.join(pkg, 'public', 'hooks', 'office-status-hook.js'))
    const claude = path.join(home, '.claude')
    fs.mkdirSync(claude, { recursive: true })
    const settings = Buffer.from('null\n')
    fs.writeFileSync(path.join(claude, 'settings.json'), settings)
    const result = run(pkg, project, home, ['setup'])
    expect(result.status).toBe(1)
    expect(fs.readFileSync(path.join(claude, 'settings.json'))).toEqual(settings)
    expect(fs.existsSync(path.join(claude, 'office-status-hook.js'))).toBe(false)
  })

  it('rejects Codex hooks inside edited matcher/policy groups and preserves them on uninstall', () => {
    const pkg = packageRoot(), project = temp('avo-project-'), home = temp('avo-home-')
    expect(run(pkg, project, home, ['setup', '--platform', 'codex']).status).toBe(0)
    const settingsPath = path.join(project, '.codex', 'hooks.json')
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    settings.hooks.PreToolUse[0].matcher = 'Bash'
    settings.hooks.PreToolUse[0].policy = 'preserve-me'
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    const edited = fs.readFileSync(settingsPath)
    const retry = run(pkg, project, home, ['setup', '--platform', 'codex'])
    expect(retry.status).toBe(1)
    expect(fs.readFileSync(settingsPath)).toEqual(edited)
    const uninstall = run(pkg, project, home, ['uninstall', '--platform', 'codex'])
    expect(uninstall.status, uninstall.stderr).toBe(0)
    const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    expect(after.hooks.PreToolUse[0].matcher).toBe('Bash')
    expect(after.hooks.PreToolUse[0].policy).toBe('preserve-me')
    expect(after.hooks.PreToolUse[0].hooks[0].command).toContain('office-status-codex-hook.js')
    expect(fs.existsSync(path.join(project, '.codex', 'hooks', 'office-status-codex-hook.js'))).toBe(true)
    expect(fs.existsSync(path.join(project, '.codex', 'hooks', 'office-status-codex.js'))).toBe(true)
  })
})
