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
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      settings = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {}
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
  // AVO-148: PermissionDenied + StopFailure are harmless on older Claude Code versions that
  // don't emit them — the hook simply never receives those event names and nothing is claimed.
  if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) settings.hooks = {}
  for (const event of ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'Stop', 'PermissionDenied', 'StopFailure']) {
    if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = []
    // Check if already installed (avoid duplicates)
    const existing = settings.hooks[event]
    const hasHook = existing.some(h =>
      h && typeof h === 'object' && (h.hooks || []).some(hh => hh && hh.command && hh.command.includes('office-status-hook'))
    )
    if (!hasHook) {
      existing.push({ hooks: [hookEntry] })
    }
  }

  // Write back atomically to prevent corruption on crash/disk-full.
  // tmp name = pid + random suffix so two concurrent setup runs (or a leftover
  // tmp from a prior crashed run) never collide on the same path — matches the
  // atomicWrite convention in server.mjs / the hooks.
  const settingsTmp = settingsPath + '.tmp.' + process.pid + '.' +
    (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
  try {
    fs.writeFileSync(settingsTmp, JSON.stringify(settings, null, 2))
    fs.renameSync(settingsTmp, settingsPath)
  } catch (e) {
    try { fs.unlinkSync(settingsTmp) } catch {}
    // Fallback: direct write (e.g. Windows EBUSY on rename)
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    } catch {
      console.error('  Error: Cannot write to ' + settingsPath)
      console.error('  Check file permissions for ~/.claude/')
      process.exit(1)
    }
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
      if (/^office-status(-[^.]+)?\.json(\.tmp\.\d+\.[a-z0-9]+)?$/.test(file) ||
          /^office-skill-[^.]+\.json(\.tmp\.\d+\.[a-z0-9]+)?$/.test(file) ||
          /^office-lang(\.tmp\.\d+\.[a-z0-9]+)?$/.test(file)) {
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
        for (const event of ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'Stop', 'PermissionDenied', 'StopFailure']) {
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

// ─── serve: production static server ───────────────────────────────────────
if (command === 'serve') {
  const serverScript = path.join(root, 'server.mjs')
  if (!fs.existsSync(serverScript)) {
    console.error('  Error: server.mjs not found. Your installation may be corrupted.')
    console.error('    npm install -g agent-virtual-office')
    process.exit(1)
  }
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    console.error('  Error: production bundle not found. Build first:')
    console.error('    npm run build')
    process.exit(1)
  }
  // Forward remaining flags to server.mjs
  const serverArgs = process.argv.slice(3)
  const child = spawn(process.execPath, [serverScript, ...serverArgs], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  })
  child.on('error', (err) => {
    console.error(`\n  Failed to start production server: ${err.message}\n`)
    process.exit(1)
  })
  let _hardTimer = null
  child.on('close', (code, signal) => {
    if (_hardTimer) clearTimeout(_hardTimer)
    // SIGINT/SIGTERM = user-initiated clean stop → exit 0
    // SIGKILL/crash signal = abnormal → exit 1 so supervisors restart
    const cleanSignal = signal === 'SIGINT' || signal === 'SIGTERM'
    process.exit(cleanSignal ? 0 : (signal ? 1 : (code || 0)))
  })
  // Forward signals to the child; child.on('close') handles actual exit.
  // Hard-exit after 12s in case server.mjs's 10s drain timer never fires.
  let _forwarding = false
  function forwardSignal(sig) {
    if (_forwarding) return
    _forwarding = true
    if (process.platform === 'win32') {
      if (child.exitCode === null && child.signalCode === null) {
        try { execSync(`taskkill /T /F /PID ${child.pid}`, { stdio: 'ignore' }) } catch {}
      }
    } else {
      try { child.kill(sig) } catch {}
    }
    _hardTimer = setTimeout(() => process.exit(1), 12000)
    // no .unref() — this timer must keep the process alive so it can force-exit a stuck child
  }
  process.on('SIGINT',  () => forwardSignal('SIGINT'))
  process.on('SIGTERM', () => forwardSignal('SIGTERM'))
  // Don't fall through to dev server
  return
}

// Parse flags
const port = args.find(a => a.startsWith('--port='))?.split('=')[1] || '5174'
if (!/^\d+$/.test(port) || parseInt(port, 10) < 1 || parseInt(port, 10) > 65535) {
  console.error('  Invalid port: ' + port + '. Must be 1-65535.')
  process.exit(1)
}
const lang = args.find(a => a.startsWith('--lang='))?.split('=')[1]
if (lang && lang !== 'en' && lang !== 'zh-TW') {
  console.error('  Invalid --lang: ' + lang + '. Use "en" or "zh-TW".')
  process.exit(1)
}
const open = !args.includes('--no-open')
const help = args.includes('--help') || args.includes('-h')

if (help) {
  console.log(`
  agent-virtual-office — Pixel-art virtual office for AI agents

  Usage:
    npx agent-virtual-office [options]
    npx agent-virtual-office setup       Install Claude Code hooks (one-time)
    npx agent-virtual-office uninstall   Remove hooks
    npx agent-virtual-office serve       Serve production build (no Vite needed)

  Options:
    --port=PORT    Port number (default: 5174)
    --lang=LANG    Language: en, zh-TW (default: auto-detect)
    --no-open      Don't open browser automatically
    --no-host      Dev mode only: don't expose to LAN (dev server binds 0.0.0.0 by
                   default; serve mode is loopback-only by default, so --no-host is
                   a no-op there)
    --help, -h     Show this help

  Quick start:
    npx agent-virtual-office setup   # one-time: install hooks
    npx agent-virtual-office         # start the office (dev mode)

  Production / static deploy:
    npm run build                    # build to dist/
    npx agent-virtual-office serve   # serve dist/ + /api/status

  Then use Claude Code in any project — the office lights up automatically.
`)
  process.exit(0)
}

// Resolve Vite's CLI entry via Node module resolution. This honors npm's
// dependency hoisting — when this package is installed as a dependency (or
// globally), Vite lands in a PARENT node_modules, not `<pkg>/node_modules`.
// A plain `fs.existsSync(root/node_modules/vite)` check would miss it and
// trigger a redundant `npm install` on every launch. require.resolve walks
// the parent chain the same way `require('vite')` would.
function resolveViteBin() {
  try {
    const pkgPath = require.resolve('vite/package.json', { paths: [root] })
    const pkg = require(pkgPath)
    const binRel = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin && pkg.bin.vite)
    if (!binRel) return null
    const binAbs = path.join(path.dirname(pkgPath), binRel)
    return fs.existsSync(binAbs) ? binAbs : null
  } catch {
    return null
  }
}

// Install deps only if Vite genuinely can't be resolved from here.
let viteBinJs = resolveViteBin()
if (!viteBinJs) {
  console.log('Installing dependencies...')
  try {
    execSync('npm install --prefer-offline --no-audit --no-fund', { cwd: root, stdio: 'inherit' })
  } catch {
    console.error('  Failed to install dependencies. Try running manually:')
    console.error(`    cd "${root}" && npm install`)
    process.exit(1)
  }
  viteBinJs = resolveViteBin()
}
if (!viteBinJs) {
  console.error('  Could not locate Vite even after install.')
  console.error(`  Try running manually: cd "${root}" && npm install`)
  process.exit(1)
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

// Run Vite's CLI entry directly with this Node binary. Avoids depending on
// the `.bin/vite` shim (which also moves under hoisting) and the per-platform
// shell-quoting dance — `process.execPath` + the resolved JS path is portable.
const viteFlags = ['--port', port]
if (host) viteFlags.push('--host')
const vite = spawn(process.execPath, [viteBinJs, ...viteFlags], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
})
vite.on('error', (err) => {
  console.error(`\n  Failed to start Vite: ${err.message}`)
  console.error(`  Try running manually: cd "${root}" && npx vite --port ${port}\n`)
  process.exit(1)
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
      const cmd = opener === 'start' ? `start "" "${url}"` : `${opener} "${url}"`
      execSync(cmd, { stdio: 'ignore' })
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
