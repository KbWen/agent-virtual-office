import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { normalizePost, VALID_ROLES } from './src/utils/normalizePost.js'

// Middleware: Universal status API
//   GET  /api/status → read current status (browser polls this)
//   POST /api/status → update status (any tool can curl this)
//
// Usage from any tool:
//   curl -X POST http://localhost:5174/api/status \
//     -H "Content-Type: application/json" \
//     -d '{"dev":"working","qa":"testing","workflow":"Sprint 42"}'
//
// Shorthand format: { "dev": "working", "qa": "blocked", "workflow": "name" }
// Full format:      { "type": "office-status", "agents": [...], "workflow": "name" }

// Shared status file path (shared between plugins)
const STATUS_PATH = path.join(os.homedir(), '.claude', 'office-status.json')

const LOOPBACK_ORIGIN_RE = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i

export function getOfficeApiConfig(env = process.env) {
  const token = env.OFFICE_API_TOKEN?.trim() || null
  const allowedOrigins = (env.OFFICE_API_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return {
    token,
    allowedOrigins,
  }
}

export function isAllowedOrigin(origin, config = getOfficeApiConfig()) {
  if (!origin) return true
  if (config.allowedOrigins.length > 0) return config.allowedOrigins.includes(origin)
  return LOOPBACK_ORIGIN_RE.test(origin)
}

export function getAllowedOriginHeader(origin, config = getOfficeApiConfig()) {
  if (!origin || !isAllowedOrigin(origin, config)) return null
  return origin
}

export function isAuthorizedOfficeRequest(req, config = getOfficeApiConfig()) {
  if (!config.token) return true
  const header = req.headers['x-office-token']
  const auth = req.headers.authorization
  if (header === config.token) return true
  if (typeof auth === 'string' && auth === `Bearer ${config.token}`) return true
  return false
}

function officeStatusPlugin() {
  const statusPath = STATUS_PATH
  const apiConfig = getOfficeApiConfig()

  // Simple rate limiter: max 30 POST requests per 10 seconds per IP
  const postCounts = new Map()
  const RATE_WINDOW = 10000
  const RATE_LIMIT = 30

  function checkRateLimit(req) {
    if (req.method !== 'POST') return true
    const ip = req.socket?.remoteAddress || 'unknown'
    const now = Date.now()
    const entry = postCounts.get(ip)
    if (!entry || now - entry.start > RATE_WINDOW) {
      postCounts.set(ip, { start: now, count: 1 })
      return true
    }
    entry.count++
    return entry.count <= RATE_LIMIT
  }

  return {
    name: 'office-status-api',
    configureServer(server) {
      server.middlewares.use('/api/status', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-cache')
        const allowedOrigin = getAllowedOriginHeader(req.headers.origin, apiConfig)
        if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match, X-Office-Token, Authorization')
        res.setHeader('Vary', 'Origin')

        // CORS preflight
        if (req.method === 'OPTIONS') {
          if (!isAllowedOrigin(req.headers.origin, apiConfig)) {
            res.statusCode = 403
            res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }))
            return
          }
          res.statusCode = 204
          res.end()
          return
        }

        // Rate limiting for POST
        if (!checkRateLimit(req)) {
          res.statusCode = 429
          res.end(JSON.stringify({ ok: false, error: 'Too many requests' }))
          return
        }

        // GET → merge all active session files (multi-worktree support)
        if (req.method === 'GET') {
          try {
            const clientEtag = req.headers['if-none-match']
            // NOTE: No fast-path ETag skip here — session files are written directly
            // to disk by hooks and don't go through POST, so we must always re-scan.

            const dir = path.dirname(statusPath)
            const now = Date.now()

            // Scan ~/.claude/office-status-*.json (only sessions from THIS project)
            const projectRoot = process.cwd()
            const sessions = []
            if (fs.existsSync(dir)) {
              for (const file of fs.readdirSync(dir)) {
                if (!file.match(/^office-status(-[^.]+)?\.json$/)) continue
                try {
                  const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
                  const parsed = JSON.parse(raw)
                  const seq = parseInt(parsed._seq, 10)
                  if (seq && now - seq > 60000) continue // stale — skip
                  // Skip sessions from other projects (hooks write _cwd).
                  // Slugged files without _cwd are from old hooks — skip them too (bare main is OK as fallback).
                  if (parsed._cwd && path.resolve(parsed._cwd) !== path.resolve(projectRoot)) continue
                  if (!parsed._cwd && file !== 'office-status.json') continue
                  // Skip file-watcher sessions in multi-session merge — they fire on every
                  // JS edit and would make single-worktree users appear as multi-session.
                  if (parsed.source === 'file-watcher') continue
                  const slug = file === 'office-status.json' ? 'main'
                    : file.replace(/^office-status-/, '').replace(/\.json$/, '')
                  sessions.push({ slug, data: parsed })
                } catch {}
              }
            }

            if (sessions.length === 0) { res.end('null'); return }

            // Dedup: if bare `office-status.json` ("main") has a _seq within 2s of any
            // slugged session, it's a duplicate from an old user-level hook. Drop it.
            if (sessions.length > 1) {
              const mainIdx = sessions.findIndex(s => s.slug === 'main')
              if (mainIdx !== -1) {
                const mainSeq = parseInt(sessions[mainIdx].data._seq, 10) || 0
                const isDup = sessions.some((s, i) => i !== mainIdx
                  && Math.abs((parseInt(s.data._seq, 10) || 0) - mainSeq) < 2000)
                if (isDup) sessions.splice(mainIdx, 1)
              }
            }

            let merged
            if (sessions.length === 1) {
              // Single session — return as-is (backward compat, plain role IDs)
              merged = sessions[0].data
            } else {
              // Multi-session — one representative agent per session (the most active one)
              // Rule: only working/blocked agents spawn extra characters; done agents are transient
              // Priority: blocked > working (shows the most urgent state per session)
              const STATUS_PRIORITY = { blocked: 0, working: 1, done: 2, idle: 3 }
              const allAgents = []
              let latestSeq = 0
              let workflow = null
              for (const { slug, data } of sessions) {
                const seq = parseInt(data._seq, 10) || 0
                if (seq > latestSeq) { latestSeq = seq; workflow = data.workflow }
                // Pick the single most active agent from this session
                const active = (data.agents || [])
                  .filter(a => a.status === 'working' || a.status === 'blocked')
                  .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9))
                const pick = active[0]
                if (pick) allAgents.push({ ...pick, role: `${slug}~${pick.role}`, session: slug })
              }
              merged = {
                _seq: String(latestSeq),
                type: 'office-status',
                agents: allAgents,
                activeCount: allAgents.filter(a => a.status !== 'done').length,
                workflow,
                source: 'multi-session',
                sessionCount: sessions.length,
              }
            }

            const data = JSON.stringify(merged)
            const etag = '"' + createHash('md5').update(data).digest('hex').slice(0, 12) + '"'
            if (clientEtag === etag) { res.statusCode = 304; res.end(); return }
            res.setHeader('ETag', etag)
            res.end(data)
          } catch {
            res.end('null')
          }
          return
        }

        // POST → update status (16KB limit to prevent abuse)
        if (req.method === 'POST') {
          if (!isAuthorizedOfficeRequest(req, apiConfig)) {
            res.statusCode = 401
            res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }))
            return
          }
          let body = ''
          let aborted = false
          const MAX_BODY = 16 * 1024
          req.on('data', chunk => {
            if (aborted) return
            body += chunk
            if (body.length > MAX_BODY) {
              aborted = true
              res.statusCode = 413
              res.end(JSON.stringify({ ok: false, error: 'Body too large' }))
              req.destroy()
            }
          })
          req.on('end', () => {
            if (aborted) return
            try {
              const parsed = JSON.parse(body)
              const normalized = normalizePost(parsed)
              normalized._cwd = process.cwd()
              // Ensure directory exists
              const dir = path.dirname(statusPath)
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
              const json = JSON.stringify(normalized, null, 2)
              fs.writeFileSync(statusPath, json)
              res.end(JSON.stringify({ ok: true, agents: normalized.agents?.length ?? 0 }))
            } catch (err) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: err.message }))
            }
          })
          return
        }

        res.statusCode = 405
        res.end(JSON.stringify({ error: 'Method not allowed' }))
      })

      // ─── /api/event — one-shot CI/CD webhook ────────────────────────────
      // Usage:
      //   curl -X POST http://localhost:5173/api/event \
      //     -H "Content-Type: application/json" \
      //     -d '{"event":"pr-merged"}'
      //
      // Supported events: pr-merged, pr-opened, pr-reviewed,
      //   test-passed, test-failed, build-success, build-failed,
      //   deploy-start, deploy-success, deploy-failed, release
      //
      // Custom: { "event": "custom", "role": "qa", "status": "blocked", "label": "❌ flaky test" }

      const EVENT_TO_STATUS = {
        'pr-merged':      [{ role: 'ops', status: 'done',    label: '🚀 PR merged!' },
                           { role: 'dev', status: 'done',    label: '✅ 上了！' }],
        'pr-opened':      [{ role: 'dev', status: 'working', label: '📋 PR 開好了' }],
        'pr-reviewed':    [{ role: 'qa',  status: 'done',    label: '✅ PR reviewed' }],
        'test-passed':    [{ role: 'qa',  status: 'done',    label: '✅ Tests passed!' }],
        'test-failed':    [{ role: 'qa',  status: 'blocked', label: '❌ Tests failed' }],
        'build-success':  [{ role: 'ops', status: 'done',    label: '🏗️ Build success' }],
        'build-failed':   [{ role: 'ops', status: 'blocked', label: '💥 Build failed' }],
        'deploy-start':   [{ role: 'ops', status: 'working', label: '🚀 Deploying...' }],
        'deploy-success': [{ role: 'ops', status: 'done',    label: '🎉 Deployed!' }],
        'deploy-failed':  [{ role: 'ops', status: 'blocked', label: '💥 Deploy failed' }],
        'release':        [{ role: 'ops', status: 'done',    label: '🎉 Released!' },
                           { role: 'dev', status: 'done',    label: '🎉 Ship it!' },
                           { role: 'qa',  status: 'done',    label: '✅ Quality approved' }],
      }

      server.middlewares.use('/api/event', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        const allowedOrigin = getAllowedOriginHeader(req.headers.origin, apiConfig)
        if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Office-Token, Authorization')
        res.setHeader('Vary', 'Origin')

        if (req.method === 'OPTIONS') {
          if (!isAllowedOrigin(req.headers.origin, apiConfig)) {
            res.statusCode = 403
            res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }))
            return
          }
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        if (!isAuthorizedOfficeRequest(req, apiConfig)) {
          res.statusCode = 401
          res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }))
          return
        }
        if (!checkRateLimit(req)) {
          res.statusCode = 429
          res.end(JSON.stringify({ ok: false, error: 'Too many requests' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            const eventName = parsed.event || ''

            let agents
            if (eventName === 'custom' && parsed.role && parsed.status) {
              if (!VALID_ROLES.includes(parsed.role) || !VALID_STATUSES.includes(parsed.status)) {
                res.statusCode = 400
                res.end(JSON.stringify({ ok: false, error: `Invalid role or status` }))
                return
              }
              agents = [{ role: parsed.role, status: parsed.status, label: parsed.label || eventName }]
            } else {
              agents = EVENT_TO_STATUS[eventName]
              if (!agents) {
                res.statusCode = 400
                res.end(JSON.stringify({ ok: false, error: `Unknown event: ${eventName}` }))
                return
              }
              // Allow label override
              if (parsed.label) agents = agents.map((a, i) => i === 0 ? { ...a, label: parsed.label } : a)
            }

            const output = {
              _seq: String(Date.now()),
              _cwd: process.cwd(),
              type: 'office-status',
              agents,
              activeCount: agents.filter(a => a.status !== 'done').length,
              workflow: parsed.workflow || eventName,
              source: 'webhook',
            }
            const dir = path.dirname(statusPath)
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(statusPath, JSON.stringify(output, null, 2))
            res.end(JSON.stringify({ ok: true, event: eventName, agents: agents.length }))
          } catch (err) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: err.message }))
          }
        })
      })
    }
  }
}

// ─── Zero-config fallback: watch ~/.claude/office-status.json + project files ───
// When hooks aren't installed (e.g. worktree, new setup), the office can still
// detect development activity by watching file changes via Vite's built-in watcher.

function fileWatcherFallbackPlugin() {
  const statusPath = STATUS_PATH
  const DEBOUNCE_MS = 1500
  const recentEdits = new Map()  // role → { file, time }

  // Map file path/extension to agent roles (test/spec checked first)
  function fileToRole(file) {
    if (/\.(test|spec)\./i.test(file)) return 'qa'
    if (/tests?[/\\]/i.test(file)) return 'qa'
    if (/\.(jsx?|tsx?|vue|svelte)$/i.test(file)) return 'dev'
    if (/\.(css|scss|less|tailwind)/i.test(file)) return 'dev'
    if (/\.(json|ya?ml|toml|env)/i.test(file)) return 'ops'
    if (/\.(md|txt|doc)/i.test(file)) return 'res'
    return 'dev'
  }

  function shortName(filePath) {
    return path.basename(filePath)
  }

  function writeStatus(role, file) {
    const now = Date.now()
    // Per-role debounce (so editing test + src simultaneously both register)
    const last = recentEdits.get(role)
    if (last && now - last.time < DEBOUNCE_MS) return

    // Don't overwrite richer hook-generated status — skip if hooks recently wrote
    try {
      const existing = JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
      if (existing.source === 'claude-cli' && existing._seq && now - parseInt(existing._seq, 10) < 10000) return
    } catch {}

    recentEdits.set(role, { file, time: now })

    // Build agents list from all recent edits (within 15s)
    const agents = []
    for (const [r, entry] of recentEdits) {
      if (now - entry.time < 15000) {
        agents.push({ role: r, task: 'Edit', status: 'working', label: `✏️ ${shortName(entry.file)}` })
      } else {
        recentEdits.delete(r)
      }
    }

    const output = {
      _seq: String(now),
      type: 'office-status',
      agents,
      activeCount: agents.length,
      source: 'file-watcher',
    }

    try {
      const dir = path.dirname(statusPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(statusPath, JSON.stringify(output, null, 2))
    } catch {}
  }

  return {
    name: 'office-file-watcher-fallback',
    configureServer(server) {
      // Watch project source files for changes (Vite's watcher covers src/)
      server.watcher.on('change', (file) => {
        // Skip node_modules, dist, .git, and the status file itself
        if (/node_modules|dist|\.git/.test(file)) return
        if (file.includes('office-status')) return
        const role = fileToRole(file)
        writeStatus(role, file)
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), officeStatusPlugin(), fileWatcherFallbackPlugin()],
  server: {
    strictPort: false,
  },
  build: {
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
})
