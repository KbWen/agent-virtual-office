#!/usr/bin/env node
'use strict'

// Native Codex lifecycle adapter. This intentionally keeps only one root-thread
// representative and writes through the existing Codex status normalizer.
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { normalizeCodexStatusPayload } = require('./office-status-codex.js')

const MAX_INPUT_BYTES = 64 * 1024
const MAX_SESSION_ID_LENGTH = 1024
const LOCK_WAIT_MS = 400
const LOCK_STALE_MS = 10_000
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4))
let lastSeq = 0
const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']

function fixedDiagnostic() {
  process.stderr.write('office-status-codex-hook: event ignored\n')
}

function canonicalCwd(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || !path.isAbsolute(value)) return null
  try {
    const resolved = path.resolve(value)
    return fs.realpathSync.native(resolved)
  } catch {
    return null
  }
}

function identity(cwd, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > MAX_SESSION_ID_LENGTH) return null
  const canonical = canonicalCwd(cwd)
  if (!canonical) return null
  const hashCwd = process.platform === 'win32' ? canonical.replace(/\\/g, '/').toLowerCase() : canonical
  const digest = crypto.createHash('sha256').update(`${hashCwd}\0${sessionId}`).digest('hex').slice(0, 24)
  return { cwd: canonical, digest }
}

function turnHash(value) {
  if (typeof value !== 'string' || !value || value.length > 2048 || /\s/.test(value)) return null
  return crypto.createHash('sha256').update(value).digest('hex')
}

function toolAssignment(name) {
  if (name === 'Bash' || name === 'PowerShell') return { role: 'ops', task: 'Run command' }
  if (name === 'apply_patch') return { role: 'dev', task: 'Edit files' }
  if (name === 'Read' || name === 'Grep' || name === 'Glob' || name === 'Search') return { role: 'res', task: 'Research code' }
  return { role: 'dev', task: 'Work on task' }
}

function validEvent(event) {
  return event && typeof event === 'object' && !Array.isArray(event) &&
    typeof event.hook_event_name === 'string'
}

function waitForLock(lockPath) {
  const deadline = Date.now() + LOCK_WAIT_MS
  while (Date.now() <= deadline) {
    const token = crypto.randomBytes(16).toString('hex')
    try {
      const fd = fs.openSync(lockPath, 'wx', 0o600)
      fs.writeSync(fd, token)
      const owned = fs.fstatSync(fd)
      return () => {
        try { fs.closeSync(fd) } catch {}
        try {
          const current = fs.statSync(lockPath)
          const currentToken = fs.readFileSync(lockPath, 'utf8')
          if (currentToken === token && current.dev === owned.dev && current.ino === owned.ino) fs.unlinkSync(lockPath)
        } catch {}
      }
    } catch (error) {
      if (!error || error.code !== 'EEXIST') throw error
      try {
        const observedToken = fs.readFileSync(lockPath, 'utf8')
        const observed = fs.statSync(lockPath)
        if (Date.now() - observed.mtimeMs > LOCK_STALE_MS) {
          const evicted = `${lockPath}.stale.${process.pid}.${crypto.randomBytes(6).toString('hex')}`
          fs.renameSync(lockPath, evicted)
          let sameInstance = false
          try {
            const moved = fs.statSync(evicted)
            sameInstance = fs.readFileSync(evicted, 'utf8') === observedToken &&
              moved.dev === observed.dev && moved.ino === observed.ino && moved.mtimeMs === observed.mtimeMs
          } catch {}
          if (sameInstance) {
            try { fs.unlinkSync(evicted) } catch {}
          } else {
            try { fs.renameSync(evicted, lockPath) } catch { /* Preserve the displaced lock at its unique path. */ }
          }
        }
      } catch {}
      Atomics.wait(sleepBuffer, 0, 0, 5)
    }
  }
  return null
}

function atomicJson(file, value) {
  const temp = `${file}.tmp.${process.pid}.${crypto.randomBytes(6).toString('hex')}`
  try {
    fs.writeFileSync(temp, JSON.stringify(value), { flag: 'wx', mode: 0o600 })
    fs.renameSync(temp, file)
  } finally {
    try { fs.unlinkSync(temp) } catch {}
  }
}

function readState(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!value || typeof value !== 'object') return null
    if (typeof value.closed !== 'boolean' || !VALID_ROLES.includes(value.role)) return null
    if (!['idle', 'working', 'done', 'planning', 'awaiting-approval'].includes(value.status)) return null
    if (typeof value.task !== 'string' || value.task.length > 40) return null
    const roles = [...new Set(Array.isArray(value.roles) ? value.roles.filter(role => VALID_ROLES.includes(role)) : [])]
      .slice(0, VALID_ROLES.length)
    if (!roles.includes(value.role)) roles.push(value.role)
    return { ...value, roles, planning: value.planning === true }
  } catch {
    return null
  }
}

function outputDir() {
  return path.resolve(process.env.OFFICE_STATUS_DIR || path.join(os.homedir(), '.claude'))
}

function writeEvent(event) {
  if (!validEvent(event)) return false
  const known = new Set(['UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'Stop', 'SessionEnd', 'Interrupt'])
  if (!known.has(event.hook_event_name)) return false
  const hasTurnId = Object.prototype.hasOwnProperty.call(event, 'turn_id')
  const incomingTurn = turnHash(event.turn_id)
  if (event.hook_event_name !== 'SessionEnd' && !incomingTurn) return false
  if (hasTurnId && !incomingTurn) return false
  if (['PreToolUse', 'PostToolUse', 'PermissionRequest'].includes(event.hook_event_name) &&
    (typeof event.tool_name !== 'string' || !event.tool_name.trim())) return false
  const id = identity(event.cwd, event.session_id)
  if (!id) return false
  const dir = outputDir()
  fs.mkdirSync(dir, { recursive: true })
  const basename = `office-status-codex-hook-${id.digest}`
  const statusPath = path.join(dir, `${basename}.json`)
  const statePath = path.join(dir, `.${basename}.state`)
  const lockPath = path.join(dir, `.${basename}.lock`)
  const release = waitForLock(lockPath)
  if (!release) return false

  try {
    let state = readState(statePath) || {
      closed: true, turn: null, role: 'pm', roles: ['pm'], status: 'idle', task: 'Working on task', planning: false,
    }
    if (event.hook_event_name === 'UserPromptSubmit') {
      state = { closed: false, turn: incomingTurn, role: 'pm', roles: state.roles, status: event.permission_mode === 'plan' ? 'planning' : 'working', task: 'Working on task', planning: event.permission_mode === 'plan' }
    } else {
      if (state.turn && incomingTurn && state.turn !== incomingTurn) return false
      if (!state.turn && incomingTurn) state.turn = incomingTurn
      if (typeof event.permission_mode === 'string') state.planning = event.permission_mode === 'plan'
      if (event.hook_event_name === 'SessionEnd' || event.hook_event_name === 'Interrupt') {
        state.status = 'idle'
        state.closed = true
      } else if (state.closed) {
        return false
      } else if (event.hook_event_name === 'PreToolUse') {
        const assigned = toolAssignment(event.tool_name)
        state = { ...state, role: assigned.role, task: assigned.task, status: state.planning ? 'planning' : 'working' }
      } else if (event.hook_event_name === 'PermissionRequest') {
        const assigned = toolAssignment(event.tool_name)
        state = { ...state, role: assigned.role, task: assigned.task, status: 'awaiting-approval' }
      } else if (event.hook_event_name === 'PostToolUse') {
        const assigned = toolAssignment(event.tool_name)
        state = { ...state, role: assigned.role, task: assigned.task, status: state.planning ? 'planning' : 'working' }
      } else if (event.hook_event_name === 'Stop') {
        state.status = 'idle'
        state.closed = true
      }
    }
    if (!state.roles.includes(state.role)) state.roles.push(state.role)

    const prior = (() => {
      try { return JSON.parse(fs.readFileSync(statusPath, 'utf8'))._seq } catch { return 0 }
    })()
    const now = Date.now()
    const priorText = typeof prior === 'string' ? prior : Number.isSafeInteger(prior) ? String(prior) : ''
    const priorCandidate = /^\d+$/.test(priorText) ? Number(priorText) : 0
    const priorSeq = Number.isSafeInteger(priorCandidate) && priorCandidate > 0 && priorCandidate <= now ? priorCandidate : 0
    const ownSeq = Number.isSafeInteger(lastSeq) && lastSeq > 0 && lastSeq <= now ? lastSeq : 0
    lastSeq = Math.max(now, ownSeq + 1, priorSeq + 1)
    const normalized = normalizeCodexStatusPayload({
      type: 'office-status',
      agents: state.roles.map(role => ({
        role,
        status: role === state.role ? state.status : 'idle',
        task: role === state.role && state.status !== 'idle' ? state.task : null,
      })),
    })
    const output = { ...normalized, _seq: String(lastSeq), _cwd: id.cwd }
    const priorStatus = (() => {
      try { return fs.readFileSync(statusPath) } catch { return null }
    })()
    atomicJson(statusPath, output)
    try {
      atomicJson(statePath, state)
    } catch (error) {
      if (priorStatus) {
        const temp = `${statusPath}.rollback.${process.pid}.${crypto.randomBytes(6).toString('hex')}`
        try {
          fs.writeFileSync(temp, priorStatus, { flag: 'wx', mode: 0o600 })
          fs.renameSync(temp, statusPath)
        } finally {
          try { fs.unlinkSync(temp) } catch {}
        }
      } else {
        try { fs.unlinkSync(statusPath) } catch {}
      }
      throw error
    }
    return true
  } finally {
    release()
  }
}

async function readInput() {
  let raw = ''
  let bytes = 0
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    bytes += Buffer.byteLength(chunk, 'utf8')
    if (bytes > MAX_INPUT_BYTES) return null
    raw += chunk
  }
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function main() {
  try {
    const event = await readInput()
    if (event) writeEvent(event)
  } catch {
    fixedDiagnostic()
  }
}

if (require.main === module) main().then(() => { process.exitCode = 0 }, () => {
  fixedDiagnostic()
  process.exitCode = 0
})

module.exports = { identity, toolAssignment, waitForLock, writeEvent }
