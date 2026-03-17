import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import os from 'os'

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
    if (body.type === 'office-status') return body
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
      })
    }
    return {
      _seq: String(Date.now()),
      type: 'office-status',
      agents,
      activeCount: agents.filter(a => a.status !== 'done').length,
      workflow: body.workflow || null,
      source: body.source || 'api',
    }
  }

  return {
    name: 'office-status-api',
    configureServer(server) {
      server.middlewares.use('/api/status', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        // CORS preflight
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }

        // GET → read current status
        if (req.method === 'GET') {
          try {
            const data = fs.readFileSync(statusPath, 'utf-8')
            res.end(data)
          } catch {
            res.end('null')
          }
          return
        }

        // POST → update status
        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body)
              const normalized = normalizePost(parsed)
              // Ensure directory exists
              const dir = path.dirname(statusPath)
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
              fs.writeFileSync(statusPath, JSON.stringify(normalized, null, 2))
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
