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

// A path may be a glob, as in Docker COPY sources and npm `files`: `*` / `?` wildcards and `[...]`
// character classes (so `file[1].txt` means `file1.txt`, exactly as Docker and npm read it). A glob
// counts as present when anything matches it; other regex metacharacters are literal.
function sourceExists(src) {
  if (!/[*?[]/.test(src)) return fs.existsSync(path.join(root, src))
  const dir = path.join(root, path.dirname(src))
  const re = new RegExp('^' + path.basename(src)
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]') + '$')
  return fs.existsSync(dir) && fs.readdirSync(dir).some((name) => re.test(name))
}

// Sources of every build-context COPY/ADD (not `--from=` stage copies, not remote ADD URLs).
// Handles `\` line continuations, `--flag=value` options and the JSON-array form.
function dockerCopySources(text) {
  const out = []
  const lines = text.replace(/\\\r?\n/g, ' ').split(/\r?\n/)
  for (const raw of lines) {
    const m = raw.trim().match(/^(COPY|ADD)\s+(.*)$/i)
    if (!m) continue
    let rest = m[2].trim()
    const opts = []
    for (let o = rest.match(/^--\S+\s*/); o; o = rest.match(/^--\S+\s*/)) {
      opts.push(o[0].trim())
      rest = rest.slice(o[0].length)
    }
    if (opts.some((o) => /^--from=/i.test(o))) continue
    const parts = rest.startsWith('[') ? JSON.parse(rest) : rest.split(/\s+/)
    out.push(...parts.slice(0, -1).filter((s) => !/^https?:\/\//i.test(s)))
  }
  return out
}

describe('build manifests only name paths that exist (REV-05, AC-4)', () => {
  it('every Dockerfile COPY/ADD source from the build context exists', () => {
    const sources = dockerCopySources(fs.readFileSync(path.join(root, 'Dockerfile'), 'utf-8'))
    expect(sources).toContain('server.mjs') // the parser really reads the file
    const missing = sources.filter((s) => !sourceExists(s))
    expect(missing, `Dockerfile COPYs paths that do not exist:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('every package.json "files" entry exists (globs included)', () => {
    const { files } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
    expect(files.length).toBeGreaterThan(3)
    const missing = files.filter((f) => !sourceExists(f.replace(/\/$/, '')))
    expect(missing, `package.json "files" names paths npm pack would silently skip:\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('the dev-server config is native ESM (the three config-loader warnings stay gone)', () => {
    expect(fs.existsSync(path.join(root, 'vite.config.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'vite.config.js'))).toBe(false)
  })
})

describe('the guard itself (test-the-test)', () => {
  it('parses every COPY/ADD shape Docker accepts', () => {
    expect(dockerCopySources('COPY a b /app/')).toEqual(['a', 'b'])
    expect(dockerCopySources('COPY src \\\n     public \\\n     ./app/')).toEqual(['src', 'public']) // continuation
    expect(dockerCopySources('COPY ["dir with space/x.js", "y.js", "/app/"]')).toEqual(['dir with space/x.js', 'y.js'])
    expect(dockerCopySources('COPY --chown=node:node --chmod=644 a /app')).toEqual(['a'])
    expect(dockerCopySources('COPY --from=builder /app/dist ./dist')).toEqual([]) // stage copy, not the context
    expect(dockerCopySources('ADD https://example.com/x.tgz /tmp/\nADD vendor.tgz /opt/')).toEqual(['vendor.tgz'])
    expect(dockerCopySources('RUN echo COPY a b\n# COPY c d')).toEqual([])
  })

  it('resolves globs the way Docker and npm do', () => {
    expect(sourceExists('package*.json')).toBe(true)
    expect(sourceExists('nope-*.json')).toBe(false)
    expect(sourceExists('packag[e].json')).toBe(true) // [...] is a class, not literal brackets
    expect(sourceExists('packag[xyz].json')).toBe(false)
    expect(sourceExists('package+json')).toBe(false) // `+` stays literal
  })
})
