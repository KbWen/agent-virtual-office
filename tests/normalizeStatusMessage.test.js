import { describe, it, expect } from 'vitest'
import { buildHashStatusMessage, normalizeStatusMessage, sanitizeHelpers } from '../src/inference/inferStatus.js'

describe('normalizeStatusMessage', () => {
  it('returns null for null input', () => {
    expect(normalizeStatusMessage(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(normalizeStatusMessage('hello')).toBeNull()
    expect(normalizeStatusMessage(42)).toBeNull()
    expect(normalizeStatusMessage(undefined)).toBeNull()
  })

  it('returns null for unknown message types', () => {
    expect(normalizeStatusMessage({ type: 'unknown' })).toBeNull()
    expect(normalizeStatusMessage({ foo: 'bar' })).toBeNull()
  })

  describe('office-status protocol', () => {
    it('normalizes office-status messages with stable source metadata', () => {
      const msg = { type: 'office-status', agents: [{ role: 'dev', status: 'working' }] }
      expect(normalizeStatusMessage(msg)).toMatchObject({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
        source: 'external',
      })
      expect(normalizeStatusMessage(msg)?._seq).toEqual(expect.any(String))
    })

    it('preserves incoming source and _seq when already provided', () => {
      const msg = {
        type: 'office-status',
        _seq: 'codex-42',
        source: 'codex-cli',
        agents: [{ role: 'dev', status: 'done' }],
      }

      expect(normalizeStatusMessage(msg)).toMatchObject({
        _seq: 'codex-42',
        source: 'codex-cli',
      })
    })

    it('R67: preserves _hint:no-hooks so applyMessage can keep the setup prompt visible', () => {
      // scanAndMerge tags an all-file-watcher merge with _hint:'no-hooks'. The envelope
      // validator must pass _hint through untouched — applyMessage reads it to decide
      // skipHintDismiss, the authoritative "hooks not installed" signal.
      const msg = {
        type: 'office-status',
        _seq: '1000',
        source: 'multi-session',
        _hint: 'no-hooks',
        agents: [{ role: 'dev', status: 'working' }],
      }
      expect(normalizeStatusMessage(msg)._hint).toBe('no-hooks')
    })

    it('M-1: strips agents with invalid role or status (untrusted in-browser channel)', () => {
      const msg = {
        type: 'office-status',
        agents: [
          { role: 'hacker', status: 'working' },        // invalid role
          { role: 'dev', status: 'pwned' },              // invalid status
          { role: 'dev', status: 'working' },            // valid — kept
        ],
      }
      const result = normalizeStatusMessage(msg)
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0].role).toBe('dev')
    })

    it('M-1: caps oversized label/task/hint strings at 200 chars', () => {
      const big = 'x'.repeat(500)
      const msg = {
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working', label: big, task: big, hint: big }],
        workflow: big,
      }
      const result = normalizeStatusMessage(msg)
      expect(result.agents[0].label.length).toBe(200)
      expect(result.agents[0].task.length).toBe(200)
      expect(result.agents[0].hint.length).toBe(200)
      expect(result.workflow.length).toBe(200)
    })

    it('M-1: validates mood against VALID_MOODS and strips unknown values', () => {
      const valid = normalizeStatusMessage({ type: 'office-status', agents: [], mood: 'rushing' })
      expect(valid.mood).toBe('rushing')
      const invalid = normalizeStatusMessage({ type: 'office-status', agents: [], mood: 'panicking' })
      expect(invalid.mood).toBeUndefined()
    })

    it('M-1: activeCount counts live transport statuses, not idle/done', () => {
      const msg = {
        type: 'office-status',
        agents: [
          { role: 'dev', status: 'working' },
          { role: 'arch', status: 'planning' },
          { role: 'gate', status: 'awaiting-approval' },
          { role: 'qa', status: 'idle' },
          { role: 'ops', status: 'done' },
        ],
      }
      const result = normalizeStatusMessage(msg)
      expect(result.activeCount).toBe(3)
    })

    it('bounds untrusted office-status agent scanning before counting active agents', () => {
      const agents = []
      for (let i = 0; i < 100; i++) {
        agents.push({ role: `session-${i}~qa`, status: 'working', session: `session-${i}` })
      }

      const result = normalizeStatusMessage({ type: 'office-status', agents })

      expect(result.agents).toHaveLength(50)
      expect(result.activeCount).toBe(50)
    })

    it('de-duplicates untrusted office-status agents by sanitized role with first occurrence winning', () => {
      const result = normalizeStatusMessage({
        type: 'office-status',
        agents: [
          { role: 'dev', status: 'working' },
          { role: 'dev', status: 'blocked' },
          { role: 'feat-x~qa', status: 'planning', session: 'feat-x' },
          { role: 'feat-x~qa', status: 'blocked', session: 'feat-x' },
        ],
      })

      expect(result.agents).toHaveLength(2)
      expect(result.agents.map(a => [a.role, a.status])).toEqual([
        ['dev', 'working'],
        ['feat-x~qa', 'planning'],
      ])
      expect(result.activeCount).toBe(2)
    })

    it('M-1: tolerates non-array agents without throwing', () => {
      const msg = { type: 'office-status', agents: 'not-an-array' }
      const result = normalizeStatusMessage(msg)
      expect(result.agents).toEqual([])
    })

    it('R62: preserves multi-session composite slug~role agents', () => {
      // scanAndMerge emits agents with role 'slug~role' for multi-worktree views.
      // Before R62, sanitizeAgent stripped these (VALID_ROLES.includes('feat-x~dev')
      // is false) — multi-session mode rendered zero agents through the SSE/poll path.
      const msg = {
        type: 'office-status',
        source: 'multi-session',
        agents: [
          { role: 'feat-x~dev', status: 'working', session: 'feat-x' },
          { role: 'hotfix~qa', status: 'blocked', session: 'hotfix' },
        ],
      }
      const result = normalizeStatusMessage(msg)
      expect(result.agents).toHaveLength(2)
      expect(result.agents[0].role).toBe('feat-x~dev')
      expect(result.agents[0].session).toBe('feat-x')
      expect(result.agents[1].role).toBe('hotfix~qa')
    })

    it('R62: preserves a slug that itself contains "~" (splits on last separator)', () => {
      const msg = {
        type: 'office-status',
        agents: [{ role: 'feat~nested~dev', status: 'working', session: 'feat~nested' }],
      }
      const result = normalizeStatusMessage(msg)
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0].role).toBe('feat~nested~dev')
    })

    it('R62: rejects composite role whose base segment is not a valid role', () => {
      const msg = {
        type: 'office-status',
        agents: [
          { role: 'feat-x~hacker', status: 'working' },   // invalid base
          { role: '~dev', status: 'working' },             // empty slug
          { role: 'feat-x~dev', status: 'working' },       // valid — kept
        ],
      }
      const result = normalizeStatusMessage(msg)
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0].role).toBe('feat-x~dev')
    })

    it('R62: caps an oversized session slug in a composite role', () => {
      const hugeSlug = 'a'.repeat(500)
      const msg = {
        type: 'office-status',
        agents: [{ role: `${hugeSlug}~dev`, status: 'working', session: hugeSlug }],
      }
      const result = normalizeStatusMessage(msg)
      expect(result.agents).toHaveLength(1)
      // slug (64) + '~' + 'dev' (3) = 68
      expect(result.agents[0].role.length).toBe(68)
      expect(result.agents[0].session.length).toBe(64)
    })

    it('R81: caps an oversized `source` from an untrusted office-status message', () => {
      // `source` is spread uncapped from `raw` and reaches the store via
      // setIntegrationSource + every isHookOrigin() comparison. An untrusted
      // in-browser channel (postMessage/BroadcastChannel/window global) must not
      // be able to inject an unbounded source string. Cap = 200, same as task/label.
      const big = 's'.repeat(500)
      const result = normalizeStatusMessage({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
        source: big,
      })
      expect(result.source.length).toBe(200)
    })

    it('R81: falls back to the default source when `source` is absent', () => {
      // Capping must not break the no-source case — withStatusEnvelope still
      // supplies its fallbackSource ('external') when `source` is omitted.
      const result = normalizeStatusMessage({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
      })
      expect(result.source).toBe('external')
    })
  })

  describe('legacy office-vibe conversion', () => {
    it('converts office-vibe to office-status', () => {
      const result = normalizeStatusMessage({
        type: 'office-vibe',
        agent: 'dev',
        command: 'npm test',
        phase: 'running',
      })
      expect(result.type).toBe('office-status')
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0]).toMatchObject({
        role: 'dev',
        task: 'npm test',
        status: 'working',
      })
    })

    it('maps "done" phase to done status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'done' })
      expect(result.agents[0].status).toBe('done')
    })

    it('maps "complete" phase to done status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'completed' })
      expect(result.agents[0].status).toBe('done')
    })

    it('maps "blocked" phase to blocked status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'blocked' })
      expect(result.agents[0].status).toBe('blocked')
    })

    it('maps "error" phase to blocked status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'error' })
      expect(result.agents[0].status).toBe('blocked')
    })

    it('maps unknown phase to working status', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', phase: 'thinking' })
      expect(result.agents[0].status).toBe('working')
    })

    it('defaults to working when no phase', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', command: 'test' })
      expect(result.agents[0].status).toBe('working')
    })

    it('passes through source and workflow', () => {
      const result = normalizeStatusMessage({
        type: 'office-vibe',
        source: 'gemini',
        workflow: 'Sprint 1',
      })
      expect(result.source).toBe('gemini')
      expect(result.workflow).toBe('Sprint 1')
      expect(result._seq).toEqual(expect.any(String))
    })

    it('R81: caps an oversized `source` from an untrusted office-vibe message', () => {
      // office-vibe is reachable from postMessage and the ?source= URL param
      // (inferFromParams). raw.source flows into withStatusEnvelope's fallbackSource
      // arg uncapped otherwise — cap it at the same 200-char boundary.
      const big = 's'.repeat(500)
      const result = normalizeStatusMessage({
        type: 'office-vibe',
        command: 'npm test',
        source: big,
      })
      expect(result.source.length).toBe(200)
    })

    it('R81: falls back to "legacy" source when office-vibe omits `source`', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', command: 'npm test' })
      expect(result.source).toBe('legacy')
    })
  })

  describe('hash bridge normalization', () => {
    it('builds a stable seq for the same hash payload', () => {
      const first = buildHashStatusMessage('#dev=done&workflow=Codex%20App%20Bridge&source=codex-app')
      const second = buildHashStatusMessage('#dev=done&workflow=Codex%20App%20Bridge&source=codex-app')

      expect(first).toMatchObject({
        type: 'office-status',
        source: 'codex-app',
        workflow: 'Codex App Bridge',
        agents: [{ role: 'dev', status: 'done' }],
      })
      expect(second?._seq).toBe(first?._seq)
    })

    it('R62: caps oversized task from the URL hash (bypasses sanitizeAgent path)', () => {
      // buildHashStatusMessage feeds applyExternalStatus WITHOUT going through
      // normalizeStatusMessage — its own output must enforce the 200-char cap.
      const big = 'x'.repeat(500)
      const result = buildHashStatusMessage(`#dev=${encodeURIComponent(big)}`)
      expect(result.agents).toHaveLength(1)
      expect(result.agents[0].task.length).toBe(200)
    })

    it('R62: caps oversized workflow from the URL hash', () => {
      const big = 'w'.repeat(500)
      const result = buildHashStatusMessage(`#workflow=${encodeURIComponent(big)}`)
      expect(result.workflow.length).toBe(200)
    })

    it('R62: parses count with explicit radix 10 (no octal/hex surprises)', () => {
      expect(buildHashStatusMessage('#count=08').activeCount).toBe(8)
    })

    it('R78 Fix F: #count=0 is treated as an inert message (returns null)', () => {
      // The string '0' is truthy, so a raw `!params.get('count')` guard would treat
      // '#count=0' as a valid count message. parseInt gives 0 = "no active agents",
      // making applyMessage's `activeCount > 0` branch a no-op — but the message would
      // still be delivered and reset the 2-min staleness timer, keeping a stale external
      // status alive. A zero-count hash with no roles/workflow must build to null.
      expect(buildHashStatusMessage('#count=0')).toBeNull()
    })

    it('R78 Fix F: a negative or non-numeric count is also inert', () => {
      expect(buildHashStatusMessage('#count=-3')).toBeNull()
      expect(buildHashStatusMessage('#count=abc')).toBeNull()
    })

    it('R78 Fix F: #count=0 alongside a role key still builds (role drives the message)', () => {
      // count=0 must not suppress a message that carries real role keys.
      const msg = buildHashStatusMessage('#dev=working&count=0')
      expect(msg).not.toBeNull()
      expect(msg.agents).toHaveLength(1)
      expect(msg.activeCount).toBe(0)
    })

    it('R78 Fix F: #count=0 with a workflow still builds (workflow drives the message)', () => {
      const msg = buildHashStatusMessage('#workflow=Sprint&count=0')
      expect(msg).not.toBeNull()
      expect(msg.workflow).toBe('Sprint')
      expect(msg.activeCount).toBe(0)
    })
  })

  describe('R62: office-vibe length capping', () => {
    it('caps an oversized command (task) from office-vibe', () => {
      const big = 'c'.repeat(500)
      const result = normalizeStatusMessage({ type: 'office-vibe', command: big })
      expect(result.agents[0].task.length).toBe(200)
    })

    it('caps an oversized workflow from office-vibe', () => {
      const big = 'w'.repeat(500)
      const result = normalizeStatusMessage({ type: 'office-vibe', workflow: big })
      expect(result.workflow.length).toBe(200)
    })
  })

  describe('R79: office-vibe agent (role) sanitization', () => {
    // The office-status branch runs every agent through sanitizeAgent → sanitizeRoleId,
    // which caps a composite slug at SLUG_CAP (64). The office-vibe branch previously
    // passed raw.agent straight through — a crafted office-vibe { agent: '<8KB>~dev' }
    // (reachable from postMessage / ?command= URL) injected an unbounded composite id
    // into the store as a dynamic agent (React key, persisted dailyDoneLedger key).
    it('caps the slug of an oversized composite agent id from office-vibe', () => {
      const hugeSlug = 'a'.repeat(8000)
      const result = normalizeStatusMessage({ type: 'office-vibe', agent: `${hugeSlug}~dev` })
      expect(result.agents).toHaveLength(1)
      // slug capped to 64 + '~' + 'dev' (3) = 68 — same bound as the office-status path.
      expect(result.agents[0].role.length).toBe(68)
      expect(result.agents[0].role.endsWith('~dev')).toBe(true)
    })

    it('passes a valid bare role through unchanged', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', agent: 'qa' })
      expect(result.agents[0].role).toBe('qa')
    })

    it('preserves a valid composite agent id', () => {
      const result = normalizeStatusMessage({ type: 'office-vibe', agent: 'feat-x~dev' })
      expect(result.agents[0].role).toBe('feat-x~dev')
    })

    it('rejects an invalid bare role and falls through to command routing', () => {
      // 'hacker' is not a VALID_ROLE → sanitizeRoleId returns null → role falls back to
      // routeTaskToAgent('/implement') = 'dev'. An invalid explicit agent must not reach
      // the store verbatim; the command-based fallback is the correct downgrade.
      const result = normalizeStatusMessage({
        type: 'office-vibe', agent: 'hacker', command: '/implement',
      })
      expect(result.agents[0].role).toBe('dev')
    })

    it('rejects a composite whose base segment is not a valid role', () => {
      // 'feat-x~hacker' has an invalid base → null → no command given → role is null,
      // which routeExternalAgents then resolves via its own fallback order.
      const result = normalizeStatusMessage({ type: 'office-vibe', agent: 'feat-x~hacker' })
      expect(result.agents[0].role).toBeNull()
    })
  })

  describe('helpers field validation (sanitizeHelpers)', () => {
    it('returns undefined when helpers field is absent', () => {
      expect(sanitizeHelpers(undefined)).toBeUndefined()
    })

    it('returns undefined for non-array helpers (rejects malformed payloads)', () => {
      expect(sanitizeHelpers('not-an-array')).toBeUndefined()
      expect(sanitizeHelpers(42)).toBeUndefined()
      expect(sanitizeHelpers({ id: 'x', parentRole: 'dev' })).toBeUndefined()
    })

    it('accepts a valid helpers array with all 8 base roles', () => {
      const roles = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
      for (const role of roles) {
        const result = sanitizeHelpers([{ id: `${role}#abc`, parentRole: role, label: 'Subagent' }])
        expect(result).toHaveLength(1)
        expect(result[0].parentRole).toBe(role)
      }
    })

    it('passes through valid helpers with optional label', () => {
      const result = sanitizeHelpers([
        { id: 'dev#abc123', parentRole: 'dev', label: 'Coder' },
        { id: 'qa#def456', parentRole: 'qa' },
      ])
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ id: 'dev#abc123', parentRole: 'dev', label: 'Coder' })
      expect(result[1]).toMatchObject({ id: 'qa#def456', parentRole: 'qa' })
      expect(result[1].label).toBeUndefined()
    })

    it('rejects entries whose parentRole is not in the 8 base roles', () => {
      const result = sanitizeHelpers([
        { id: 'hacker#abc', parentRole: 'hacker' },
        { id: 'dev#abc', parentRole: 'dev' },
        { id: 'slug~dev#abc', parentRole: 'slug~dev' },  // composite is not a base role
      ])
      expect(result).toHaveLength(1)
      expect(result[0].parentRole).toBe('dev')
    })

    it('rejects entries with missing or non-string id', () => {
      const result = sanitizeHelpers([
        { id: 123, parentRole: 'dev' },
        { parentRole: 'dev' },
        { id: '', parentRole: 'dev' },          // empty string is rejected
        { id: 'valid#abc', parentRole: 'dev' }, // kept
      ])
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('valid#abc')
    })

    it('caps helpers array at 64 entries', () => {
      const many = Array.from({ length: 100 }, (_, i) => ({ id: `dev#${i}`, parentRole: 'dev' }))
      const result = sanitizeHelpers(many)
      expect(result).toHaveLength(64)
    })

    it('caps id and label strings at 200 chars', () => {
      const big = 'x'.repeat(500)
      const result = sanitizeHelpers([{ id: big, parentRole: 'dev', label: big }])
      expect(result[0].id.length).toBe(200)
      expect(result[0].label.length).toBe(200)
    })

    it('returns empty array (not undefined) for an explicit helpers:[] — clears helpers slice', () => {
      const result = sanitizeHelpers([])
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('normalizeStatusMessage: valid helpers array passes through to the message', () => {
      const msg = normalizeStatusMessage({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
        helpers: [{ id: 'dev#abc', parentRole: 'dev', label: 'Helper' }],
      })
      expect(msg.helpers).toEqual([{ id: 'dev#abc', parentRole: 'dev', label: 'Helper' }])
    })

    it('normalizeStatusMessage: malformed helpers array is dropped (field absent in output)', () => {
      const msg = normalizeStatusMessage({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
        helpers: 'not-an-array',
      })
      expect(msg.helpers).toBeUndefined()
      expect('helpers' in msg).toBe(false)
    })

    it('normalizeStatusMessage: helpers absent in payload → field absent in output (no-clear semantics)', () => {
      const msg = normalizeStatusMessage({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
      })
      expect('helpers' in msg).toBe(false)
    })

    it('normalizeStatusMessage: explicit helpers:[] passes as empty array (clear semantics)', () => {
      const msg = normalizeStatusMessage({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
        helpers: [],
      })
      expect(msg.helpers).toEqual([])
    })

    it('normalizeStatusMessage: entry with invalid parentRole is filtered out', () => {
      const msg = normalizeStatusMessage({
        type: 'office-status',
        agents: [{ role: 'dev', status: 'working' }],
        helpers: [
          { id: 'bad#1', parentRole: 'admin' },
          { id: 'good#1', parentRole: 'qa' },
        ],
      })
      expect(msg.helpers).toHaveLength(1)
      expect(msg.helpers[0].parentRole).toBe('qa')
    })
  })
})
