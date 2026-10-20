#!/usr/bin/env node
'use strict'

// Standalone Gemini CLI hook. Keep this file dependency-free: setup copies it into
// a user's project, where only Node built-ins are available.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
const VALID_STATUSES = ['idle', 'working', 'blocked', 'done', 'planning', 'awaiting-approval']
const VALID_MOODS = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
const BLOCKED_REASONS = ['test-run-failed', 'build-failed', 'deps-failed', 'blocked-unknown', 'permission-denied', 'api-rate-limit', 'api-auth-failed']
const AGENT_CARRY_FIELDS = ['task', 'label', 'hint', 'reasonCode', 'activeFile', 'skill']
const MAX_STDIN_BYTES = 1024 * 1024
const MAX_RUN_MS = 1000
const LOCK_WAIT_MS = 180

function isActiveStatus(status) {
  return status === 'working' || status === 'blocked' || status === 'planning' || status === 'awaiting-approval'
}

function canonicalRoot(value, io = fs) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) return null
  let resolved = path.resolve(value)
  try { resolved = io.realpathSync.native ? io.realpathSync.native(resolved) : io.realpathSync(resolved) } catch { return null }
  const normalized = path.normalize(resolved)
  resolved = normalized.replace(/[\\/]+$/, '') || path.parse(normalized).root
  if (!resolved || /^[A-Za-z]:$/.test(resolved)) resolved = path.parse(normalized).root
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isWithinRoot(root, candidate) {
  const rel = path.relative(root, candidate)
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`))
}

// Mirrors the established fileToRole precedence; intentionally does not require the
// Claude hook because importing that file installs stdin listeners.
function fileToRole(filePath) {
  if (!filePath) return null
  const f = filePath.replace(/\\/g, '/').toLowerCase()
  const base = path.posix.basename(f)
  if (/\.(test|spec)\.(js|ts|jsx|tsx|py|rb|go|java|cjs|mjs)$/.test(base)) return 'qa'
  if (/\/(tests?|__tests?|specs?)\//i.test(f)) return 'qa'
  if (/^dockerfile/i.test(base) || /docker-compose/i.test(base)) return 'ops'
  if (/\/(\.github|\.gitlab|\.circleci|\.buildkite|\.drone)\//i.test(f)) return 'ops'
  if (/\.(ya?ml|toml)$/.test(base) && !/^package/.test(base)) return 'ops'
  if (/\.(md|mdx|txt|rst|adoc)$/.test(base) || /\/(docs?|wiki|notes?)\//i.test(f)) return 'res'
  if (/\/(adr|architecture)\//i.test(f) || /\.(puml|drawio)$/.test(base)) return 'arch'
  if (/\.(css|scss|less|sass|svg|figma|sketch|xd|ai)$/.test(base) || /\/(design|ui|ux|styles?|themes?|assets?)\//i.test(f) || /\.(png|jpe?g|gif|webp|ico)$/.test(base)) return 'designer'
  return null
}

function validateSessionId(value) {
  return typeof value === 'string' && value.length <= 256 && /^[A-Za-z0-9._:-]{1,256}$/.test(value)
}

function digestSession(platform, root, sessionId) {
  if (!validateSessionId(sessionId) || typeof root !== 'string' || !root) return null
  return crypto.createHash('sha256').update(`${platform}\0${root}\0${sessionId}`, 'utf8').digest('hex').slice(0, 24)
}

function safeRelativeFile(root, raw, io = fs) {
  if (typeof raw !== 'string' || !raw || !path.isAbsolute(raw)) return null
  const target = path.resolve(raw)
  if (!isWithinRoot(root, target)) return null
  let cursor = root
  const parts = path.relative(root, target).split(path.sep).filter(Boolean)
  for (const part of parts) {
    cursor = path.join(cursor, part)
    try {
      const entry = io.lstatSync(cursor)
      if (entry.isSymbolicLink()) {
        let realEntry
        try { realEntry = io.realpathSync.native ? io.realpathSync.native(cursor) : io.realpathSync(cursor) }
        catch { return null } // Dangling links cannot prove a safe target.
        if (!isWithinRoot(root, realEntry)) return null
      }
    } catch (error) {
      if (!error || error.code !== 'ENOENT') return null
      break // Missing suffix is valid for a new write target.
    }
  }
  // New write targets need not exist yet. Resolve the nearest existing ancestor so a
  // symlinked parent outside the project cannot be used to claim an in-root path.
  let ancestor = target
  let canonicalAncestor = null
  while (!canonicalAncestor) {
    try { canonicalAncestor = io.realpathSync.native ? io.realpathSync.native(ancestor) : io.realpathSync(ancestor) }
    catch {
      const parent = path.dirname(ancestor)
      if (parent === ancestor) return null
      ancestor = parent
    }
  }
  if (!isWithinRoot(root, canonicalAncestor)) return null
  const rel = path.relative(root, target).split(path.sep).join('/')
  if (!rel || rel.length > 200 || rel.split('/').some((part) => !part || part === '.' || part === '..')) return null
  return rel
}

function classifyShellCommand(command) {
  if (typeof command !== 'string' || command.length > 4096) return 'ops'
  if (/[;&|<>`\r\n]/.test(command) || command.includes('$(')) return 'ops'
  const s = command.trim().replace(/\s+/g, ' ').toLowerCase()
  const tests = [
    /^(npm|pnpm|yarn|bun) (run )?test(?:\s|$)/,
    /^npx vitest run(?:\s|$)/, /^vitest run(?:\s|$)/,
    /^pytest(?:\s|$)/, /^python(?:3)? -m pytest(?:\s|$)/,
    /^cargo test(?:\s|$)/, /^go test(?:\s|$)/, /^dotnet test(?:\s|$)/,
    /^mvn test(?:\s|$)/, /^gradle test(?:\s|$)/,
  ]
  return tests.some((pattern) => pattern.test(s)) ? 'qa' : 'ops'
}

function getToolPath(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  for (const key of ['file_path', 'dir_path', 'path', 'target_file', 'absolute_path']) {
    if (typeof input[key] === 'string') return input[key]
  }
  return null
}

function mapTool(toolName, toolInput, root, io = fs) {
  const input = toolInput && typeof toolInput === 'object' ? toolInput : {}
  const rawPath = getToolPath(input)
  const safeFile = rawPath && path.isAbsolute(rawPath) ? safeRelativeFile(root, rawPath, io) : null
  let role = 'dev'
  let task = 'Task'
  let label = 'Use tool'
  let write = false

  switch (toolName) {
    case 'run_shell_command':
      role = classifyShellCommand(input.command)
      task = 'Bash'; label = 'Run command'
      break
    case 'read_file': case 'read_many_files': case 'list_directory': case 'glob': case 'grep_search':
      role = safeFile ? (fileToRole(rawPath) || 'res') : 'res'
      task = 'Read'; label = toolName === 'grep_search' || toolName === 'glob' ? 'Search files' : 'Read files'
      break
    case 'write_file': case 'replace':
      role = safeFile ? (fileToRole(rawPath) || 'dev') : 'dev'
      task = toolName === 'replace' ? 'Edit' : 'Write'
      label = toolName === 'replace' ? 'Edit file' : 'Write file'
      write = true
      break
    case 'web_fetch': role = 'res'; task = 'Read'; label = 'Fetch web'; break
    case 'google_web_search': role = 'res'; task = 'Read'; label = 'Search web'; break
    default: break // Unknown and MCP names never become user-visible labels.
  }
  return { role, task, label, activeFile: write ? safeFile : null }
}

function mapGeminiEvent(payload, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const { root, io = fs } = options
  const event = payload.hook_event_name
  const blank = { role: 'dev', status: 'working', task: null, label: null, hint: null, reasonCode: null, activeFile: null, skill: null, orderPriority: 0 }
  if (event === 'BeforeAgent') return { ...blank, label: 'Working' }
  if (event === 'BeforeTool' || event === 'AfterTool') {
    if (typeof payload.tool_name !== 'string' || !payload.tool_name) return null
    const mappedTool = mapTool(payload.tool_name, payload.tool_input, root || '', io)
    return { ...blank, ...mappedTool, orderPriority: event === 'AfterTool' ? 2 : (event === 'BeforeTool' ? 2 : 0) }
  }
  if (event === 'AfterAgent') return { ...blank, status: 'idle', orderPriority: 3 }
  if (event === 'SessionEnd') return { ...blank, status: 'idle', orderPriority: 4 }
  if (event === 'Notification' && payload.notification_type === 'ToolPermission') {
    return { ...blank, status: 'awaiting-approval', label: 'Permission required', orderPriority: 1 }
  }
  return null
}

function parseTimestamp(value, now = Date.now()) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || timestamp < Date.UTC(2000, 0, 1) || timestamp < now - 5 * 60_000 || timestamp > now + 5 * 60_000) return null
  return timestamp
}

function validPayload(payload, options = {}) {
  const { cwd = process.cwd(), env = process.env, io = fs, now = Date.now() } = options
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  if (!validateSessionId(payload.session_id) || typeof payload.cwd !== 'string' || !path.isAbsolute(payload.cwd)) return null
  if (parseTimestamp(payload.timestamp, now) == null) return null
  const hookRoot = canonicalRoot(payload.cwd, io)
  const officeRoot = canonicalRoot(env.OFFICE_PROJECT_ROOT || cwd, io)
  if (!hookRoot || !officeRoot || hookRoot !== officeRoot) return null
  // Identity/binding use the real root; the scanner matches the office's logical root.
  return { root: hookRoot, statusRoot: path.resolve(env.OFFICE_PROJECT_ROOT || cwd), timestamp: Date.parse(payload.timestamp), digest: digestSession('gemini-cli', hookRoot, payload.session_id) }
}

function sleepSync(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) }

function acquireLock(lockPath, options = {}) {
  const io = options.io || fs
  const localDeadline = Date.now() + (options.waitMs ?? LOCK_WAIT_MS)
  const deadline = Number.isFinite(options.deadlineAt) ? Math.min(localDeadline, options.deadlineAt) : localDeadline
  const token = crypto.randomBytes(16).toString('hex')
  while (Date.now() < deadline) {
    try {
      const fd = io.openSync(lockPath, 'wx', 0o600)
      io.writeFileSync(fd, JSON.stringify({ token }), 'utf8')
      io.closeSync(fd)
      return token
    } catch (error) {
      if (!error || error.code !== 'EEXIST') return null
      if (Date.now() >= deadline) return null
      sleepSync(15)
    }
  }
  return null
}

function releaseLock(lockPath, token, io = fs) {
  try {
    const held = JSON.parse(io.readFileSync(lockPath, 'utf8'))
    if (held.token !== token) return false
    io.unlinkSync(lockPath)
    return true
  } catch { return false }
}

function atomicWrite(filePath, data, io = fs, deadlineAt = Infinity) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`
  let fd
  try {
    fd = io.openSync(tempPath, 'wx', 0o600)
    io.writeFileSync(fd, data, 'utf8')
    io.fsyncSync(fd)
    io.closeSync(fd); fd = undefined
    if (Date.now() >= deadlineAt) return null
    for (let attempt = 0; attempt < 4; attempt++) {
      if (Date.now() >= deadlineAt) return null
      try { io.renameSync(tempPath, filePath); return true } catch (error) {
        if (!error || !['EBUSY', 'EPERM'].includes(error.code) || attempt === 3) throw error
        sleepSync(15 * (attempt + 1))
        if (Date.now() >= deadlineAt) return null
      }
    }
    return false
  } finally {
    if (fd !== undefined) { try { io.closeSync(fd) } catch {} }
    try { if (io.existsSync(tempPath)) io.unlinkSync(tempPath) } catch {}
  }
}

function emptyFields(role, status = 'idle') {
  return { role, status, task: null, label: null, hint: null, reasonCode: null, activeFile: null, skill: null }
}

function makeOutput(mapped, root, previous, timestamp, digest) {
  const now = Date.now()
  const priorSeq = Number(previous && previous._seq)
  const safePriorSeq = Number.isSafeInteger(priorSeq) && priorSeq >= Date.UTC(2000, 0, 1) && priorSeq <= now + 5 * 60_000
    ? priorSeq : 0
  const seq = Math.max(now, safePriorSeq + 1)
  const previousRole = previous?.agents?.[0]?.role
  const current = mapped.status === 'idle'
    ? emptyFields(VALID_ROLES.includes(previousRole) ? previousRole : mapped.role)
    : { role: mapped.role, status: mapped.status, task: mapped.task, label: mapped.label, hint: null, reasonCode: null, activeFile: mapped.activeFile, skill: null }
  return {
    type: 'office-status', agents: [current], activeCount: isActiveStatus(current.status) ? 1 : 0,
    workflow: null, source: 'gemini-cli', _cwd: root, _seq: String(seq),
    _geminiOrder: { timestamp, eventHash: crypto.createHash('sha256').update(`${digest}\0${timestamp}\0${mapped.status}\0${mapped.label || ''}`).digest('hex').slice(0, 24), priority: mapped.orderPriority },
  }
}

async function runHook(input, options = {}) {
  const startedAt = Date.now()
  const deadlineAt = Number.isFinite(options.deadlineAt) ? options.deadlineAt : startedAt + MAX_RUN_MS
  const diagnostic = (code) => { if (typeof options.onDiagnostic === 'function') options.onDiagnostic(code) }
  const io = options.io || fs
  const env = options.env || process.env
  const now = options.now == null ? Date.now() : options.now
  if (typeof input === 'string' && Buffer.byteLength(input, 'utf8') > MAX_STDIN_BYTES) { diagnostic('input_overflow'); return false }
  const payload = typeof input === 'string' ? safeParse(input) : input
  const identity = validPayload(payload, { cwd: options.cwd || process.cwd(), env, io, now })
  if (!identity) return false
  if (Date.now() >= deadlineAt) { diagnostic('deadline'); return false }
  const mapped = mapGeminiEvent(payload, { root: identity.root, io })
  if (!mapped) return false

  const dir = path.resolve(env.OFFICE_STATUS_DIR || path.join(os.homedir(), '.claude'))
  const statusPath = path.join(dir, `office-status-gemini-${identity.digest}.json`)
  const lockPath = `${statusPath}.lock`
  try { io.mkdirSync(dir, { recursive: true }) } catch { diagnostic('io_failure'); return false }
  if (Date.now() >= deadlineAt) { diagnostic('deadline'); return false }
  const waitMs = Math.max(0, Math.min(LOCK_WAIT_MS, options.lockWaitMs ?? LOCK_WAIT_MS, deadlineAt - Date.now()))
  const token = acquireLock(lockPath, { io, waitMs, deadlineAt })
  if (!token) { diagnostic(Date.now() >= deadlineAt ? 'deadline' : 'lock_busy'); return false }
  try {
    if (Date.now() >= deadlineAt) { diagnostic('deadline'); return false }
    let previous = null
    try { previous = JSON.parse(io.readFileSync(statusPath, 'utf8')) } catch {}
    if ((payload.hook_event_name === 'BeforeAgent' || payload.hook_event_name === 'Notification') &&
        previous && Array.isArray(previous.agents) && previous.agents[0] && VALID_ROLES.includes(previous.agents[0].role)) {
      mapped.role = previous.agents[0].role
    }
    const meta = previous && previous._geminiOrder
    const rawOldTimestamp = Number(meta && meta.timestamp)
    const oldTimestamp = Number.isSafeInteger(rawOldTimestamp) && rawOldTimestamp >= Date.UTC(2000, 0, 1) && rawOldTimestamp <= Date.now() + 5 * 60_000
      ? rawOldTimestamp : null
    const oldPriority = Number.isInteger(meta && meta.priority) && meta.priority >= 0 && meta.priority <= 4 ? meta.priority : 0
    if (oldTimestamp != null) {
      if (identity.timestamp < oldTimestamp) return false
      if (identity.timestamp === oldTimestamp && !(mapped.orderPriority > oldPriority)) return false
    }
    const output = makeOutput(mapped, identity.statusRoot, previous, identity.timestamp, identity.digest)
    if (Date.now() >= deadlineAt) { diagnostic('deadline'); return false }
    const writeResult = atomicWrite(statusPath, JSON.stringify(output, null, 2), io, deadlineAt)
    if (writeResult !== true) { diagnostic(writeResult === null ? 'deadline' : 'write_failure'); return false }
    return true
  } catch { diagnostic('io_failure'); return false } finally {
    if (!releaseLock(lockPath, token, io)) diagnostic('lock_release_failure')
  }
}

function safeParse(raw) {
  try { return JSON.parse(raw) } catch { return null }
}

function runMain(options = {}) {
  const stdin = options.stdin || process.stdin
  const stdout = options.stdout || process.stdout
  const stderr = options.stderr || process.stderr
  const deadlineAt = Date.now() + MAX_RUN_MS
  let data = Buffer.alloc(0)
  let settled = false
  let diagnosticCode = null
  const finish = (code) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    stdout.write('{}\n')
    if (code) stderr.write(`[office-status-gemini] ${code}\n`)
    if (typeof stdin.destroy === 'function' && !stdin.destroyed) stdin.destroy()
  }
  const timer = setTimeout(() => finish('deadline'), MAX_RUN_MS)
  stdin.on('data', (chunk) => {
    if (settled) return
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    if (data.length + bytes.length > MAX_STDIN_BYTES) return finish('input_overflow')
    data = Buffer.concat([data, bytes])
  })
  stdin.on('error', () => finish('input_error'))
  stdin.on('end', async () => {
    if (settled) return
    try {
      if (!data.length) return finish('invalid_input')
      const accepted = await runHook(data.toString('utf8'), { ...options, deadlineAt, onDiagnostic: (code) => { diagnosticCode = diagnosticCode || code } })
      finish(accepted ? null : diagnosticCode || 'ignored')
    } catch { finish('hook_error') }
  })
}

if (require.main === module) runMain()

module.exports = {
  VALID_ROLES, VALID_STATUSES, VALID_MOODS, BLOCKED_REASONS, AGENT_CARRY_FIELDS,
  isActiveStatus, fileToRole, digestSession, canonicalRoot, isWithinRoot,
  safeRelativeFile, classifyShellCommand, mapTool, mapGeminiEvent, parseTimestamp,
  validPayload, runHook, runMain,
}
