#!/usr/bin/env node
/**
 * server.mjs — Standalone production server for agent-virtual-office
 *
 * Serves dist/ as static files AND provides the same API endpoints as the
 * Vite dev server (/api/status, /api/lang, /api/event). No new dependencies —
 * uses only Node.js built-in modules.
 *
 * Usage:
 *   node server.mjs [--port=5174] [--host] [--no-open]
 *   npx agent-virtual-office serve [--port=5174] [--host]
 *   npm run serve
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

// ─── Inline validation (mirrors src/utils/normalizePost.js + src/systems/constants.js) ─
// Kept here so server.mjs has zero dependencies on src/ at runtime.
const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
const VALID_STATUSES = ['idle', 'working', 'blocked', 'done']
const VALID_MOODS = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
const MAX_MOOD_DURATION = 3_600_000

function normalizePost(body) {
  if (body.type === 'office-status') {
    return {
      type: 'office-status',
      agents: (Array.isArray(body.agents) ? body.agents : [])
        .filter(a => a && typeof a === 'object' && VALID_ROLES.includes(a.role) && VALID_STATUSES.includes(a.status))
        .slice(0, 50)
        .map(a => ({
          role: a.role, status: a.status,
          task: typeof a.task === 'string' ? a.task.slice(0, 200) : null,
          label: typeof a.label === 'string' ? a.label.slice(0, 200) : null,
          hint: typeof a.hint === 'string' ? a.hint.slice(0, 200) : null,
        })),
      activeCount: typeof body.activeCount === 'number' ? body.activeCount : 0,
      workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
      mood: VALID_MOODS.includes(body.mood) ? body.mood : null,
      moodDuration: Math.min(Math.max(Number(body.moodDuration) || 60000, 1000), MAX_MOOD_DURATION),
      source: typeof body.source === 'string' ? body.source.slice(0, 50) : null,
      _seq: String(Date.now()),
    }
  }
  const agents = []
  for (const key of VALID_ROLES) {
    const val = body[key]
    if (val == null) continue
    const isStatus = VALID_STATUSES.includes(val)
    agents.push({
      role: key,
      task: isStatus ? null : (typeof val === 'string' ? val.slice(0, 200) : null),
      status: isStatus ? val : 'working',
      label: typeof body.label === 'string' ? body.label.slice(0, 200) : null,
      hint: typeof body.hint === 'string' ? body.hint.slice(0, 200) : null,
    })
  }
  return {
    _seq: String(Date.now()), type: 'office-status', agents,
    activeCount: agents.filter(a => a.status !== 'done').length,
    workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
    source: typeof body.source === 'string' ? body.source.slice(0, 50) : 'api',
    mood: VALID_MOODS.includes(body.mood) ? body.mood : null,
    moodDuration: body.moodDuration ? Math.min(Number(body.moodDuration) || 60000, MAX_MOOD_DURATION) : null,
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')

// ─── Args ───────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2)
function argVal(prefix) { return rawArgs.find(a => a.startsWith(prefix))?.split('=')[1] }

const rawPort = argVal('--port=') || '5174'
const port = Math.max(1, Math.min(65535, parseInt(rawPort, 10) || 5174))
if (String(port) !== rawPort && !/^\d+$/.test(rawPort)) {
  console.error(`\n  Invalid port "${rawPort}". Must be 1–65535.\n`)
  process.exit(1)
}
const bindHost = rawArgs.includes('--host') ? '0.0.0.0' : '127.0.0.1'
const lang = argVal('--lang=')
const openBrowser = !rawArgs.includes('--no-open')

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('\n  dist/index.html not found. Build first:\n    npm run build\n    npx agent-virtual-office serve\n')
  process.exit(1)
}

// ─── Shared paths ────────────────────────────────────────────────────────────
const STATUS_PATH = path.join(os.homedir(), '.claude', 'office-status.json')
const isWin = process.platform === 'win32'
function pathsEqual(a, b) { return isWin ? a.toLowerCase() === b.toLowerCase() : a === b }

// ─── CORS + auth ─────────────────────────────────────────────────────────────
const LOOPBACK_RE = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i

function getServerIPs() {
  const ips = new Set(['localhost', '127.0.0.1', '[::1]'])
  try {
    for (const iface of Object.values(os.networkInterfaces())) {
      for (const addr of iface) {
        if (!addr.internal) ips.add(addr.family === 'IPv6' ? `[${addr.address}]` : addr.address)
      }
    }
  } catch {}
  return ips
}
const SERVER_IPS = getServerIPs()

const apiToken = process.env.OFFICE_API_TOKEN?.trim() || null
const allowedOrigins = (process.env.OFFICE_API_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)

function isAllowedOrigin(origin) {
  if (!origin) return true
  if (allowedOrigins.length > 0) return allowedOrigins.includes(origin)
  try { if (SERVER_IPS.has(new URL(origin).hostname)) return true } catch {}
  return LOOPBACK_RE.test(origin)
}

function getAllowedOriginHeader(origin) {
  return origin && isAllowedOrigin(origin) ? origin : null
}

function safeEqual(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function isAuthorized(req) {
  if (!apiToken) return true
  const h = req.headers['x-office-token']
  const a = req.headers.authorization
  return (h != null && safeEqual(h, apiToken)) ||
         (typeof a === 'string' && safeEqual(a, `Bearer ${apiToken}`))
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Note: keys on req.socket.remoteAddress. Behind a reverse proxy (Nginx/Caddy)
// every request arrives from 127.0.0.1, so this becomes a global aggregate cap
// (30 POST / 10s total) rather than a per-client limit. In that case Nginx's
// limit_req (docs/deployment/nginx.conf) is the real per-client rate limiter.
// This layer defends the loopback surface on non-proxied deployments.
const postCounts = new Map()
const RATE_WINDOW = 10000, RATE_LIMIT = 30

function checkRateLimit(req) {
  if (req.method !== 'POST') return true
  const ip = req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const entry = postCounts.get(ip)
  if (!entry || now - entry.start > RATE_WINDOW) {
    if (postCounts.size > 50) for (const [k, v] of postCounts) if (now - v.start > RATE_WINDOW) postCounts.delete(k)
    postCounts.set(ip, { start: now, count: 1 })
    return true
  }
  return ++entry.count <= RATE_LIMIT
}

// ─── CORS headers ─────────────────────────────────────────────────────────────
function setCors(res, origin, methods = 'GET, POST, OPTIONS') {
  const allowed = getAllowedOriginHeader(origin)
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed)
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match, X-Office-Token, Authorization')
  res.setHeader('Vary', 'Origin')
}

function handlePreflight(req, res) {
  if (!isAllowedOrigin(req.headers.origin)) {
    res.statusCode = 403
    return res.end(JSON.stringify({ ok: false, error: 'Origin not allowed' }))
  }
  res.statusCode = 204
  return res.end()
}

// ─── /api/status ─────────────────────────────────────────────────────────────
function handleStatus(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-cache')
  setCors(res, req.headers.origin)

  if (req.method === 'OPTIONS') return handlePreflight(req, res)
  if (!checkRateLimit(req)) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: 'Too many requests' })) }

  if (req.method === 'GET') {
    try {
      const clientEtag = req.headers['if-none-match']
      const dir = path.dirname(STATUS_PATH)
      const now = Date.now()
      const sessions = []

      function scanSessions(strict) {
        if (!fs.existsSync(dir)) return
        for (const file of fs.readdirSync(dir)) {
          if (!file.match(/^office-status(-[^.]+)?\.json$/)) continue
          try {
            const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
            const parsed = JSON.parse(raw)
            const seq = parseInt(parsed._seq, 10)
            if (!seq || now - seq > 300000) {
              if (seq && now - seq > 3600000 && file !== 'office-status.json') {
                try { fs.unlinkSync(path.join(dir, file)) } catch {}
              }
              continue
            }
            if (strict) {
              if (parsed._cwd && !pathsEqual(path.resolve(parsed._cwd), path.resolve(process.cwd()))) continue
              if (!parsed._cwd && file !== 'office-status.json') continue
            }
            if (parsed.source === 'file-watcher') continue
            const slug = file === 'office-status.json' ? 'main'
              : file.replace(/^office-status-/, '').replace(/\.json$/, '')
            sessions.push({ slug, data: parsed })
          } catch {}
        }
      }

      scanSessions(true)
      if (sessions.length === 0) scanSessions(false)
      if (sessions.length === 0) return res.end('null')

      // Dedup bare main if it's a hook duplicate
      if (sessions.length > 1) {
        const mainIdx = sessions.findIndex(s => s.slug === 'main')
        if (mainIdx !== -1) {
          const mainSeq = parseInt(sessions[mainIdx].data._seq, 10) || 0
          const mainWorkflow = sessions[mainIdx].data.workflow
          const isDup = sessions.some((s, i) => i !== mainIdx && Math.abs((parseInt(s.data._seq, 10) || 0) - mainSeq) < 2000)
          const hasUniqueWorkflow = mainWorkflow && !sessions.some((s, i) => i !== mainIdx && s.data.workflow === mainWorkflow)
          if (isDup && !hasUniqueWorkflow) sessions.splice(mainIdx, 1)
        }
      }

      let merged
      if (sessions.length === 1) {
        merged = { ...sessions[0].data }
        delete merged._cwd
      } else {
        const PRI = { blocked: 0, working: 1, done: 2, idle: 3 }
        const allAgents = []
        let latestSeq = 0, workflow = null
        for (const { slug, data } of sessions) {
          const seq = parseInt(data._seq, 10) || 0
          if (seq > latestSeq) latestSeq = seq
          if (!workflow && data.workflow) workflow = data.workflow
          const pick = (data.agents || [])
            .filter(a => a.status === 'working' || a.status === 'blocked')
            .sort((a, b) => (PRI[a.status] ?? 9) - (PRI[b.status] ?? 9))[0]
          if (pick) allAgents.push({ ...pick, role: `${slug}~${pick.role}`, session: slug })
        }
        merged = { _seq: String(latestSeq), type: 'office-status', agents: allAgents, activeCount: allAgents.filter(a => a.status !== 'done').length, workflow, source: 'multi-session', sessionCount: sessions.length }
      }

      const data = JSON.stringify(merged)
      const etag = '"' + createHash('md5').update(data).digest('hex').slice(0, 12) + '"'
      if (clientEtag === etag) { res.statusCode = 304; return res.end() }
      res.setHeader('ETag', etag)
      return res.end(data)
    } catch { return res.end('null') }
  }

  if (req.method === 'POST') {
    if (!isAuthorized(req)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' })) }
    req.setEncoding('utf-8')
    let body = '', aborted = false
    req.on('data', chunk => {
      if (aborted) return
      body += chunk
      if (body.length > 16384) { aborted = true; res.statusCode = 413; res.end(JSON.stringify({ ok: false, error: 'Body too large' })); req.destroy() }
    })
    req.on('end', () => {
      if (aborted) return
      try {
        const normalized = normalizePost(JSON.parse(body))
        normalized._cwd = process.cwd()
        const dir = path.dirname(STATUS_PATH)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(STATUS_PATH, JSON.stringify(normalized, null, 2))
        res.end(JSON.stringify({ ok: true, agents: normalized.agents?.length ?? 0 }))
      } catch { res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' })) }
    })
    return
  }

  res.statusCode = 405
  res.end(JSON.stringify({ error: 'Method not allowed' }))
}

// ─── /api/lang ────────────────────────────────────────────────────────────────
function handleLang(req, res) {
  res.setHeader('Content-Type', 'application/json')
  setCors(res, req.headers.origin, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return handlePreflight(req, res)
  if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
  if (!isAuthorized(req)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' })) }
  req.setEncoding('utf-8')
  let body = '', aborted = false
  req.on('data', chunk => {
    if (aborted) return
    body += chunk
    if (body.length > 16) { aborted = true; res.statusCode = 413; res.end(JSON.stringify({ ok: false, error: 'Body too large' })); req.destroy() }
  })
  req.on('end', () => {
    if (aborted) return
    const l = body.trim()
    if (l !== 'en' && l !== 'zh-TW') { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Invalid lang' })) }
    const langFile = path.join(os.homedir(), '.claude', 'office-lang')
    try {
      const dir = path.dirname(langFile)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(langFile, l)
      res.end(JSON.stringify({ ok: true }))
    } catch { res.statusCode = 500; res.end(JSON.stringify({ ok: false })) }
  })
}

// ─── /api/event ───────────────────────────────────────────────────────────────
const EVENT_TO_STATUS = {
  'pr-merged':         [{ role: 'ops', status: 'done',    label: '🚀 PR merged!' }, { role: 'dev', status: 'done', label: '✅ 上了！' }],
  'pr-opened':         [{ role: 'dev', status: 'working', label: '📋 PR 開好了' }],
  'pr-reviewed':       [{ role: 'qa',  status: 'done',    label: '✅ PR reviewed' }],
  'test-passed':       [{ role: 'qa',  status: 'done',    label: '✅ Tests passed!' }],
  'test-failed':       [{ role: 'qa',  status: 'blocked', label: '❌ Tests failed' }],
  'build-success':     [{ role: 'ops', status: 'done',    label: '🏗️ Build success' }],
  'build-failed':      [{ role: 'ops', status: 'blocked', label: '💥 Build failed' }],
  'deploy-start':      [{ role: 'ops', status: 'working', label: '🚀 Deploying...' }],
  'deploy-success':    [{ role: 'ops', status: 'done',    label: '🎉 Deployed!' }],
  'deploy-failed':     [{ role: 'ops', status: 'blocked', label: '💥 Deploy failed' }],
  'release':           [{ role: 'ops', status: 'done',    label: '🎉 Released!' }, { role: 'dev', status: 'done', label: '🎉 Ship it!' }, { role: 'qa', status: 'done', label: '✅ Quality approved' }],
  'review-approved':   [{ role: 'qa',  status: 'done',    label: '✅ Review approved' }],
  'release-cut':       [{ role: 'ops', status: 'working', label: '📦 Cutting release...' }],
  'rollback':          [{ role: 'ops', status: 'blocked', label: '⏪ Rolling back' }],
  'incident-start':    [{ role: 'ops', status: 'blocked', label: '🚨 Incident started' }, { role: 'dev', status: 'working', label: '🔥 Investigating...' }],
  'incident-resolved': [{ role: 'ops', status: 'done',    label: '✅ Incident resolved' }],
}

function handleEvent(req, res) {
  res.setHeader('Content-Type', 'application/json')
  setCors(res, req.headers.origin, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return handlePreflight(req, res)
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'Method not allowed' })) }
  if (!isAuthorized(req)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' })) }
  if (!checkRateLimit(req)) { res.statusCode = 429; return res.end(JSON.stringify({ ok: false, error: 'Too many requests' })) }
  req.setEncoding('utf-8')
  let body = '', aborted = false
  req.on('data', chunk => {
    if (aborted) return
    body += chunk
    if (body.length > 8192) { aborted = true; res.statusCode = 413; res.end(JSON.stringify({ ok: false, error: 'Payload too large' })); req.destroy() }
  })
  req.on('end', () => {
    if (aborted) return
    try {
      const parsed = JSON.parse(body)
      const eventName = parsed.event || ''
      let agents
      if (eventName === 'custom' && parsed.role && parsed.status) {
        if (!VALID_ROLES.includes(parsed.role) || !VALID_STATUSES.includes(parsed.status)) {
          res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Invalid role or status' }))
        }
        agents = [{ role: parsed.role, status: parsed.status, label: parsed.label ? String(parsed.label).slice(0, 200) : eventName }]
      } else {
        agents = EVENT_TO_STATUS[eventName]
        if (!agents) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Unknown event' })) }
        if (parsed.label) agents = agents.map((a, i) => i === 0 ? { ...a, label: String(parsed.label).slice(0, 200) } : a)
      }
      const output = {
        _seq: String(Date.now()), _cwd: process.cwd(),
        type: 'office-status', agents,
        activeCount: agents.filter(a => a.status !== 'done').length,
        workflow: parsed.workflow ? String(parsed.workflow).slice(0, 200) : eventName,
        source: 'webhook',
      }
      const dir = path.dirname(STATUS_PATH)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(STATUS_PATH, JSON.stringify(output, null, 2))
      res.end(JSON.stringify({ ok: true, event: eventName, agents: agents.length }))
    } catch { res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' })) }
  })
}

// ─── Static file serving (SPA-aware) ─────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end() }
  const urlPath = new URL(req.url, 'http://x').pathname
  let target = path.join(dist, urlPath)

  // Path traversal guard — use sep to prevent dist-single/dist-evil siblings matching
  if (target !== dist && !target.startsWith(dist + path.sep)) { res.statusCode = 403; return res.end('Forbidden') }

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html')
  if (!fs.existsSync(target)) target = path.join(dist, 'index.html')  // SPA fallback

  const ext = path.extname(target).toLowerCase()
  const mime = MIME[ext] || 'application/octet-stream'
  try {
    const content = fs.readFileSync(target)
    const etag = '"' + createHash('md5').update(content).digest('hex').slice(0, 12) + '"'
    if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end() }
    res.setHeader('Content-Type', mime)
    res.setHeader('ETag', etag)
    // Immutable cache for hashed assets, no-cache for HTML
    if (mime.startsWith('text/html')) res.setHeader('Cache-Control', 'no-cache')
    else if (/\.[0-9a-f]{8,}\./.test(path.basename(target))) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.statusCode = 200
    return req.method === 'HEAD' ? res.end() : res.end(content)
  } catch { res.statusCode = 500; return res.end('Internal Error') }
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const SERVER_START = Date.now()

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/api/status') return handleStatus(req, res)
  if (url.pathname === '/api/lang')   return handleLang(req, res)
  if (url.pathname === '/api/event')  return handleEvent(req, res)
  if (url.pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ ok: true, uptime: Math.floor((Date.now() - SERVER_START) / 1000) }))
  }
  return serveStatic(req, res)
})

// Close keep-alive connections that go silent for 30s (slow-client DoS guard)
server.setTimeout(30000)

server.listen(port, bindHost, () => {
  const displayHost = bindHost === '0.0.0.0' ? 'localhost' : bindHost
  const url = `http://${displayHost}:${port}${lang ? `?lang=${lang}` : ''}`
  const lanIp = bindHost === '0.0.0.0'
    ? [...SERVER_IPS].find(ip => !['localhost', '127.0.0.1', '[::1]'].includes(ip))
    : null
  const lanLine = lanIp ? `\n  LAN:     http://${lanIp}:${port}` : ''

  console.log(`
  Agent Virtual Office (production build)
  Local:   ${url}
  Panel:   ${url}${lang ? '&' : '?'}mode=panel
  API:     http://${displayHost}:${port}/api/status${lanLine}

  Use Ctrl+C to stop.
  `)

  // Open browser
  if (openBrowser) {
    const opener = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open'
    if (opener === 'xdg-open' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
      console.log(`  Open in browser: ${url}`)
    } else {
      try {
        const cmd = opener === 'start' ? `start "" "${url}"` : `${opener} "${url}"`
        execSync(cmd, { stdio: 'ignore' })
      } catch { console.log(`  Open in browser: ${url}`) }
    }
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`\n  Port ${port} is already in use. Try --port=${port + 1}\n`)
  else console.error('\n  Server error:', err.message, '\n')
  process.exit(1)
})

// ─── Graceful shutdown ────────────────────────────────────────────────────────
// server.close() stops accepting new connections but is async — it fires its
// callback only after all in-flight requests finish. closeIdleConnections()
// (Node >= 18.2) immediately frees idle keep-alive sockets so close() doesn't
// hang waiting for them. The hard-exit timer guards against requests that never
// complete (e.g. a hung upstream or a client that never reads its response).
let _shuttingDown = false
function gracefulShutdown(signal) {
  if (_shuttingDown) return
  _shuttingDown = true
  console.log(`\n  ${signal} received — draining in-flight requests...`)

  server.close((err) => {
    if (err) { console.error('  Server close error:', err.message); process.exit(1) }
    console.log('  All connections drained. Exiting cleanly.')
    process.exit(0)
  })

  // Drop idle keep-alive sockets so server.close() can actually complete.
  server.closeIdleConnections?.()

  // Hard cap: if requests don't finish in 10s, force exit so the orchestrator's
  // own SIGKILL timeout (systemd TimeoutStopSec=15, PM2 kill_timeout:15000)
  // isn't the first line of defence.
  setTimeout(() => {
    console.error('  Drain timed out (10s) — forcing exit.')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
