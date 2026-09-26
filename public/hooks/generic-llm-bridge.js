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
 *   --port 5174       Office dev server port (default: 5174)
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

// 2026-09-26 audit finding 5: the shipped docs (docs/INTEGRATIONS.md lines 201/215) invoke this
// script with `--port=5174` (one argv token), but parseArgs only recognized the two-token
// `--port 5174` form — the `=` form was silently ignored, falling back to the default port.
// Support both forms for every flag: `--flag value` and `--flag=value`.
function parseArgs(argv) {
  const args = { port: 5174, watch: process.cwd(), source: 'generic' }
  for (let i = 2; i < argv.length; i++) {
    const tok = argv[i]
    const eq = tok.indexOf('=')
    let flag, inlineValue
    if (eq !== -1 && tok.startsWith('--')) {
      flag = tok.slice(0, eq)
      inlineValue = tok.slice(eq + 1)
    } else {
      flag = tok
      inlineValue = undefined
    }
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue
      const next = argv[i + 1]
      if (next !== undefined) i++
      return next
    }
    if (flag === '--port') { const v = takeValue(); if (v !== undefined) args.port = /^\d+$/.test(v) ? parseInt(v, 10) : NaN }
    else if (flag === '--watch') { const v = takeValue(); if (v) args.watch = path.resolve(v) }
    else if (flag === '--source') { const v = takeValue(); if (v) args.source = v }
  }
  if (!args.port || args.port < 1 || args.port > 65535) {
    console.error(`[bridge] Invalid port: ${args.port}. Must be 1-65535.`)
    process.exit(1)
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

// Same language resolution as office-status-hook.js: the office writes the viewer's choice to
// ~/.claude/office-lang, and 'en' is the default because the browser-side i18n default is 'en'.
// Before this every label this bridge produced was hard-coded Traditional Chinese, so an
// English office showed Chinese status text with no way to change it.
function detectHookLang() {
  try {
    const langFile = path.join(os.homedir(), '.claude', 'office-lang')
    const lang = fs.readFileSync(langFile, 'utf-8').trim()
    if (lang === 'en' || lang === 'zh-TW') return lang
  } catch {}
  return 'en'
}

const LANG = detectHookLang()

function workingLabel(filePath) {
  const base = path.basename(filePath || '')
  // With a filename the label is already language-neutral (emoji + the file's own name).
  if (!base) return LANG === 'en' ? '✏️ Editing code' : '✏️ 改 code 中'
  const role = fileToRole(filePath)
  if (role === 'qa') return `🧪 ${base}`
  if (role === 'res') return `📝 ${base}`
  return `✏️ ${base}`
}

const DONE_LABELS = LANG === 'en'
  ? ['✅ Done', '✅ Complete']
  : ['✅ 搞定', '✅ 完成']
function doneLabel() { return DONE_LABELS[Math.floor(Math.random() * DONE_LABELS.length)] }
const IDLE_LABEL = LANG === 'en' ? '☕ Waiting for instructions' : '☕ 等指令中'

// ─── POST to /api/status ──────────────────────────────────────────────────────

function postStatus(port, agents, source) {
  const activeCount = agents.filter(a => a.status === 'working' || a.status === 'blocked').length
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
    res.resume()
    if (res.statusCode === 401) {
      console.warn('[bridge] 401 Unauthorized — server has OFFICE_API_TOKEN set. Bridge updates are silently dropped. Check token configuration.')
    }
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
      role: role,
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
    idleAgents.push({ role: role, status: 'idle', label: IDLE_LABEL, task: null })
  }
  if (idleAgents.length > 0) postStatus(port, idleAgents, source)

  // Then after 2s: mark them done
  setTimeout(() => {
    if (claudeWroteRecently()) return
    const doneAgents = []
    for (const role of activeRoles.keys()) {
      doneAgents.push({ role: role, status: 'done', label: doneLabel(), task: null })
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

function onFileChange(filePath, port, source, watchDir) {
  const role = fileToRole(filePath)

  // Update tracking
  activeRoles.set(role, { file: filePath, lastSeen: Date.now() })

  // Per-role debounce
  if (debounceTimers.has(role)) clearTimeout(debounceTimers.get(role))
  debounceTimers.set(role, setTimeout(() => {
    debounceTimers.delete(role)

    // On debounce tick: refresh changed files from git to get accurate picture.
    // 2026-09-26 audit finding 5: this used to call getGitChangedFiles(process.cwd()) — the
    // BRIDGE PROCESS's own cwd, not the watched project (`watchDir`). Both servers/CLIs are
    // spawned with `cwd: root` (bin/cli.js), so this silently no-op'd whenever the bridge was
    // launched from a different directory than `--watch` — exactly the documented multi-worktree
    // use case (docs/INTEGRATIONS.md "Multi-Worktree Support").
    const changed = getGitChangedFiles(watchDir)
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

// Paths to ignore (avoid noise from build artifacts, caches, and the status file itself).
// 2026-09-26 audit finding 5: the old single unanchored regex matched `\.git` and `dist` as
// SUBSTRINGS anywhere in the path — `.git` also matched `.github/…` (permanently killing the
// `.github` → `ops` rule in fileToRole(), since the watcher filtered those paths out before
// fileToRole ever saw them) and `dist` matched any filename containing it, e.g. `distance.js`.
// Split into a path-segment-anchored directory check and a basename-only check: `office-status`
// is INTENTIONALLY still a substring match on the basename — it exists to filter out the
// bridge's own hook/status files by name (e.g. `office-status-hook.js`), not a directory.
const IGNORE_DIR_RE = /(^|[\\/])(node_modules|\.git|dist|\.next|\.nuxt|\.turbo)([\\/]|$)/
const IGNORE_FILE_RE = /office-status/
// 2026-09-26 review finding LOW #6: the anchored regex above still tested the ABSOLUTE path —
// a --watch dir living under any ancestor directory named node_modules/.git/dist/.next/.nuxt/
// .turbo (e.g. a project checked out at /builds/dist/my-project) matched every single event and
// silently ignored the entire watch. Test the path RELATIVE to the watched project instead, so
// only segments INSIDE the watched tree can trigger the ignore rule. `watchDir` is optional so
// existing callers that only have an absolute path (none remain in this file, kept for safety)
// degrade to the old absolute-path behavior rather than throwing.
function shouldIgnorePath(fullPath, watchDir) {
  const rel = watchDir ? path.relative(watchDir, fullPath) : fullPath
  const norm = rel.replace(/\\/g, '/')
  if (IGNORE_DIR_RE.test(norm)) return true
  return IGNORE_FILE_RE.test(path.basename(norm))
}

function startWatcher(watchDir, port, source) {
  let watcher

  try {
    // Try recursive watch first (macOS/Windows native support)
    watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return
      const full = path.join(watchDir, filename)
      if (shouldIgnorePath(full, watchDir)) return
      onFileChange(full, port, source, watchDir)
    })
  } catch {
    // Fall back to watching src/ only (Linux without inotify flags)
    const srcDir = path.join(watchDir, 'src')
    const target = fs.existsSync(srcDir) ? srcDir : watchDir
    try {
      watcher = fs.watch(target, { recursive: false }, (eventType, filename) => {
        if (!filename) return
        const full = path.join(target, filename)
        if (shouldIgnorePath(full, watchDir)) return
        onFileChange(full, port, source, watchDir)
      })
      console.warn(`[bridge] Recursive watch unavailable — watching ${target} only`)
    } catch (err) {
      console.error(`[bridge] Could not start file watcher: ${err.message}`)
      process.exit(1)
    }
  }

  watcher.on('error', (err) => {
    console.error(`[bridge] Watcher error: ${err.message}`)
    shutdown(port, source, watcher)
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
    role: role,
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

// Guard direct execution vs `require()` so unit tests can exercise the pure helpers
// (parseArgs, shouldIgnorePath, fileToRole) without starting a real file watcher / HTTP client.
if (require.main === module) {
  main()
}

module.exports = { parseArgs, fileToRole, shouldIgnorePath, IGNORE_DIR_RE, IGNORE_FILE_RE }
