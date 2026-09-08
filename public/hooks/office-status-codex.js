#!/usr/bin/env node
const fs = require('fs')
const os = require('os')
const path = require('path')

// ─── Transport contract MIRROR ───────────────────────────────────────────────
// This file is a standalone CommonJS script (it is copied out of the package and run by
// `node` with no bundler), so it CANNOT import src/utils/statusContract.mjs -- a .mjs is
// ESM and `require` cannot load it synchronously. The contract is therefore mirrored here
// and pinned against the canonical module by tests/codexHookContractParity.test.js, which
// fails the moment the two drift.
//
// The mirror had already drifted: 'planning' (AVO-101) and 'awaiting-approval' (AVO-167)
// were missing, so normalizeAgent() DROPPED every agent in either state, activeCount
// under-counted them, and the reasonCode/activeFile/skill carry fields were stripped --
// a Codex-driven blocked agent silently lost its blocked-reason badge.
const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
const VALID_STATUSES = ['idle', 'working', 'blocked', 'done', 'planning', 'awaiting-approval']
const VALID_MOODS = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
const BLOCKED_REASONS = [
  'test-run-failed', 'build-failed', 'deps-failed', 'blocked-unknown',
  'permission-denied', 'api-rate-limit', 'api-auth-failed',
]
const AGENT_CARRY_FIELDS = ['task', 'label', 'hint', 'reasonCode', 'activeFile', 'skill']
const FIELD_SANITIZERS = {
  task:       (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  label:      (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  hint:       (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  reasonCode: (v) => BLOCKED_REASONS.includes(v) ? v : null,
  activeFile: (v) => typeof v === 'string' ? v.slice(0, 200) : null,
  skill:      (v) => typeof v === 'string' ? v.slice(0, 200) : null,
}

// An agent is "active" for activeCount in exactly the states statusContract.countActive()
// counts. 'planning' and 'awaiting-approval' are active work states, not resting ones.
function isActiveStatus(status) {
  return status === 'working' || status === 'blocked' || status === 'planning' || status === 'awaiting-approval'
}

// Monotonic _seq: plain integer string, matches office-status-hook.js / server.mjs.
// Two invocations in the same ms get distinct values, so scanSessions dedup/staleness
// keying stays correct. Caller-supplied _seq is only honored when it is a plain
// integer string — a stale or non-numeric _seq would otherwise make scanAndMerge
// drop the session as stale or fail the /^\d+$/ guard in the client.
let _seqLast = 0
function nextSeq() {
  const now = Date.now()
  _seqLast = now > _seqLast ? now : _seqLast + 1
  return String(_seqLast)
}

function coerceSeq(raw) {
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return raw
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return String(raw)
  return nextSeq()
}

function getSessionSlug() {
  const cwdHash = require('crypto').createHash('md5').update(process.cwd()).digest('hex').slice(0, 4)
  try {
    // Read .git/HEAD directly instead of spawning `git rev-parse` — a child process
    // adds ~10-30ms latency to every status write. Mirrors office-status-hook.js,
    // which was already optimized this way; the codex hook had been left on execSync.
    const gitEntry = path.join(process.cwd(), '.git')
    let headContent = null
    if (fs.existsSync(gitEntry)) {
      const stat = fs.statSync(gitEntry)
      if (stat.isFile()) {
        // Worktree: .git is a file "gitdir: <path>" — resolve HEAD relative to it.
        const ref = fs.readFileSync(gitEntry, 'utf-8').trim()
        const m = ref.match(/^gitdir:\s*(.+)$/)
        if (m) headContent = fs.readFileSync(path.resolve(path.dirname(gitEntry), m[1], 'HEAD'), 'utf-8').trim()
      } else {
        headContent = fs.readFileSync(path.join(gitEntry, 'HEAD'), 'utf-8').trim()
      }
    }
    if (headContent) {
      const refMatch = headContent.match(/^ref:\s+refs\/heads\/(.+)$/)
      const branch = refMatch ? refMatch[1] : null  // null = detached HEAD → fall through
      if (branch) {
        return branch.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) + `-${cwdHash}`
      }
    }
  } catch {}

  return path.basename(process.cwd()).replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) + `-${cwdHash}`
}

function normalizeAgent(agent) {
  if (!agent || !VALID_ROLES.includes(agent.role) || !VALID_STATUSES.includes(agent.status)) return null
  const carry = {}
  for (const f of AGENT_CARRY_FIELDS) carry[f] = FIELD_SANITIZERS[f](agent[f])
  return { role: agent.role, status: agent.status, ...carry }
}

function normalizeCodexStatusPayload(body, now = Date.now()) {
  if (!body || typeof body !== 'object') {
    throw new Error('Expected a JSON object payload')
  }
  // Caller may supply _seq, but a stale/non-numeric value would break scanSessions
  // staleness + the client's /^\d+$/ guard. coerceSeq accepts only plain-integer
  // strings; anything else falls back to a fresh monotonic value.
  // `now` is kept as a parameter for deterministic tests, but only via coerceSeq's
  // nextSeq() fallback — a literal numeric `now` is no longer used as the seq.
  void now

  if (body.type === 'office-status') {
    const agents = Array.isArray(body.agents)
      ? body.agents.map(normalizeAgent).filter(Boolean)
      : []

    return {
      type: 'office-status',
      agents,
      activeCount: agents.filter((a) => isActiveStatus(a.status)).length,
      workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
      mood: VALID_MOODS.includes(body.mood) ? body.mood : null,
      source: body.source || 'codex-cli',
      _seq: coerceSeq(body._seq),
    }
  }

  const agents = []
  for (const role of VALID_ROLES) {
    const value = body[role]
    if (value == null) continue
    const isStatus = VALID_STATUSES.includes(value)
    // Top-level carry fields apply to every shorthand role, EXCEPT activeFile: broadcasting
    // one file to several roles would fabricate a shared-file co-edit (AVO-183b), so it is
    // applied post-loop and only when the payload named a single role.
    const carry = {}
    for (const f of AGENT_CARRY_FIELDS) {
      if (f === 'task' || f === 'activeFile') continue
      carry[f] = FIELD_SANITIZERS[f](body[f])
    }
    agents.push({
      role,
      task: isStatus ? null : FIELD_SANITIZERS.task(value),
      status: isStatus ? value : 'working',
      ...carry,
    })
  }
  const singleActiveFile = agents.length === 1 ? FIELD_SANITIZERS.activeFile(body.activeFile) : null
  for (const a of agents) a.activeFile = singleActiveFile

  return {
    type: 'office-status',
    agents,
    activeCount: agents.filter((a) => isActiveStatus(a.status)).length,
    workflow: body.workflow || null,
    source: body.source || 'codex-cli',
    _seq: coerceSeq(body._seq),
  }
}

function writeCodexStatusFile(payload, cwd = process.cwd()) {
  const sessionSlug = getSessionSlug()
  const statusFile = path.join(os.homedir(), '.claude', `office-status-${sessionSlug}.json`)
  const normalized = normalizeCodexStatusPayload(payload)
  const output = {
    ...normalized,
    _cwd: cwd,
  }

  const dir = path.dirname(statusFile)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  // tmp name = pid + random suffix: a bare pid collides when two codex hook
  // invocations share a parent pid and run concurrently — one's writeFileSync
  // would clobber the other mid-write and the shared-path unlinkSync would
  // delete the sibling's tmp. Matches office-status-hook.js / vite.config.js.
  const tmpFile = `${statusFile}.tmp.${process.pid}.` +
    (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
  const json = JSON.stringify(output, null, 2)
  try {
    fs.writeFileSync(tmpFile, json)
    fs.renameSync(tmpFile, statusFile)
  } catch {
    try { fs.writeFileSync(statusFile, json) } catch {}
    try { fs.unlinkSync(tmpFile) } catch {}
  }
  return { statusFile, payload: output }
}

function readPayloadFromInput(argv, stdin) {
  const arg = argv[2]
  const raw = arg && arg !== '--stdin' ? arg : stdin.trim()
  if (!raw) {
    throw new Error('Usage: node office-status-codex.js \'{\"dev\":\"working\"}\' or pipe JSON via stdin')
  }
  return JSON.parse(raw)
}

async function main() {
  let stdin = ''
  process.stdin.setEncoding('utf-8')
  for await (const chunk of process.stdin) stdin += chunk

  const payload = readPayloadFromInput(process.argv, stdin)
  const result = writeCodexStatusFile(payload)
  process.stdout.write(`${result.statusFile}\n`)
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exit(0)
  })
}

module.exports = {
  getSessionSlug,
  normalizeCodexStatusPayload,
  writeCodexStatusFile,
  // Exported for tests/codexHookContractParity.test.js only: the drift guard compares these
  // mirrored constants against src/utils/statusContract.mjs, which this CJS script cannot import.
  VALID_ROLES,
  VALID_STATUSES,
  VALID_MOODS,
  BLOCKED_REASONS,
  AGENT_CARRY_FIELDS,
  isActiveStatus,
}
