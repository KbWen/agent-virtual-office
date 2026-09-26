/**
 * cliSetupUninstall.test.js — 2026-09-26 audit finding 6.
 *
 * bin/cli.js's `setup`/`uninstall` commands read os.homedir(); real tests override HOME
 * (POSIX) / USERPROFILE (Windows) to a fresh temp dir per test, matching the isolation
 * pattern already used by scripts/pack-smoke.mjs — NEVER the real ~/.claude.
 *
 * cli.js runs its whole command dispatch at module-load time based on process.argv, so it is
 * exercised as a real child process (execFileSync/spawnSync) rather than require()'d in-process.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const cliPath = path.resolve('bin/cli.js')

function makeFakeHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'avo-cli-home-'))
}

function homeEnv(fakeHome) {
  return { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome }
}

function runCli(args, fakeHome) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    env: homeEnv(fakeHome),
    encoding: 'utf-8',
  })
}

describe('bin/cli.js setup — symlinked settings.json (finding 6)', () => {
  let fakeHome
  let symlinksSupported = true

  beforeEach(() => {
    fakeHome = makeFakeHome()
  })

  afterEach(() => {
    try { fs.rmSync(fakeHome, { recursive: true, force: true }) } catch {}
  })

  it('writes through a symlinked settings.json instead of replacing the symlink', () => {
    const claudeDir = path.join(fakeHome, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })
    const realTarget = path.join(fakeHome, 'real-settings.json')
    fs.writeFileSync(realTarget, JSON.stringify({}))
    const settingsPath = path.join(claudeDir, 'settings.json')
    try {
      fs.symlinkSync(realTarget, settingsPath, 'file')
    } catch (e) {
      // Symlinks need elevated privileges / Developer Mode on some Windows configs — skip
      // rather than fail the suite on an environment limitation unrelated to this fix.
      symlinksSupported = false
    }
    if (!symlinksSupported) return

    runCli(['setup'], fakeHome)

    // The symlink itself must still be a symlink (not replaced by a regular file).
    const st = fs.lstatSync(settingsPath)
    expect(st.isSymbolicLink()).toBe(true)
    // Its target must carry the new hook registration.
    const written = JSON.parse(fs.readFileSync(realTarget, 'utf-8'))
    expect(written.hooks).toBeTruthy()
    expect(written.hooks.PreToolUse).toBeTruthy()
  })
})

describe('bin/cli.js uninstall — malformed settings.json does not throw (finding 6)', () => {
  let fakeHome

  beforeEach(() => {
    fakeHome = makeFakeHome()
    const claudeDir = path.join(fakeHome, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })
    // A settings.json with a null entry in a hooks array AND a hooks-array element with no
    // `command` field — both used to throw inside uninstall's filter predicate.
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({
      hooks: {
        PreToolUse: [
          null,
          { hooks: [{ type: 'command', command: 'node /somewhere/office-status-hook.js' }] },
          { hooks: [{ type: 'command' /* no command field */ }] },
          { hooks: [null] },
        ],
      },
    }))
  })

  afterEach(() => {
    try { fs.rmSync(fakeHome, { recursive: true, force: true }) } catch {}
  })

  it('exits 0 and does not crash on a null entry / missing-command hook entry', () => {
    expect(() => runCli(['uninstall'], fakeHome)).not.toThrow()
  })

  it('still removes the real office-status-hook entry despite the malformed neighbors', () => {
    runCli(['uninstall'], fakeHome)
    const settingsPath = path.join(fakeHome, '.claude', 'settings.json')
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    // The real hook entry is gone; the malformed `null` survives (uninstall only filters OUT
    // entries that match office-status-hook — it does not sanitize unrelated malformed data).
    const remaining = settings.hooks && settings.hooks.PreToolUse || []
    const stillHasRealHook = remaining.some(h =>
      h && (h.hooks || []).some(hh => hh && hh.command && hh.command.includes('office-status-hook')),
    )
    expect(stillHasRealHook).toBe(false)
  })
})

describe('bin/cli.js uninstall — one unlinkable file does not stop cleanup of the rest (finding 6)', () => {
  let fakeHome

  beforeEach(() => {
    fakeHome = makeFakeHome()
  })

  afterEach(() => {
    try { fs.rmSync(fakeHome, { recursive: true, force: true }) } catch {}
  })

  it('removes the other matching status files even when one match is a directory (unlinkSync fails)', () => {
    const claudeDir = path.join(fakeHome, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })
    // A real status file that SHOULD be removed.
    const goodFile = path.join(claudeDir, 'office-status-abcd.json')
    fs.writeFileSync(goodFile, '{}')
    // A directory that happens to match the same glob — fs.unlinkSync on a directory always
    // fails (EPERM/EISDIR) regardless of platform, giving a portable way to force the failure
    // finding 6 asks to be non-fatal.
    const trapDir = path.join(claudeDir, 'office-status-trapdir.json')
    fs.mkdirSync(trapDir)

    expect(() => runCli(['uninstall'], fakeHome)).not.toThrow()
    expect(fs.existsSync(goodFile)).toBe(false)  // cleanup continued past the trap
  })
})
