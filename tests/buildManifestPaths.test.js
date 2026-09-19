import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// spec_ref: docs/specs/vite-config-esm.md — AC-4 (REV-05)
//
// Two manifests name repo paths and both DROP a missing one silently:
// - `docker build` fails on a stale `COPY`, but CI never builds the image (dockerRuntimeClosure only
//   follows the runner stage's imports), so a rename ships a broken Dockerfile with every gate green.
// - `npm pack` skips a `files` entry that does not exist without any error, so the tarball just loses
//   the file — renaming `vite.config.js` would have shipped an install whose dev server has no API.
// This guard makes both loud.

const root = path.resolve(__dirname, '..')

// A COPY source may be a glob (`package*.json`): it counts as present when anything matches it.
function sourceExists(src) {
  if (!/[*?[]/.test(src)) return fs.existsSync(path.join(root, src))
  const dir = path.join(root, path.dirname(src))
  const re = new RegExp('^' + path.basename(src).replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
  return fs.existsSync(dir) && fs.readdirSync(dir).some((name) => re.test(name))
}

function dockerCopySources() {
  const out = []
  for (const raw of fs.readFileSync(path.join(root, 'Dockerfile'), 'utf-8').split('\n')) {
    const line = raw.trim()
    if (!/^COPY\s/i.test(line) || /--from=/i.test(line)) continue // --from= copies between stages
    const parts = line.split(/\s+/).slice(1).filter((p) => !p.startsWith('--'))
    out.push(...parts.slice(0, -1)) // everything but the destination
  }
  return out
}

describe('build manifests only name paths that exist (REV-05, AC-4)', () => {
  it('every Dockerfile COPY source from the build context exists', () => {
    const sources = dockerCopySources()
    expect(sources).toContain('server.mjs') // the parser really reads the file
    expect(sourceExists('package*.json')).toBe(true) // globs resolve…
    expect(sourceExists('nope-*.json')).toBe(false) // …and a glob that matches nothing is missing
    const missing = sources.filter((s) => !sourceExists(s))
    expect(missing, `Dockerfile COPYs paths that do not exist:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('every package.json "files" entry exists', () => {
    const { files } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
    expect(files.length).toBeGreaterThan(3)
    const missing = files.filter((f) => !fs.existsSync(path.join(root, f.replace(/\/$/, ''))))
    expect(missing, `package.json "files" names paths npm pack would silently skip:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('the dev-server config is native ESM (the three config-loader warnings stay gone)', () => {
    expect(fs.existsSync(path.join(root, 'vite.config.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'vite.config.js'))).toBe(false)
  })
})
