import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

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

function officeStatusPlugin() {
  const statusPath = path.join(os.homedir(), '.claude', 'office-status.json')
  const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate']
  const VALID_STATUSES = ['idle', 'working', 'blocked', 'done']

  // Convert shorthand { dev: "working", qa: "testing" } to full format
  function normalizePost(body) {
    if (body.type === 'office-status') {
      // Validate statuses in full format too
      if (Array.isArray(body.agents)) {
        body.agents = body.agents.filter(a =>
          VALID_ROLES.includes(a.role) && VALID_STATUSES.includes(a.status)
        ).map(a => ({ ...a, hint: a.hint || null }))
      }
      // Preserve mood and hint fields
      if (body.mood) body.mood = String(body.mood)
      if (body.moodDuration) body.moodDuration = Number(body.moodDuration) || 60000
      return body
    }
    const agents = []
    for (const key of VALID_ROLES) {
      const val = body[key]
      if (val == null) continue
      const isStatus = VALID_STATUSES.includes(val)
      agents.push({
        role: key,
        task: isStatus ? null : val,
        status: isStatus ? val : 'working',
        label: body.label || null,
        hint: body.hint || null,
      })
    }
    return {
      _seq: String(Date.now()),
      type: 'office-status',
      agents,
      activeCount: agents.filter(a => a.status !== 'done').length,
      workflow: body.workflow || null,
      source: body.source || 'api',
      mood: body.mood || null,
      moodDuration: body.moodDuration || null,
    }
  }

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

  // ETag tracking for GET 304 responses
  let lastEtag = null
  let lastData = null

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

        // GET → read current status (with ETag support)
        if (req.method === 'GET') {
          try {
            const data = fs.readFileSync(statusPath, 'utf-8')
            const etag = '"' + createHash('md5').update(data).digest('hex').slice(0, 12) + '"'

            // 304 Not Modified if ETag matches
            if (req.headers['if-none-match'] === etag) {
              res.statusCode = 304
              res.end()
              return
            }

            res.setHeader('ETag', etag)
            lastEtag = etag
            lastData = data
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
              lastEtag = null
              lastData = null
              res.end(JSON.stringify({ ok: true, agents: normalized.agents.length }))
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

export default defineConfig({
  plugins: [react(), tailwindcss(), officeStatusPlugin()],
  build: {
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
})
