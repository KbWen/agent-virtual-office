#!/usr/bin/env node

const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

const root = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const command = args[0]

// ─── setup: one-click Claude Code hook installation ───
if (command === 'setup') {
  const claudeDir = path.join(os.homedir(), '.claude')
  const settingsPath = path.join(claudeDir, 'settings.json')
  const hookSrc = path.join(root, 'public', 'hooks', 'office-status-hook.js')

  // Ensure ~/.claude exists
  if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true })

  // Copy hook script to ~/.claude/
  const hookDest = path.join(claudeDir, 'office-status-hook.js')
  fs.copyFileSync(hookSrc, hookDest)

  // Read or create settings.json
  let settings = {}
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) } catch {}
  }

  // Build hook command (node works on all platforms, no jq/bash dependency)
  const hookCmd = `node "${hookDest.replace(/\\/g, '/')}"`
  const hookEntry = { type: 'command', command: hookCmd }

  // Add hooks for all relevant events
  if (!settings.hooks) settings.hooks = {}
  for (const event of ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop']) {
    if (!settings.hooks[event]) settings.hooks[event] = []
    // Check if already installed (avoid duplicates)
    const existing = settings.hooks[event]
    const hasHook = existing.some(h =>
      (h.hooks || []).some(hh => hh.command && hh.command.includes('office-status-hook'))
    )
    if (!hasHook) {
      existing.push({ hooks: [hookEntry] })
    }
  }

  // Write back
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

  console.log(`
  Virtual Office setup complete!

  Hook installed:  ${hookDest}
  Settings updated: ${settingsPath}

  Now run:
    npx agent-virtual-office

  Then use Claude Code in any project — the office will light up automatically.
  `)
  process.exit(0)
}

// ─── uninstall: remove hooks ───
if (command === 'uninstall') {
  const claudeDir = path.join(os.homedir(), '.claude')
  const settingsPath = path.join(claudeDir, 'settings.json')
  const hookDest = path.join(claudeDir, 'office-status-hook.js')
  const hookDestLegacy = path.join(claudeDir, 'office-status-hook.sh')

  // Remove hook files (current + legacy .sh)
  for (const f of [hookDest, hookDestLegacy]) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f)
      console.log('  Removed: ' + f)
    }
  }

  // Remove from settings.json
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      if (settings.hooks) {
        for (const event of ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop']) {
          if (settings.hooks[event]) {
            settings.hooks[event] = settings.hooks[event].filter(h =>
              !(h.hooks || []).some(hh => hh.command && hh.command.includes('office-status-hook'))
            )
            if (settings.hooks[event].length === 0) delete settings.hooks[event]
          }
        }
        if (Object.keys(settings.hooks).length === 0) delete settings.hooks
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
      console.log('  Cleaned: ' + settingsPath)
    } catch {}
  }

  console.log('\n  Virtual Office hooks removed.\n')
  process.exit(0)
}

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
    npx agent-virtual-office setup       Install Claude Code hooks (one-time)
    npx agent-virtual-office uninstall   Remove hooks

  Options:
    --port=PORT    Port number (default: 5174)
    --lang=LANG    Language: en, zh-TW (default: auto-detect)
    --no-open      Don't open browser automatically
    --no-host      Don't expose to network (localhost only)
    --help, -h     Show this help

  Quick start:
    npx agent-virtual-office setup   # one-time: install hooks
    npx agent-virtual-office         # start the office

  Then use Claude Code in any project — the office lights up automatically.
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
