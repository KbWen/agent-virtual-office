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

// Shared status file path and ETag cache (shared between plugins)
const STATUS_PATH = path.join(os.homedir(), '.claude', 'office-status.json')
const etagCache = { lastEtag: null, lastData: null }

function officeStatusPlugin() {
  const statusPath = STATUS_PATH

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

  // ETag tracking uses shared etagCache (so file watcher can invalidate)

  return {
    name: 'office-status-api',
    configureServer(server) {
      server.middlewares.use('/api/status', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-cache')
        // Dev-only: allow any origin so local tools (CLI, curl, etc.) can POST status
        // This middleware does NOT exist in production builds
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match')

        // CORS preflight
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }

        // Rate limiting for POST
        if (!checkRateLimit(req)) {
          res.statusCode = 429
          res.end(JSON.stringify({ ok: false, error: 'Too many requests' }))
          return
        }

        // GET → read current status (ETag cache + server-side staleness)
        if (req.method === 'GET') {
          try {
            // Fast path: check cached ETag before reading file
            const clientEtag = req.headers['if-none-match']
            if (clientEtag && etagCache.lastEtag === clientEtag) {
              res.statusCode = 304
              res.end()
              return
            }

            const data = fs.readFileSync(statusPath, 'utf-8')

            // Server-side staleness: if _seq is older than 60s, return empty
            try {
              const parsed = JSON.parse(data)
              const seq = parseInt(parsed._seq, 10)
              if (seq && Date.now() - seq > 60000) {
                res.end('null')
                return
              }
            } catch {}

            const etag = '"' + createHash('md5').update(data).digest('hex').slice(0, 12) + '"'

            // 304 if ETag matches (for clients with stale cache ref)
            if (clientEtag === etag) {
              res.statusCode = 304
              res.end()
              return
            }

            res.setHeader('ETag', etag)
            etagCache.lastEtag = etag
            etagCache.lastData = data
            res.end(data)
          } catch {
            res.end('null')
          }
          return
        }

        // POST → update status (16KB limit to prevent abuse)
        if (req.method === 'POST') {
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
              // Ensure directory exists
              const dir = path.dirname(statusPath)
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
              const json = JSON.stringify(normalized, null, 2)
              fs.writeFileSync(statusPath, json)
              // Invalidate ETag cache
              etagCache.lastEtag = null
              etagCache.lastData = null
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
      etagCache.lastEtag = null
      etagCache.lastData = null
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
  build: {
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
})
