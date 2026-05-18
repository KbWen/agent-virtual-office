import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { normalizePost, VALID_ROLES, VALID_STATUSES } from './src/utils/normalizePost.js'
import { scanAndMerge, getSessionStats } from './src/server/scanSessions.mjs'

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

// Auto-detect server's LAN IPs for CORS when --host is active
function getServerIPs() {
  const ips = new Set(['localhost', '127.0.0.1', '[::1]'])
  try {
    const interfaces = os.networkInterfaces()
    for (const iface of Object.values(interfaces)) {
      for (const addr of iface) {
        if (!addr.internal) {
          ips.add(addr.family === 'IPv6' ? `[${addr.address}]` : addr.address)
        }
      }
    }
  } catch {}
  return ips
}

const SERVER_IPS = getServerIPs()

// Monotonic _seq: plain integer string, identical implementation as server.mjs.
// Number(_seq) and parseInt(_seq,10) both work identically; no suffix to truncate.
let _seqLast = 0
function nextSeq() {
  const now = Date.now()
  _seqLast = now > _seqLast ? now : _seqLast + 1
  return String(_seqLast)
}

// Constant-time token comparison — prevents timing oracle attacks.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// Atomic write: temp file + rename to prevent partial-read corruption.
function atomicWrite(filePath, content) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
  try {
    fs.writeFileSync(tmp, content)
    fs.renameSync(tmp, filePath)
    return true
  } catch {
    let ok = false
    try { fs.writeFileSync(filePath, content); ok = true } catch {}
    try { fs.unlinkSync(tmp) } catch {}
    return ok
  }
}

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
  // Allow loopback + any of this machine's own IPs (for --host LAN access)
  try {
    const url = new URL(origin)
    if (SERVER_IPS.has(url.hostname)) return true
  } catch {}
  return LOOPBACK_ORIGIN_RE.test(origin)
}

export function getAllowedOriginHeader(origin, config = getOfficeApiConfig()) {
  if (!origin || !isAllowedOrigin(origin, config)) return null
  return origin
}

export function isAuthorizedOfficeRequest(req, config = getOfficeApiConfig()) {
  if (!config.token) return true
  const h = req.headers['x-office-token']
  const a = req.headers.authorization
  // Evaluate both before OR-ing — avoids timing oracle from short-circuit evaluation.
  const m1 = typeof h === 'string' && safeEqual(h, config.token)
  const m2 = typeof a === 'string' && safeEqual(a, `Bearer ${config.token}`)
  return m1 || m2
}

function officeStatusPlugin() {
  const statusPath = STATUS_PATH
  const apiConfig = getOfficeApiConfig()

  // Simple rate limiter: max 30 POST requests per 10 seconds per IP
  const postCounts = new Map()
  const RATE_WINDOW = 10000
  const RATE_LIMIT = 30

  // SSE clients — receives pushes from both POST updates and file-watcher events
  const sseClients = new Set()

  function broadcastSSE(merged) {
    if (sseClients.size === 0) return
    const payload = `event: status\ndata: ${JSON.stringify(merged)}\n\n`
    for (const client of [...sseClients]) {
      try { client.write(payload) } catch { sseClients.delete(client) }
    }
  }

  // M4: keyed on IP only — shared 30 POST/10s budget across all write endpoints
  function checkRateLimit(req) {
    if (req.method !== 'POST') return true
    const ip = req.socket?.remoteAddress || 'unknown'
    const now = Date.now()
    const ts = postCounts.get(ip) || []
    const fresh = ts.filter(t => now - t < RATE_WINDOW)
    if (fresh.length >= RATE_LIMIT) { postCounts.set(ip, fresh); return false }
    fresh.push(now)
    postCounts.set(ip, fresh)
    return true
  }

  return {
    name: 'office-status-api',
    configureServer(server) {
      server.middlewares.use('/api/status', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('X-Content-Type-Options', 'nosniff')
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
          res.setHeader('Access-Control-Max-Age', '600')
          res.statusCode = 204
          res.end()
          return
        }

        // GET → merge all active session files (multi-worktree support)
        // Scan/dedup/merge delegated to shared scanAndMerge (src/server/scanSessions.mjs)
        if (req.method === 'GET') {
          try {
            const clientEtag = req.headers['if-none-match']
            const merged = scanAndMerge(path.dirname(statusPath), process.cwd())
            if (!merged) { res.end('null'); return }
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
          const reqOrigin = req.headers.origin
          if (reqOrigin && !isAllowedOrigin(reqOrigin, apiConfig)) {
            res.statusCode = 403
            res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }))
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
          req.setEncoding('utf-8')
          let body = '', aborted = false, receivedBytes = 0
          const MAX_BODY = 16 * 1024
          req.on('data', chunk => {
            if (aborted) return
            receivedBytes += Buffer.byteLength(chunk, 'utf8')
            if (receivedBytes > MAX_BODY) {
              aborted = true
              res.statusCode = 413
              res.end(JSON.stringify({ ok: false, error: 'Body too large' }))
              req.resume()
              return
            }
            body += chunk
          })
          req.on('end', () => {
            if (aborted) return
            try {
              const parsed = JSON.parse(body)
              const normalized = normalizePost(parsed)
              normalized._cwd = process.cwd()
              const dir = path.dirname(statusPath)
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
              if (!atomicWrite(statusPath, JSON.stringify(normalized, null, 2))) {
                res.statusCode = 500
                return res.end(JSON.stringify({ ok: false, error: 'Write failed' }))
              }
              // Push to any connected SSE clients immediately (no need to wait for poll)
              const sseData = scanAndMerge(path.dirname(statusPath), process.cwd())
              if (sseData) broadcastSSE(sseData)
              res.end(JSON.stringify({ ok: true, agents: normalized.agents?.length ?? 0 }))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
            }
          })
          return
        }

        res.statusCode = 405
        res.end(JSON.stringify({ error: 'Method not allowed' }))
      })

      // SSE push: GET /api/status/stream
      // Clients receive an immediate snapshot then pushed updates on every hook write
      // or API POST — no polling needed when connected.
      server.middlewares.use('/api/status/stream', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
        const allowedSse = getAllowedOriginHeader(req.headers.origin, apiConfig)
        if (allowedSse) res.setHeader('Access-Control-Allow-Origin', allowedSse)
        res.setHeader('Access-Control-Allow-Headers', 'X-Office-Token, Authorization')
        res.setHeader('Vary', 'Origin')
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('X-Accel-Buffering', 'no')  // disable Nginx response buffering
        res.flushHeaders()
        sseClients.add(res)
        req.on('close', () => sseClients.delete(res))
        req.on('error', () => sseClients.delete(res))
        res.on('error', () => sseClients.delete(res))
        const snapshot = scanAndMerge(path.dirname(statusPath), process.cwd())
        if (snapshot) {
          try { res.write(`event: status\ndata: ${JSON.stringify(snapshot)}\n\n`) }
          catch { sseClients.delete(res) }
        }
      })

      // Watch ~/.claude/ for hook-written file changes and push via SSE
      // (hooks write directly to disk, not through POST, so we can't intercept them otherwise)
      const watchDir = path.dirname(statusPath)
      // Always register — chokidar watches non-existent dirs and picks them up when created
      if (!fs.existsSync(watchDir)) fs.mkdirSync(watchDir, { recursive: true })
      server.watcher.add(watchDir)
      const onWatchChange = (file) => {
        if (path.basename(file).match(/^office-status(-[^.]+)?\.json$/)) {
          const merged = scanAndMerge(path.dirname(statusPath), process.cwd())
          if (merged) broadcastSSE(merged)
        }
      }
      server.watcher.on('change', onWatchChange)
      server.httpServer?.on('close', () => server.watcher.off('change', onWatchChange))

      // Heartbeat: keep SSE connections alive through proxies and load balancers
      const sseHeartbeat = setInterval(() => {
        if (sseClients.size === 0) return
        for (const client of [...sseClients]) {
          try { client.write(':heartbeat\n\n') } catch { sseClients.delete(client) }
        }
      }, 30_000)
      if (sseHeartbeat.unref) sseHeartbeat.unref()
      if (server.httpServer) {
        server.httpServer.on('close', () => clearInterval(sseHeartbeat))
      } else {
        // middleware mode: httpServer is null, fall back to SIGTERM/exit cleanup
        const cleanup = () => clearInterval(sseHeartbeat)
        process.once('SIGTERM', cleanup)
        process.once('exit', cleanup)
      }

      const EVENT_TO_STATUS = {
        'pr-merged':      [{ role: 'ops', status: 'done',    label: '🚀 PR merged!' },
                           { role: 'dev', status: 'done',    label: '✅ Shipped!' }],
        'pr-opened':      [{ role: 'dev', status: 'working', label: '📋 PR opened' }],
        'pr-reviewed':    [{ role: 'qa',  status: 'done',    label: '✅ PR reviewed' }],
        'test-passed':    [{ role: 'qa',  status: 'done',    label: '✅ Tests passed!' }],
        'test-failed':    [{ role: 'qa',  status: 'blocked', label: '❌ Tests failed' }],
        'build-success':  [{ role: 'ops', status: 'done',    label: '🏗️ Build success' }],
        'build-failed':   [{ role: 'ops', status: 'blocked', label: '💥 Build failed' }],
        'deploy-start':   [{ role: 'ops', status: 'working', label: '🚀 Deploying...' }],
        'deploy-success': [{ role: 'ops', status: 'done',    label: '🎉 Deployed!' }],
        'deploy-failed':  [{ role: 'ops', status: 'blocked', label: '💥 Deploy failed' }],
        'release':           [{ role: 'ops', status: 'done',    label: '🎉 Released!' },
                            { role: 'dev', status: 'done',    label: '🎉 Ship it!' },
                            { role: 'qa',  status: 'done',    label: '✅ Quality approved' }],
        'review-approved':   [{ role: 'qa',  status: 'done',    label: '✅ Review approved' }],
        'release-cut':       [{ role: 'ops', status: 'working', label: '📦 Cutting release...' }],
        'rollback':          [{ role: 'ops', status: 'blocked', label: '⏪ Rolling back' }],
        'incident-start':    [{ role: 'ops', status: 'blocked', label: '🚨 Incident started' },
                              { role: 'dev', status: 'working', label: '🔥 Investigating...' }],
        'incident-resolved': [{ role: 'ops', status: 'done',    label: '✅ Incident resolved' }],
      }

      server.middlewares.use('/api/lang', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Vary', 'Origin')
        const allowedOriginL = getAllowedOriginHeader(req.headers.origin, apiConfig)
        if (allowedOriginL) res.setHeader('Access-Control-Allow-Origin', allowedOriginL)
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match, X-Office-Token, Authorization')
        if (req.method === 'OPTIONS') {
          if (!isAllowedOrigin(req.headers.origin, apiConfig)) {
            res.statusCode = 403
            res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }))
            return
          }
          res.setHeader('Access-Control-Max-Age', '600')
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method === 'POST') {
          const reqOriginL = req.headers.origin
          if (reqOriginL && !isAllowedOrigin(reqOriginL, apiConfig)) {
            res.statusCode = 403
            res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }))
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
          req.setEncoding('utf-8')
          let body = '', langAborted = false, langReceivedBytes = 0
          const MAX_LANG_BODY = 16  // lang codes are tiny
          req.on('data', chunk => {
            if (langAborted) return
            langReceivedBytes += Buffer.byteLength(chunk, 'utf8')
            if (langReceivedBytes > MAX_LANG_BODY) {
              langAborted = true
              res.statusCode = 413
              res.end(JSON.stringify({ ok: false, error: 'Body too large' }))
              req.resume()
              return
            }
            body += chunk
          })
          req.on('end', () => {
            if (langAborted) return
            const lang = body.trim()
            if (lang === 'en' || lang === 'zh-TW') {
              const langFile = path.join(os.homedir(), '.claude', 'office-lang')
              try {
                const dir = path.dirname(langFile)
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
                if (!atomicWrite(langFile, lang)) {
                  res.statusCode = 500
                  res.end(JSON.stringify({ ok: false, error: 'Write failed' }))
                  return
                }
                res.statusCode = 200
                res.end(JSON.stringify({ ok: true }))
              } catch {
                res.statusCode = 500
                res.end(JSON.stringify({ ok: false }))
              }
            } else {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'Invalid lang' }))
            }
          })
          return
        }
        res.setHeader('Allow', 'POST, OPTIONS')
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'Method not allowed' }))
      })

      // ─── /api/event — one-shot CI/CD webhook ────────────────────────────
      // Usage:
      //   curl -X POST http://localhost:5174/api/event \
      //     -H "Content-Type: application/json" \
      //     -d '{"event":"pr-merged"}'
      //
      // Supported events: pr-merged, pr-opened, pr-reviewed, review-approved,
      //   test-passed, test-failed, build-success, build-failed,
      //   deploy-start, deploy-success, deploy-failed,
      //   release, release-cut, rollback, incident-start, incident-resolved
      //
      // Custom: { "event": "custom", "role": "qa", "status": "blocked", "label": "❌ flaky test" }

      server.middlewares.use('/api/event', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        const allowedOrigin = getAllowedOriginHeader(req.headers.origin, apiConfig)
        if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match, X-Office-Token, Authorization')
        res.setHeader('Vary', 'Origin')

        if (req.method === 'OPTIONS') {
          if (!isAllowedOrigin(req.headers.origin, apiConfig)) {
            res.statusCode = 403
            res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }))
            return
          }
          res.setHeader('Access-Control-Max-Age', '600')
          res.statusCode = 204
          res.end()
          return
        }
        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST, OPTIONS')
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        const reqOriginE = req.headers.origin
        if (reqOriginE && !isAllowedOrigin(reqOriginE, apiConfig)) {
          res.statusCode = 403
          res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }))
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

        req.setEncoding('utf-8')
        let body = '', aborted = false, receivedBytes = 0
        req.on('data', chunk => {
          if (aborted) return
          receivedBytes += Buffer.byteLength(chunk, 'utf8')
          if (receivedBytes > 8192) { aborted = true; res.statusCode = 413; res.end(JSON.stringify({ ok: false, error: 'Payload too large' })); req.resume(); return }
          body += chunk
        })
        req.on('end', () => {
          if (aborted) return
          try {
            const parsed = JSON.parse(body)
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: 'Invalid payload' })); return
            }
            const eventName = typeof parsed.event === 'string' ? parsed.event : ''

            let agents
            if (eventName === 'custom' && parsed.role && parsed.status) {
              if (!VALID_ROLES.includes(parsed.role) || !VALID_STATUSES.includes(parsed.status)) {
                res.statusCode = 400
                res.end(JSON.stringify({ ok: false, error: `Invalid role or status` }))
                return
              }
              agents = [{ role: parsed.role, status: parsed.status, label: (typeof parsed.label === 'string' ? parsed.label.slice(0, 200) : eventName.slice(0, 200)) }]
            } else {
              agents = Object.prototype.hasOwnProperty.call(EVENT_TO_STATUS, eventName) ? EVENT_TO_STATUS[eventName] : undefined
              if (!agents) {
                res.statusCode = 400
                res.end(JSON.stringify({ ok: false, error: 'Unknown event' }))
                return
              }
              // Allow label override
              if (typeof parsed.label === 'string') agents = agents.map((a, i) => i === 0 ? { ...a, label: parsed.label.slice(0, 200) } : a)
            }

            const output = {
              _seq: nextSeq(),
              _cwd: process.cwd(),
              type: 'office-status',
              agents,
              activeCount: agents.filter(a => a.status === 'working' || a.status === 'blocked').length,
              workflow: typeof parsed.workflow === 'string' ? parsed.workflow.slice(0, 200) : eventName,
              source: 'webhook',
            }
            const dir = path.dirname(statusPath)
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
            if (!atomicWrite(statusPath, JSON.stringify(output, null, 2))) {
              res.statusCode = 500
              res.end(JSON.stringify({ ok: false, error: 'Write failed' }))
              return
            }
            const sseData = scanAndMerge(path.dirname(statusPath), process.cwd())
            if (sseData) broadcastSSE(sseData)
            res.end(JSON.stringify({ ok: true, event: eventName, agents: agents.length }))
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
          }
        })
      })

      server.middlewares.use('/api/health', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        const allowedH = getAllowedOriginHeader(req.headers.origin, apiConfig)
        if (allowedH) res.setHeader('Access-Control-Allow-Origin', allowedH)
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Vary', 'Origin')
        if (req.method === 'OPTIONS') {
          if (!isAllowedOrigin(req.headers.origin, apiConfig)) {
            res.statusCode = 403; res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' })); return
          }
          res.setHeader('Access-Control-Max-Age', '600')
          res.statusCode = 204; res.end(); return
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return
        }
        const stats = getSessionStats(path.dirname(statusPath), process.cwd())
        res.end(JSON.stringify({ ok: true, uptime: Math.floor(process.uptime()), ...stats }))
      })

      // Sweep rate-limiter map so it doesn't grow unbounded under IP rotation.
      const rlSweep = setInterval(() => {
        const cutoff = Date.now() - RATE_WINDOW
        for (const [ip, ts] of postCounts) {
          const fresh = ts.filter(t => t >= cutoff)
          if (fresh.length === 0) postCounts.delete(ip)
          else postCounts.set(ip, fresh)
        }
      }, 600_000)
      if (rlSweep.unref) rlSweep.unref()
      if (server.httpServer) {
        server.httpServer.once('close', () => clearInterval(rlSweep))
      } else {
        process.once('exit', () => clearInterval(rlSweep))
      }
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

    // Don't write when hooks are actively running. Hooks write to office-status-<slug>.json,
    // not this bare file, so checking the bare file for 'claude-cli' only catches curl/API
    // callers. The correct check is whether any recent slugged hook session exists.
    // (scanAndMerge's strict-pass exclusion is the real dedup, but skipping writes
    //  reduces filesystem noise and unnecessary SSE broadcasts.)
    try {
      const hookDir = path.dirname(statusPath)
      for (const f of fs.readdirSync(hookDir)) {
        if (!/^office-status-.+\.json$/.test(f)) continue
        const d = JSON.parse(fs.readFileSync(path.join(hookDir, f), 'utf-8'))
        if (d.source === 'claude-cli' && d._seq && now - parseInt(d._seq, 10) < 10_000) return
      }
    } catch {}
    // Also skip if a POST/curl caller recently wrote to the bare file directly
    try {
      const existing = JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
      if (existing.source === 'claude-cli' && existing._seq && now - parseInt(existing._seq, 10) < 10_000) return
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
      _seq: nextSeq(),
      type: 'office-status',
      agents,
      activeCount: agents.length,
      source: 'file-watcher',
    }

    try {
      const dir = path.dirname(statusPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      atomicWrite(statusPath, JSON.stringify(output, null, 2))
    } catch {}
  }

  return {
    name: 'office-file-watcher-fallback',
    configureServer(server) {
      // Watch project source files for changes (Vite's watcher covers src/)
      const onFallbackChange = (file) => {
        // Skip node_modules, dist, .git, and the status file itself
        if (/node_modules|dist|\.git/.test(file)) return
        if (file.includes('office-status')) return
        const role = fileToRole(file)
        writeStatus(role, file)
      }
      server.watcher.on('change', onFallbackChange)
      server.httpServer?.on('close', () => server.watcher.off('change', onFallbackChange))
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), officeStatusPlugin(), fileWatcherFallbackPlugin()],
  server: {
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
})
