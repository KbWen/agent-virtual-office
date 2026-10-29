#!/usr/bin/env node

const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

const root = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const command = args[0]

// Both servers are spawned with `cwd: root` so Vite can resolve its own config and sources.
// That makes their process.cwd() the package directory — under `npx` the npx cache — while
// the hooks stamp each session file with the real project directory. Without forwarding the
// invoking cwd, every hook file looks foreign and is filtered out, leaving only file-watcher
// fallback data (`source: 'file-watcher'`, `_hint: 'no-hooks'`). This process is never
// chdir'd, so its cwd is still the directory the user launched us from. An explicitly set
// OFFICE_PROJECT_ROOT wins, so multi-worktree setups can point the office at one root.
// Reported by @whoffmandesign (#201).
function childEnv() {
  return { ...process.env, OFFICE_PROJECT_ROOT: process.env.OFFICE_PROJECT_ROOT || process.cwd() }
}

// 2026-09-26 audit finding 6: `setup`'s atomic write (tmp + renameSync) used to target
// `settingsPath` directly. On POSIX, renaming a file ONTO a path that is itself a symlink
// replaces the symlink with a regular file — silently breaking any dotfile-symlink setup
// (chezmoi, GNU stow, etc.) that points `~/.claude/settings.json` somewhere else. Resolve
// through the symlink first so the write lands on its target instead. Non-symlink paths
// (the common case) are returned unchanged — this never throws.
function resolveWriteTarget(p) {
  try {
    if (fs.lstatSync(p).isSymbolicLink()) return fs.realpathSync(p)
  } catch { /* doesn't exist yet, or lstat failed — write to the path as given */ }
  return p
}

// Shared atomic-write helper for both `setup` and `uninstall`'s settings.json rewrite.
// Resolves a symlinked target first (see resolveWriteTarget), then tmp-write + rename, with a
// direct-write fallback for the rare rename failure (e.g. Windows EBUSY). NEVER throws;
// returns true on success.
function atomicWriteSettings(settingsPath, contents) {
  const target = resolveWriteTarget(settingsPath)
  const tmp = target + '.tmp.' + process.pid + '.' +
    (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
  try {
    fs.writeFileSync(tmp, contents)
    fs.renameSync(tmp, target)
    return true
  } catch {
    try { fs.unlinkSync(tmp) } catch {}
    try { fs.writeFileSync(target, contents); return true } catch { return false }
  }
}

const GEMINI_EVENTS = ['BeforeAgent', 'BeforeTool', 'AfterTool', 'AfterAgent', 'Notification', 'SessionEnd']
const GEMINI_HOOK_TIMEOUT = 2000
const GEMINI_HOOK_DESCRIPTION = 'Publish private Agent Virtual Office status from Gemini CLI.'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function shellQuotePowerShell(value) {
  return "'" + value.replace(/'/g, "''") + "'"
}

function shellQuotePosix(value) {
  return "'" + value.replace(/'/g, "'\\''") + "'"
}

function geminiHookCommand(scriptPath) {
  if (process.platform === 'win32') {
    return `& ${shellQuotePowerShell(process.execPath)} ${shellQuotePowerShell(scriptPath)}`
  }
  return `${shellQuotePosix(process.execPath)} ${shellQuotePosix(scriptPath)}`
}

function readGeminiSettings(settingsPath) {
  let settings = {}
  let exists = false
  try {
    fs.lstatSync(settingsPath)
    exists = true
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error
  }
  if (exists) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    if (!isPlainObject(settings)) throw new Error('settings.json root must be an object')
  }
  if (settings.hooks !== undefined && !isPlainObject(settings.hooks)) {
    throw new Error('settings.json hooks must be an object')
  }
  for (const event of GEMINI_EVENTS) {
    if (settings.hooks && settings.hooks[event] !== undefined && !Array.isArray(settings.hooks[event])) {
      throw new Error(`settings.json hooks.${event} must be an array`)
    }
  }
  return { settings, exists }
}

function geminiOwnedHookName(event) {
  return `avo-office-status-gemini-${event}`
}

function geminiHookConfig(event, command) {
  return {
    name: geminiOwnedHookName(event),
    type: 'command',
    command,
    timeout: GEMINI_HOOK_TIMEOUT,
    description: GEMINI_HOOK_DESCRIPTION,
  }
}

function hasExactKeys(value, expectedKeys) {
  return isPlainObject(value) && Object.keys(value).length === expectedKeys.length &&
    expectedKeys.every(key => Object.prototype.hasOwnProperty.call(value, key))
}

function isGeminiOwnedHook(hook, event, command) {
  return hasExactKeys(hook, ['name', 'type', 'command', 'timeout', 'description']) &&
    hook.name === geminiOwnedHookName(event) &&
    hook.type === 'command' && hook.command === command &&
    hook.timeout === GEMINI_HOOK_TIMEOUT && hook.description === GEMINI_HOOK_DESCRIPTION
}

function isGeminiOwnedGroup(group, event, command) {
  return hasExactKeys(group, ['matcher', 'hooks']) && group.matcher === '*' &&
    Array.isArray(group.hooks) && group.hooks.some(hook => isGeminiOwnedHook(hook, event, command))
}

function hasEditedGeminiRegistration(settings, command) {
  if (!settings.hooks) return false
  return GEMINI_EVENTS.some(event => (settings.hooks[event] || []).some(group =>
    isPlainObject(group) && Array.isArray(group.hooks) && group.hooks.some(hook =>
      isPlainObject(hook) && hook.name === geminiOwnedHookName(event) &&
      (!isGeminiOwnedHook(hook, event, command) || !isGeminiOwnedGroup(group, event, command)),
    ),
  ))
}

function mergeGeminiHook(settings, event, hookConfig) {
  if (!settings.hooks) settings.hooks = {}
  const groups = settings.hooks[event] || []
  const name = hookConfig.name
  let inserted = false
  const merged = []

  for (const group of groups) {
    if (!isPlainObject(group) || !Array.isArray(group.hooks)) {
      merged.push(group)
      continue
    }
    const owned = isGeminiOwnedGroup(group, event, hookConfig.command)
    if (!owned) {
      merged.push(group)
      continue
    }
    const remainingHooks = []
    for (const hook of group.hooks) {
      if (isGeminiOwnedHook(hook, event, hookConfig.command)) {
        if (!inserted) {
          remainingHooks.push({ ...hook, ...hookConfig, name })
          inserted = true
        }
      } else {
        remainingHooks.push(hook)
      }
    }
    if (remainingHooks.length) merged.push({ ...group, hooks: remainingHooks })
  }
  if (!inserted) merged.push({ matcher: '*', hooks: [hookConfig] })
  settings.hooks[event] = merged
}

function removeGeminiHooks(settings, command) {
  if (!settings.hooks) return
  for (const event of GEMINI_EVENTS) {
    const groups = settings.hooks[event]
    if (!Array.isArray(groups)) continue
    const kept = []
    for (const group of groups) {
      if (!isPlainObject(group) || !Array.isArray(group.hooks)) {
        kept.push(group)
        continue
      }
      const hooks = group.hooks.filter(hook => !isGeminiOwnedGroup(group, event, command) ||
        !isGeminiOwnedHook(hook, event, command))
      if (hooks.length) kept.push(hooks.length === group.hooks.length ? group : { ...group, hooks })
    }
    if (kept.length) settings.hooks[event] = kept
    else delete settings.hooks[event]
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks
}

function hasGeminiScriptReference(settings, scriptPath) {
  if (!settings.hooks) return false
  return Object.values(settings.hooks).some(groups => Array.isArray(groups) && groups.some(group =>
    isPlainObject(group) && Array.isArray(group.hooks) && group.hooks.some(hook =>
      isPlainObject(hook) && typeof hook.command === 'string' && hook.command.includes(scriptPath),
    ),
  ))
}

function atomicWriteGeminiSettings(target, contents) {
  const tmp = target + '.tmp.' + process.pid + '.' +
    (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
  try {
    fs.writeFileSync(tmp, contents)
    fs.renameSync(tmp, target)
    return true
  } catch {
    try { fs.unlinkSync(tmp) } catch {}
    return false
  }
}

function parsePlatformSelector(argv) {
  const equalsArg = argv.find(arg => arg.startsWith('--platform='))
  const flagIndex = argv.indexOf('--platform')
  if (equalsArg) return { selected: true, value: equalsArg.slice('--platform='.length) }
  if (flagIndex !== -1) return { selected: true, value: argv[flagIndex + 1] }
  return { selected: false, value: undefined }
}

const CODEX_EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'Stop', 'SessionEnd']
const CODEX_HOOK_TIMEOUT_SECONDS = 2
const CLAUDE_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'Stop', 'PermissionDenied', 'StopFailure', 'PermissionRequest', 'SessionEnd']

function exactClaudeCommand(command, hookDest) {
  if (typeof command !== 'string') return false
  const normalized = command.replace(/\\/g, '/')
  const normalizedPath = hookDest.replace(/\\/g, '/')
  const current = `node "${normalizedPath}"`
  const bare = `node ${normalizedPath}`
  const legacy = 'node public/hooks/office-status-hook.js'
  const safeBarePath = /^[A-Za-z0-9_./:\\-]+$/.test(normalizedPath)
  return normalized === current || (safeBarePath && normalized === bare) || command === legacy
}

function claudeHookIdentity(contents) {
  const source = (Buffer.isBuffer(contents) ? contents.toString('utf8') : String(contents)).replace(/\r\n/g, '\n')
  const hasHeader = source.startsWith('#!/usr/bin/env node\n/**\n * Agent Virtual Office — Claude Code Hook')
  const hasId = /(?:const|var|let) HOOK_ID\s*=\s*['"]agent-virtual-office\/claude-hook['"]/.test(source)
  const version = source.match(/(?:const|var|let) HOOK_VERSION\s*=\s*['"]([0-9]+\.[0-9]+\.[0-9]+)['"]/)?.[1]
  return hasHeader && hasId && version ? { id: 'agent-virtual-office/claude-hook', version } : null
}

function claudeLegacyHookIdentity(contents) {
  const source = (Buffer.isBuffer(contents) ? contents.toString('utf8') : String(contents)).replace(/\r\n/g, '\n')
  const hasHeader = source.startsWith('#!/usr/bin/env node\n/**\n * Agent Virtual Office — Claude Code Hook')
  const hasVersion = /(?:const|var|let) HOOK_VERSION\s*=\s*['"]([0-9]+\.[0-9]+\.[0-9]+)['"]/.test(source)
  const hasStableId = /(?:const|var|let) HOOK_ID\s*=/.test(source)
  return hasHeader && hasVersion && !hasStableId
}

function validateProjectClaudeSettings(projectRoot) {
  const file = path.join(projectRoot, '.claude', 'settings.json')
  let stat
  try { stat = fs.lstatSync(file) } catch (error) {
    if (error && error.code === 'ENOENT') return
    throw new Error('cannot inspect project Claude settings safely')
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe project Claude settings path')
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!isPlainObject(settings) || (settings.hooks !== undefined && !isPlainObject(settings.hooks))) {
    throw new Error('unsupported project Claude settings structure')
  }
  if (settings.hooks) for (const event of CLAUDE_EVENTS) {
    if (settings.hooks[event] !== undefined && !Array.isArray(settings.hooks[event])) {
      throw new Error('unsupported project Claude event structure')
    }
  }
}

function writeClaudeHookSafely(source, destination, nominatedLegacyHash) {
  const backup = destination + '.avo-claude-backup'
  let existing = null
  try {
    const stat = fs.lstatSync(destination)
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('unsafe Claude hook path')
    existing = fs.readFileSync(destination)
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error
  }
  if (existing && existing.equals(source)) return { action: 'up-to-date', previous: existing, backupCreatedPath: null, backupPath: null }
  const currentOwned = existing && claudeHookIdentity(existing)
  const nominatedHashValid = typeof nominatedLegacyHash === 'string' && /^[a-f0-9]{64}$/i.test(nominatedLegacyHash) &&
    require('node:crypto').createHash('sha256').update(existing || Buffer.alloc(0)).digest('hex') === nominatedLegacyHash.toLowerCase()
  const nominatedLegacy = existing && nominatedHashValid && claudeLegacyHookIdentity(existing)
  if (existing && !currentOwned && !nominatedLegacy) throw new Error('existing Claude hook is not verifiably AVO-owned')
  let createdBackupPath = null
  let backupPath = null
  if (existing) {
    let baseBackupExists = false
    try {
      const stat = fs.lstatSync(backup)
      baseBackupExists = true
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe Claude hook backup')
      if (fs.readFileSync(backup).equals(existing)) backupPath = backup
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
    if (baseBackupExists && !backupPath) {
      if (!currentOwned) throw new Error('Claude hook backup does not match the nominated legacy bytes')
      const versionBackup = `${backup}.${require('node:crypto').createHash('sha256').update(existing).digest('hex')}`
      try {
        const stat = fs.lstatSync(versionBackup)
        if (!stat.isFile() || stat.isSymbolicLink() || !fs.readFileSync(versionBackup).equals(existing)) {
          throw new Error('Claude hook version backup does not match the prior installed bytes')
        }
        backupPath = versionBackup
      } catch (error) {
        if (!error || error.code !== 'ENOENT') throw error
        fs.copyFileSync(destination, versionBackup, fs.constants.COPYFILE_EXCL)
        createdBackupPath = versionBackup
        if (!fs.readFileSync(versionBackup).equals(existing)) throw new Error('Claude hook version backup verification failed')
        backupPath = versionBackup
      }
    } else if (!backupPath) {
      fs.copyFileSync(destination, backup, fs.constants.COPYFILE_EXCL)
      createdBackupPath = backup
      if (!fs.readFileSync(backup).equals(existing)) throw new Error('Claude hook backup verification failed')
      backupPath = backup
    }
  }
  const temp = `${destination}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`
  try {
    fs.writeFileSync(temp, source, { flag: 'wx', mode: 0o600 })
    fs.renameSync(temp, destination)
    if (!fs.readFileSync(destination).equals(source)) throw new Error('Claude hook verification failed')
  } catch (error) {
    try { fs.unlinkSync(temp) } catch {}
    if (existing) { try { fs.writeFileSync(destination, existing) } catch {} }
    else { try { fs.unlinkSync(destination) } catch {} }
    if (createdBackupPath) { try { fs.unlinkSync(createdBackupPath) } catch {} }
    throw error
  }
  return { action: existing ? 'updated' : 'installed', previous: existing, backupCreatedPath: createdBackupPath, backupPath }
}

function rollbackClaudeHook(destination, previous, backupCreatedPath) {
  try {
    if (previous) fs.writeFileSync(destination, previous)
    else fs.unlinkSync(destination)
  } catch {}
  if (backupCreatedPath) { try { fs.unlinkSync(backupCreatedPath) } catch {} }
}

function removeKnownProjectClaudeHooks(projectRoot) {
  const file = path.join(projectRoot, '.claude', 'settings.json')
  let stat
  try { stat = fs.lstatSync(file) } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw new Error('cannot inspect project Claude settings safely')
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe project Claude settings path')
  let original
  try { original = fs.readFileSync(file) } catch { throw new Error('cannot read project Claude settings safely') }
  const settings = JSON.parse(original.toString('utf8'))
  if (!isPlainObject(settings) || (settings.hooks !== undefined && !isPlainObject(settings.hooks))) {
    throw new Error('unsupported project Claude settings structure')
  }
  let changed = false
  if (settings.hooks) for (const event of CLAUDE_EVENTS) {
    const groups = settings.hooks[event]
    if (groups === undefined) continue
    if (!Array.isArray(groups)) throw new Error('unsupported project Claude event structure')
    const kept = []
    for (const group of groups) {
      if (!isPlainObject(group) || !Array.isArray(group.hooks)) { kept.push(group); continue }
      const hooks = group.hooks.filter(hook => !(isPlainObject(hook) && hook.type === 'command' && exactClaudeCommand(hook.command, path.join(projectRoot, '.claude', 'office-status-hook.js'))))
      if (hooks.length !== group.hooks.length) changed = true
      if (hooks.length) kept.push(hooks.length === group.hooks.length ? group : { ...group, hooks })
    }
    if (kept.length) settings.hooks[event] = kept
    else delete settings.hooks[event]
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks
  if (!changed) return null
  const backup = file + '.avo-claude-backup'
  let backupCreated = false
  if (fs.existsSync(backup)) {
    const stat = fs.lstatSync(backup)
    if (!stat.isFile() || stat.isSymbolicLink() || !fs.readFileSync(backup).equals(original)) {
      throw new Error('project Claude backup does not match the pre-migration settings')
    }
  } else {
    fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL)
    backupCreated = true
    if (!fs.readFileSync(backup).equals(original)) {
      try { fs.unlinkSync(backup) } catch {}
      throw new Error('project Claude backup verification failed')
    }
  }
  if (!atomicWriteSettings(file, JSON.stringify(settings, null, 2))) {
    try { fs.writeFileSync(file, original) } catch {}
    if (backupCreated) { try { fs.unlinkSync(backup) } catch {} }
    throw new Error('cannot update project Claude settings')
  }
  return { file, original, backup }
}

function codexHookCommand(scriptPath) {
  if (process.platform === 'win32') {
    return `& ${shellQuotePowerShell(process.execPath)} ${shellQuotePowerShell(scriptPath)}`
  }
  return `${shellQuotePosix(process.execPath)} ${shellQuotePosix(scriptPath)}`
}

function readCodexHooks(file) {
  let settings = {}
  let exists = false
  try { fs.lstatSync(file); exists = true } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error
  }
  if (exists) {
    const stat = fs.lstatSync(file)
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('unsafe hooks.json path')
    settings = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!isPlainObject(settings)) throw new Error('hooks.json root must be an object')
  }
  if (settings.hooks !== undefined && !isPlainObject(settings.hooks)) throw new Error('hooks.json hooks must be an object')
  for (const event of CODEX_EVENTS) {
    if (settings.hooks?.[event] !== undefined && !Array.isArray(settings.hooks[event])) {
      throw new Error(`hooks.json hooks.${event} must be an array`)
    }
  }
  return { settings, exists }
}

function codexOwnedEntry(hook, command) {
  return hasExactKeys(hook, ['type', 'command', 'timeout']) && hook.type === 'command' &&
    hook.command === command && hook.timeout === CODEX_HOOK_TIMEOUT_SECONDS
}

function codexOwnedGroupShape(group) {
  return isPlainObject(group) && Array.isArray(group.hooks) &&
    (hasExactKeys(group, ['hooks']) || (hasExactKeys(group, ['matcher', 'hooks']) && group.matcher === '*'))
}

function hasEditedCodexRegistration(settings, command) {
  if (!settings.hooks) return false
  return CODEX_EVENTS.some(event => (settings.hooks[event] || []).some(group =>
    isPlainObject(group) && Array.isArray(group.hooks) && group.hooks.some(hook =>
      isPlainObject(hook) && typeof hook.command === 'string' &&
      hook.command.includes('office-status-codex-hook.js') &&
      (!codexOwnedEntry(hook, command) || !codexOwnedGroupShape(group)),
    ),
  ))
}

function mergeCodexRegistration(settings, event, command) {
  if (!settings.hooks) settings.hooks = {}
  const groups = settings.hooks[event] || []
  let inserted = false
  const merged = []
  for (const group of groups) {
    if (!isPlainObject(group) || !Array.isArray(group.hooks)) { merged.push(group); continue }
    const matching = group.hooks.some(hook => codexOwnedEntry(hook, command))
    if (!matching || !codexOwnedGroupShape(group)) { merged.push(group); continue }
    const hooks = []
    for (const hook of group.hooks) {
      if (!codexOwnedEntry(hook, command)) { hooks.push(hook); continue }
      if (!inserted) {
        hooks.push({ type: 'command', command, timeout: CODEX_HOOK_TIMEOUT_SECONDS })
        inserted = true
      }
    }
    if (hooks.length) merged.push({ ...group, hooks })
  }
  if (!inserted) merged.push({ hooks: [{ type: 'command', command, timeout: CODEX_HOOK_TIMEOUT_SECONDS }] })
  settings.hooks[event] = merged
}

function removeCodexRegistrations(settings, command) {
  if (!settings.hooks) return
  for (const event of CODEX_EVENTS) {
    const groups = settings.hooks[event]
    if (!Array.isArray(groups)) continue
    const kept = []
    for (const group of groups) {
      if (!isPlainObject(group) || !Array.isArray(group.hooks)) { kept.push(group); continue }
      const hooks = codexOwnedGroupShape(group) ? group.hooks.filter(hook => !codexOwnedEntry(hook, command)) : group.hooks
      if (hooks.length) kept.push(hooks.length === group.hooks.length ? group : { ...group, hooks })
    }
    if (kept.length) settings.hooks[event] = kept
    else delete settings.hooks[event]
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks
}

function writeCodexHooks(file, contents) {
  const temp = `${file}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`
  try {
    fs.writeFileSync(temp, contents, { flag: 'wx' })
    fs.renameSync(temp, file)
    return true
  } catch {
    try { fs.unlinkSync(temp) } catch {}
    return false
  }
}

function codexHash(bytes) {
  return require('node:crypto').createHash('sha256').update(bytes).digest('hex')
}

function stageCodexFile(destination, contents) {
  const temp = `${destination}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 10)}`
  try {
    fs.writeFileSync(temp, contents, { flag: 'wx', mode: 0o600 })
    return temp
  } catch (error) {
    try { fs.unlinkSync(temp) } catch {}
    throw error
  }
}

function commitCodexFile(temp, destination, replace) {
  if (replace) fs.renameSync(temp, destination)
  else {
    // linkSync is an atomic no-clobber commit on the same filesystem.
    fs.linkSync(temp, destination)
    fs.unlinkSync(temp)
  }
  return true
}

function readCodexOwnership(manifestPath) {
  try {
    const stat = fs.lstatSync(manifestPath)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe ownership metadata')
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const allowedKeys = ['version', 'files', 'settingsBackupHash']
    if (!isPlainObject(parsed) || Object.keys(parsed).some(key => !allowedKeys.includes(key)) ||
        !Object.prototype.hasOwnProperty.call(parsed, 'version') || !Object.prototype.hasOwnProperty.call(parsed, 'files') ||
        parsed.version !== 1 || !isPlainObject(parsed.files) ||
        (parsed.settingsBackupHash !== undefined && parsed.settingsBackupHash !== null && !/^[a-f0-9]{64}$/.test(parsed.settingsBackupHash)) ||
        Object.keys(parsed.files).some(name => !['office-status-codex-hook.js', 'office-status-codex.js'].includes(name) || !/^[a-f0-9]{64}$/.test(parsed.files[name]))) {
      throw new Error('invalid ownership metadata')
    }
    return { exists: true, parsed, bytes: fs.readFileSync(manifestPath) }
  } catch (error) {
    if (error && error.code === 'ENOENT') return { exists: false, parsed: { version: 1, files: {} }, bytes: null }
    throw error
  }
}

function hasCodexScriptReference(settings, scriptPath) {
  if (!settings.hooks) return false
  const normalized = scriptPath.replace(/\\/g, '/')
  return Object.values(settings.hooks).some(groups => Array.isArray(groups) && groups.some(group =>
    isPlainObject(group) && Array.isArray(group.hooks) && group.hooks.some(hook => {
      if (!isPlainObject(hook) || typeof hook.command !== 'string') return false
      const command = hook.command.replace(/\\/g, '/')
      return process.platform === 'win32'
        ? command.toLowerCase().includes(normalized.toLowerCase())
        : command.includes(normalized)
    }),
  ))
}

function runCodexProjectCommand(action) {
  const projectRoot = process.cwd()
  const codexDir = path.join(projectRoot, '.codex')
  const hooksDir = path.join(codexDir, 'hooks')
  const settingsPath = path.join(codexDir, 'hooks.json')
  const hookDest = path.join(hooksDir, 'office-status-codex-hook.js')
  const helperDest = path.join(hooksDir, 'office-status-codex.js')
  const ownershipPath = path.join(hooksDir, '.avo-codex-owned.json')
  const settingsBackup = settingsPath + '.avo-codex-backup'
  let hooksDirExisted = false
  for (const directory of [codexDir, hooksDir]) {
    try {
      const stat = fs.lstatSync(directory)
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        console.error('  Error: Refusing an unsafe Codex hook directory; no project files were changed.')
        process.exit(1)
      }
      if (directory === hooksDir) hooksDirExisted = true
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        console.error('  Error: Cannot safely inspect a Codex hook directory; no project files were changed.')
        process.exit(1)
      }
    }
  }
  const sources = ['office-status-codex-hook.js', 'office-status-codex.js'].map(name =>
    fs.readFileSync(path.join(root, 'public', 'hooks', name)),
  )
  let parsed
  try { parsed = readCodexHooks(settingsPath) } catch {
    console.error('  Error: Cannot safely read .codex/hooks.json (invalid JSON or unsupported structure).')
    console.error('  No project files were changed.')
    process.exit(1)
  }
  const command = codexHookCommand(hookDest)
  if (action === 'setup' && hasEditedCodexRegistration(parsed.settings, command)) {
    console.error('  Error: An AVO Codex hook entry was edited; it was preserved.')
    console.error('  Restore the AVO entry before retrying setup.')
    process.exit(1)
  }
  const destinations = [hookDest, helperDest]
  const names = ['office-status-codex-hook.js', 'office-status-codex.js']
  let ownership
  try { ownership = readCodexOwnership(ownershipPath) } catch {
    console.error('  Error: Codex ownership metadata is invalid or unsafe; no project files were changed.')
    process.exit(1)
  }
  const existed = []
  const priorBytes = []
  const owned = []
  for (let i = 0; i < destinations.length; i++) {
    try {
      const stat = fs.lstatSync(destinations[i])
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('unsafe hook path')
      existed[i] = true
      priorBytes[i] = fs.readFileSync(destinations[i])
      owned[i] = ownership.parsed.files[names[i]] === codexHash(priorBytes[i])
      if (action === 'setup' && !priorBytes[i].equals(sources[i]) && !owned[i]) {
        console.error('  Error: An installed Codex hook differs from its recorded owned version; it was preserved.')
        process.exit(1)
      }
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        console.error('  Error: Cannot safely inspect a Codex hook path; no project files were changed.')
        process.exit(1)
      }
      existed[i] = false
    }
  }
  if (action === 'setup' && parsed.exists && fs.existsSync(settingsBackup)) {
    // Existing backup is retained; it is the rollback point from the first successful install.
  }
  if (action === 'setup') for (const event of CODEX_EVENTS) mergeCodexRegistration(parsed.settings, event, command)
  else removeCodexRegistrations(parsed.settings, command)
  const updated = JSON.stringify(parsed.settings, null, 2)
  const oldBytes = parsed.exists ? fs.readFileSync(settingsPath) : null
  const settingsChanged = action === 'setup' || (parsed.exists && JSON.stringify(JSON.parse(oldBytes.toString('utf8'))) !== JSON.stringify(parsed.settings))
  let settingsBackupHash = ownership.parsed.settingsBackupHash
  if (action === 'setup') {
    let backupBytes = null
    try {
      const stat = fs.lstatSync(settingsBackup)
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe Codex settings backup')
      backupBytes = fs.readFileSync(settingsBackup)
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        console.error('  Error: Codex settings backup is unsafe; no project files were changed.')
        process.exit(1)
      }
    }
    if (ownership.exists && settingsBackupHash === null) {
      if (backupBytes) {
        console.error('  Error: Unexpected Codex settings backup; no project files were changed.')
        process.exit(1)
      }
    } else if (ownership.exists && settingsBackupHash) {
      if (!backupBytes || codexHash(backupBytes) !== settingsBackupHash) {
        console.error('  Error: Codex settings backup does not match recorded ownership; no project files were changed.')
        process.exit(1)
      }
    } else if (backupBytes) {
      if (!parsed.exists || !backupBytes.equals(oldBytes)) {
        console.error('  Error: Existing Codex settings backup does not match the pre-install settings; no project files were changed.')
        process.exit(1)
      }
      settingsBackupHash = codexHash(backupBytes)
    } else if (!ownership.exists && parsed.exists) {
      settingsBackupHash = codexHash(oldBytes)
    } else if (!ownership.exists) {
      settingsBackupHash = null
    } else if (settingsBackupHash === undefined) {
      settingsBackupHash = null
    }
  }
  const installed = []
  let createdBackup = false
  const staged = []
  let ownershipTemp = null
  const rollbackBackups = []
  let ownershipCommitted = false
  const originalOwnershipBytes = ownership.bytes
  try {
    if (action === 'setup') {
      fs.mkdirSync(hooksDir, { recursive: true })
      for (let i = 0; i < destinations.length; i++) {
        if (existed[i] && priorBytes[i].equals(sources[i])) continue
        if (existed[i]) {
          const backup = `${destinations[i]}.avo-codex-backup.${codexHash(priorBytes[i])}`
          if (fs.existsSync(backup)) {
            if (!fs.readFileSync(backup).equals(priorBytes[i])) throw new Error('Codex script backup mismatch')
          } else {
            fs.copyFileSync(destinations[i], backup, fs.constants.COPYFILE_EXCL)
            rollbackBackups.push(backup)
            if (!fs.readFileSync(backup).equals(priorBytes[i])) throw new Error('Codex script backup verification failed')
          }
        }
        staged[i] = stageCodexFile(destinations[i], sources[i])
      }
      const nextFiles = { ...ownership.parsed.files }
      for (let i = 0; i < destinations.length; i++) {
        if (!existed[i] || owned[i]) nextFiles[names[i]] = codexHash(sources[i])
      }
      const nextOwnership = { version: 1, files: nextFiles }
      nextOwnership.settingsBackupHash = settingsBackupHash
      const ownershipContents = JSON.stringify(nextOwnership, null, 2)
      ownershipTemp = stageCodexFile(ownershipPath, ownershipContents)
      if (parsed.exists && settingsChanged && settingsBackupHash && !fs.existsSync(settingsBackup)) {
        fs.copyFileSync(settingsPath, settingsBackup, fs.constants.COPYFILE_EXCL)
        createdBackup = true
        if (!fs.readFileSync(settingsBackup).equals(oldBytes)) throw new Error('Codex settings backup verification failed')
      }
      for (let i = 0; i < destinations.length; i++) if (staged[i]) {
        commitCodexFile(staged[i], destinations[i], Boolean(existed[i]))
        staged[i] = null
        if (!existed[i]) installed.push(i)
      }
      commitCodexFile(ownershipTemp, ownershipPath, ownership.exists)
      ownershipTemp = null
      ownershipCommitted = true
    }
    if (settingsChanged && !writeCodexHooks(settingsPath, updated)) throw new Error('hooks.json write failed')
  } catch (error) {
    for (const temp of staged) {
      if (typeof temp === 'string') { try { fs.unlinkSync(temp) } catch {} }
    }
    if (ownershipTemp) { try { fs.unlinkSync(ownershipTemp) } catch {} }
    if (action === 'setup') for (let i = 0; i < destinations.length; i++) {
      if (existed[i] && owned[i] && !priorBytes[i].equals(sources[i])) {
        const restoreTemp = `${destinations[i]}.restore.${process.pid}.${Math.random().toString(36).slice(2, 8)}`
        try { fs.writeFileSync(restoreTemp, priorBytes[i], { flag: 'wx' }); fs.renameSync(restoreTemp, destinations[i]) } catch { try { fs.unlinkSync(restoreTemp) } catch {} }
      } else if (installed.includes(i)) { try { fs.unlinkSync(destinations[i]) } catch {} }
    }
    if (ownershipCommitted) {
      try {
        if (originalOwnershipBytes) {
          const restore = stageCodexFile(ownershipPath, originalOwnershipBytes)
          commitCodexFile(restore, ownershipPath, true)
        } else fs.unlinkSync(ownershipPath)
      } catch {}
    }
    for (const backup of rollbackBackups) { try { fs.unlinkSync(backup) } catch {} }
    if (createdBackup) { try { fs.unlinkSync(settingsBackup) } catch {} }
    if (action === 'setup' && !hooksDirExisted) { try { fs.rmdirSync(hooksDir) } catch {} }
    console.error(`  Error: Codex ${action} failed; changes were rolled back where possible.`)
    process.exit(1)
  }
  if (action === 'uninstall') {
    const adapterStillReferenced = hasCodexScriptReference(parsed.settings, hookDest)
    const retained = { ...ownership.parsed.files }
    for (let i = 0; i < destinations.length; i++) {
      try {
        const referenced = hasCodexScriptReference(parsed.settings, destinations[i]) || (i === 1 && adapterStillReferenced)
        if (!referenced && existed[i] && owned[i]) {
          fs.unlinkSync(destinations[i])
          delete retained[names[i]]
        }
      } catch {}
    }
    try {
      const settingsBackupVerified = ownership.parsed.settingsBackupHash && (() => {
        try {
          const stat = fs.lstatSync(settingsBackup)
          return stat.isFile() && !stat.isSymbolicLink() && codexHash(fs.readFileSync(settingsBackup)) === ownership.parsed.settingsBackupHash
        } catch { return false }
      })()
      if (Object.keys(retained).length || settingsBackupVerified) {
        const remainingOwnership = { version: 1, files: retained }
        if (Object.prototype.hasOwnProperty.call(ownership.parsed, 'settingsBackupHash')) {
          remainingOwnership.settingsBackupHash = ownership.parsed.settingsBackupHash
        }
        const temp = stageCodexFile(ownershipPath, JSON.stringify(remainingOwnership, null, 2))
        commitCodexFile(temp, ownershipPath, true)
      } else if (ownership.exists) fs.unlinkSync(ownershipPath)
    } catch {}
  }
  const setupGuidance = action === 'setup'
    ? `\n  Desktop hooks are optional. Open or reload a chat for this project; if "Review hook" appears, expand all six entries, verify the project paths, select the intended hooks, and choose "Allow selected items". They stay inactive until approved and the session reloads.\n  Choose "Not now" to leave automatic Codex observation off; the office remains usable. Manual alternatives: docs/INTEGRATIONS.md#native-codex-lifecycle-hooks. This setup applies to this project only. CLI users can review with /hooks.`
    : ''
  console.log(`\n  Codex project hook ${action} complete.\n  Settings: ${settingsPath}${setupGuidance}\n`)
  process.exit(0)
}

function runGeminiProjectCommand(action) {
  const projectRoot = process.cwd()
  const geminiDir = path.join(projectRoot, '.gemini')
  const hooksDir = path.join(geminiDir, 'hooks')
  const settingsPath = path.join(geminiDir, 'settings.json')
  const hookDest = path.join(hooksDir, 'office-status-gemini.js')
  const hookSrc = path.join(root, 'public', 'hooks', 'office-status-gemini.js')

  let parsed
  try {
    parsed = readGeminiSettings(settingsPath)
  } catch (error) {
    console.error(`  Error: Cannot safely read ${settingsPath} (invalid JSON or unsupported structure).`)
    console.error('  No project files were changed.')
    process.exit(1)
  }

  let sourceBytes = null
  if (action === 'setup') {
    try {
      sourceBytes = fs.readFileSync(hookSrc)
    } catch {
      console.error('  Error: Gemini hook source not found at ' + hookSrc)
      console.error('  Your installation may be corrupted. Reinstall the package and retry.')
      process.exit(1)
    }
  }

  const hookCommand = geminiHookCommand(hookDest)
  if (action === 'setup' && hasEditedGeminiRegistration(parsed.settings, hookCommand)) {
    console.error('  Error: An AVO Gemini hook entry was edited in settings.json; it was preserved.')
    console.error('  Restore the AVO entry before retrying setup.')
    process.exit(1)
  }
  let scriptExists = false
  try {
    const st = fs.lstatSync(hookDest)
    scriptExists = true
    if (st.isSymbolicLink() || !st.isFile()) {
      if (action === 'setup') {
        console.error('  Error: Refusing to replace a non-regular Gemini hook path: ' + hookDest)
        process.exit(1)
      }
    } else if (action === 'setup' && !fs.readFileSync(hookDest).equals(sourceBytes)) {
      console.error('  Error: Existing Gemini hook differs from the package source: ' + hookDest)
      console.error('  Preserve or move the file manually before retrying setup.')
      process.exit(1)
    }
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      console.error('  Error: Cannot inspect Gemini hook path ' + hookDest)
      process.exit(1)
    }
  }

  const settings = parsed.settings
  if (action === 'setup') {
    for (const event of GEMINI_EVENTS) {
      mergeGeminiHook(settings, event, geminiHookConfig(event, hookCommand))
    }
  } else {
    removeGeminiHooks(settings, hookCommand)
  }

  let settingsChanged = false
  let settingsContents = ''
  if (parsed.exists || action === 'setup') {
    settingsContents = JSON.stringify(settings, null, 2)
    settingsChanged = !parsed.exists
    // Compare parsed values to avoid changing an already-installed file's bytes on repeat setup.
    if (parsed.exists) {
      try { settingsChanged = JSON.stringify(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))) !== JSON.stringify(settings) } catch { settingsChanged = true }
    }
  }

  let installedScript = false
  let createdBackup = false
  let createdGeminiDir = false
  let createdHooksDir = false
  const settingsTarget = resolveWriteTarget(settingsPath)
  const backupPath = settingsTarget + '.avo-gemini-backup'
  try {
    if (action === 'setup') {
      const hadGeminiDir = fs.existsSync(geminiDir)
      const hadHooksDir = fs.existsSync(hooksDir)
      fs.mkdirSync(hooksDir, { recursive: true })
      createdGeminiDir = !hadGeminiDir
      createdHooksDir = !hadHooksDir
      if (!scriptExists) {
        const stagedScript = hookDest + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8)
        fs.writeFileSync(stagedScript, sourceBytes)
        try { fs.renameSync(stagedScript, hookDest) } catch (error) {
          try { fs.unlinkSync(stagedScript) } catch {}
          throw error
        }
        installedScript = true
      }

      if (parsed.exists && settingsChanged && !fs.existsSync(backupPath)) {
        // Keep the settings target present while preserving the exact pre-install inode.
        fs.linkSync(settingsTarget, backupPath)
        createdBackup = true
      }
      if (settingsChanged && !atomicWriteGeminiSettings(settingsTarget, settingsContents)) {
        throw new Error('atomic settings write failed')
      }
    } else {
      if (settingsChanged && !atomicWriteGeminiSettings(settingsTarget, settingsContents)) {
        throw new Error('atomic settings write failed')
      }
    }
  } catch (error) {
    if (installedScript) {
      try {
        if (fs.readFileSync(hookDest).equals(sourceBytes)) fs.unlinkSync(hookDest)
      } catch {}
    }
    if (createdBackup) {
      try { fs.unlinkSync(backupPath) } catch {}
    }
    if (createdHooksDir) {
      try { fs.rmdirSync(hooksDir) } catch {}
    }
    if (createdGeminiDir) {
      try { fs.rmdirSync(geminiDir) } catch {}
    }
    console.error(`  Error: Gemini ${action} failed (${error && error.message}).`)
    console.error('  No hook commands were executed.')
    process.exit(1)
  }

  if (action === 'uninstall' && scriptExists && sourceBytes === null &&
      !hasGeminiScriptReference(settings, hookDest)) {
    try { sourceBytes = fs.readFileSync(hookSrc) } catch {}
    if (sourceBytes) {
      try {
        const st = fs.lstatSync(hookDest)
        if (st.isFile() && !st.isSymbolicLink() && fs.readFileSync(hookDest).equals(sourceBytes)) {
          fs.unlinkSync(hookDest)
          console.log('  Removed: ' + hookDest)
        }
      } catch {}
    }
  }

  console.log(`\n  Gemini project hook ${action} complete.\n  Settings: ${settingsPath}\n`)
  process.exit(0)
}

const platformSelector = parsePlatformSelector(args.slice(1))
if ((command === 'setup' || command === 'uninstall') && platformSelector.selected) {
  if (platformSelector.value === 'gemini') {
    runGeminiProjectCommand(command)
  } else if (platformSelector.value === 'codex') {
    runCodexProjectCommand(command)
  } else if (platformSelector.value !== 'claude') {
    console.error(`  Error: Unsupported platform "${platformSelector.value || ''}". Supported platforms: claude, codex, gemini.`)
    process.exit(1)
  }
}

// ─── setup: one-click Claude Code hook installation ───
if (command === 'setup') {
  const claudeDir = path.join(os.homedir(), '.claude')
  const settingsPath = path.join(claudeDir, 'settings.json')
  const hookSrc = path.join(root, 'public', 'hooks', 'office-status-hook.js')
  const legacyMigrationArg = args.find(arg => arg.startsWith('--migrate-legacy-claude='))
  const nominatedLegacyHash = legacyMigrationArg ? legacyMigrationArg.slice('--migrate-legacy-claude='.length) : undefined

  // Ensure ~/.claude exists
  if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true })

  const hookDest = path.join(claudeDir, 'office-status-hook.js')
  if (!fs.existsSync(hookSrc)) {
    console.error('  Error: Hook source not found at ' + hookSrc)
    console.error('  Your installation may be corrupted. Try reinstalling:')
    console.error('    npm install -g agent-virtual-office')
    process.exit(1)
  }
  let hookBytes
  try {
    hookBytes = fs.readFileSync(hookSrc)
  } catch {
    console.error('  Error: Hook source not found at ' + hookSrc)
    process.exit(1)
  }

  // Read or create settings.json
  let settings = {}
  let settingsOriginalBytes = null
  if (fs.existsSync(settingsPath)) {
    try {
      settingsOriginalBytes = fs.readFileSync(settingsPath)
      const parsed = JSON.parse(settingsOriginalBytes.toString('utf-8'))
      if (!isPlainObject(parsed)) throw new Error('settings root must be an object')
      settings = parsed
    } catch (e) {
      console.error('  Error: ' + settingsPath + ' contains invalid JSON.')
      console.error('  Please fix or back up the file, then re-run setup.')
      process.exit(1)
    }
  }
  if (settings.hooks !== undefined && !isPlainObject(settings.hooks)) {
    console.error('  Error: ' + settingsPath + ' has an unsupported hooks structure.')
    console.error('  No installed hook files or settings were changed.')
    process.exit(1)
  }
  if (settings.hooks) for (const event of CLAUDE_EVENTS) {
    if (settings.hooks[event] !== undefined && !Array.isArray(settings.hooks[event])) {
      console.error(`  Error: ${settingsPath} has an unsupported hooks.${event} structure.`)
      console.error('  No installed hook files or settings were changed.')
      process.exit(1)
    }
  }

  try { validateProjectClaudeSettings(process.cwd()) } catch {
    console.error('  Error: Project Claude settings are malformed or unsafe; no hook files or settings were changed.')
    process.exit(1)
  }

  let hookAction
  let hookPrevious = null
  let hookBackupCreated = false
  try {
    const installed = writeClaudeHookSafely(hookBytes, hookDest, nominatedLegacyHash)
    hookAction = installed.action
    hookPrevious = installed.previous
    hookBackupCreated = installed.backupCreatedPath
  } catch {
    console.error('  Error: The installed Claude hook is unsafe, edited, or could not be verified; it was preserved.')
    console.error('  Keep a copy of the file, then restore a known AVO hook before retrying setup.')
    process.exit(1)
  }

  // Build hook command (node works on all platforms, no jq/bash dependency)
  const hookCmd = `node "${hookDest.replace(/\\/g, '/')}"`
  const hookEntry = { type: 'command', command: hookCmd }

  // Add hooks for all relevant events
  // Register only lifecycle events that can support an honest office state.
  if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) settings.hooks = {}
  for (const event of CLAUDE_EVENTS) {
    if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = []
    const existing = settings.hooks[event]
    let inserted = false
    const merged = []
    for (const group of existing) {
      if (!isPlainObject(group) || !Array.isArray(group.hooks)) { merged.push(group); continue }
      const retained = group.hooks.filter(hook => !(isPlainObject(hook) && hook.type === 'command' && exactClaudeCommand(hook.command, hookDest)))
      const hadOwned = retained.length !== group.hooks.length
      if (hadOwned && !inserted) { retained.push(hookEntry); inserted = true }
      if (retained.length) merged.push(retained.length === group.hooks.length ? group : { ...group, hooks: retained })
    }
    if (!inserted) merged.push({ hooks: [hookEntry] })
    settings.hooks[event] = merged
  }

  // Write back atomically to prevent corruption on crash/disk-full. tmp name = pid + random
  // suffix so two concurrent setup runs (or a leftover tmp from a prior crashed run) never
  // collide on the same path — matches the atomicWrite convention in server.mjs / the hooks.
  // atomicWriteSettings also resolves settingsPath through a symlink first (finding 6) so a
  // dotfile-symlink setup pointing ~/.claude/settings.json elsewhere isn't silently broken.
  if (!atomicWriteSettings(settingsPath, JSON.stringify(settings, null, 2))) {
    rollbackClaudeHook(hookDest, hookPrevious, hookBackupCreated)
    console.error('  Error: Cannot write to ' + settingsPath)
    console.error('  Check file permissions for ~/.claude/')
    process.exit(1)
  }

  try {
    removeKnownProjectClaudeHooks(process.cwd())
  } catch {
    if (settingsOriginalBytes) {
      try { atomicWriteSettings(settingsPath, settingsOriginalBytes.toString('utf8')) } catch {}
    } else { try { fs.unlinkSync(settingsPath) } catch {} }
    rollbackClaudeHook(hookDest, hookPrevious, hookBackupCreated)
    console.error('  Error: Could not safely migrate known project-local Claude hooks.')
    console.error('  The project settings were preserved; the global setup changes were rolled back where possible.')
    process.exit(1)
  }

  console.log(`
  Virtual Office setup complete!

  Hook ${hookAction}:  ${hookDest}
  Settings updated: ${settingsPath}

  Now run:
    npx github:KbWen/agent-virtual-office --no-host

  Requires: Claude Code (https://claude.ai/code) must be installed.
  Then use Claude Code in any project — the office will light up automatically.
  `)
  process.exit(0)
}

// ─── uninstall: remove hooks ───
if (command === 'uninstall') {
  const claudeDir = path.join(os.homedir(), '.claude')
  const settingsPath = path.join(claudeDir, 'settings.json')
  const hookDest = path.join(claudeDir, 'office-status-hook.js')
  const hookDestLegacy = path.join(claudeDir, 'office-status-hook.sh')
  const currentHookSource = (() => { try { return fs.readFileSync(path.join(root, 'public', 'hooks', 'office-status-hook.js')) } catch { return null } })()

  // Remove only a byte-identical current hook or a recognizable installed AVO hook.
  if (fs.existsSync(hookDest)) {
    try {
      const contents = fs.readFileSync(hookDest)
      if ((currentHookSource && contents.equals(currentHookSource)) || claudeHookIdentity(contents)) {
        fs.unlinkSync(hookDest)
        console.log('  Removed: ' + hookDest)
      }
    } catch (e) {
      console.warn('  Warning: Could not inspect or remove ' + hookDest)
    }
  }

  // Clean up status, skill, and preference files. Same per-file guard as above — one
  // unlinkable file (permission, race with a live hook process) must not stop the rest.
  try {
    const files = fs.readdirSync(claudeDir)
    for (const file of files) {
      if (/^office-status(-[^.]+)?\.json(\.tmp\.\d+\.[a-z0-9]+)?$/.test(file) ||
          /^office-skill-[^.]+\.json(\.tmp\.\d+\.[a-z0-9]+)?$/.test(file) ||
          /^office-lang(\.tmp\.\d+\.[a-z0-9]+)?$/.test(file)) {
        const filePath = path.join(claudeDir, file)
        try {
          fs.unlinkSync(filePath)
          console.log('  Removed: ' + filePath)
        } catch (e) {
          console.warn('  Warning: Could not remove ' + filePath + ' (' + (e && e.message) + ')')
        }
      }
    }
  } catch (e) {
    console.warn('  Warning: Could not clean up status files in ' + claudeDir)
  }

  // Remove from settings.json
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      if (settings.hooks) {
        for (const event of CLAUDE_EVENTS) {
          if (settings.hooks[event]) {
            // Null-guard both `h` and `hh` (finding 6) — a malformed/foreign settings entry
            // (e.g. `null` sitting in the array, or a hooks-array element with no `command`)
            // used to throw here and abort the ENTIRE uninstall, including the file cleanup
            // that already ran above.
            const retained = []
            for (const group of settings.hooks[event]) {
              if (!group || !Array.isArray(group.hooks)) { retained.push(group); continue }
              const hooks = group.hooks.filter(hh => !(hh && hh.type === 'command' && exactClaudeCommand(hh.command, hookDest)))
              if (hooks.length) retained.push(hooks.length === group.hooks.length ? group : { ...group, hooks })
            }
            settings.hooks[event] = retained
            if (settings.hooks[event].length === 0) delete settings.hooks[event]
          }
        }
        if (Object.keys(settings.hooks).length === 0) delete settings.hooks
      }
      // Atomic write (finding 6) — matches `setup`'s tmp+rename convention (including
      // symlink-aware target resolution) instead of a bare direct fs.writeFileSync.
      if (!atomicWriteSettings(settingsPath, JSON.stringify(settings, null, 2))) {
        throw new Error('write failed')
      }
      console.log('  Cleaned: ' + settingsPath)
    } catch (e) {
      console.warn('  Warning: Could not update ' + settingsPath)
      console.warn('  You may need to manually remove office-status-hook entries')
    }
  }

  console.log('\n  Virtual Office hooks removed.\n')
  process.exit(0)
}

// ─── serve: production static server ───────────────────────────────────────
if (command === 'serve') {
  const serverScript = path.join(root, 'server.mjs')
  if (!fs.existsSync(serverScript)) {
    console.error('  Error: server.mjs not found. Your installation may be corrupted.')
    console.error('    npm install -g agent-virtual-office')
    process.exit(1)
  }
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    console.error('  Error: production bundle not found. Build first:')
    console.error('    npm run build')
    process.exit(1)
  }
  // Forward remaining flags to server.mjs
  const serverArgs = process.argv.slice(3)
  const child = spawn(process.execPath, [serverScript, ...serverArgs], {
    cwd: root,
    env: childEnv(),
    stdio: 'inherit',
    shell: false,
  })
  child.on('error', (err) => {
    console.error(`\n  Failed to start production server: ${err.message}\n`)
    process.exit(1)
  })
  let _hardTimer = null
  child.on('close', (code, signal) => {
    if (_hardTimer) clearTimeout(_hardTimer)
    // SIGINT/SIGTERM = user-initiated clean stop → exit 0
    // SIGKILL/crash signal = abnormal → exit 1 so supervisors restart
    const cleanSignal = signal === 'SIGINT' || signal === 'SIGTERM'
    process.exit(cleanSignal ? 0 : (signal ? 1 : (code || 0)))
  })
  // Forward signals to the child; child.on('close') handles actual exit.
  // Hard-exit after 12s in case server.mjs's 10s drain timer never fires.
  let _forwarding = false
  function forwardSignal(sig) {
    if (_forwarding) return
    _forwarding = true
    if (process.platform === 'win32') {
      if (child.exitCode === null && child.signalCode === null) {
        try { execSync(`taskkill /T /F /PID ${child.pid}`, { stdio: 'ignore' }) } catch {}
      }
    } else {
      try { child.kill(sig) } catch {}
    }
    _hardTimer = setTimeout(() => process.exit(1), 12000)
    // no .unref() — this timer must keep the process alive so it can force-exit a stuck child
  }
  process.on('SIGINT',  () => forwardSignal('SIGINT'))
  process.on('SIGTERM', () => forwardSignal('SIGTERM'))
  // Don't fall through to dev server
  return
}

// Parse flags
const port = args.find(a => a.startsWith('--port='))?.split('=')[1] || '5174'
if (!/^\d+$/.test(port) || parseInt(port, 10) < 1 || parseInt(port, 10) > 65535) {
  console.error('  Invalid port: ' + port + '. Must be 1-65535.')
  process.exit(1)
}
const lang = args.find(a => a.startsWith('--lang='))?.split('=')[1]
if (lang && lang !== 'en' && lang !== 'zh-TW') {
  console.error('  Invalid --lang: ' + lang + '. Use "en" or "zh-TW".')
  process.exit(1)
}
const open = !args.includes('--no-open')
const help = args.includes('--help') || args.includes('-h')

if (help) {
  console.log(`
  agent-virtual-office — Pixel-art virtual office for AI agents

  Usage:
    npx github:KbWen/agent-virtual-office [options]
    npx github:KbWen/agent-virtual-office setup       Install Claude Code hooks (one-time)
    npx github:KbWen/agent-virtual-office setup --platform codex
                                         Install Codex CLI hooks in this project
    npx github:KbWen/agent-virtual-office setup --platform gemini
                                         Install Gemini CLI hooks in this project
    npx github:KbWen/agent-virtual-office uninstall   Remove Claude Code hooks
    npx github:KbWen/agent-virtual-office uninstall --platform codex
                                         Remove this project's Codex CLI hooks
    npx github:KbWen/agent-virtual-office uninstall --platform gemini
                                         Remove this project's Gemini CLI hooks
    npx github:KbWen/agent-virtual-office serve       Serve production build (no Vite needed)

  Options:
    --port=PORT    Port number (default: 5174)
    --lang=LANG    Language: en, zh-TW (default: auto-detect)
    --no-open      Don't open browser automatically
    --no-host      Dev mode only: don't expose to LAN (dev server binds 0.0.0.0 by
                   default; serve mode is loopback-only by default, so --no-host is
                   a no-op there)
    --help, -h     Show this help

  Quick start:
    npx github:KbWen/agent-virtual-office setup   # one-time: install hooks
    npx github:KbWen/agent-virtual-office --no-host  # start locally (dev mode)

  Production / static deploy:
    npm run build                    # build to dist/
    npx github:KbWen/agent-virtual-office serve   # serve dist/ + /api/status

  Then use Claude Code in any project — the office lights up automatically.
`)
  process.exit(0)
}

// Resolve Vite's CLI entry via Node module resolution. This honors npm's
// dependency hoisting — when this package is installed as a dependency (or
// globally), Vite lands in a PARENT node_modules, not `<pkg>/node_modules`.
// A plain `fs.existsSync(root/node_modules/vite)` check would miss it and
// trigger a redundant `npm install` on every launch. require.resolve walks
// the parent chain the same way `require('vite')` would.
function resolveViteBin() {
  try {
    const pkgPath = require.resolve('vite/package.json', { paths: [root] })
    const pkg = require(pkgPath)
    const binRel = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin && pkg.bin.vite)
    if (!binRel) return null
    const binAbs = path.join(path.dirname(pkgPath), binRel)
    return fs.existsSync(binAbs) ? binAbs : null
  } catch {
    return null
  }
}

// Install deps only if Vite genuinely can't be resolved from here.
let viteBinJs = resolveViteBin()
if (!viteBinJs) {
  console.log('Installing dependencies...')
  try {
    execSync('npm install --prefer-offline --no-audit --no-fund', { cwd: root, stdio: 'inherit' })
  } catch {
    console.error('  Failed to install dependencies. Try running manually:')
    console.error(`    cd "${root}" && npm install`)
    process.exit(1)
  }
  viteBinJs = resolveViteBin()
}
if (!viteBinJs) {
  console.error('  Could not locate Vite even after install.')
  console.error(`  Try running manually: cd "${root}" && npm install`)
  process.exit(1)
}

// Build URL
const url = `http://localhost:${port}${lang ? `?lang=${lang}` : ''}`

// Start vite dev server
const host = !args.includes('--no-host')

console.log(`
  Starting Agent Virtual Office...
  Local:   ${url}
  Panel:   ${url}${lang ? '&' : '?'}mode=panel
  API:     http://localhost:${port}/api/status
`)

if (host) {
  console.log(`  Network mode enabled (--host). LAN devices can access the office.`)
  console.log(`  To restrict to localhost only, use: --no-host`)
  if (process.platform === 'win32') {
    console.log(`  Note: Windows Firewall may prompt you to allow access.`)
  }
  console.log()
  // Parity with server.mjs's production warning (server.mjs ~L540-543): the dev server binds
  // to the LAN by default just like --host in production, so it deserves the same warning.
  if (!process.env.OFFICE_API_TOKEN?.trim()) {
    console.warn('  WARNING: --host is set but OFFICE_API_TOKEN is not.')
    console.warn('  Anyone on the network can write to /api/status without authentication.')
    console.warn('  Set OFFICE_API_TOKEN=<secret> to require a token for writes.\n')
  }
}

// Run Vite's CLI entry directly with this Node binary. Avoids depending on
// the `.bin/vite` shim (which also moves under hoisting) and the per-platform
// shell-quoting dance — `process.execPath` + the resolved JS path is portable.
const viteFlags = ['--port', port]
if (host) viteFlags.push('--host')
const vite = spawn(process.execPath, [viteBinJs, ...viteFlags], {
  cwd: root,
  env: childEnv(),
  stdio: 'inherit',
  shell: false,
})
vite.on('error', (err) => {
  console.error(`\n  Failed to start Vite: ${err.message}`)
  console.error(`  Try running manually: cd "${root}" && npx vite --port ${port}\n`)
  process.exit(1)
})

// Open browser after a short delay
if (open) {
  setTimeout(() => {
    const opener = process.platform === 'win32' ? 'start' :
                   process.platform === 'darwin' ? 'open' : 'xdg-open'
    // Skip browser open on headless Linux / WSL (no display server)
    if (opener === 'xdg-open' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
      console.log(`  Open in browser: ${url}`)
      return
    }
    try {
      const cmd = opener === 'start' ? `start "" "${url}"` : `${opener} "${url}"`
      execSync(cmd, { stdio: 'ignore' })
    } catch {
      console.log(`  Open in browser: ${url}`)
    }
  }, 2000)
}

vite.on('close', (code) => {
  if (code) {
    console.error(`\n  Vite exited with code ${code}. If port ${port} is in use, try:`)
    console.error(`    npx github:KbWen/agent-virtual-office --port=${parseInt(port) + 1}\n`)
  }
  process.exit(code || 0)
})
function killVite() {
  try { vite.kill() } catch {}
  process.exit(0)
}
process.on('SIGINT', killVite)
process.on('SIGTERM', killVite)
