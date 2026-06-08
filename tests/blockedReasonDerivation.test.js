// AVO-110 / #29 — honesty firewall for the hook's deriveBlockedReason.
// This is the truth-half: a specific reason is emitted ONLY when the signal proves it;
// every ambiguous / launch-failure / compound / heuristic case → 'blocked-unknown'.
import { describe, it, expect } from 'vitest'

const { deriveBlockedReason, pickReason } = await import('../public/hooks/office-status-hook.js')

// convenience: a trusted error event for a given bash command + optional first output line
const ev = (command, toolResultFirstLine = '') =>
  deriveBlockedReason({ isErrorExplicit: true, command, toolResultFirstLine })

describe('AVO-110 deriveBlockedReason — honesty firewall', () => {
  describe('FALLBACK-IS-DEFAULT', () => {
    it('a vague-noun command → blocked-unknown (never force-fit)', () => {
      expect(ev('echo done')).toBe('blocked-unknown')
      expect(ev('git status')).toBe('blocked-unknown')
    })
  })

  describe('SAME-EVENT ANCHOR', () => {
    it('specific reason requires the explicit is_error===true boolean', () => {
      expect(ev('vitest')).toBe('test-run-failed')
    })
    it('heuristic path (is_error undefined) → blocked-unknown even on an allowlisted command', () => {
      expect(deriveBlockedReason({ isErrorExplicit: false, command: 'vitest', toolResultFirstLine: 'Error: x' }))
        .toBe('blocked-unknown')
      expect(deriveBlockedReason({ command: 'vitest' })).toBe('blocked-unknown') // isErrorExplicit absent
    })
  })

  describe('SINGLE-SEGMENT GUARD', () => {
    it('rejects &&, ||, ;, | compounds (wrong-segment attribution)', () => {
      expect(ev('npm install && npm run build')).toBe('blocked-unknown')
      expect(ev('vitest || true')).toBe('blocked-unknown')
      expect(ev('vitest; echo x')).toBe('blocked-unknown')
      expect(ev('vitest | tee log')).toBe('blocked-unknown')
    })
    it('rejects newline and background &', () => {
      expect(ev('vitest\nrm -rf /')).toBe('blocked-unknown')
      expect(ev('vitest &')).toBe('blocked-unknown')
    })
  })

  describe('CD-GLUE strip', () => {
    it('strips exactly ONE leading `cd "<path>" &&` wrapper (harness shape)', () => {
      expect(ev('cd "/repo" && vitest')).toBe('test-run-failed')
      expect(ev("cd '/repo' && npm run build")).toBe('build-failed')
      expect(ev('cd /repo && npm ci')).toBe('deps-failed')
    })
    it('does NOT exempt a second operator after the cd glue', () => {
      expect(ev('cd /a && npm i && tsc')).toBe('blocked-unknown')
    })
  })

  describe('ANCHORED ALLOWLIST + near-miss negatives', () => {
    it('positive ^-anchored matches', () => {
      expect(ev('vitest run')).toBe('test-run-failed')
      expect(ev('pytest -k x')).toBe('test-run-failed')
      expect(ev('npm test')).toBe('test-run-failed')
      expect(ev('npm run test')).toBe('test-run-failed')
      expect(ev('vite build')).toBe('build-failed')
      expect(ev('tsc')).toBe('build-failed')
      expect(ev('npm install')).toBe('deps-failed')
      expect(ev('npm ci')).toBe('deps-failed')
      expect(ev('pip install requests')).toBe('deps-failed')
    })
    it('npx vitest → blocked-unknown (npx not in allowlist)', () => {
      expect(ev('npx vitest')).toBe('blocked-unknown')
    })
    it('make test → blocked-unknown (bare \\bmake\\b/\\btest\\b dropped)', () => {
      expect(ev('make test')).toBe('blocked-unknown')
    })
    it('npm run pretest → blocked-unknown (not npm (run )?test)', () => {
      expect(ev('npm run pretest')).toBe('blocked-unknown')
    })
    it('npm install-foo → blocked-unknown (bare \\binstall\\b dropped; hyphen boundary)', () => {
      expect(ev('npm install-foo')).toBe('blocked-unknown')
    })
    it('tsconfig → blocked-unknown (not tsc)', () => {
      expect(ev('tsconfig --show')).toBe('blocked-unknown')
    })
    it('colon-suffixed npm scripts → blocked-unknown (arbitrary scripts, not the bucket they name)', () => {
      // `:` is the dominant npm-script separator; `npm run test:lint` may actually run a linter.
      expect(ev('npm test:ci')).toBe('blocked-unknown')
      expect(ev('npm run test:watch')).toBe('blocked-unknown')
      expect(ev('pnpm test:e2e')).toBe('blocked-unknown')
      expect(ev('npm install:all')).toBe('blocked-unknown')
      expect(ev('vite build:ci')).toBe('blocked-unknown')
    })
    it('dot-suffixed programs → blocked-unknown (tsc.cmd, pip install.foo)', () => {
      expect(ev('tsc.cmd')).toBe('blocked-unknown')
    })
    it('an allowlisted program WITH args still matches (boundary is whitespace, not just EOL)', () => {
      expect(ev('vitest run --reporter dot')).toBe('test-run-failed')
      expect(ev('tsc --noEmit')).toBe('build-failed')
      expect(ev('npm install react')).toBe('deps-failed')
    })
  })

  describe('RUNNER-PRESENT (launch-vs-run)', () => {
    it('a launch failure on an allowlisted command → blocked-unknown (the runner never ran)', () => {
      expect(ev('vitest', 'ENOENT: no such file or directory')).toBe('blocked-unknown')
      expect(ev('vitest', 'vitest: command not found')).toBe('blocked-unknown')
      expect(ev('vite build', 'EACCES: permission denied')).toBe('blocked-unknown')
    })
    it('an allowlisted command WITHOUT a launch-failure line → the specific reason', () => {
      expect(ev('vitest', 'FAIL src/foo.test.js')).toBe('test-run-failed')
    })
  })

  describe('DEFERRED-REASONS-NOT-EMITTED', () => {
    it('EACCES/429/401 first-lines never become permission/auth/rate-limit (Phase-2)', () => {
      expect(ev('curl https://api', '401 Unauthorized')).toBe('blocked-unknown')
      expect(ev('curl https://api', '429 Too Many Requests')).toBe('blocked-unknown')
      expect(ev('rm -rf /protected', 'EACCES: permission denied')).toBe('blocked-unknown')
    })
  })

  describe('LANGUAGE-NEUTRAL-TOKEN', () => {
    it('returns the same enum token regardless of locale (no localized noun)', () => {
      // deriveBlockedReason takes no lang arg and never localizes — the token is the contract.
      const a = ev('vitest')
      const b = deriveBlockedReason({ isErrorExplicit: true, command: 'vitest', toolResultFirstLine: '' })
      expect(a).toBe('test-run-failed')
      expect(b).toBe('test-run-failed')
    })
  })

  describe('pickReason — EPHEMERAL per-agent gate (both hook write sites)', () => {
    it('retains the reason ONLY while blocked', () => {
      expect(pickReason('blocked', 'test-run-failed')).toBe('test-run-failed')
      expect(pickReason('blocked', 'blocked-unknown')).toBe('blocked-unknown')
    })
    it('any non-blocked status clears it (no stale reason survives a transition / cross-agent rebuild)', () => {
      expect(pickReason('done', 'test-run-failed')).toBeNull()
      expect(pickReason('working', 'test-run-failed')).toBeNull()
      expect(pickReason('idle', 'test-run-failed')).toBeNull()
      expect(pickReason('awaiting-approval', 'test-run-failed')).toBeNull()
    })
    it('blocked with no reason → null (never undefined-leaks)', () => {
      expect(pickReason('blocked', null)).toBeNull()
      expect(pickReason('blocked', undefined)).toBeNull()
    })
  })

  describe('edge / safety', () => {
    it('no command / non-string → blocked-unknown, never throws', () => {
      expect(ev(null)).toBe('blocked-unknown')
      expect(ev('')).toBe('blocked-unknown')
      expect(deriveBlockedReason()).toBe('blocked-unknown')
      expect(deriveBlockedReason({})).toBe('blocked-unknown')
    })
  })
})
