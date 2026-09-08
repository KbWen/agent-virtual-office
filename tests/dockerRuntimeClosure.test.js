/**
 * dockerRuntimeClosure.test.js
 *
 * Guards the Docker runner stage against ERR_MODULE_NOT_FOUND at container startup.
 *
 * `server.mjs` is NOT self-contained: it imports `src/server/scanSessions.mjs` and
 * `src/utils/normalizePost.mjs`, which in turn imports `src/utils/statusContract.mjs`.
 * The runner stage of the Dockerfile copies an explicit allowlist of paths out of the
 * builder stage; before this guard existed, that allowlist was missing `src/` entirely
 * and every container built from the image exited immediately on startup.
 *
 * A unit test cannot catch that (vitest resolves from the repo, not the image), and the
 * build itself succeeds, so the failure only surfaced at `docker run`. This test closes
 * the gap statically: it walks the ENTIRE relative-import closure reachable from
 * `server.mjs` and asserts every resolved file is inside something the runner stage
 * copies. Adding an import that reaches outside the copied set fails here instead of in
 * production.
 *
 * Scope: relative specifiers only. Bare specifiers are either `node:` built-ins (always
 * present) or npm packages — the runner deliberately ships no `node_modules`, so a bare
 * non-builtin import is also flagged.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { builtinModules } from 'node:module'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = 'server.mjs'

/** Paths the runner stage copies out of the builder, as repo-relative POSIX paths. */
function runnerCopiedPaths() {
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf-8')
  // Everything after the LAST `FROM ... AS runner` is the runtime stage.
  const idx = dockerfile.search(/^FROM\s+\S+\s+AS\s+runner\s*$/mi)
  expect(idx, 'Dockerfile must declare a `FROM ... AS runner` stage').toBeGreaterThan(-1)
  const runnerStage = dockerfile.slice(idx)
  const copied = []
  for (const line of runnerStage.split('\n')) {
    const m = line.match(/^\s*COPY\s+.*--from=builder\s+\/app\/(\S+)\s/)
    if (m) copied.push(m[1].replace(/\/+$/, ''))
  }
  return copied
}

/** Every relative specifier in a source file (static, side-effect and dynamic imports). */
function relativeSpecifiers(source) {
  const specs = []
  const patterns = [
    /\bfrom\s*['"](\.[^'"]*)['"]/g,      // import x from './y'  /  export * from './y'
    /\bimport\s*['"](\.[^'"]*)['"]/g,    // import './y'
    /\bimport\s*\(\s*['"](\.[^'"]*)['"]/g, // await import('./y')
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(source)) !== null) specs.push(m[1])
  }
  return specs
}

/** Bare (non-relative, non-builtin) specifiers — these need node_modules, which the runner has none of. */
function bareNonBuiltinSpecifiers(source) {
  const builtins = new Set(builtinModules)
  const out = []
  const re = /\bfrom\s*['"]([^.'"][^'"]*)['"]/g
  let m
  while ((m = re.exec(source)) !== null) {
    const spec = m[1]
    if (spec.startsWith('node:')) continue
    if (builtins.has(spec)) continue
    out.push(spec)
  }
  return out
}

/** Transitively resolve the relative-import closure of ENTRY. Returns repo-relative POSIX paths. */
function importClosure() {
  const seen = new Set()
  const bare = new Map()
  const queue = [ENTRY]
  while (queue.length > 0) {
    const rel = queue.shift()
    if (seen.has(rel)) continue
    seen.add(rel)
    const abs = path.join(repoRoot, rel)
    const source = fs.readFileSync(abs, 'utf-8')
    const bareHere = bareNonBuiltinSpecifiers(source)
    if (bareHere.length > 0) bare.set(rel, bareHere)
    for (const spec of relativeSpecifiers(source)) {
      const resolvedAbs = path.resolve(path.dirname(abs), spec)
      expect(
        fs.existsSync(resolvedAbs),
        `${rel} imports "${spec}" which does not resolve to a file`,
      ).toBe(true)
      queue.push(path.relative(repoRoot, resolvedAbs).split(path.sep).join('/'))
    }
  }
  seen.delete(ENTRY)
  return { files: [...seen].sort(), bare }
}

describe('Docker runner stage ships server.mjs\'s full import closure', () => {
  const copied = runnerCopiedPaths()
  const { files, bare } = importClosure()

  it('resolves a non-empty import closure from server.mjs', () => {
    // Sanity floor: if this ever goes empty the walker silently stopped matching and the
    // rest of this suite would pass vacuously.
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain('src/server/scanSessions.mjs')
    expect(files).toContain('src/utils/normalizePost.mjs')
    expect(files).toContain('src/utils/statusContract.mjs')
  })

  it('copies the entry point itself', () => {
    expect(copied).toContain(ENTRY)
  })

  it.each([['dist'], ['package.json']])('still copies %s', (p) => {
    expect(copied).toContain(p)
  })

  it('copies every file server.mjs transitively imports', () => {
    const missing = files.filter(
      (f) => !copied.some((c) => f === c || f.startsWith(`${c}/`)),
    )
    expect(
      missing,
      `Dockerfile runner stage does not ship these runtime imports — the container will ` +
      `exit with ERR_MODULE_NOT_FOUND. Add a COPY for them:\n  ${missing.join('\n  ')}`,
    ).toEqual([])
  })

  it('the runtime closure needs no npm package (runner ships no node_modules)', () => {
    const offenders = [...bare.entries()].map(([f, specs]) => `${f}: ${specs.join(', ')}`)
    expect(
      offenders,
      `These runtime files import npm packages, but the runner stage installs no ` +
      `node_modules:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })
})
