/**
 * hookShellSeq.test.js
 *
 * `public/hooks/office-status-hook.sh` (the legacy shell hook, still shipped and still
 * hand-wirable) stamped `_seq` with `date +%s%N`, which was wrong on BOTH platforms:
 *
 *   - GNU date returns NANOseconds — 1,000,000x the millisecond epoch every consumer assumes.
 *     scanSessions dedups a bare status file against a slugged one only when their seqs are
 *     within 2s, and expires a `done` against `Date.now()`; neither works on a nanosecond value.
 *   - BSD/macOS date has no `%N` and echoes the format character back ("1757318400N"), which
 *     the client's numeric-seq guard rejects outright, so the write was simply ignored.
 *
 * Runs the script's own `seq_ms` helper under both, using a stub `date` on PATH to emulate BSD.
 * Skipped where no POSIX shell is available (the shell hook cannot run there either).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOOK = path.join(repoRoot, 'public/hooks/office-status-hook.sh')

const hasBash = spawnSync('bash', ['-c', 'exit 0'], { stdio: 'ignore' }).status === 0

/** Extract just the seq_ms function so sourcing the file doesn't run the whole hook. */
function seqMsSource() {
  const src = fs.readFileSync(HOOK, 'utf-8')
  const m = src.match(/^seq_ms\(\)\s*\{[\s\S]*?^\}/m)
  expect(m, 'office-status-hook.sh must define a seq_ms() helper').not.toBeNull()
  return m[0]
}

function runSeqMs(extraPath) {
  const script = `${seqMsSource()}\nseq_ms\n`
  return execFileSync('bash', ['-c', script], {
    encoding: 'utf-8',
    env: extraPath ? { ...process.env, PATH: `${extraPath}${path.delimiter}${process.env.PATH}` } : process.env,
  }).trim()
}

describe.skipIf(!hasBash)('shell hook _seq is a millisecond epoch on every platform', () => {
  let bsdStubDir

  beforeAll(() => {
    // A `date` that behaves like BSD: no %N support, so the format char comes back literally.
    const realDate = execFileSync('bash', ['-c', 'command -v date'], { encoding: 'utf-8' }).trim()
    bsdStubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avo-bsd-date-'))
    const stub = path.join(bsdStubDir, 'date')
    fs.writeFileSync(
      stub,
      `#!/bin/bash\nif [ "$1" = "+%s%N" ]; then echo "$(${realDate} +%s)N"; else ${realDate} "$@"; fi\n`,
    )
    fs.chmodSync(stub, 0o755)
  })

  it('the raw `date +%s%N` this replaced is NOT a valid seq (guards against a vacuous test)', () => {
    // Proves the stub really emulates BSD and that the old expression was broken.
    const bsdRaw = execFileSync('bash', ['-c', 'date +%s%N'], {
      encoding: 'utf-8',
      env: { ...process.env, PATH: `${bsdStubDir}${path.delimiter}${process.env.PATH}` },
    }).trim()
    expect(bsdRaw).toMatch(/N$/)
    expect(/^\d+$/.test(bsdRaw)).toBe(false)
  })

  it.each([['GNU date (nanoseconds available)', false], ['BSD date (no %N)', true]])(
    'emits a plain-integer millisecond seq under %s',
    (_label, useBsdStub) => {
      const seq = runSeqMs(useBsdStub ? bsdStubDir : null)
      expect(seq, `seq "${seq}" must satisfy the client's /^\d+$/ guard`).toMatch(/^\d+$/)
      // Milliseconds, not nanoseconds: within a minute of this process's own clock.
      const drift = Math.abs(Number(seq) - Date.now())
      expect(drift, `seq ${seq} is ${drift}ms from Date.now() — wrong unit?`).toBeLessThan(60_000)
    },
  )
})
