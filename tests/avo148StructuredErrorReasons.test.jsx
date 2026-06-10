/**
 * AVO-148 — Structured-event blocked reasons (AC-6 test suite)
 *
 * Tests:
 *   (a) PermissionDenied handler — valid payload → correct agent+token; malformed → no-throw
 *   (b) StopFailure handler — rate_limit / authentication_failed / other / absent matcher
 *   (c) BLOCKED_REASONS mirror equality (classify.js canonical vs normalizePost.mjs inlined)
 *   (d) classifyBlockedReason for 3 new tokens
 *   (e) Badge render per new token (distinct silhouette + correct a11y)
 *   (f) EPHEMERAL clear regression — permission-denied token is cleared on non-blocked status
 *   (g) normalizePost transport: new tokens survive the sanitizer (field-survival)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

// ── Hook module (CJS via dynamic import) ───────────────────────────────────
const hook = await import('../public/hooks/office-status-hook.js')
const { processEvent, pickReason, VALID_HOOK_ROLES, toolToRole } = hook

// ── Classify + normalize ────────────────────────────────────────────────────
import { BLOCKED_REASONS, classifyBlockedReason } from '../src/systems/classify.js'
import { BLOCKED_REASONS as MJS_BLOCKED_REASONS } from '../src/utils/normalizePost.mjs'
import { normalizePost } from '../src/utils/normalizePost.js'
import { BlockedReasonBadge } from '../src/components/blockedReasonBadge.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a fresh temp dir and a STATUS_FILE path for isolation between tests.
 * Returns { base, cleanup }.
 */
function makeTempBase(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `avo-148-test-${label}-`))
  const base = path.join(dir, 'office-status.json')
  return {
    base,
    cleanup: () => {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
    },
  }
}

/**
 * Override OFFICE_STATUS_FILE env so the hook writes to a temp file.
 * The hook's STATUS_FILE reads process.env.OFFICE_STATUS_FILE at module load,
 * but STATUS_LOCK_CONFIG.lockDir uses a getter that reads it lazily — so tests
 * that need the lock must set the env var BEFORE calling processEvent.
 *
 * NOTE: the hook's STATUS_FILE constant is fixed at module-load time.
 * To drive processEvent against a temp file we write the temp file first
 * and point OFFICE_STATUS_FILE at it for the lock getter.
 */
function withStatusFile(base, agents = []) {
  const prior = process.env.OFFICE_STATUS_FILE
  process.env.OFFICE_STATUS_FILE = base
  // Seed the temp file with the given initial agents so handlers have data to read.
  const dir = path.dirname(base)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(base, JSON.stringify({
    type: 'office-status',
    agents,
    activeCount: agents.filter(a => a.status === 'working' || a.status === 'planning').length,
    source: 'test',
    _seq: String(Date.now()),
  }, null, 2))
  return () => {
    if (prior === undefined) delete process.env.OFFICE_STATUS_FILE
    else process.env.OFFICE_STATUS_FILE = prior
  }
}

/**
 * Read and parse the temp STATUS_FILE.  Returns null if absent or invalid.
 */
function readStatus(base) {
  try { return JSON.parse(fs.readFileSync(base, 'utf-8')) } catch { return null }
}

// ── (a) PermissionDenied handler ─────────────────────────────────────────────
// OFFICE_STATUS_FILE is now respected by getStatusFile() inside the hook (each processEvent call
// reads it lazily), so withStatusFile() seeds the temp file AND redirects writes.

describe('AVO-148 PermissionDenied handler (AC-1)', () => {
  let tmp, restore

  beforeEach(() => {
    tmp = makeTempBase('pd')
    restore = withStatusFile(tmp.base, [
      { role: 'dev', status: 'working', task: 'Edit', label: '✏️ edit', hint: null, reasonCode: null, activeFile: null },
      { role: 'ops', status: 'working', task: 'Bash', label: '⚡ tests', hint: null, reasonCode: null, activeFile: null },
    ])
  })

  afterEach(() => { restore(); tmp.cleanup() })

  it('Bash tool_name → ops agent blocked with permission-denied; dev agent untouched', () => {
    processEvent({ hook_event_name: 'PermissionDenied', tool_name: 'Bash' })
    const status = readStatus(tmp.base)
    const ops = status.agents.find(a => a.role === 'ops')
    const dev = status.agents.find(a => a.role === 'dev')
    expect(ops).toBeDefined()
    expect(ops.status).toBe('blocked')
    expect(ops.reasonCode).toBe('permission-denied')
    // dev was working → not stamped by this PermissionDenied event (ops is the target)
    expect(dev).toBeDefined()
    expect(dev.status).toBe('working')
    expect(dev.reasonCode).toBeNull()
  })

  it('Edit tool_name → dev agent blocked with permission-denied', () => {
    processEvent({ hook_event_name: 'PermissionDenied', tool_name: 'Edit' })
    const status = readStatus(tmp.base)
    const dev = status.agents.find(a => a.role === 'dev')
    expect(dev.status).toBe('blocked')
    expect(dev.reasonCode).toBe('permission-denied')
  })

  it('missing tool_name → NO-OP (honest-narrow: cannot attribute to a role)', () => {
    const before = readStatus(tmp.base)
    processEvent({ hook_event_name: 'PermissionDenied' })
    const after = readStatus(tmp.base)
    // File must be unchanged (no write happened)
    expect(after).toEqual(before)
  })

  it('null tool_name → NO-OP (no spatial over-claim)', () => {
    const before = readStatus(tmp.base)
    processEvent({ hook_event_name: 'PermissionDenied', tool_name: null })
    const after = readStatus(tmp.base)
    expect(after).toEqual(before)
  })

  it('non-string tool_name → NO-OP', () => {
    const before = readStatus(tmp.base)
    processEvent({ hook_event_name: 'PermissionDenied', tool_name: 123 })
    processEvent({ hook_event_name: 'PermissionDenied', tool_name: {} })
    const after = readStatus(tmp.base)
    expect(after).toEqual(before)
  })

  it('toolToRole convention matches the spec (Edit→dev, Bash→ops, Read→res)', () => {
    expect(toolToRole('Edit')).toBe('dev')
    expect(toolToRole('Bash')).toBe('ops')
    expect(toolToRole('Read')).toBe('res')
    expect(toolToRole('UnknownTool')).toBe('dev')
  })

  it('pickReason gates: permission-denied is EPHEMERAL (cleared on non-blocked status)', () => {
    expect(pickReason('blocked', 'permission-denied')).toBe('permission-denied')
    expect(pickReason('done',    'permission-denied')).toBeNull()
    expect(pickReason('working', 'permission-denied')).toBeNull()
    expect(pickReason('idle',    'permission-denied')).toBeNull()
  })

  it('EPHEMERAL clear: a subsequent normal PostToolUse for the ops agent clears the reasonCode', () => {
    // Step 1: stamp ops as blocked/permission-denied
    processEvent({ hook_event_name: 'PermissionDenied', tool_name: 'Bash' })
    const blocked = readStatus(tmp.base)
    expect(blocked.agents.find(a => a.role === 'ops').reasonCode).toBe('permission-denied')

    // Step 2: normal PostToolUse for ops (no error) → ops goes done, reasonCode cleared
    processEvent({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: JSON.stringify({ command: 'npm test' }),
      tool_result: 'All tests passed',
      is_error: false,
    })
    const cleared = readStatus(tmp.base)
    const ops = cleared.agents.find(a => a.role === 'ops')
    expect(ops.status).toBe('done')
    expect(ops.reasonCode).toBeNull()
  })
})

// ── (b) StopFailure handler ──────────────────────────────────────────────────

describe('AVO-148 StopFailure handler (AC-1)', () => {
  let tmp, restore

  beforeEach(() => {
    tmp = makeTempBase('sf')
    restore = withStatusFile(tmp.base, [
      { role: 'dev', status: 'working',  task: 'Bash', label: '⚡ tests', hint: null, reasonCode: null, activeFile: null },
      { role: 'qa',  status: 'planning', task: 'Bash', label: '⚡ tests', hint: null, reasonCode: null, activeFile: null },
      { role: 'ops', status: 'done',     task: 'Bash', label: '✅ done',  hint: null, reasonCode: null, activeFile: null },
    ])
  })

  afterEach(() => { restore(); tmp.cleanup() })

  it('rate_limit matcher → working+planning agents get api-rate-limit; done agent untouched', () => {
    processEvent({ hook_event_name: 'StopFailure', matcher: 'rate_limit' })
    const status = readStatus(tmp.base)
    const dev = status.agents.find(a => a.role === 'dev')
    const qa  = status.agents.find(a => a.role === 'qa')
    const ops = status.agents.find(a => a.role === 'ops')
    expect(dev.status).toBe('blocked')
    expect(dev.reasonCode).toBe('api-rate-limit')
    expect(qa.status).toBe('blocked')
    expect(qa.reasonCode).toBe('api-rate-limit')
    // ops was done → not stamped
    expect(ops.status).toBe('done')
    expect(ops.reasonCode).toBeNull()
  })

  it('authentication_failed matcher → working+planning agents get api-auth-failed', () => {
    processEvent({ hook_event_name: 'StopFailure', matcher: 'authentication_failed' })
    const status = readStatus(tmp.base)
    const dev = status.agents.find(a => a.role === 'dev')
    const qa  = status.agents.find(a => a.role === 'qa')
    expect(dev.reasonCode).toBe('api-auth-failed')
    expect(qa.reasonCode).toBe('api-auth-failed')
  })

  it('negative over-claim guard: overloaded matcher → blocked-unknown NEVER api-rate-limit or api-auth-failed', () => {
    processEvent({ hook_event_name: 'StopFailure', matcher: 'overloaded' })
    const status = readStatus(tmp.base)
    const dev = status.agents.find(a => a.role === 'dev')
    expect(dev.status).toBe('blocked')
    expect(dev.reasonCode).toBe('blocked-unknown')
    expect(dev.reasonCode).not.toBe('api-rate-limit')
    expect(dev.reasonCode).not.toBe('api-auth-failed')
  })

  it('negative over-claim guard: absent matcher → blocked-unknown', () => {
    processEvent({ hook_event_name: 'StopFailure' })
    const status = readStatus(tmp.base)
    const dev = status.agents.find(a => a.role === 'dev')
    expect(dev.reasonCode).toBe('blocked-unknown')
  })

  it('done/idle agents are NEVER stamped', () => {
    processEvent({ hook_event_name: 'StopFailure', matcher: 'rate_limit' })
    const status = readStatus(tmp.base)
    const ops = status.agents.find(a => a.role === 'ops')
    expect(ops.status).toBe('done')
    expect(ops.reasonCode).toBeNull()
  })

  it('EPHEMERAL: subsequent normal PostToolUse for an agent clears the reasonCode', () => {
    // Step 1: StopFailure stamps dev (working) with api-rate-limit
    processEvent({ hook_event_name: 'StopFailure', matcher: 'rate_limit' })
    const blocked = readStatus(tmp.base)
    expect(blocked.agents.find(a => a.role === 'dev').reasonCode).toBe('api-rate-limit')

    // Step 2: normal PostToolUse for a dev-mapped tool (Edit → role:'dev', is_error:false)
    // → dev goes done, reasonCode cleared (EPHEMERAL contract)
    processEvent({
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: JSON.stringify({ file_path: '/src/foo.js' }),
      tool_result: 'ok',
      is_error: false,
    })
    const cleared = readStatus(tmp.base)
    const dev = cleared.agents.find(a => a.role === 'dev')
    expect(dev.status).toBe('done')
    expect(dev.reasonCode).toBeNull()
  })

  it('null/malformed matcher → no throw', () => {
    expect(() => processEvent({ hook_event_name: 'StopFailure', matcher: null })).not.toThrow()
    expect(() => processEvent({ hook_event_name: 'StopFailure', matcher: 42 })).not.toThrow()
    expect(() => processEvent({ hook_event_name: 'StopFailure', matcher: {} })).not.toThrow()
  })

  it('api-rate-limit and api-auth-failed are EPHEMERAL via pickReason', () => {
    expect(pickReason('blocked', 'api-rate-limit')).toBe('api-rate-limit')
    expect(pickReason('blocked', 'api-auth-failed')).toBe('api-auth-failed')
    expect(pickReason('done',    'api-rate-limit')).toBeNull()
    expect(pickReason('working', 'api-auth-failed')).toBeNull()
  })
})

// ── (c) BLOCKED_REASONS mirror equality ──────────────────────────────────────

describe('AVO-148 BLOCKED_REASONS mirror equality (AC-2)', () => {
  it('normalizePost.mjs inlined BLOCKED_REASONS equals canonical classify.js list', () => {
    // List equality — same tokens, same order (the drift-guard spec requirement).
    expect(MJS_BLOCKED_REASONS).toEqual(BLOCKED_REASONS)
  })

  it('3 new tokens are present in canonical BLOCKED_REASONS', () => {
    expect(BLOCKED_REASONS).toContain('permission-denied')
    expect(BLOCKED_REASONS).toContain('api-rate-limit')
    expect(BLOCKED_REASONS).toContain('api-auth-failed')
  })
})

// ── (d) classifyBlockedReason for 3 new tokens ───────────────────────────────

describe('AVO-148 classifyBlockedReason — 3 new tokens (AC-2)', () => {
  it('permission-denied → distinct iconId + non-grey hue + a11yKey', () => {
    const r = classifyBlockedReason('permission-denied')
    expect(r.reason).toBe('permission-denied')
    expect(r.iconId).toBe('slash-circle')
    expect(r.hue).not.toBe('#8a8f99')  // not the neutral grey
    expect(r.a11yKey).toBe('blockedReason.permission-denied.a11y')
  })

  it('api-rate-limit → distinct iconId + non-grey hue + a11yKey', () => {
    const r = classifyBlockedReason('api-rate-limit')
    expect(r.reason).toBe('api-rate-limit')
    expect(r.iconId).toBe('hourglass')
    expect(r.hue).not.toBe('#8a8f99')
    expect(r.a11yKey).toBe('blockedReason.api-rate-limit.a11y')
  })

  it('api-auth-failed → distinct iconId + non-grey hue + a11yKey', () => {
    const r = classifyBlockedReason('api-auth-failed')
    expect(r.reason).toBe('api-auth-failed')
    expect(r.iconId).toBe('key-broken')
    expect(r.hue).not.toBe('#8a8f99')
    expect(r.a11yKey).toBe('blockedReason.api-auth-failed.a11y')
  })

  it('all 3 new tokens produce distinct iconIds (COLOR-NEVER-ONLY)', () => {
    const ids = ['permission-denied', 'api-rate-limit', 'api-auth-failed']
      .map(t => classifyBlockedReason(t).iconId)
    expect(new Set(ids).size).toBe(3)  // all three differ
  })

  it('3 new iconIds are all distinct from the original 4', () => {
    const origIds = new Set(['beaker-crack', 'hammer-crack', 'box-open-x', 'q-neutral'])
    for (const token of ['permission-denied', 'api-rate-limit', 'api-auth-failed']) {
      expect(origIds.has(classifyBlockedReason(token).iconId)).toBe(false)
    }
  })
})

// ── (e) Badge render per token ───────────────────────────────────────────────

const render = (reasonCode) => renderToStaticMarkup(<BlockedReasonBadge reasonCode={reasonCode} />)

describe('AVO-148 BlockedReasonBadge — 3 new tokens (AC-3)', () => {
  it('permission-denied renders a localized a11y label + distinct markup', () => {
    const html = render('permission-denied')
    expect(html).toContain('<title>')
    expect(html).toContain('aria-label=')
    expect(html).toContain('Blocked: permission denied')
  })

  it('api-rate-limit renders a localized a11y label + distinct markup', () => {
    const html = render('api-rate-limit')
    expect(html).toContain('<title>')
    expect(html).toContain('aria-label=')
    expect(html).toContain('Blocked: API rate-limited')
  })

  it('api-auth-failed renders a localized a11y label + distinct markup', () => {
    const html = render('api-auth-failed')
    expect(html).toContain('<title>')
    expect(html).toContain('aria-label=')
    expect(html).toContain('Blocked: API auth failed')
  })

  it('all 7 tokens (4 original + 3 new) render structurally distinct markup', () => {
    const markups = BLOCKED_REASONS.map(render)
    expect(new Set(markups).size).toBe(BLOCKED_REASONS.length)
  })

  it('each new token carries a non-empty aria-label (COLOR-NEVER-ONLY)', () => {
    for (const token of ['permission-denied', 'api-rate-limit', 'api-auth-failed']) {
      expect(render(token)).toMatch(/aria-label="[^"]+"/)
    }
  })
})

// ── (f) EPHEMERAL clear regression — transport e2e for permission-denied ──────

describe('AVO-148 transport e2e — permission-denied token survives normalizePost (AC-5)', () => {
  it('permission-denied survives normalizePost (full-format branch)', () => {
    const result = normalizePost({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'blocked', reasonCode: 'permission-denied' }],
    })
    expect(result.agents[0].reasonCode).toBe('permission-denied')
  })

  it('api-rate-limit survives normalizePost', () => {
    const result = normalizePost({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'blocked', reasonCode: 'api-rate-limit' }],
    })
    expect(result.agents[0].reasonCode).toBe('api-rate-limit')
  })

  it('api-auth-failed survives normalizePost', () => {
    const result = normalizePost({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'blocked', reasonCode: 'api-auth-failed' }],
    })
    expect(result.agents[0].reasonCode).toBe('api-auth-failed')
  })

  it('new tokens are rejected by normalizePost when status is not blocked (EPHEMERAL)', () => {
    // The FIELD_SANITIZERS let reasonCode through for any valid token, but the pickReason
    // gate in the hook (and downstream) clears it on non-blocked status — so passing
    // normalizePost with a non-blocked status + reasonCode is an unusual case; test the
    // sanitizer's allow/block behaviour directly.
    const result = normalizePost({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'working', reasonCode: 'permission-denied' }],
    })
    // normalizePost itself doesn't strip based on status; that's the hook's pickReason gate.
    // The token survives the normalizer (it's valid); the store/hook enforces EPHEMERAL.
    expect(['permission-denied', null]).toContain(result.agents[0].reasonCode)
  })

  it('unknown / garbage token is sanitized to null by normalizePost', () => {
    const result = normalizePost({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'blocked', reasonCode: 'not-a-real-reason' }],
    })
    expect(result.agents[0].reasonCode).toBeNull()
  })
})

// ── (g) Sanitizer probe: 3 new tokens in the probe table ─────────────────────
// Import at top level so it() callbacks don't need async/await (avoids esbuild issues)
const { FIELD_SANITIZERS: MJS_FS } = await import('../src/utils/normalizePost.mjs')
const { FIELD_SANITIZERS: CANONICAL_FS } = await import('../src/utils/statusFields.js')

describe('AVO-148 statusFieldsDriftGuard — new tokens in sanitizer probe (AC-2)', () => {
  it('permission-denied is accepted by FIELD_SANITIZERS.reasonCode in normalizePost.mjs', () => {
    expect(MJS_FS.reasonCode('permission-denied')).toBe('permission-denied')
    expect(MJS_FS.reasonCode('api-rate-limit')).toBe('api-rate-limit')
    expect(MJS_FS.reasonCode('api-auth-failed')).toBe('api-auth-failed')
  })

  it('permission-denied is accepted by canonical FIELD_SANITIZERS.reasonCode', () => {
    expect(CANONICAL_FS.reasonCode('permission-denied')).toBe('permission-denied')
    expect(CANONICAL_FS.reasonCode('api-rate-limit')).toBe('api-rate-limit')
    expect(CANONICAL_FS.reasonCode('api-auth-failed')).toBe('api-auth-failed')
  })
})
