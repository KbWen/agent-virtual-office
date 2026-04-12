#!/usr/bin/env node
/**
 * Agent Virtual Office — Generic LLM Bridge
 *
 * Connects any LLM tool (Copilot, Cursor, Aider, ollama, Continue.dev, etc.) to the
 * pixel-art office by watching file changes and POSTing status updates.
 *
 * Usage:
 *   node generic-llm-bridge.js [options]
 *
 * Options:
 *   --port 5173       Office dev server port (default: 5173)
 *   --watch .         Directory to watch (default: current directory)
 *   --source copilot  Name shown in office (default: generic)
 *
 * No dependencies — just Node.js.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const http = require('http')
const os = require('os')

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { port: 5173, watch: process.cwd(), source: 'generic' }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) { args.port = parseInt(argv[i + 1], 10); i++ }
    else if (argv[i] === '--watch' && argv[i + 1]) { args.watch = path.resolve(argv[i + 1]); i++ }
    else if (argv[i] === '--source' && argv[i + 1]) { args.source = argv[i + 1]; i++ }
  }
  return args
}

// ─── File-to-role mapping ─────────────────────────────────────────────────────

function fileToRole(filePath) {
  if (!filePath) return 'dev'
  const f = filePath.replace(/\\/g, '/').toLowerCase()
  const base = path.basename(f)

  if (/\.(test|spec)\./i.test(base)) return 'qa'
  if (/\/(tests?|__tests?)\//i.test(f)) return 'qa'
  if (/^dockerfile/i.test(base) || /docker-compose/i.test(base)) return 'ops'
  if (/\/(\.github|\.gitlab)\//i.test(f)) return 'ops'
  if (/\.(ya?ml|toml)$/i.test(base) && !/^package/i.test(base)) return 'ops'
  if (/\.(md|txt|rst)$/i.test(base)) return 'res'
  if (/\.(css|scss|less|svg|png|jpe?g)$/i.test(base)) return 'designer'
  if (/\/(adr|architecture)\//i.test(f)) return 'arch'
  return 'dev'
}

// ─── Labels ───────────────────────────────────────────────────────────────────

function workingLabel(filePath) {
  const base = path.basename(filePath || '')
  if (!base) return '✏️ 改 code 中'
  const role = fileToRole(filePath)
  if (role === 'qa') return `🧪 ${base}`
  if (role === 'res') return `📝 ${base}`
  return `✏️ ${base}`
}

const DONE_LABELS = ['✅ 搞定', '✅ 完成']
function doneLabel() { return DONE_LABELS[Math.floor(Math.random() * DONE_LABELS.length)] }
const IDLE_LABEL = '☕ 等指令中'

// ─── POST to /api/status ──────────────────────────────────────────────────────

function postStatus(port, agents, source) {
  const activeCount = agents.filter(a => a.status !== 'done' && a.status !== 'idle').length
  const payload = JSON.stringify({
    _seq: String(Date.now()),
    type: 'office-status',
    agents,
    activeCount,
    source,
  })

  const options = {
    hostname: 'localhost',
    port,
    path: '/api/status',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }

  const req = http.request(options, (res) => {
    // Consume the response body so the socket closes cleanly
    res.resume()
  })

  req.on('error', () => {
    // Silently ignore — office server may not be running yet
  })

  req.setTimeout(3000, () => { req.destroy() })
  req.write(payload)
  req.end()
}

// ─── Claude-cli guard — skip if a real Claude hook wrote recently ─────────────

function claudeWroteRecently() {
  try {
    // Look for any office-status-*.json written by claude-cli in ~/.claude
    const dir = path.join(os.homedir(), '.claude')
    if (!fs.existsSync(dir)) return false
    const now = Date.now()
    for (const file of fs.readdirSync(dir)) {
      if (!file.match(/^office-status(-[^.]+)?\.json$/)) continue
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
        const parsed = JSON.parse(raw)
        if (parsed.source === 'claude-cli') {
          const seq = parseInt(parsed._seq, 10)
          if (seq && now - seq < 15000) return true
        }
      } catch {}
    }
  } catch {}
  return false
}

// ─── Git-aware changed files ──────────────────────────────────────────────────

function getGitChangedFiles(watchDir) {
  try {
    const out = execSync('git diff --name-only HEAD', {
      cwd: watchDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
    }).trim()
    if (!out) return []
    return out.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

// activeRoles: Map<role, { file: string, lastSeen: number }>
const activeRoles = new Map()
// debounceTimers: Map<role, NodeJS.Timeout>
const debounceTimers = new Map()

const DEBOUNCE_MS = 2000
const IDLE_TIMEOUT_MS = 15000

let idleTimer = null

// ─── Core logic ───────────────────────────────────────────────────────────────

function buildAgents() {
  const agents = []
  for (const [role, entry] of activeRoles) {
    agents.push({
      agentId: role,
      status: 'working',
      label: workingLabel(entry.file),
      task: 'Edit',
    })
  }
  return agents
}

function flushWorking(port, source) {
  if (claudeWroteRecently()) return
  const agents = buildAgents()
  if (agents.length === 0) return
  postStatus(port, agents, source)
}

function flushIdleThenDone(port, source) {
  if (claudeWroteRecently()) return

  // First: mark all tracked agents as idle
  const idleAgents = []
  for (const role of activeRoles.keys()) {
    idleAgents.push({ agentId: role, status: 'idle', label: IDLE_LABEL, task: null })
  }
  if (idleAgents.length > 0) postStatus(port, idleAgents, source)

  // Then after 2s: mark them done
  setTimeout(() => {
    if (claudeWroteRecently()) return
    const doneAgents = []
    for (const role of activeRoles.keys()) {
      doneAgents.push({ agentId: role, status: 'done', label: doneLabel(), task: null })
    }
    if (doneAgents.length > 0) postStatus(port, doneAgents, source)
    activeRoles.clear()
  }, 2000)
}

function resetIdleTimer(port, source) {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    flushIdleThenDone(port, source)
  }, IDLE_TIMEOUT_MS)
}

function onFileChange(filePath, port, source) {
  const role = fileToRole(filePath)

  // Update tracking
  activeRoles.set(role, { file: filePath, lastSeen: Date.now() })

  // Per-role debounce
  if (debounceTimers.has(role)) clearTimeout(debounceTimers.get(role))
  debounceTimers.set(role, setTimeout(() => {
    debounceTimers.delete(role)

    // On debounce tick: refresh changed files from git to get accurate picture
    const changed = getGitChangedFiles(process.cwd())
    for (const cf of changed) {
      const r = fileToRole(cf)
      // Only update if we haven't already seen this role from fs.watch
      if (!activeRoles.has(r)) {
        activeRoles.set(r, { file: cf, lastSeen: Date.now() })
      }
    }

    flushWorking(port, source)
  }, DEBOUNCE_MS))

  resetIdleTimer(port, source)
}

// ─── File watcher ─────────────────────────────────────────────────────────────

// Paths to ignore (avoid noise from build artifacts, caches, and the status file itself)
const IGNORE_RE = /node_modules|\.git|dist|\.next|\.nuxt|\.turbo|office-status/

function startWatcher(watchDir, port, source) {
  let watcher

  try {
    // Try recursive watch first (macOS/Windows native support)
    watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return
      const full = path.join(watchDir, filename)
      if (IGNORE_RE.test(full.replace(/\\/g, '/'))) return
      onFileChange(full, port, source)
    })
  } catch {
    // Fall back to watching src/ only (Linux without inotify flags)
    const srcDir = path.join(watchDir, 'src')
    const target = fs.existsSync(srcDir) ? srcDir : watchDir
    try {
      watcher = fs.watch(target, { recursive: false }, (eventType, filename) => {
        if (!filename) return
        const full = path.join(target, filename)
        if (IGNORE_RE.test(full.replace(/\\/g, '/'))) return
        onFileChange(full, port, source)
      })
      console.warn(`[bridge] Recursive watch unavailable — watching ${target} only`)
    } catch (err) {
      console.error(`[bridge] Could not start file watcher: ${err.message}`)
      process.exit(1)
    }
  }

  watcher.on('error', (err) => {
    console.error(`[bridge] Watcher error: ${err.message}`)
  })

  return watcher
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(port, source, watcher) {
  console.log('\n[bridge] Shutting down — posting final done status...')

  if (idleTimer) clearTimeout(idleTimer)
  for (const t of debounceTimers.values()) clearTimeout(t)

  watcher.close()

  const roles = activeRoles.size > 0 ? [...activeRoles.keys()] : ['dev']
  const doneAgents = roles.map(role => ({
    agentId: role,
    status: 'done',
    label: doneLabel(),
    task: null,
  }))

  postStatus(port, doneAgents, source)

  // Give the POST time to flush before exit
  setTimeout(() => process.exit(0), 500)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const { port, watch: watchDir, source } = parseArgs(process.argv)

  if (!fs.existsSync(watchDir)) {
    console.error(`[bridge] Watch directory does not exist: ${watchDir}`)
    process.exit(1)
  }

  console.log(`🏢 Office bridge started — watching ${watchDir} → localhost:${port} (source: ${source})`)
  console.log('[bridge] Press Ctrl+C to stop.')

  const watcher = startWatcher(watchDir, port, source)

  process.on('SIGINT', () => shutdown(port, source, watcher))
  process.on('SIGTERM', () => shutdown(port, source, watcher))
}

main()
