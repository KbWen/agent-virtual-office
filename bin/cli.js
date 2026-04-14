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

  // Copy hook script to ~/.claude/ (update if changed)
  const hookDest = path.join(claudeDir, 'office-status-hook.js')
  if (!fs.existsSync(hookSrc)) {
    console.error('  Error: Hook source not found at ' + hookSrc)
    console.error('  Your installation may be corrupted. Try reinstalling:')
    console.error('    npm install -g agent-virtual-office')
    process.exit(1)
  }
  let hookAction = 'installed'
  if (fs.existsSync(hookDest)) {
    const oldContent = fs.readFileSync(hookDest, 'utf-8')
    const newContent = fs.readFileSync(hookSrc, 'utf-8')
    if (oldContent.replace(/\r\n/g, '\n') === newContent.replace(/\r\n/g, '\n')) {
      hookAction = 'up-to-date'
    } else {
      hookAction = 'updated'
    }
  }
  fs.copyFileSync(hookSrc, hookDest)
  // Verify the hook was copied successfully
  if (!fs.existsSync(hookDest)) {
    console.error('  Error: Failed to copy hook file to ' + hookDest)
    console.error('  Check file permissions for ~/.claude/')
    process.exit(1)
  }

  // Read or create settings.json
  let settings = {}
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    } catch (e) {
      console.error('  Error: ' + settingsPath + ' contains invalid JSON.')
      console.error('  Please fix or back up the file, then re-run setup.')
      process.exit(1)
    }
  }

  // Build hook command (node works on all platforms, no jq/bash dependency)
  const hookCmd = `node "${hookDest.replace(/\\/g, '/')}"`
  const hookEntry = { type: 'command', command: hookCmd }

  // Add hooks for all relevant events
  if (!settings.hooks) settings.hooks = {}
  for (const event of ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'Stop']) {
    if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = []
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
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  } catch (e) {
    console.error('  Error: Cannot write to ' + settingsPath)
    console.error('  Check file permissions for ~/.claude/')
    process.exit(1)
  }

  console.log(`
  Virtual Office setup complete!

  Hook ${hookAction}:  ${hookDest}
  Settings updated: ${settingsPath}

  Now run:
    npx agent-virtual-office

  Requires: Claude Code (https://claude.ai/code) must be installed.
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

  // Clean up status, skill, and preference files
  try {
    const files = fs.readdirSync(claudeDir)
    for (const file of files) {
      if (file.startsWith('office-status') || file.startsWith('office-skill-') || file === 'office-lang') {
        const filePath = path.join(claudeDir, file)
        fs.unlinkSync(filePath)
        console.log('  Removed: ' + filePath)
      }
    }
  } catch (e) {
    console.warn('  Warning: Could not clean up status files in ' + claudeDir)
  }

  // Remove from settings.json
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      if (settings.hooks) {
        for (const event of ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'Stop']) {
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
    } catch (e) {
      console.warn('  Warning: Could not update ' + settingsPath)
      console.warn('  You may need to manually remove office-status-hook entries')
    }
  }

  console.log('\n  Virtual Office hooks removed.\n')
  process.exit(0)
}

// Parse flags
const port = args.find(a => a.startsWith('--port='))?.split('=')[1] || '5174'
if (!/^\d+$/.test(port) || parseInt(port, 10) < 1 || parseInt(port, 10) > 65535) {
  console.error('  Invalid port: ' + port + '. Must be 1-65535.')
  process.exit(1)
}
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
const viteExists = fs.existsSync(path.join(nodeModules, 'vite'))
if (!fs.existsSync(nodeModules) || !viteExists) {
  console.log('Installing dependencies...')
  try {
    execSync('npm install --prefer-offline --no-audit --no-fund', { cwd: root, stdio: 'inherit' })
  } catch {
    console.error('  Failed to install dependencies. Try running manually:')
    console.error(`    cd "${root}" && npm install`)
    process.exit(1)
  }
}

// Build URL
const url = `http://localhost:${port}${lang ? `?lang=${lang}` : ''}`

// Start vite dev server
const host = !args.includes('--no-host')

console.log(`
  Starting Agent Virtual Office...
  Local:   ${url}
  Panel:   ${url}${lang ? '&' : '?'}mode=panel
  API:     http://localhost:${port}/api/status
`)

if (host) {
  console.log(`  Network mode enabled (--host). LAN devices can access the office.`)
  console.log(`  To restrict to localhost only, use: --no-host`)
  if (process.platform === 'win32') {
    console.log(`  Note: Windows Firewall may prompt you to allow access.`)
  }
  console.log()
}

const viteBin = path.join(root, 'node_modules', '.bin', 'vite')
const viteFlags = ['--port', port]
if (host) viteFlags.push('--host')
const isWin = process.platform === 'win32'
const viteCmd = isWin ? `"${viteBin}" ${viteFlags.join(' ')}` : viteBin
const viteArgs = isWin ? [] : viteFlags
const vite = spawn(viteCmd, viteArgs, {
  cwd: root,
  stdio: 'inherit',
  shell: isWin,
})

// Open browser after a short delay
if (open) {
  setTimeout(() => {
    const opener = process.platform === 'win32' ? 'start' :
                   process.platform === 'darwin' ? 'open' : 'xdg-open'
    // Skip browser open on headless Linux / WSL (no display server)
    if (opener === 'xdg-open' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
      console.log(`  Open in browser: ${url}`)
      return
    }
    try {
      execSync(`${opener} "${url}"`, { stdio: 'ignore' })
    } catch {
      console.log(`  Open in browser: ${url}`)
    }
  }, 2000)
}

vite.on('close', (code) => {
  if (code) {
    console.error(`\n  Vite exited with code ${code}. If port ${port} is in use, try:`)
    console.error(`    npx agent-virtual-office --port=${parseInt(port) + 1}\n`)
  }
  process.exit(code || 0)
})
function killVite() {
  try { vite.kill() } catch {}
  process.exit(0)
}
process.on('SIGINT', killVite)
process.on('SIGTERM', killVite)
