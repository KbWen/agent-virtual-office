#!/usr/bin/env node
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')

const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
const VALID_STATUSES = ['idle', 'working', 'blocked', 'done']
const VALID_MOODS = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']

function getSessionSlug() {
  const cwdHash = require('crypto').createHash('md5').update(process.cwd()).digest('hex').slice(0, 4)
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    if (branch && branch !== 'HEAD') {
      return branch.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) + `-${cwdHash}`
    }
  } catch {}

  return path.basename(process.cwd()).replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) + `-${cwdHash}`
}

function normalizeAgent(agent) {
  if (!agent || !VALID_ROLES.includes(agent.role) || !VALID_STATUSES.includes(agent.status)) return null
  return {
    role: agent.role,
    task: agent.task || null,
    status: agent.status,
    label: agent.label || null,
    hint: agent.hint || null,
  }
}

function normalizeCodexStatusPayload(body, now = Date.now()) {
  if (!body || typeof body !== 'object') {
    throw new Error('Expected a JSON object payload')
  }

  if (body.type === 'office-status') {
    const agents = Array.isArray(body.agents)
      ? body.agents.map(normalizeAgent).filter(Boolean)
      : []

    return {
      type: 'office-status',
      agents,
      activeCount: agents.filter((a) => a.status === 'working' || a.status === 'blocked').length,
      workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
      mood: VALID_MOODS.includes(body.mood) ? body.mood : null,
      source: body.source || 'codex-cli',
      _seq: body._seq || String(now),
    }
  }

  const agents = []
  for (const role of VALID_ROLES) {
    const value = body[role]
    if (value == null) continue
    const isStatus = VALID_STATUSES.includes(value)
    agents.push({
      role,
      task: isStatus ? null : value,
      status: isStatus ? value : 'working',
      label: body.label || null,
      hint: body.hint || null,
    })
  }

  return {
    type: 'office-status',
    agents,
    activeCount: agents.filter((a) => a.status === 'working' || a.status === 'blocked').length,
    workflow: body.workflow || null,
    source: body.source || 'codex-cli',
    _seq: body._seq || String(now),
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
  const tmpFile = `${statusFile}.tmp.${process.pid}`
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(output, null, 2))
    fs.renameSync(tmpFile, statusFile)
  } catch {
    try { fs.writeFileSync(statusFile, JSON.stringify(output, null, 2)) } catch {}
    try { fs.unlinkSync(`${statusFile}.tmp.${process.pid}`) } catch {}
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
}
