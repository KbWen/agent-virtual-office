import fs from 'node:fs/promises'
import path from 'node:path'
import { homedir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { nextSeq } from '../utils/statusContract.mjs'

const DISCOVERY_MS = 10_000
const TICK_MS = 1_000
const FRESH_MS = 15_000
const FUTURE_MS = 5_000
const MAX_ACTIVE = 32
const MAX_STATS_PER_DISCOVERY = 32
const MAX_READ_PER_FILE = 64 * 1024
const MAX_READ_PER_TICK = 256 * 1024
const MAX_PARTIAL = 1024 * 1024
const MAX_PARTIAL_TOTAL = 1024 * 1024
const STARTUP_TAIL = 256 * 1024
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/
const ALLOWED_TYPES = new Set(['GENERIC', 'PLANNER_RESPONSE'])
const ALLOWED_STATUSES = new Set(['RUNNING', 'DONE'])
const ALLOWED_SOURCES = new Set(['MODEL', 'USER_EXPLICIT', 'SYSTEM'])
const PATH_FIELDS = ['TargetFile', 'AbsolutePath', 'Path', 'path']
const warned = new Set()
const isWin = process.platform === 'win32'

function diagnostic(code) {
  if (warned.has(code)) return
  warned.add(code)
  console.error(`[AVO-ANTIGRAVITY] ${code}`)
}

function hash(value, length = 40) {
  return createHash('sha256').update(value).digest('hex').slice(0, length)
}

function samePath(a, b) {
  return isWin ? a.toLowerCase() === b.toLowerCase() : a === b
}

function withinRoot(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

function isActiveStatus(status) {
  return status === 'working' || status === 'blocked' || status === 'planning' || status === 'awaiting-approval'
}

function safeRoleForFile(filePath) {
  if (!filePath) return null
  const f = filePath.replace(/\\/g, '/').toLowerCase()
  const base = path.posix.basename(f)
  if (/\.(test|spec)\.(js|ts|jsx|tsx|py|rb|go|java|cjs|mjs)$/.test(base) || /\/(tests?|__tests?|specs?)\//i.test(f)) return 'qa'
  if (/^dockerfile/i.test(base) || /docker-compose/i.test(base) || /\/(\.github|\.gitlab|\.circleci|\.buildkite|\.drone)\//i.test(f)) return 'ops'
  if (/\.(ya?ml|toml)$/.test(base) && !/^package/.test(base)) return 'ops'
  if (/\.(md|mdx|txt|rst|adoc)$/.test(base) || /\/(docs?|wiki|notes?)\//i.test(f)) return 'res'
  if (/\/(adr|architecture)\//i.test(f) || /\.(puml|drawio)$/.test(base)) return 'arch'
  if (/\.(css|scss|less|sass|svg|figma|sketch|xd|ai|png|jpe?g|gif|webp|ico)$/.test(base) || /\/(design|ui|ux|styles?|themes?|assets?)\//i.test(f)) return 'designer'
  return null
}

function isKnownTestCommand(command) {
  if (typeof command !== 'string') return false
  return /^(?:npm test|npm run test|npx vitest|npx vitest run|vitest|vitest run|node --test|pnpm test|yarn test)$/i.test(command.trim())
}

function decodeRecord(text) {
  let row
  try { row = JSON.parse(text) } catch { return null }
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  if (typeof row.created_at !== 'string' || !Number.isInteger(row.step_index) || row.step_index < 0) return null
  if (!ALLOWED_STATUSES.has(row.status) || !ALLOWED_TYPES.has(row.type) || !ALLOWED_SOURCES.has(row.source)) return null
  if (!Array.isArray(row.tool_calls) || row.tool_calls.length === 0) return null
  const timestamp = Date.parse(row.created_at)
  if (!Number.isFinite(timestamp)) return null
  if (!row.tool_calls.length || row.tool_calls.some((item) => !item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name || !item.args || typeof item.args !== 'object' || Array.isArray(item.args))) return null
  return { timestamp, step: row.step_index, status: row.status, type: row.type, source: row.source, tools: row.tool_calls.map(({ name, args }) => ({ name, args })) }
}

function mapTool(record, activeFile) {
  const { name, args } = record
  if (name === 'run_command') return { role: isKnownTestCommand(args.CommandLine) ? 'qa' : 'ops', task: 'Bash', label: 'Run command', activeFile: null }
  if (name === 'view_file' || name === 'read_file') return { role: 'res', task: 'Read', label: 'Read file', activeFile: null }
  if (name === 'list_dir' || name === 'search') return { role: 'res', task: 'Read', label: name === 'search' ? 'Search files' : 'List files', activeFile: null }
  if (name === 'replace_file_content' || name === 'write_to_file' || name === 'write_file' || name === 'edit_file') {
    return { role: safeRoleForFile(activeFile) || 'dev', task: name === 'edit_file' ? 'Edit' : 'Write', label: name === 'edit_file' ? 'Edit file' : 'Write file', activeFile }
  }
  if (name === 'invoke_subagent') return { role: 'dev', task: 'Task', label: 'Delegate work', activeFile: null }
  if (name === 'ask_question') return record.status === 'RUNNING'
    ? { role: 'dev', status: 'awaiting-approval', task: 'AskUserQuestion', label: 'Waiting for approval', activeFile: null }
    : { role: 'dev', task: 'AskUserQuestion', label: 'Ask question', activeFile: null }
  return { role: 'dev', task: 'Bash', label: 'Work', activeFile: null }
}

async function canonical(pathname, injectedFs) {
  return injectedFs.realpath(pathname)
}

async function writeAtomic(destination, contents, deps, stopped) {
  const temp = `${destination}.tmp-${randomUUID()}`
  try {
    await deps.fs.writeFile(temp, contents, { flag: 'wx', mode: 0o600 })
    if (stopped()) return false
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await deps.fs.rename(temp, destination)
        return true
      } catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error?.code) || attempt === 3) {
          diagnostic(error?.code === 'EPERM' ? 'publish-permission' : error?.code === 'EBUSY' ? 'publish-busy' : 'publish-failed')
          return false
        }
        await new Promise((resolve) => deps.setTimeout(resolve, 10 * (attempt + 1)))
        if (stopped()) return false
      }
    }
    return false
  } catch {
    diagnostic('publish-failed')
    return false
  } finally {
    try { await deps.fs.unlink(temp) } catch (error) { if (error?.code !== 'ENOENT') diagnostic('temp-cleanup-failed') }
  }
}

async function withOutputLock(lockPath, deps, stopped, callback) {
  const token = randomUUID()
  let handle
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (stopped()) return
      try {
        handle = await deps.fs.open(lockPath, 'wx', 0o600)
        await handle.writeFile(token)
        break
      } catch (error) {
        if (error?.code !== 'EEXIST') {
          diagnostic('lock-failed')
          return
        }
        if (attempt === 3) return
        await new Promise((resolve) => deps.setTimeout(resolve, 10 * (attempt + 1)))
      }
    }
    if (!handle) return
    if (!stopped()) await callback()
  } catch {
    diagnostic('lock-failed')
  } finally {
    if (handle) {
      try { await handle.close() } catch { diagnostic('lock-cleanup-failed') }
      try {
        const content = await deps.fs.readFile(lockPath, 'utf8')
        if (content === token) await deps.fs.unlink(lockPath)
      } catch (error) { diagnostic(error?.code === 'ENOENT' ? 'lock-already-gone' : 'lock-cleanup-failed') }
    }
  }
}

/** Read-only observer for Antigravity's verified transcript JSONL envelope. */
export function startAntigravityWatcher({ projectRoot, statusDir, dataRoot, ...testDependencies } = {}) {
  const mode = testDependencies.mode ?? process.env.OFFICE_ANTIGRAVITY_MODE ?? 'auto'
  if (mode === 'off' || !['auto', 'off'].includes(mode) || !projectRoot || !statusDir) return { stop() {} }

  const deps = {
    fs: testDependencies.fs ?? fs,
    now: testDependencies.now ?? Date.now,
    setTimeout: testDependencies.setTimeout ?? setTimeout,
    clearTimeout: testDependencies.clearTimeout ?? clearTimeout,
  }
  const configuredRoot = dataRoot ?? process.env.OFFICE_ANTIGRAVITY_ROOT ?? path.join(homedir(), '.gemini', 'antigravity')
  let stopped = false
  let timer = null
  let inFlight = false
  let canonicalDataRoot = null
  let canonicalProjectRoot = null
  const statusProjectRoot = path.resolve(projectRoot)
  let discoveryCursor = 0
  let discoveryDue = 0
  let activeCursor = 0
  let attachmentOrder = 0
  const entries = new Map()
  const fileSystem = deps.fs

  function stoppedNow() { return stopped }

  function makeOutputPath(entry) {
    const sessionKey = hash(`antigravity\0${canonicalProjectRoot}\0${entry.conversationId}`, 24)
    return path.join(statusDir, `office-status-antigravity-${sessionKey}.json`)
  }

  function outputData(entry, agent, sourceKey, sourceTimestamp, old) {
    const agents = [
      {
        role: agent.role,
        status: agent.status ?? 'working',
        task: agent.task ?? null,
        label: agent.label ?? null,
        hint: null,
        reasonCode: null,
        activeFile: agent.activeFile ?? null,
        skill: null,
      },
    ]
    return {
      type: 'office-status', agents,
      activeCount: agents.filter((item) => isActiveStatus(item.status)).length,
      workflow: null, source: 'antigravity', _cwd: statusProjectRoot, _seq: nextOutputSeq(old),
      _sourceEventKey: sourceKey,
      _sourceTimestamp: sourceTimestamp,
      ...(old?._sourceIdle === true ? { _sourceIdle: false } : {}),
    }
  }

  function nextOutputSeq(old) {
    const candidate = Number(nextSeq())
    const previous = old?._seq
    const parsed = typeof previous === 'string' && /^\d{1,16}$/.test(previous) ? Number(previous) : NaN
    const plausiblePrevious = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= deps.now() + 1_000_000 ? parsed : 0
    return String(Math.max(candidate, plausiblePrevious + 1))
  }

  async function publish(entry, agent, sourceKey, sourceTimestamp) {
    if (stopped) return
    const destination = makeOutputPath(entry)
    const lock = `${destination}.antigravity-lock`
    await withOutputLock(lock, deps, stoppedNow, async () => {
      if (stopped) return
      let old = null
      try { old = JSON.parse(await fileSystem.readFile(destination, 'utf8')) } catch (error) {
        if (error?.code !== 'ENOENT') diagnostic('status-read-failed')
      }
      if (old?._sourceEventKey === sourceKey) return
      if (Number.isFinite(Number(old?._sourceTimestamp)) && sourceTimestamp < Number(old._sourceTimestamp)) return
      const data = outputData(entry, agent, sourceKey, sourceTimestamp, old)
      await writeAtomic(destination, JSON.stringify(data) + '\n', deps, stoppedNow)
    })
  }

  async function neutralize(entry) {
    if (stopped || !entry.lastAccepted || entry.neutralized) return
    if (deps.now() - entry.lastAccepted.observedAt < FRESH_MS) return
    if (deps.now() - entry.lastPublishAt < 1_000) return
    const destination = makeOutputPath(entry)
    const lock = `${destination}.antigravity-lock`
    await withOutputLock(lock, deps, stoppedNow, async () => {
      if (stopped) return
      let old
      try { old = JSON.parse(await fileSystem.readFile(destination, 'utf8')) } catch { diagnostic('status-read-failed'); return }
      if (old?._sourceEventKey !== entry.lastAccepted.key || old?._sourceIdle === true) return
      const agents = [{ role: entry.lastAccepted.agent.role, status: 'idle', task: null, label: null, hint: null, reasonCode: null, activeFile: null, skill: null }]
      const data = {
        type: 'office-status', agents, activeCount: 0, workflow: null,
        source: 'antigravity', _cwd: statusProjectRoot, _seq: nextOutputSeq(old),
        _sourceEventKey: entry.lastAccepted.key, _sourceTimestamp: entry.lastAccepted.timestamp, _sourceIdle: true,
      }
      if (await writeAtomic(destination, JSON.stringify(data) + '\n', deps, stoppedNow)) {
        entry.neutralized = true
        entry.lastPublishAt = deps.now()
      }
    })
  }

  async function pathEvidence(raw) {
    if (typeof raw !== 'string' || /[\u0000-\u001f\u007f]/.test(raw) || !path.isAbsolute(raw)) return { explicit: true, valid: false }
    try {
      const absolute = path.resolve(raw)
      let existing = absolute
      const suffix = []
      while (true) {
        try {
          const resolved = await canonical(existing, fileSystem)
          const reconstructed = path.resolve(resolved, ...suffix.reverse())
          return { explicit: true, valid: withinRoot(canonicalProjectRoot, reconstructed), canonical: reconstructed }
        } catch (error) {
          if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error
          const parent = path.dirname(existing)
          if (parent === existing) return { explicit: true, valid: false }
          suffix.push(path.basename(existing))
          existing = parent
        }
      }
    } catch {
      diagnostic('source-path-unavailable')
      return { explicit: true, valid: false }
    }
  }

  function normalizePathField(field, raw) {
    if (field !== 'Path' && field !== 'path') return raw
    if (typeof raw !== 'string' || /[\u0000-\u001f\u007f]/.test(raw)) return null
    if (raw.includes('"')) {
      let decoded
      try { decoded = JSON.parse(raw) } catch { return null }
      return typeof decoded === 'string' && !/[\u0000-\u001f\u007f]/.test(decoded) && path.isAbsolute(decoded) ? decoded : null
    }
    if (path.isAbsolute(raw)) return raw
    return null
  }

  async function applyRecord(entry, rawLine) {
    if (stopped) return
    let decoded
    try { decoded = decodeRecord(Buffer.from(rawLine).toString('utf8')) } catch { diagnostic('record-invalid'); return }
    if (!decoded) return
    const firstObservedAt = deps.now()
    let exactCwd = false
    let scopedFile = null
    let scopedWriteEvidence = false
    const scopedFiles = []
    let explicitForeign = false
    let explicitAmbiguous = false
    for (const tool of decoded.tools) {
      if (Object.hasOwn(tool.args, 'Cwd')) {
        const cwd = await pathEvidence(tool.args.Cwd)
        if (stopped) return
        if (cwd.valid && samePath(cwd.canonical, canonicalProjectRoot)) exactCwd ||= tool.name === 'run_command'
        else { explicitForeign = true; explicitAmbiguous ||= !path.isAbsolute(tool.args.Cwd ?? '') }
      }
      for (const field of PATH_FIELDS) {
        if (!Object.hasOwn(tool.args, field)) continue
        const rawFile = normalizePathField(field, tool.args[field])
        const evidence = await pathEvidence(rawFile)
        if (stopped) return
        if (evidence.valid && withinRoot(canonicalProjectRoot, evidence.canonical)) {
          const relativeFile = path.relative(canonicalProjectRoot, evidence.canonical).split(path.sep).join('/')
          scopedFiles.push({ tool, relativeFile })
          scopedWriteEvidence = true
        } else { explicitForeign = true; explicitAmbiguous ||= typeof rawFile !== 'string' || !path.isAbsolute(rawFile) }
      }
    }
    if (explicitForeign) entry.bound = false
    if (explicitAmbiguous || explicitForeign) return
    if (decoded.step <= entry.highWaterStep) return
    entry.highWaterStep = decoded.step
    if (exactCwd) entry.bound = true
    const owned = exactCwd || entry.bound || scopedWriteEvidence
    if (!owned) return
    const observedAt = firstObservedAt
    const currentTime = deps.now()
    if (decoded.timestamp > observedAt + FUTURE_MS || observedAt - decoded.timestamp > FRESH_MS || currentTime - decoded.timestamp > FRESH_MS) return

    const representative = decoded.tools[0]
    if (['write_to_file', 'replace_file_content', 'write_file', 'edit_file'].includes(representative.name)) {
      const targets = scopedFiles.filter(({ tool }) => tool === representative).map(({ relativeFile }) => relativeFile)
      if (targets.length > 0 && targets.every((candidate) => candidate === targets[0])) {
        scopedFile = targets[0].length <= 200 && !/[\u0000-\u001f\u007f]/.test(targets[0]) ? targets[0] : null
      }
    }
    const agent = mapTool({ ...decoded, ...representative }, ['write_to_file', 'replace_file_content', 'write_file', 'edit_file'].includes(representative.name) ? scopedFile : null)
    if (representative.name === 'ask_question' && decoded.status !== 'RUNNING') agent.status = 'working'
    const eventKey = hash(`${entry.identity}\n${decoded.step}\n${decoded.timestamp}`)
    if (deps.now() - entry.lastPublishAt < 1_000) {
      entry.pending = { agent, key: eventKey, timestamp: decoded.timestamp, observedAt }
      return
    }
    entry.lastAccepted = { agent, key: eventKey, timestamp: decoded.timestamp, observedAt }
    entry.lastAcceptedAt = observedAt
    entry.neutralized = false
    entry.lastPublishAt = deps.now()
    entry.pending = null
    await publish(entry, agent, eventKey, decoded.timestamp)
  }

  async function probeBinding(entry, filePath, size) {
    try {
      const handle = await fileSystem.open(filePath, 'r')
      try {
        if (stopped) return
        const length = Math.min(size, STARTUP_TAIL)
        const buffer = Buffer.alloc(length)
        const { bytesRead } = await handle.read(buffer, 0, length, Math.max(0, size - length))
        if (stopped) return
        const lines = buffer.subarray(0, bytesRead).toString('utf8').split('\n')
        lines.pop() // The tail's last fragment may be an incomplete source record.
        for (const line of lines) {
          if (!line) continue
          const decoded = decodeRecord(line)
          if (!decoded) continue
          entry.highWaterStep = Math.max(entry.highWaterStep, decoded.step)
          let runCwdExact = false
          let foreign = false
          for (const candidate of decoded.tools) {
            const args = candidate.args
            if (Object.hasOwn(args, 'Cwd')) {
              const evidence = await pathEvidence(args.Cwd)
              if (stopped) return
              if (evidence.valid && samePath(evidence.canonical, canonicalProjectRoot)) runCwdExact ||= candidate.name === 'run_command'
              else foreign = true
            }
            for (const field of PATH_FIELDS) {
              if (!Object.hasOwn(args, field)) continue
              const evidence = await pathEvidence(normalizePathField(field, args[field]))
              if (stopped) return
              if (!evidence.valid || !withinRoot(canonicalProjectRoot, evidence.canonical)) foreign = true
            }
          }
          if (foreign) entry.bound = false
          else if (runCwdExact) entry.bound = true
        }
      } finally { await handle.close() }
    } catch (error) { if (!stopped && error?.code !== 'ENOENT') diagnostic('transcript-read-failed') }
  }

  async function attach(relativePath, absolutePath) {
    let realPath
    let stat
    try {
      realPath = await canonical(absolutePath, fileSystem)
      if (stopped) return
      if (!withinRoot(canonicalDataRoot, realPath)) return
      stat = await fileSystem.stat(realPath)
      if (stopped) return
      if (!stat.isFile()) return
    } catch (error) { if (!stopped && error?.code !== 'ENOENT') diagnostic('transcript-unavailable'); return }
    const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`
    const existing = entries.get(relativePath)
    if (existing && existing.identity === identity && stat.size >= existing.offset) {
      existing.lastSeen = deps.now()
      return
    }
    const entry = {
      conversationId: relativePath.split(path.sep)[1], relativePath, sourcePath: absolutePath, filePath: realPath, identity, generation: (existing?.generation ?? 0) + 1,
      attachmentOrder: ++attachmentOrder,
      offset: stat.size, partial: Buffer.alloc(0), droppingLine: false, bound: false, highWaterStep: -1,
      lastAccepted: null, lastPublishAt: 0, lastSeen: deps.now(), neutralized: false,
      pending: null, lastAcceptedAt: 0,
    }
    await probeBinding(entry, realPath, stat.size)
    entries.set(relativePath, entry)
    if (entries.size > MAX_ACTIVE) {
      const oldest = [...entries.entries()].sort((a, b) => a[1].lastAcceptedAt - b[1].lastAcceptedAt || a[1].attachmentOrder - b[1].attachmentOrder || a[0].localeCompare(b[0]))[0]
      if (oldest) entries.delete(oldest[0])
    }
  }

  async function discover(now) {
    if (now < discoveryDue) return
    discoveryDue = now + DISCOVERY_MS
    let names
    try { names = await fileSystem.readdir(path.join(canonicalDataRoot, 'brain')) } catch (error) { if (error?.code !== 'ENOENT') diagnostic('discovery-unavailable'); return }
    if (stopped) return
    const candidates = names.filter((name) => SAFE_ID.test(name)).sort().map((name) => ({
      relative: path.join('brain', name, '.system_generated', 'logs', 'transcript.jsonl'),
      absolute: path.join(canonicalDataRoot, 'brain', name, '.system_generated', 'logs', 'transcript.jsonl'),
    }))
    if (!candidates.length) return
    const start = discoveryCursor % candidates.length
    const selected = Array.from({ length: Math.min(MAX_STATS_PER_DISCOVERY, candidates.length) }, (_, index) => candidates[(start + index) % candidates.length])
    discoveryCursor = (start + selected.length) % candidates.length
    for (const candidate of selected) await attach(candidate.relative, candidate.absolute)
  }

  async function consumeLine(entry, line) {
    if (!line.length || entry.droppingLine) return
    await applyRecord(entry, line)
  }

  async function readEntry(entry, budget) {
    if (stopped) return 0
    let stat
    try {
      const currentPath = await canonical(entry.sourcePath, fileSystem)
      if (stopped) return 0
      if (!withinRoot(canonicalDataRoot, currentPath)) { entries.delete(entry.relativePath); return 0 }
      if (currentPath !== entry.filePath) entry.filePath = currentPath
      stat = await fileSystem.stat(entry.filePath)
      if (stopped) return 0
    } catch (error) { if (!stopped && error?.code !== 'ENOENT') diagnostic('transcript-unavailable'); entries.delete(entry.relativePath); return 0 }
    const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`
    if (identity !== entry.identity || stat.size < entry.offset) {
      entry.identity = identity
      entry.generation += 1
      entry.offset = stat.size
      entry.partial = Buffer.alloc(0)
      entry.droppingLine = false
      entry.bound = false
      entry.highWaterStep = -1
      entry.lastAccepted = null
      entry.neutralized = false
      await probeBinding(entry, entry.filePath, stat.size)
      return 0
    }
    const length = Math.min(MAX_READ_PER_FILE, budget, Math.max(0, stat.size - entry.offset))
    if (!length) return 0
    let bytes
    try {
      const handle = await fileSystem.open(entry.filePath, 'r')
      try { const buffer = Buffer.alloc(length); const result = await handle.read(buffer, 0, length, entry.offset); bytes = buffer.subarray(0, result.bytesRead); entry.offset += result.bytesRead }
      finally { await handle.close() }
    } catch { diagnostic('transcript-read-failed'); return 0 }
    if (stopped) return 0
    let combined = Buffer.concat([entry.partial, bytes])
    entry.partial = Buffer.alloc(0)
    let cursor = 0
    while (cursor < combined.length) {
      const newline = combined.indexOf(0x0a, cursor)
      if (newline === -1) {
        const rest = combined.subarray(cursor)
        if (entry.droppingLine) { entry.partial = Buffer.alloc(0); break }
        const otherPartial = [...entries.values()].reduce((total, candidate) => total + (candidate === entry ? 0 : candidate.partial.length), 0)
        const partialBudget = Math.max(0, Math.min(MAX_PARTIAL, MAX_PARTIAL_TOTAL - otherPartial))
        if (rest.length > partialBudget) { entry.droppingLine = true; diagnostic('record-too-large') }
        else entry.partial = Buffer.from(rest)
        break
      }
      const line = combined.subarray(cursor, newline)
      if (entry.droppingLine) entry.droppingLine = false
      else if (line.length <= MAX_PARTIAL) await consumeLine(entry, line)
      else diagnostic('record-too-large')
      cursor = newline + 1
    }
    return bytes.length
  }

  async function tick() {
    if (stopped || inFlight) return
    inFlight = true
    try {
      if (!canonicalDataRoot || !canonicalProjectRoot) {
        try {
          [canonicalDataRoot, canonicalProjectRoot] = await Promise.all([canonical(configuredRoot, fileSystem), canonical(projectRoot, fileSystem)])
        } catch { if (!stopped) diagnostic('root-unavailable'); return }
      }
      if (stopped) return
      const now = deps.now()
      await discover(now)
      if (stopped) return
      const ordered = [...entries.values()]
      let budget = MAX_READ_PER_TICK
      if (ordered.length) {
        const start = activeCursor % ordered.length
        const rotated = ordered.slice(start).concat(ordered.slice(0, start))
        for (const entry of rotated) {
          if (stopped) break
          if (budget > 0) {
            const read = await readEntry(entry, budget)
            budget -= read
          }
          if (entry.pending && deps.now() - entry.lastPublishAt >= 1_000 && !stopped) {
            const pending = entry.pending
            entry.pending = null
            entry.lastAccepted = { ...pending }
            entry.lastAcceptedAt = pending.observedAt
            entry.neutralized = false
            entry.lastPublishAt = deps.now()
            await publish(entry, pending.agent, pending.key, pending.timestamp)
          }
          await neutralize(entry)
        }
        activeCursor = (start + 1) % ordered.length
      }
    } catch {
      if (!stopped) diagnostic('watcher-tick-failed')
    } finally {
      inFlight = false
      if (!stopped) timer = deps.setTimeout(() => { void tick() }, TICK_MS)
    }
  }

  timer = deps.setTimeout(() => { void tick() }, TICK_MS)
  return {
    stop() {
      if (stopped) return
      stopped = true
      if (timer !== null) deps.clearTimeout(timer)
      timer = null
    },
  }
}
