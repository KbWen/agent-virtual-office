import { describe, it, expect } from 'vitest'
import {
  isHookOrigin,
  isAuthoritativeSnapshotSource,
  shouldSkipHintDismiss,
  isNumericSeq,
  stalenessSweepAction,
  sanitizeTokens,
  normalizeStatusMessage,
  buildHashStatusMessage,
} from '../src/inference/inferStatus.js'

describe('sanitizeTokens — AVO-108 token-usage validation', () => {
  it('passes a well-formed usage object with floored non-negative counts', () => {
    expect(sanitizeTokens({ ctx: 604937, out: 5302, model: 'claude-opus-4-8' }))
      .toEqual({ ctx: 604937, out: 5302, model: 'claude-opus-4-8' })
    expect(sanitizeTokens({ ctx: 10.9, out: 2.1 })).toEqual({ ctx: 10, out: 2, model: null })
  })
  it('rejects malformed input (non-object, NaN, missing counts)', () => {
    expect(sanitizeTokens(null)).toBeUndefined()
    expect(sanitizeTokens('600k')).toBeUndefined()
    expect(sanitizeTokens({ ctx: 'lots', out: 1 })).toBeUndefined()
    expect(sanitizeTokens({})).toBeUndefined()
  })
  it('clamps negatives and caps an over-long model string', () => {
    const r = sanitizeTokens({ ctx: -5, out: -1, model: 'x'.repeat(100) })
    expect(r.ctx).toBe(0)
    expect(r.out).toBe(0)
    expect(r.model.length).toBeLessThanOrEqual(40)
  })
  it('passes through normalizeStatusMessage on a real office-status message', () => {
    const msg = normalizeStatusMessage({ type: 'office-status', agents: [], tokens: { ctx: 1000, out: 50, model: 'm' } })
    expect(msg.tokens).toEqual({ ctx: 1000, out: 50, model: 'm' })
    const bad = normalizeStatusMessage({ type: 'office-status', agents: [], tokens: 'oops' })
    expect(bad.tokens).toBeUndefined()
  })
})

describe('effort validation in normalizeStatusMessage (AVO-102)', () => {
  it('passes the 5 known effort levels through', () => {
    for (const lvl of ['low', 'medium', 'high', 'xhigh', 'max']) {
      const msg = normalizeStatusMessage({ type: 'office-status', agents: [], effort: lvl })
      expect(msg.effort).toBe(lvl)
    }
  })
  it('drops unknown / malformed effort', () => {
    expect(normalizeStatusMessage({ type: 'office-status', agents: [], effort: 'turbo' }).effort).toBeUndefined()
    expect(normalizeStatusMessage({ type: 'office-status', agents: [], effort: 5 }).effort).toBeUndefined()
    expect('effort' in normalizeStatusMessage({ type: 'office-status', agents: [] })).toBe(false)
  })
})

describe('isAuthoritativeSnapshotSource — multi-session exit-reconcile stale-drop exemption', () => {
  it('is true only for multi-session (its merged _seq is max-child, not a monotonic clock)', () => {
    expect(isAuthoritativeSnapshotSource('multi-session')).toBe(true)
  })

  it('is false for single-source hook origins (their seqs ARE monotonic → keep stale-drop)', () => {
    expect(isAuthoritativeSnapshotSource('claude-cli')).toBe(false)
    expect(isAuthoritativeSnapshotSource('codex-cli')).toBe(false)
    expect(isAuthoritativeSnapshotSource('file-watcher')).toBe(false)
  })

  it('is false for external / unknown sources', () => {
    expect(isAuthoritativeSnapshotSource('hash-bridge')).toBe(false)
    expect(isAuthoritativeSnapshotSource('external')).toBe(false)
    expect(isAuthoritativeSnapshotSource(undefined)).toBe(false)
  })

  it('stays hook-origin (so the non-hook-origin eviction guard still treats it as authoritative)', () => {
    // multi-session must remain isHookOrigin=true: the `!hookOriginMsg` guard must NOT drop it,
    // while the seq-drop guards (which AND in !isAuthoritativeSnapshotSource) DO exempt it.
    expect(isHookOrigin('multi-session')).toBe(true)
    expect(isAuthoritativeSnapshotSource('multi-session')).toBe(true)
  })
})

describe('stalenessSweepAction — orphaned workflow-only banner fix', () => {
  it('clears external status when an external source is showing', () => {
    expect(stalenessSweepAction('external', 'Build Feature')).toBe('clear-external')
    expect(stalenessSweepAction('fallback', null)).toBe('clear-external')
  })

  it('clears a lingering workflow when statusSource is organic (the #workflow=X hash leak)', () => {
    // A workflow-only hash set activeWorkflow without agents → statusSource stayed organic →
    // the external-clear path is skipped → banner would persist forever without this branch.
    expect(stalenessSweepAction('organic', 'Build Feature')).toBe('clear-workflow')
  })

  it('does nothing when organic with no workflow (normal idle office)', () => {
    expect(stalenessSweepAction('organic', null)).toBe('noop')
    expect(stalenessSweepAction('organic', undefined)).toBe('noop')
  })
})

// Fix D (R76): startStatusIntegration's applyMessage / handleIncoming require DOM
// globals (window, EventSource, BroadcastChannel) and so resisted direct coverage.
// Their PURE decision logic is extracted into isHookOrigin / shouldSkipHintDismiss /
// isNumericSeq — these tests pin the contracts that drive applyMessage's branches:
//   - the _hint:'no-hooks' → skipHintDismiss decision
//   - the hook-origin / numeric-seq stale-drop gate
//   - the count-only fallback path (Fix B from R75) via normalizeStatusMessage
//   - the office-vibe conversion path

describe('shouldSkipHintDismiss — "hooks not installed" decision', () => {
  it('returns true for an explicit _hint:no-hooks (authoritative signal)', () => {
    // scanAndMerge tags an all-file-watcher merge with _hint:'no-hooks' and rewrites
    // source to 'multi-session' — a source-only check would miss this. _hint wins.
    expect(shouldSkipHintDismiss({ source: 'multi-session', _hint: 'no-hooks' })).toBe(true)
  })

  it('returns true for a direct file-watcher message (no _hint, never merged)', () => {
    // A file-watcher message that never passed through scanAndMerge (e.g. direct
    // postMessage) carries source:'file-watcher' but no _hint — still skip dismissal.
    expect(shouldSkipHintDismiss({ source: 'file-watcher' })).toBe(true)
  })

  it('returns false for a genuine hook status (claude-cli, no hint)', () => {
    expect(shouldSkipHintDismiss({ source: 'claude-cli', _seq: '1000' })).toBe(false)
  })

  it('returns false for a multi-session merge that is NOT all-file-watcher', () => {
    // Real hook sessions merged together: no _hint, source rewritten to multi-session.
    // The setup prompt MUST be dismissed — hooks are clearly installed.
    expect(shouldSkipHintDismiss({ source: 'multi-session', _seq: '2000' })).toBe(false)
  })

  it('does not treat an unrelated _hint value as no-hooks', () => {
    expect(shouldSkipHintDismiss({ source: 'claude-cli', _hint: 'something-else' })).toBe(false)
  })

  it('returns false for null / non-object input (no crash)', () => {
    expect(shouldSkipHintDismiss(null)).toBe(false)
    expect(shouldSkipHintDismiss(undefined)).toBe(false)
    expect(shouldSkipHintDismiss('file-watcher')).toBe(false)
    expect(shouldSkipHintDismiss(42)).toBe(false)
  })
})

describe('isHookOrigin — clock-sharing source classification', () => {
  it('recognizes every hook-origin source', () => {
    // These four are all produced by Date.now() on the same machine → comparable seqs.
    for (const s of ['claude-cli', 'codex-cli', 'multi-session', 'file-watcher']) {
      expect(isHookOrigin(s)).toBe(true)
    }
  })

  it('rejects external (independent-clock) sources', () => {
    // postMessage / hash / title / window-global channels must NOT poison lastAppliedSeq.
    for (const s of ['external', 'hash-bridge', 'title', 'legacy', 'codex-app', 'webhook']) {
      expect(isHookOrigin(s)).toBe(false)
    }
  })

  it('rejects null / undefined / unknown without crashing', () => {
    expect(isHookOrigin(null)).toBe(false)
    expect(isHookOrigin(undefined)).toBe(false)
    expect(isHookOrigin('')).toBe(false)
  })
})

describe('isNumericSeq — stale-drop comparability gate', () => {
  it('accepts a plain integer string (hook monotonic clock value)', () => {
    expect(isNumericSeq('1000')).toBe(true)
    expect(isNumericSeq(String(Date.now()))).toBe(true)
    expect(isNumericSeq('0')).toBe(true)
  })

  it('rejects a colon-joined / hash-bridge / codex seq (independent clock)', () => {
    // A non-numeric seq must fail the guard so it is never compared against a hook seq.
    expect(isNumericSeq('hash:#dev=working')).toBe(false)
    expect(isNumericSeq('codex-42')).toBe(false)
    expect(isNumericSeq('1000-extra')).toBe(false)
  })

  it('rejects non-string and empty input', () => {
    expect(isNumericSeq(null)).toBe(false)
    expect(isNumericSeq(undefined)).toBe(false)
    expect(isNumericSeq('')).toBe(false)
    expect(isNumericSeq(1000)).toBe(false)   // number, not string — must be coerced upstream
  })
})

describe('applyMessage routing inputs — count-only fallback path (Fix B / R75)', () => {
  it('a count-only hash message produces zero agents but a positive activeCount', () => {
    // applyMessage's `else if (msg.activeCount > 0)` branch: a '#count=N' hash with no
    // role keys routes through distributeFallbackCount. The message itself must carry
    // activeCount>0 and an empty agents array for that branch to be reachable.
    const msg = buildHashStatusMessage('#count=8')
    expect(msg).not.toBeNull()
    expect(msg.agents).toEqual([])
    expect(msg.activeCount).toBe(8)
  })

  it('a hash with role keys takes the agent-routing branch instead (activeCount from count)', () => {
    const msg = buildHashStatusMessage('#dev=working&count=3')
    expect(msg.agents).toHaveLength(1)
    expect(msg.agents[0].role).toBe('dev')
    expect(msg.activeCount).toBe(3)
  })

  it('a count-only office-status message also exposes activeCount with empty agents', () => {
    // The SSE/poll equivalent: normalizeStatusMessage recomputes activeCount from agents,
    // so a count-only payload must arrive with activeCount already in the agents-less form.
    // Here agents:[] → activeCount recomputes to 0, confirming the office-status branch
    // derives activeCount from agents (NOT a raw count field) — the count-only fallback is
    // therefore hash-specific, which is exactly why buildHashStatusMessage keeps `count`.
    const msg = normalizeStatusMessage({ type: 'office-status', agents: [], activeCount: 8 })
    expect(msg.agents).toEqual([])
    expect(msg.activeCount).toBe(0)
  })
})

describe('applyMessage routing inputs — office-vibe conversion path', () => {
  it('office-vibe is converted to office-status before applyMessage sees it', () => {
    // applyMessage only ever handles office-status; normalizeStatusMessage performs the
    // legacy office-vibe → office-status conversion upstream. Verify the converted shape
    // carries the fields applyMessage reads (agents, source, _seq, workflow).
    const msg = normalizeStatusMessage({
      type: 'office-vibe',
      agent: 'dev',
      command: '/implement',
      phase: 'running',
      workflow: 'Sprint 7',
    })
    expect(msg.type).toBe('office-status')
    expect(msg.agents[0]).toMatchObject({ role: 'dev', status: 'working' })
    expect(msg.workflow).toBe('Sprint 7')
    expect(typeof msg._seq).toBe('string')
    // source defaults to 'legacy' for office-vibe — an external (non-hook) origin, so
    // applyMessage must NOT track its _seq as the stale-drop high-water mark.
    expect(isHookOrigin(msg.source)).toBe(false)
  })

  it('office-vibe with a done phase converts to a done agent (applyMessage drives the celebration)', () => {
    // phaseToStatus matches /done|complete|finish/i — 'completed' contains 'complete'.
    const msg = normalizeStatusMessage({ type: 'office-vibe', agent: 'ops', phase: 'completed' })
    expect(msg.agents[0].status).toBe('done')
  })

  it('a hook-origin office-status message IS tracked as a stale-drop high-water mark', () => {
    // Contrast with office-vibe: a claude-cli office-status with a numeric _seq satisfies
    // both gates applyMessage checks before assigning lastAppliedSeq.
    const msg = normalizeStatusMessage({
      type: 'office-status',
      source: 'claude-cli',
      _seq: '1700000000000',
      agents: [{ role: 'dev', status: 'working' }],
    })
    expect(isHookOrigin(msg.source)).toBe(true)
    expect(isNumericSeq(msg._seq)).toBe(true)
  })
})
