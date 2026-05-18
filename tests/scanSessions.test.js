/**
 * Tests for src/server/scanSessions.mjs
 *
 * Covers: single-session pass-through, stale/future filtering, dedup,
 * multi-session merge (C1 deterministic ordering, C2 joined _seq, M3 TTL
 * constants, M6 mood carry-forward), and getSessionStats.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { scanAndMerge, getSessionStats } from '../src/server/scanSessions.mjs'

// ─── helpers ──────────────────────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scanSessions-'))
}

function writeSession(dir, file, data) {
  fs.writeFileSync(path.join(dir, file), JSON.stringify(data))
}

function freshSeq(offsetMs = 0) {
  return String(Date.now() + offsetMs)
}

// ─── stale / future filtering (M3) ────────────────────────────────────────────

describe('stale / future filtering', () => {
  let dir
  beforeEach(() => { dir = tmpDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('skips sessions older than 5 minutes', () => {
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: String(Date.now() - 301_000),
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    expect(scanAndMerge(dir, dir)).toBeNull()
  })

  it('skips sessions more than 5 minutes in the future', () => {
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: String(Date.now() + 301_000),
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    expect(scanAndMerge(dir, dir)).toBeNull()
  })

  it('accepts sessions within the 5-minute window', () => {
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: freshSeq(),
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    expect(scanAndMerge(dir, dir)).not.toBeNull()
  })

  it('returns null when directory does not exist', () => {
    expect(scanAndMerge(path.join(dir, 'nonexistent'), dir)).toBeNull()
  })
})

// ─── single session pass-through ──────────────────────────────────────────────

describe('single session pass-through', () => {
  let dir
  beforeEach(() => { dir = tmpDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('returns session data without _cwd', () => {
    const seq = freshSeq()
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: seq, _cwd: dir,
      agents: [{ role: 'dev', status: 'working', task: 'test', label: null }],
      workflow: 'build',
    })
    const result = scanAndMerge(dir, dir)
    expect(result).not.toBeNull()
    expect(result._cwd).toBeUndefined()
    expect(result._seq).toBe(seq)
    expect(result.workflow).toBe('build')
  })

  it('passes through mood and moodDuration in single-session path', () => {
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: freshSeq(), _cwd: dir,
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
      mood: 'smooth', moodDuration: 30000,
    })
    const result = scanAndMerge(dir, dir)
    expect(result.mood).toBe('smooth')
    expect(result.moodDuration).toBe(30000)
  })
})

// ─── dedup: bare file is duplicate of slugged session ─────────────────────────

describe('dedup', () => {
  let dir
  beforeEach(() => { dir = tmpDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('removes bare office-status.json when _seq is within 2s of a slugged session (hook source)', () => {
    const baseSeq = Date.now()
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: String(baseSeq), source: 'claude-cli',
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    writeSession(dir, 'office-status-feat-x.json', {
      type: 'office-status', _seq: String(baseSeq + 500), _cwd: dir,
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    const result = scanAndMerge(dir, dir)
    // After dedup, only the slugged session remains → single-session path
    expect(result).not.toBeNull()
    expect(result.source).not.toBe('multi-session')
  })

  it('keeps bare file when source is not claude-cli (POST/API write — not a hook duplicate)', () => {
    const baseSeq = Date.now()
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: String(baseSeq), source: 'api',
      agents: [{ role: 'pm', status: 'working', task: null, label: null }],
    })
    writeSession(dir, 'office-status-feat-x.json', {
      type: 'office-status', _seq: String(baseSeq + 100), _cwd: dir,
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    const result = scanAndMerge(dir, dir)
    // API-sourced bare file is not a hook duplicate — both sessions kept
    expect(result.source).toBe('multi-session')
    expect(result.sessionCount).toBe(2)
  })

  it('keeps bare file when _seq differs by more than 2s', () => {
    const baseSeq = Date.now()
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: String(baseSeq),
      agents: [{ role: 'qa', status: 'blocked', task: null, label: null }],
    })
    writeSession(dir, 'office-status-feat-x.json', {
      type: 'office-status', _seq: String(baseSeq + 5000), _cwd: dir,
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    const result = scanAndMerge(dir, dir)
    expect(result.source).toBe('multi-session')
    expect(result.sessionCount).toBe(2)
  })
})

// ─── multi-session merge ───────────────────────────────────────────────────────

describe('multi-session merge', () => {
  let dir
  beforeEach(() => { dir = tmpDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  function writeSlugged(slug, seq, agents, extra = {}) {
    writeSession(dir, `office-status-${slug}.json`, {
      type: 'office-status', _seq: String(seq), _cwd: dir, agents, ...extra,
    })
  }

  // C1: deterministic ordering
  it('C1: merged JSON is identical on repeated calls (same input)', () => {
    const base = Date.now()
    writeSlugged('bravo', base + 100, [{ role: 'qa', status: 'blocked', task: null, label: null }])
    writeSlugged('alpha', base + 200, [{ role: 'dev', status: 'working', task: null, label: null }])
    const r1 = JSON.stringify(scanAndMerge(dir, dir))
    const r2 = JSON.stringify(scanAndMerge(dir, dir))
    expect(r1).toBe(r2)
  })

  it('C1: agents from sessions sorted by slug appear in slug order', () => {
    const base = Date.now()
    writeSlugged('zzz', base + 10, [{ role: 'dev', status: 'working', task: null, label: null }])
    writeSlugged('aaa', base + 20, [{ role: 'qa', status: 'working', task: null, label: null }])
    const result = scanAndMerge(dir, dir)
    expect(result.source).toBe('multi-session')
    // aaa comes before zzz in sorted order
    const sessions = result.agents.map(a => a.session)
    expect(sessions.indexOf('aaa')).toBeLessThan(sessions.indexOf('zzz'))
  })

  // C2: joined _seq
  it('C2: _seq changes when a non-max child session updates', () => {
    const base = Date.now()
    writeSlugged('alpha', base + 1000, [{ role: 'dev', status: 'working', task: null, label: null }])
    writeSlugged('beta', base + 2000, [{ role: 'qa', status: 'working', task: null, label: null }])
    const r1 = scanAndMerge(dir, dir)
    const seq1 = r1._seq

    // Update alpha (the non-max session) by bumping its _seq
    writeSlugged('alpha', base + 1500, [{ role: 'dev', status: 'blocked', task: 'stuck', label: null }])
    const r2 = scanAndMerge(dir, dir)
    expect(r2._seq).not.toBe(seq1)
  })

  it('C2: _seq is a colon-joined string of sorted child _seqs', () => {
    const seqA = Date.now()
    const seqB = seqA + 1000
    writeSlugged('alpha', seqA, [{ role: 'dev', status: 'working', task: null, label: null }])
    writeSlugged('beta', seqB, [{ role: 'qa', status: 'working', task: null, label: null }])
    const result = scanAndMerge(dir, dir)
    const parts = result._seq.split(':').sort()
    expect(parts).toContain(String(seqA))
    expect(parts).toContain(String(seqB))
  })

  // M3: both functions use same 5-min future tolerance
  it('M3: session 4 min in future is accepted (within FUTURE_MS)', () => {
    const seq = Date.now() + 240_000
    writeSlugged('alpha', seq, [{ role: 'dev', status: 'working', task: null, label: null }])
    const result = scanAndMerge(dir, dir)
    expect(result).not.toBeNull()
  })

  it('M3: session 6 min in future is rejected (beyond FUTURE_MS)', () => {
    const seq = Date.now() + 360_000
    writeSlugged('alpha', seq, [{ role: 'dev', status: 'working', task: null, label: null }])
    expect(scanAndMerge(dir, dir)).toBeNull()
  })

  // M6: mood carry-forward
  it('M6: carries forward mood from the most-recent session that has one', () => {
    const base = Date.now()
    writeSlugged('alpha', base + 100, [{ role: 'dev', status: 'working', task: null, label: null }], { mood: 'frustrated', moodDuration: 20000 })
    writeSlugged('beta', base + 200, [{ role: 'qa', status: 'working', task: null, label: null }], { mood: 'smooth', moodDuration: 30000 })
    const result = scanAndMerge(dir, dir)
    // beta has higher _seq → its mood wins
    expect(result.mood).toBe('smooth')
    expect(result.moodDuration).toBe(30000)
  })

  it('M6: no mood in merged output when no session has mood', () => {
    const base = Date.now()
    writeSlugged('alpha', base + 100, [{ role: 'dev', status: 'working', task: null, label: null }])
    writeSlugged('beta', base + 200, [{ role: 'qa', status: 'working', task: null, label: null }])
    const result = scanAndMerge(dir, dir)
    expect(result.mood).toBeUndefined()
  })

  // Agent priority and role tiebreaker (multi-session path only — single session returns all agents)
  it('picks most urgent (blocked > working) agent per session', () => {
    const base = Date.now()
    // Need 2 sessions to trigger the multi-session pick-one-representative path
    writeSlugged('alpha', base + 100, [
      { role: 'dev', status: 'working', task: null, label: null },
      { role: 'qa',  status: 'blocked', task: 'stuck', label: null },
    ])
    writeSlugged('beta', base + 200, [{ role: 'ops', status: 'working', task: null, label: null }])
    const result = scanAndMerge(dir, dir)
    const alphaAgent = result.agents.find(a => a.session === 'alpha')
    expect(alphaAgent.role).toMatch(/qa/)
    expect(alphaAgent.status).toBe('blocked')
  })

  it('C1: role tiebreaker is stable when two agents share same status', () => {
    const base = Date.now()
    // Two working agents in same session — alphabetically first role wins as tiebreaker
    writeSlugged('alpha', base + 100, [
      { role: 'pm',  status: 'working', task: null, label: null },
      { role: 'dev', status: 'working', task: null, label: null },
    ])
    writeSlugged('beta', base + 200, [{ role: 'qa', status: 'working', task: null, label: null }])
    const r1 = scanAndMerge(dir, dir)
    const r2 = scanAndMerge(dir, dir)
    const alphaAgent1 = r1.agents.find(a => a.session === 'alpha')
    const alphaAgent2 = r2.agents.find(a => a.session === 'alpha')
    // Same agent picked each time (stable)
    expect(alphaAgent1.role).toBe(alphaAgent2.role)
    // dev < pm alphabetically → dev wins
    expect(alphaAgent1.role).toMatch(/dev/)
  })

  it('only includes working/blocked agents in activeCount', () => {
    const base = Date.now()
    writeSlugged('alpha', base + 100, [{ role: 'dev', status: 'done', task: null, label: null }])
    writeSlugged('beta', base + 200, [{ role: 'qa', status: 'working', task: null, label: null }])
    const result = scanAndMerge(dir, dir)
    // alpha's agent is 'done' → not picked; beta's agent is 'working' → picked
    expect(result.activeCount).toBe(1)
  })
})

// ─── getSessionStats ───────────────────────────────────────────────────────────

describe('getSessionStats', () => {
  let dir
  beforeEach(() => { dir = tmpDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('returns zeros when dir does not exist', () => {
    const stats = getSessionStats(path.join(dir, 'no-such'), dir)
    expect(stats.hookSessionCount).toBe(0)
    expect(stats.fileWatcherPresent).toBe(false)
  })

  it('counts hook sessions matching projectRoot CWD', () => {
    writeSession(dir, 'office-status-feat.json', {
      type: 'office-status', _seq: freshSeq(), _cwd: dir,
      agents: [], source: 'hook',
    })
    const stats = getSessionStats(dir, dir)
    expect(stats.hookSessionCount).toBe(1)
    expect(stats.fileWatcherPresent).toBe(false)
  })

  it('detects file-watcher sessions', () => {
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: freshSeq(),
      agents: [], source: 'file-watcher',
    })
    const stats = getSessionStats(dir, dir)
    expect(stats.fileWatcherPresent).toBe(true)
  })

  it('M3: skips sessions more than 5 min in the future (consistent with scanAndMerge)', () => {
    writeSession(dir, 'office-status-feat.json', {
      type: 'office-status', _seq: String(Date.now() + 360_000), _cwd: dir,
      agents: [], source: 'hook',
    })
    const stats = getSessionStats(dir, dir)
    expect(stats.hookSessionCount).toBe(0)
  })

  it('returns zeros when dir exists but is not readable (ENOTDIR guard)', () => {
    // Write a *file* at the path so readdirSync would throw ENOTDIR
    const filePath = path.join(dir, 'not-a-dir')
    fs.writeFileSync(filePath, 'data')
    const stats = getSessionStats(filePath, dir)
    expect(stats.hookSessionCount).toBe(0)
    expect(stats.fileWatcherPresent).toBe(false)
  })
})

// ─── dedup: hasUniqueWorkflow carve-out ───────────────────────────────────────

describe('dedup: hasUniqueWorkflow carve-out', () => {
  let dir
  beforeEach(() => { dir = tmpDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('keeps bare file when it has a workflow no slugged session shares (even within 2s, hook source)', () => {
    // Exercises hasUniqueWorkflow carve-out: isDup=true AND hasUniqueWorkflow=true → keep
    const baseSeq = Date.now()
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: String(baseSeq), workflow: 'unique-workflow', source: 'claude-cli',
      agents: [{ role: 'pm', status: 'working', task: null, label: null }],
    })
    writeSession(dir, 'office-status-feat.json', {
      type: 'office-status', _seq: String(baseSeq + 500), _cwd: dir, workflow: 'other-workflow',
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    const result = scanAndMerge(dir, dir)
    // Both sessions kept — bare file has unique workflow (carve-out prevents dedup)
    expect(result.source).toBe('multi-session')
    expect(result.sessionCount).toBe(2)
  })

  it('removes bare file when its workflow matches a slugged session (within 2s, hook source)', () => {
    const baseSeq = Date.now()
    const sharedWorkflow = 'shared-workflow'
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: String(baseSeq), workflow: sharedWorkflow, source: 'claude-cli',
      agents: [{ role: 'pm', status: 'working', task: null, label: null }],
    })
    writeSession(dir, 'office-status-feat.json', {
      type: 'office-status', _seq: String(baseSeq + 500), _cwd: dir, workflow: sharedWorkflow,
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    const result = scanAndMerge(dir, dir)
    // Bare file deduped — same workflow
    expect(result.source).not.toBe('multi-session')
  })
})

// ─── file-watcher strict exclusion + _hint:no-hooks ──────────────────────────

describe('file-watcher strict exclusion and _hint:no-hooks', () => {
  let dir
  beforeEach(() => { dir = tmpDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('excludes file-watcher session from strict pass when a hook session exists', () => {
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: freshSeq(), source: 'file-watcher',
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    writeSession(dir, 'office-status-feat.json', {
      type: 'office-status', _seq: freshSeq(), _cwd: dir, source: 'hook',
      agents: [{ role: 'qa', status: 'working', task: null, label: null }],
    })
    const result = scanAndMerge(dir, dir)
    // Hook session passes strict; file-watcher excluded from strict
    expect(result).not.toBeNull()
    expect(result._hint).toBeUndefined()
    // Only the hook session should have been included
    expect(result.source).not.toBe('multi-session')
  })

  it('sets _hint:no-hooks when only file-watcher sessions are available (fallback)', () => {
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: freshSeq(), source: 'file-watcher',
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    // projectRoot is something OTHER than dir so CWD match fails → strict pass empty → fallback
    const result = scanAndMerge(dir, '/nonexistent-project-root')
    expect(result).not.toBeNull()
    expect(result._hint).toBe('no-hooks')
  })

  it('skips malformed JSON files gracefully', () => {
    fs.writeFileSync(path.join(dir, 'office-status-bad.json'), '{ bad json }')
    writeSession(dir, 'office-status-good.json', {
      type: 'office-status', _seq: freshSeq(), _cwd: dir,
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    // Bad file skipped, good one processed
    expect(scanAndMerge(dir, dir)).not.toBeNull()
  })
})

// ─── fallback pass _cwd filtering ────────────────────────────────────────────

describe('fallback pass _cwd filtering', () => {
  let dir
  beforeEach(() => { dir = tmpDir() })
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }) })

  it('excludes a foreign-_cwd hook session from fallback so it cannot mix with local file-watcher', () => {
    // Hook session from a different project — strict pass sees nothing (no match for dir),
    // fallback must also exclude it.
    writeSession(dir, 'office-status-other.json', {
      type: 'office-status', _seq: freshSeq(), _cwd: '/some/other/project', source: 'claude-cli',
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: freshSeq(), source: 'file-watcher',
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    // projectRoot doesn't match either _cwd → strict empty → fallback
    const result = scanAndMerge(dir, dir)
    expect(result).not.toBeNull()
    // Foreign hook session must NOT appear in merged output
    expect(result._hint).toBe('no-hooks')
    // All agents should come from file-watcher, not the foreign session
    expect(result.source).not.toBe('multi-session')
  })

  it('excludes a slugged no-_cwd non-file-watcher session from fallback (old hook or foreign tool)', () => {
    // A slugged file with no _cwd and source !== 'file-watcher' — e.g. old hook version
    writeSession(dir, 'office-status-old-hook.json', {
      type: 'office-status', _seq: freshSeq(), source: 'claude-cli',
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: freshSeq(), source: 'file-watcher',
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    // projectRoot doesn't match → strict empty → fallback
    const result = scanAndMerge(dir, '/nonexistent-root')
    expect(result).not.toBeNull()
    // Old hook file must not suppress the _hint:'no-hooks' signal
    expect(result._hint).toBe('no-hooks')
  })

  it('includes a file-watcher session and the bare file in fallback even when no matching _cwd exists', () => {
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: freshSeq(), source: 'file-watcher',
      agents: [{ role: 'dev', status: 'working', task: 'edit', label: null }],
    })
    const result = scanAndMerge(dir, '/nonexistent-root')
    expect(result).not.toBeNull()
    expect(result._hint).toBe('no-hooks')
  })

  it('includes a matching-_cwd hook session in fallback when strict pass returns nothing (no file-watcher)', () => {
    // Strict fails because the only session is file-watcher (excluded from strict).
    // Fallback should include it and also the hook session if its _cwd matches.
    writeSession(dir, 'office-status-feat.json', {
      type: 'office-status', _seq: freshSeq(), _cwd: dir, source: 'claude-cli',
      agents: [{ role: 'qa', status: 'working', task: null, label: null }],
    })
    writeSession(dir, 'office-status.json', {
      type: 'office-status', _seq: freshSeq(), source: 'file-watcher',
      agents: [{ role: 'dev', status: 'working', task: null, label: null }],
    })
    // Strict pass: feat.json has matching _cwd and source!='file-watcher' → included
    // So we actually go through the strict path here, not fallback.
    // Verify: strict returns the hook session, not file-watcher.
    const result = scanAndMerge(dir, dir)
    expect(result).not.toBeNull()
    expect(result._hint).toBeUndefined()
  })
})
