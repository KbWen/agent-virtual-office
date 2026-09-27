/**
 * codexHookIsolation.test.js — AVO audit remediation (2026-09-26, finding #1 / #2).
 *
 * `office-status-codex.js` and `office-status-hook.js` independently derive a session-slug
 * filename in the SAME directory (`~/.claude/`). Before this fix they used the exact same
 * name scheme (`office-status-<slug>.json`) with no provenance tag, so:
 *
 *   (a) a Codex blind overwrite could silently clobber the Claude hook's RMW state
 *       (`_stopped`, `_stoppedAt`, `_promptId`, helpers, other agents) — no lock, no check.
 *   (b) `cleanupGhostAliases` (branch-hop ghost cleanup in office-status-hook.js) deletes any
 *       sibling file sharing its own cwd-hash suffix once it proves `_cwd` matches — a Codex
 *       file with the same cwd hash (and therefore the same `_cwd`) was proven-deletable even
 *       though the hook never wrote it.
 *   (c) the two files' slug transforms applied slice(0,28) and the leading/trailing-dash strip
 *       in OPPOSITE order, so the same branch name could resolve to two different slugs at the
 *       28-char boundary — defeating "one checkout, one session" for exactly the branch names
 *       most likely to be long feature branches.
 *
 * Fix: Codex writes its own `office-status-codex-<slug>.json` namespace, `cleanupGhostAliases`
 * additionally requires `source === 'claude-cli'` before unlinking a sibling (so it can never
 * remove a file it did not write, regardless of filename), and the slug slice/strip order is
 * aligned to the Claude hook's (slice-then-strip), which is the documented reference behavior
 * per docs/specs/codex-status-parity-and-done-count.md.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const hook = require('../public/hooks/office-status-hook.js')
const codex = require('../public/hooks/office-status-codex.js')

function writeJson(dir, name, data) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data))
}

describe('Codex helper writes its own filename namespace', () => {
  let dir, origHome, origUserProfile
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-namespace-'))
    origHome = process.env.HOME
    origUserProfile = process.env.USERPROFILE
    process.env.HOME = dir
    process.env.USERPROFILE = dir
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true })
  })
  afterEach(() => {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome
    if (origUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = origUserProfile
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('writeCodexStatusFile names the file office-status-codex-<slug>.json, never bare office-status-<slug>.json', () => {
    const { statusFile } = codex.writeCodexStatusFile({ dev: 'working' })
    const base = path.basename(statusFile)
    expect(base.startsWith('office-status-codex-')).toBe(true)
    expect(base).not.toMatch(/^office-status-(?!codex-)/)
  })

  it('the written payload still carries source: codex-cli for downstream provenance checks', () => {
    const { payload } = codex.writeCodexStatusFile({ dev: 'working' })
    expect(payload.source).toBe('codex-cli')
  })
})

describe('cleanupGhostAliases never deletes a non-Claude-hook file (source-gated)', () => {
  const SUFFIX = 'ab12'
  let dir, origStatusFile
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-source-gate-'))
    origStatusFile = process.env.OFFICE_STATUS_FILE
    process.env.OFFICE_STATUS_FILE = path.join(dir, `office-status-new-branch-${SUFFIX}.json`)
  })
  afterEach(() => {
    if (origStatusFile === undefined) delete process.env.OFFICE_STATUS_FILE
    else process.env.OFFICE_STATUS_FILE = origStatusFile
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('does NOT delete a same-cwd-hash, same-_cwd sibling whose source is codex-cli (would previously have been deleted)', () => {
    // Same cwd-hash suffix AND _cwd === process.cwd() — pre-fix, this alone was sufficient
    // to prove "our own pre-branch-switch alias" and delete it. A Codex-written file can
    // legitimately share both of those (same checkout, same machine) — only `source` tells
    // them apart.
    writeJson(dir, `office-status-old-branch-${SUFFIX}.json`, { _cwd: process.cwd(), source: 'codex-cli', agents: [] })
    hook.cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, `office-status-old-branch-${SUFFIX}.json`))).toBe(true)
  })

  it('still deletes a genuine same-checkout Claude-hook alias (source: claude-cli) — regression guard', () => {
    writeJson(dir, `office-status-old-branch-${SUFFIX}.json`, { _cwd: process.cwd(), source: 'claude-cli', agents: [] })
    hook.cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, `office-status-old-branch-${SUFFIX}.json`))).toBe(false)
  })

  it('does NOT delete a sibling with no source field at all (unknown provenance — honest-narrow: do not delete)', () => {
    writeJson(dir, `office-status-old-branch-${SUFFIX}.json`, { _cwd: process.cwd(), agents: [] })
    hook.cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, `office-status-old-branch-${SUFFIX}.json`))).toBe(true)
  })

  it('the new office-status-codex-<slug>.json naming ALSO survives the sweep (defense in depth, belt+suspenders)', () => {
    writeJson(dir, `office-status-codex-old-branch-${SUFFIX}.json`, { _cwd: process.cwd(), source: 'codex-cli', agents: [] })
    hook.cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, `office-status-codex-old-branch-${SUFFIX}.json`))).toBe(true)
  })
})

describe('slug slice/strip order parity between the Claude hook and the Codex helper', () => {
  let dir, origCwd
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slug-parity-'))
    fs.mkdirSync(path.join(dir, '.git'))
    origCwd = process.cwd()
  })
  afterEach(() => {
    process.chdir(origCwd)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('produces an identical slug for a branch whose 28-char slice boundary lands on a separator', () => {
    // 27 alnum chars + '-' + more chars: slice(0, 28) ends EXACTLY on the dash.
    // slice-then-strip (hook's order) drops the trailing dash -> 27 a's.
    // strip-then-slice (codex's PRE-FIX order) has nothing to strip yet -> keeps the dash.
    const branch = 'a'.repeat(27) + '-' + 'b'.repeat(10)
    fs.writeFileSync(path.join(dir, '.git', 'HEAD'), `ref: refs/heads/${branch}\n`)
    process.chdir(dir)

    const hookSlug = hook.getSessionSlug()
    const codexSlug = codex.getSessionSlug()
    expect(codexSlug).toBe(hookSlug)
    // The un-stripped trailing dash from slice(0,28) would otherwise collide with the
    // `-${cwdHash}` suffix's own separator, producing a double dash ("...a--<hash>").
    expect(hookSlug).not.toMatch(/--/)
  })

  it('produces an identical slug for a branch with leading non-alnum runs collapsing near the boundary', () => {
    const branch = '---' + 'x'.repeat(40)
    fs.writeFileSync(path.join(dir, '.git', 'HEAD'), `ref: refs/heads/${branch}\n`)
    process.chdir(dir)
    expect(codex.getSessionSlug()).toBe(hook.getSessionSlug())
  })
})

describe('office-status-codex.js does not block on stdin when a JSON arg is supplied (finding #2)', () => {
  // spawnSync's 'pipe' stdio auto-closes an unwritten pipe (no faithful repro of an open
  // terminal/pipe), so this uses async `spawn` and keeps the child's stdin genuinely open
  // (never .end()'d) — the exact shape of the documented usage
  // `node office-status-codex.js '{"dev":"working"}'` run from an interactive shell or a
  // long-lived pipe that hasn't sent EOF yet.
  it('exits promptly with an open (unclosed) stdin pipe when invoked with an argv payload', async () => {
    const scriptPath = path.resolve('public/hooks/office-status-codex.js')
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-stdin-'))
    try {
      const child = spawn(process.execPath, [scriptPath, '{"dev":"working"}'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome },
      })
      // Deliberately never call child.stdin.end() — stdin stays open, simulating a TTY /
      // long-lived pipe that has not sent EOF.
      const exited = await new Promise((resolve) => {
        const timer = setTimeout(() => { child.kill(); resolve(false) }, 3000)
        child.on('exit', (code) => { clearTimeout(timer); resolve(code === 0) })
      })
      expect(exited).toBe(true)
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true })
    }
  }, 6000)
})
