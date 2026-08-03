/**
 * Project-root resolution (#201 — npx hook filtering)
 *
 * Both servers are spawned by bin/cli.js with `cwd` set to the PACKAGE root, so under
 * `npx agent-virtual-office` their process.cwd() is the npx cache directory. Session files
 * are matched against that root, so every hook-written file looked foreign and was filtered
 * out — the office fell back to file-watcher data and the documented install path showed
 * no agent signal at all.
 *
 * Covers:
 *   - resolveProjectRoot() precedence (env override > cwd) and path resolution.
 *   - The read path honours the override (the reported bug).
 *   - The WRITE path uses the same root — a server that stamps `_cwd` with its own cwd
 *     while reading against the override filters out its own POSTs (the gap left by the
 *     original patch: vite.config.js/server.mjs stamp `_cwd` in the POST handlers too).
 *
 * The real-server end-to-end proof lives in tests/serverProjectRootE2E.test.js.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { scanAndMerge, resolveProjectRoot } from '../src/server/scanSessions.mjs'

function tmpDir(prefix = 'projectRoot-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeSession(dir, file, data) {
  fs.writeFileSync(path.join(dir, file), JSON.stringify(data))
}

function hookSession(cwd) {
  return {
    type: 'office-status',
    _seq: String(Date.now()),
    _cwd: cwd,
    source: 'claude-cli',
    agents: [{ role: 'dev', status: 'working', task: 'Edit', label: null }],
  }
}

describe('resolveProjectRoot', () => {
  it('defaults to the process cwd when no override is set', () => {
    expect(resolveProjectRoot({}, '/some/project')).toBe('/some/project')
  })

  it('prefers an explicit OFFICE_PROJECT_ROOT over the cwd', () => {
    const root = path.resolve('/explicit/root')
    expect(resolveProjectRoot({ OFFICE_PROJECT_ROOT: root }, '/package/dir')).toBe(root)
  })

  it('resolves a relative override to an absolute path', () => {
    const resolved = resolveProjectRoot({ OFFICE_PROJECT_ROOT: 'sub/dir' }, '/package/dir')
    expect(path.isAbsolute(resolved)).toBe(true)
    expect(resolved).toBe(path.resolve('sub/dir'))
  })

  it('ignores an empty or whitespace-only override', () => {
    expect(resolveProjectRoot({ OFFICE_PROJECT_ROOT: '' }, '/package/dir')).toBe('/package/dir')
    expect(resolveProjectRoot({ OFFICE_PROJECT_ROOT: '   ' }, '/package/dir')).toBe('/package/dir')
  })
})

describe('session matching under an npx-style cwd split', () => {
  let statusDir, projectRoot, packageRoot
  beforeEach(() => {
    statusDir = tmpDir('projectRoot-status-')
    projectRoot = tmpDir('projectRoot-project-')
    packageRoot = tmpDir('projectRoot-package-')
  })
  afterEach(() => {
    for (const d of [statusDir, projectRoot, packageRoot]) {
      fs.rmSync(d, { recursive: true, force: true })
    }
  })

  // Test-the-test: this is the reported failure. If this ever starts passing, the
  // _cwd filter has changed and the override below no longer proves anything.
  it('drops hook sessions when the root is the package dir (the #201 bug)', () => {
    writeSession(statusDir, 'office-status-abc.json', hookSession(projectRoot))
    expect(scanAndMerge(statusDir, packageRoot)).toBeNull()
  })

  it('keeps hook sessions when the root is the invoking project dir', () => {
    writeSession(statusDir, 'office-status-abc.json', hookSession(projectRoot))
    const merged = scanAndMerge(statusDir, resolveProjectRoot(
      { OFFICE_PROJECT_ROOT: projectRoot },
      packageRoot,
    ))
    expect(merged).not.toBeNull()
    expect(merged.source).toBe('claude-cli')
    expect(merged.agents[0].role).toBe('dev')
  })

  // The write sites (`normalized._cwd = PROJECT_ROOT` in both POST handlers) must use the
  // same root as the read sites. Stamping process.cwd() while reading against the override
  // makes the server filter out its own POSTed status.
  it('keeps a POST-style payload stamped with the same resolved root', () => {
    const root = resolveProjectRoot({ OFFICE_PROJECT_ROOT: projectRoot }, packageRoot)
    writeSession(statusDir, 'office-status.json', { ...hookSession(root), source: 'webhook' })
    const merged = scanAndMerge(statusDir, root)
    expect(merged).not.toBeNull()
    expect(merged.source).toBe('webhook')
  })

  it('drops a POST-style payload stamped with the package dir instead', () => {
    const root = resolveProjectRoot({ OFFICE_PROJECT_ROOT: projectRoot }, packageRoot)
    writeSession(statusDir, 'office-status.json', { ...hookSession(packageRoot), source: 'webhook' })
    expect(scanAndMerge(statusDir, root)).toBeNull()
  })
})
