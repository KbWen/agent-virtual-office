#!/usr/bin/env node

const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const root = path.resolve(__dirname, '..')
const args = process.argv.slice(2)

// Parse flags
const port = args.find(a => a.startsWith('--port='))?.split('=')[1] || '5174'
const lang = args.find(a => a.startsWith('--lang='))?.split('=')[1]
const open = !args.includes('--no-open')
const help = args.includes('--help') || args.includes('-h')

if (help) {
  console.log(`
  agent-virtual-office — Pixel-art virtual office for AI agents

  Usage:
    npx agent-virtual-office [options]

  Options:
    --port=PORT    Port number (default: 5174)
    --lang=LANG    Language: en, zh-TW (default: auto-detect)
    --no-open      Don't open browser automatically
    --no-host      Don't expose to network (localhost only)
    --help, -h     Show this help

  Status API:
    POST http://localhost:PORT/api/status
    Body: {"dev":"working","workflow":"Feature X"}

  Embedding:
    http://localhost:PORT?mode=panel   (compact panel for IDE sidebars)
    http://localhost:PORT?lang=zh-TW   (force Chinese)

  Example:
    curl -X POST http://localhost:5174/api/status \\
      -H "Content-Type: application/json" \\
      -d '{"dev":"working","qa":"testing","workflow":"Sprint 42"}'
`)
  process.exit(0)
}

// Check if node_modules exists, install if not
const nodeModules = path.join(root, 'node_modules')
if (!fs.existsSync(nodeModules)) {
  console.log('Installing dependencies...')
  execSync('npm install', { cwd: root, stdio: 'inherit' })
}

// Build URL
const url = `http://localhost:${port}${lang ? `?lang=${lang}` : ''}`

console.log(`
  Starting Agent Virtual Office...
  Local:   ${url}
  Panel:   ${url}${lang ? '&' : '?'}mode=panel
  API:     http://localhost:${port}/api/status
`)

// Start vite dev server
const host = !args.includes('--no-host')
const viteArgs = ['vite', '--port', port]
if (host) viteArgs.push('--host')
const vite = spawn('npx', viteArgs, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})

// Open browser after a short delay
if (open) {
  setTimeout(() => {
    const opener = process.platform === 'win32' ? 'start' :
                   process.platform === 'darwin' ? 'open' : 'xdg-open'
    try {
      execSync(`${opener} "${url}"`, { stdio: 'ignore' })
    } catch {}
  }, 2000)
}

vite.on('close', (code) => process.exit(code || 0))
process.on('SIGINT', () => { vite.kill(); process.exit(0) })
process.on('SIGTERM', () => { vite.kill(); process.exit(0) })
