/**
 * Branch-hop ghost cleanup (owner bug 2026-06-11: "characters yanked to the top /
 * vanish then reappear").
 *
 * The hook's session slug embeds the git branch, so a mid-session `git checkout`
 * moves the hook onto a NEW status file and strands the old one — fresh for up to
 * the scanner's 5-min staleness window. scanSessions then merges the same checkout
 * as TWO sessions: composite `slug~role` ghosts spawn at the OVERFLOW slots (top
 * hallway, y≈50–80) and are evicted when the stranded file goes stale.
 *
 * cleanupGhostAliases() deletes slugged siblings that (a) share our filename's
 * 4-hex cwd-hash suffix (cheap readdir prefilter) AND (b) prove `_cwd === process.cwd()`
 * on parse (so a hash collision with a foreign repo can never delete a live session).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const hook = await import('../public/hooks/office-status-hook.js').then(m => m.default || m)
const { cleanupGhostAliases } = hook

const SUFFIX = 'ab12'  // arbitrary 4-hex suffix used as "our" cwd hash in tests

function writeJson(dir, name, data) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data))
}

describe('cleanupGhostAliases — branch-hop alias removal', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-cleanup-'))
    // Point the hook at "our" file: a slug-shaped name carrying the test suffix.
    process.env.OFFICE_STATUS_FILE = path.join(dir, `office-status-new-branch-${SUFFIX}.json`)
  })
  afterEach(() => {
    delete process.env.OFFICE_STATUS_FILE
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('deletes a slugged sibling with the same suffix AND _cwd === process.cwd()', () => {
    writeJson(dir, `office-status-old-branch-${SUFFIX}.json`, { _cwd: process.cwd(), agents: [] })
    cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, `office-status-old-branch-${SUFFIX}.json`))).toBe(false)
  })

  it('does NOT delete a same-suffix sibling whose _cwd differs (hash-collision guard)', () => {
    writeJson(dir, `office-status-other-repo-${SUFFIX}.json`, { _cwd: '/some/other/repo', agents: [] })
    cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, `office-status-other-repo-${SUFFIX}.json`))).toBe(true)
  })

  it('does NOT delete siblings with a different cwd-hash suffix', () => {
    writeJson(dir, 'office-status-old-branch-ffff.json', { _cwd: process.cwd(), agents: [] })
    cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, 'office-status-old-branch-ffff.json'))).toBe(true)
  })

  it('NEVER touches the bare office-status.json (server/POST writes it)', () => {
    writeJson(dir, 'office-status.json', { _cwd: process.cwd(), agents: [] })
    cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, 'office-status.json'))).toBe(true)
  })

  it('never deletes its OWN file', () => {
    writeJson(dir, `office-status-new-branch-${SUFFIX}.json`, { _cwd: process.cwd(), agents: [] })
    cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, `office-status-new-branch-${SUFFIX}.json`))).toBe(true)
  })

  it('tolerates an unreadable/malformed sibling without throwing (and leaves it)', () => {
    fs.writeFileSync(path.join(dir, `office-status-broken-${SUFFIX}.json`), '{not json')
    expect(() => cleanupGhostAliases()).not.toThrow()
    expect(fs.existsSync(path.join(dir, `office-status-broken-${SUFFIX}.json`))).toBe(true)
  })

  it('skips the sweep entirely when the own filename has no cwd-hash shape (env-override safety)', () => {
    process.env.OFFICE_STATUS_FILE = path.join(dir, 'counter.json')  // pack/lock-test style override
    writeJson(dir, `office-status-old-branch-${SUFFIX}.json`, { _cwd: process.cwd(), agents: [] })
    cleanupGhostAliases()
    expect(fs.existsSync(path.join(dir, `office-status-old-branch-${SUFFIX}.json`))).toBe(true)
  })

  it('end-to-end: a processEvent call removes the stranded pre-switch alias', () => {
    writeJson(dir, `office-status-old-branch-${SUFFIX}.json`, { _cwd: process.cwd(), agents: [] })
    hook.processEvent({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo hi' } })
    expect(fs.existsSync(path.join(dir, `office-status-old-branch-${SUFFIX}.json`))).toBe(false)
  })
})
