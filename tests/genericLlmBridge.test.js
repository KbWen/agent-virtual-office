/**
 * genericLlmBridge.test.js — 2026-09-26 audit finding 5.
 *
 * `public/hooks/generic-llm-bridge.js` is a CJS CLI script that used to call `main()`
 * unconditionally at module load — requiring it for testing would start a real fs.watch()
 * and register process signal handlers. It now guards `main()` behind
 * `require.main === module`, so this test can `require()` it (real CLI invocation via
 * `node generic-llm-bridge.js` is unaffected — require.main === module holds true there).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const bridgePath = path.resolve('public/hooks/generic-llm-bridge.js')
const { parseArgs, fileToRole, shouldIgnorePath } = require(bridgePath)

describe('parseArgs — supports both "--flag value" and "--flag=value" (finding 5)', () => {
  it('parses the two-token form (pre-existing behavior)', () => {
    const args = parseArgs(['node', 'bridge.js', '--port', '5175', '--source', 'copilot'])
    expect(args.port).toBe(5175)
    expect(args.source).toBe('copilot')
  })

  it('parses the "=" form documented in docs/INTEGRATIONS.md lines 201/215', () => {
    const args = parseArgs(['node', 'bridge.js', '--port=5175'])
    expect(args.port).toBe(5175)
  })

  it('parses "--watch=" and "--source=" in the "=" form too', () => {
    const args = parseArgs(['node', 'bridge.js', '--watch=.', '--source=cursor'])
    expect(args.source).toBe('cursor')
    expect(path.isAbsolute(args.watch)).toBe(true)
  })

  it('rejects a non-numeric --port=abc the same way as the two-token form', () => {
    const orig = process.exit
    let exitCode = null
    process.exit = (code) => { exitCode = code; throw new Error('exit') }
    try {
      expect(() => parseArgs(['node', 'bridge.js', '--port=abc'])).toThrow()
      expect(exitCode).toBe(1)
    } finally {
      process.exit = orig
    }
  })

  it('defaults to port 5174 when no --port flag is given at all', () => {
    const args = parseArgs(['node', 'bridge.js'])
    expect(args.port).toBe(5174)
  })
})

describe('shouldIgnorePath — anchored directory match, not substring (finding 5)', () => {
  it('ignores node_modules, .git, dist, .next, .nuxt, .turbo as whole path segments', () => {
    expect(shouldIgnorePath('/repo/node_modules/pkg/index.js')).toBe(true)
    expect(shouldIgnorePath('/repo/.git/HEAD')).toBe(true)
    expect(shouldIgnorePath('/repo/dist/index.js')).toBe(true)
    expect(shouldIgnorePath('/repo/.next/cache/x')).toBe(true)
    expect(shouldIgnorePath('/repo/.nuxt/build/x')).toBe(true)
    expect(shouldIgnorePath('/repo/.turbo/cache/x')).toBe(true)
  })

  it('does NOT ignore .github/ (regression: unanchored \\.git used to eat .github too)', () => {
    expect(shouldIgnorePath('/repo/.github/workflows/ci.yml')).toBe(false)
  })

  it('does NOT ignore a filename that merely contains "dist" as a substring', () => {
    expect(shouldIgnorePath('/repo/src/distance.js')).toBe(false)
    expect(shouldIgnorePath('/repo/src/distributor.ts')).toBe(false)
  })

  it('still ignores files named after office-status (basename substring, by design)', () => {
    expect(shouldIgnorePath('/repo/public/hooks/office-status-hook.js')).toBe(true)
    expect(shouldIgnorePath('/home/user/.claude/office-status.json')).toBe(true)
  })

  it('works with Windows-style backslash paths', () => {
    expect(shouldIgnorePath('C:\\repo\\node_modules\\pkg\\index.js')).toBe(true)
    expect(shouldIgnorePath('C:\\repo\\.github\\workflows\\ci.yml')).toBe(false)
  })
})

describe('fileToRole — .github routing is reachable again once the ignore regex stopped eating it', () => {
  it('routes .github/ paths to ops', () => {
    expect(fileToRole('/repo/.github/workflows/ci.yml')).toBe('ops')
  })
})

// 2026-09-26 review finding LOW #6: shouldIgnorePath used to test the ABSOLUTE path, so a
// --watch dir living under an ancestor directory named node_modules/.git/dist/etc. (e.g. a
// project checked out at /builds/dist/my-project) ignored every single event under it.
describe('shouldIgnorePath(path, watchDir) — tests the path RELATIVE to the watched project', () => {
  it('does not ignore project files when an ANCESTOR of watchDir is named "dist"', () => {
    const watchDir = '/builds/dist/my-project'
    expect(shouldIgnorePath('/builds/dist/my-project/src/index.js', watchDir)).toBe(false)
    expect(shouldIgnorePath('/builds/dist/my-project/README.md', watchDir)).toBe(false)
  })

  it('does not ignore project files when an ANCESTOR of watchDir is named ".git" or "node_modules"', () => {
    expect(shouldIgnorePath('/x/.git/checkout/my-project/src/a.js', '/x/.git/checkout/my-project')).toBe(false)
    expect(shouldIgnorePath('/x/node_modules/my-project/src/a.js', '/x/node_modules/my-project')).toBe(false)
  })

  it('still ignores a real dist/ or .git/ segment INSIDE the watched project', () => {
    const watchDir = '/builds/dist/my-project'
    expect(shouldIgnorePath('/builds/dist/my-project/dist/bundle.js', watchDir)).toBe(true)
    expect(shouldIgnorePath('/builds/dist/my-project/.git/HEAD', watchDir)).toBe(true)
    expect(shouldIgnorePath('/builds/dist/my-project/node_modules/pkg/x.js', watchDir)).toBe(true)
  })

  it('still catches office-status basename matches relative to watchDir', () => {
    expect(shouldIgnorePath('/builds/dist/my-project/public/hooks/office-status-hook.js', '/builds/dist/my-project')).toBe(true)
  })

  it('handles the fallback-watcher shape (full path built from a src/ subdir, watchDir is the project root)', () => {
    const watchDir = '/builds/dist/my-project'
    const target = path.join(watchDir, 'src')
    expect(shouldIgnorePath(path.join(target, 'App.jsx'), watchDir)).toBe(false)
  })
})
