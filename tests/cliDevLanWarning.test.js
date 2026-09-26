/**
 * 2026-09-26 dev-server parity wave — finding F-6.
 *
 * `bin/cli.js`'s dev-start path binds Vite to `--host` (LAN-exposed, 0.0.0.0) by default and,
 * unlike `server.mjs` (production), never warned when no `OFFICE_API_TOKEN` is set. Spawns the
 * REAL cli entrypoint (which spawns a real Vite dev server) with an isolated HOME/USERPROFILE
 * and OFFICE_STATUS_DIR so nothing touches the developer's real ~/.claude.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

let child

afterEach(() => {
  if (child) {
    try { child.kill(process.platform === 'win32' ? undefined : 'SIGTERM') } catch {}
    child = null
  }
})

async function runCli(extraEnv = {}) {
  const port = await freePort()
  const tempHome = mkdtempSync(join(tmpdir(), 'avo-cli-warn-'))
  let stdout = ''
  child = spawn(process.execPath, [join(ROOT, 'bin', 'cli.js'), '--no-open', `--port=${port}`], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
      OFFICE_STATUS_DIR: join(tempHome, '.claude'),
      OFFICE_API_TOKEN: '',
      ...extraEnv,
    },
  })
  child.stdout.on('data', (d) => { stdout += d.toString() })
  child.stderr.on('data', (d) => { stdout += d.toString() })

  // Wait for Vite's ready banner or a bounded timeout — whichever first.
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline && !/Starting Agent Virtual Office|ready in|VITE v/i.test(stdout)) {
    await new Promise((r) => setTimeout(r, 150))
  }
  // Give the WARNING lines (printed synchronously at spawn-time, before Vite's own banner
  // in some orderings) a moment to flush.
  await new Promise((r) => setTimeout(r, 500))
  return stdout
}

describe('F-6 dev LAN-exposure warning (bin/cli.js parity with server.mjs)', () => {
  it('warns when the dev server binds to the LAN with no OFFICE_API_TOKEN set', async () => {
    const stdout = await runCli()
    expect(stdout).toMatch(/OFFICE_API_TOKEN is not/i)
  }, 20_000)

  it('does not warn when OFFICE_API_TOKEN is set', async () => {
    const stdout = await runCli({ OFFICE_API_TOKEN: 'secret-for-test' })
    expect(stdout).not.toMatch(/OFFICE_API_TOKEN is not/i)
  }, 20_000)

  it('does not warn when --no-host is passed (not LAN-exposed)', async () => {
    const port = await freePort()
    const tempHome = mkdtempSync(join(tmpdir(), 'avo-cli-warn-nohost-'))
    let stdout = ''
    child = spawn(process.execPath, [join(ROOT, 'bin', 'cli.js'), '--no-open', '--no-host', `--port=${port}`], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: tempHome,
        USERPROFILE: tempHome,
        OFFICE_STATUS_DIR: join(tempHome, '.claude'),
        OFFICE_API_TOKEN: '',
      },
    })
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stdout += d.toString() })
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline && !/Starting Agent Virtual Office|ready in|VITE v/i.test(stdout)) {
      await new Promise((r) => setTimeout(r, 150))
    }
    await new Promise((r) => setTimeout(r, 500))
    expect(stdout).not.toMatch(/OFFICE_API_TOKEN is not/i)
  }, 20_000)
})
