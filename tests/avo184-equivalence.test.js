/**
 * AVO-184 — equivalence (characterization) harness for the applyExternalStatus god-reducer.
 *
 * PURPOSE: lock the CURRENT observable input→output of store.applyExternalStatus BEFORE any
 * "extract named helper" refactor, so a behavior-preserving extraction can be proven byte-green
 * at every step. This file MUST pass on the UN-refactored code first (baseline lock), then stay
 * green through the buildExtEntry / resolveAgentVisual / assembleIntegrationPatch hoists.
 *
 * SCOPE: applyExternalStatus ONLY (store.js). startStatusIntegration is OUT OF SCOPE this session.
 *
 * Honesty note (AVO): these assertions guard the status-decision truth path — what status an agent
 * shows, whether a 'done'/'blocked' is counted, whether a phantom worktree agent is evicted, and
 * object-identity (AVO-143 anti-re-render). A silent change here = a silent honesty regression.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore, __clearStoreFallbackPicks } from '../src/systems/store.js'
import { OVERFLOW_POSITIONS } from '../src/systems/movementSystem.js'
import { decideBehavior } from '../src/systems/classify.js'

// Data slices the reducer reads/writes. Restored (deep-cloned) before each test so the singleton
// store is a clean, deterministic baseline — actions are left intact (merge setState, not replace).
const DATA_KEYS = [
  'agents', 'externalStatus', 'dailyDoneLedger', 'dailyBlockedLedger', 'recurringFailureLog',
  'activityLog', 'eventFeed', 'selectedAgent', 'statusSource', 'integrationSource',
  'activeWorkflow', 'hasEverReceivedStatus',
]
const clone = (v) => (v === undefined ? undefined : structuredClone(v))
const PRISTINE = {}
for (const k of DATA_KEYS) PRISTINE[k] = clone(useOfficeStore.getState()[k])

// Captured ONCE at load so it shares the pristine ledgers' dayKey (same calendar day) — a fixed
// arbitrary epoch would make ensureCurrentDailyDoneLedger roll the day on EVERY apply.
const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

function reset() {
  const fresh = {}
  for (const k of DATA_KEYS) fresh[k] = clone(PRISTINE[k])
  useOfficeStore.setState(fresh)
  __clearStoreFallbackPicks()
}
function apply(updates, meta = {}) {
  useOfficeStore.getState().applyExternalStatus(updates, { now: NOW, ...meta })
}
const st = () => useOfficeStore.getState()

beforeEach(reset)

// ─── A. Fresh status transitions (R1; resolveAgentVisual + buildExtEntry surfaces) ─────────────
describe('A. fresh status transitions', () => {
  it('A1 working: ext entry fields + behavior (Bash→typing) + focused expression', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    const ext = st().externalStatus.dev
    expect(ext.status).toBe('working')
    expect(ext.task).toBe('Bash')
    expect(ext.expiresAt).toBe(NOW + 300000)
    expect(ext.changedAt).toBe(NOW)
    const dev = st().agents.dev
    expect(dev.status).toBe('working')
    expect(dev.expression).toBe('focused')           // STATUS_BEHAVIOR_MAP.working.expression
    expect(dev.behavior).toBe('typing')              // decideBehavior(dev+Bash+working)
    expect(dev.behavior).toBe(decideBehavior({ task: 'Bash', role: 'dev', status: 'working', workflow: null }))
  })

  it('A1b carry fields (label/hint/reasonCode/skill) pass through; absent → null', () => {
    // AGENT_CARRY_FIELDS = task,label,hint,reasonCode,activeFile,skill — buildExtEntry carries each
    // via `u[f] || null` (activeFile handled separately). Closes the review-flagged coverage gap:
    // reasonCode is honesty-relevant (drives blocked-reason tags) and must not silently drift.
    apply([{ agentId: 'dev', status: 'working', task: 'Bash', label: 'Running tests', hint: 'npm test', reasonCode: 'permission-denied', skill: 'tdd' }])
    const ext = st().externalStatus.dev
    expect(ext.label).toBe('Running tests')
    expect(ext.hint).toBe('npm test')
    expect(ext.reasonCode).toBe('permission-denied')
    expect(ext.skill).toBe('tdd')
    apply([{ agentId: 'qa', status: 'working', task: 'Bash' }])
    const qa = st().externalStatus.qa
    expect(qa.label).toBeNull()
    expect(qa.hint).toBeNull()
    expect(qa.reasonCode).toBeNull()
    expect(qa.skill).toBeNull()
  })

  it('A2 blocked: scratch-head/confused + blocked-ledger +1 + activity logged', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'blocked', task: 'Bash' }])
    const dev = st().agents.dev
    expect(dev.status).toBe('blocked')
    expect(dev.behavior).toBe('scratch-head')
    expect(dev.expression).toBe('confused')
    expect(st().dailyBlockedLedger.counts.dev).toBe(1)
    expect(st().activityLog[0]).toMatchObject({ agentId: 'dev', status: 'blocked', origin: 'hook' })
  })

  it('A3 done: 10s expiry + done count +1 + coffee growth + thumbs-up/happy', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'done', task: 'Bash' }])
    expect(st().externalStatus.dev.expiresAt).toBe(NOW + 10000)
    expect(st().dailyDoneLedger.counts.dev).toBe(1)
    expect(st().agents.dev.deskItemCount.coffee).toBe(1)   // ROLE_GROWTH_ITEMS.dev === 'coffee'
    expect(st().agents.dev.behavior).toBe('thumbs-up')
    expect(st().agents.dev.expression).toBe('happy')
  })
})

// ─── B. Poll re-apply identity (R2; AVO-143 anti-re-render) ─────────────────────────────────────
describe('B. no-op poll re-apply preserves identity', () => {
  beforeEach(() => apply([{ agentId: 'dev', status: 'working', task: 'Bash' }]))

  it('B1 same status+task keeps top-level + per-agent agents reference', () => {
    const before = st().agents
    const beforeDev = before.dev
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(st().agents).toBe(before)
    expect(st().agents.dev).toBe(beforeDev)
  })

  it('B2 re-apply does not re-count or re-grow', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(st().dailyDoneLedger.counts.dev ?? 0).toBe(0)
    expect(st().dailyBlockedLedger.counts.dev ?? 0).toBe(0)
  })

  it('B3 changedAt carried forward (not restamped) on same-signature re-apply', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }], { now: NOW + 5000 })
    expect(st().externalStatus.dev.changedAt).toBe(NOW)
  })
})

// ─── C. Day rollover (R1) ───────────────────────────────────────────────────────────────────────
describe('C. cross-midnight rollover resets desks + rolls ledgers', () => {
  it('C1 next-day apply zeroes deskItemCount and rolls dayKey', () => {
    apply([{ agentId: 'dev', status: 'done', task: 'Bash' }])      // grow coffee → 1
    expect(st().agents.dev.deskItemCount.coffee).toBe(1)
    const beforeKey = st().dailyDoneLedger.dayKey
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }], { now: NOW + DAY + 3600000 })
    expect(st().agents.dev.deskItemCount.coffee).toBe(0)
    expect(st().dailyDoneLedger.dayKey).not.toBe(beforeKey)
  })
})

// ─── D. Dynamic worktree agent creation + overflow slot (R1) ────────────────────────────────────
describe('D. dynamic slug~role creation', () => {
  it('D1 new agent cloned, placed in overflow slot 0, own empty desk, session set', () => {
    apply([{ agentId: 'proj~dev', status: 'working', task: 'Bash', session: 'proj' }])
    const a = st().agents['proj~dev']
    expect(a).toBeTruthy()
    expect(a.session).toBe('proj')
    expect(a.position).toEqual(OVERFLOW_POSITIONS[0])
    expect(a.deskItemCount).toEqual({ coffee: 0, sticky: 0, books: 0 })
  })

  it('D2 two new agents in one payload take distinct slots', () => {
    apply([
      { agentId: 'a~dev', status: 'working', task: 'Bash', session: 'a' },
      { agentId: 'b~dev', status: 'working', task: 'Bash', session: 'b' },
    ])
    expect(st().agents['a~dev'].position).not.toEqual(st().agents['b~dev'].position)
  })
})

// ─── E. Multi-session eviction + AVO-180 prune (R1) ─────────────────────────────────────────────
describe('E. multi-session reconciliation', () => {
  function seedDynamic() {
    apply([{ agentId: 'wt1~dev', status: 'working', task: 'Bash', session: 'wt1' }], { source: 'multi-session' })
  }

  it('E1 omitted dynamic agent is evicted (agent + ext deleted)', () => {
    seedDynamic()
    expect(st().agents['wt1~dev']).toBeTruthy()
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }], { source: 'multi-session' })
    expect(st().agents['wt1~dev']).toBeUndefined()
    expect(st().externalStatus['wt1~dev']).toBeUndefined()
  })

  it('E2 AVO-180: recurringFailureLog[id] pruned on a CLONE (original ref untouched)', () => {
    seedDynamic()
    useOfficeStore.setState({ recurringFailureLog: { 'wt1~dev': [{ at: NOW, reason: 'x' }] } })
    const original = st().recurringFailureLog
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }], { source: 'multi-session' })
    expect(st().recurringFailureLog['wt1~dev']).toBeUndefined()  // pruned in the new log
    expect(original['wt1~dev']).toBeTruthy()                     // old reference NOT mutated
  })

  it('E3 evicted agent that was selected clears selectedAgent', () => {
    seedDynamic()
    useOfficeStore.setState({ selectedAgent: 'wt1~dev' })
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }], { source: 'multi-session' })
    expect(st().selectedAgent).toBeNull()
  })

  it('E4 static roster agent is NOT evicted by a multi-session payload', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }], { source: 'multi-session' })
    expect(st().agents.qa).toBeTruthy()
  })
})

// ─── F. Done counting dedup (R1) ────────────────────────────────────────────────────────────────
describe('F. done counting + seenEventKeys dedup', () => {
  it('F1 a fresh working→done counts exactly once', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'done', task: 'Bash' }])
    expect(st().dailyDoneLedger.counts.dev).toBe(1)
  })

  it('F2 a held done (done→done) does not double count', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'done', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'done', task: 'Read' }])   // task change → sigChanged, but previousStatus==='done'
    expect(st().dailyDoneLedger.counts.dev).toBe(1)
  })

  it('F3 same eventKey across two episodes counts once (seenEventKeys)', () => {
    const meta = { eventKey: 'k1' }
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'done', task: 'Bash' }], meta)
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'done', task: 'Bash' }], meta)  // fresh transition but key already seen
    expect(st().dailyDoneLedger.counts.dev).toBe(1)
  })
})

// ─── G. Blocked counting + AVO-117 episode (R1) ─────────────────────────────────────────────────
describe('G. blocked counting + recurring-failure episode', () => {
  it('G1 first blocked counts once; a held blocked does not double count', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'blocked', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'blocked', task: 'Bash' }])
    expect(st().dailyBlockedLedger.counts.dev).toBe(1)
  })

  it('G2 a blocked edge with a specific reasonCode records one episode', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    apply([{ agentId: 'dev', status: 'blocked', task: 'Bash', reasonCode: 'permission-denied' }])
    // recordEpisode shape: log[agentId][reasonCode] = [timestamp, ...]
    expect(st().recurringFailureLog.dev['permission-denied']).toHaveLength(1)
  })
})

// ─── H. AVO-106 activeFile stamping (buildExtEntry surface) ──────────────────────────────────────
describe('H. activeFile / activeFileAt', () => {
  it('H1 setting activeFile stamps activeFileAt = now', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Edit', activeFile: 'a.js' }])
    expect(st().externalStatus.dev.activeFile).toBe('a.js')
    expect(st().externalStatus.dev.activeFileAt).toBe(NOW)
  })

  it('H2 same activeFile re-apply carries activeFileAt forward', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Edit', activeFile: 'a.js' }])
    apply([{ agentId: 'dev', status: 'working', task: 'Edit', activeFile: 'a.js' }], { now: NOW + 9000 })
    expect(st().externalStatus.dev.activeFileAt).toBe(NOW)
  })

  it('H3 no activeFile → activeFileAt null', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(st().externalStatus.dev.activeFile).toBeNull()
    expect(st().externalStatus.dev.activeFileAt).toBeNull()
  })
})

// ─── I. Integration patch (assembleIntegrationPatch surface) ─────────────────────────────────────
describe('I. integration-channel patch', () => {
  it('I1 statusSource/integrationSource land from meta', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }], { statusSource: 'external', integrationSource: 'claude-cli' })
    expect(st().statusSource).toBe('external')
    expect(st().integrationSource).toBe('claude-cli')
  })

  it('I2 hasWorkflow sets activeWorkflow; absent workflow leaves it unchanged', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }], { hasWorkflow: true, workflow: '/plan' })
    expect(st().activeWorkflow).toBe('/plan')
    apply([{ agentId: 'dev', status: 'working', task: 'Read' }])  // no hasWorkflow
    expect(st().activeWorkflow).toBe('/plan')
  })

  it('I3 clearSourceIfEmpty after eviction reverts to organic (precedence over meta)', () => {
    apply([{ agentId: 'wt1~dev', status: 'working', task: 'Bash', session: 'wt1' }], { source: 'multi-session', statusSource: 'external' })
    apply([], { source: 'multi-session', clearSourceIfEmpty: true, statusSource: 'external' })
    expect(st().externalStatus).toEqual({})
    expect(st().statusSource).toBe('organic')
    expect(st().integrationSource).toBeNull()
  })
})

// ─── J. Behavior/bubble gating invariants (R1/R2) ────────────────────────────────────────────────
describe('J. group-event + no-op gating', () => {
  it('J2 inGroupEvent agent keeps its behavior/expression (officeLife owns them)', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    useOfficeStore.setState((s) => ({
      agents: { ...s.agents, dev: { ...s.agents.dev, inGroupEvent: true, behavior: 'meeting', expression: 'happy' } },
    }))
    apply([{ agentId: 'dev', status: 'blocked', task: 'Bash' }])
    expect(st().agents.dev.behavior).toBe('meeting')
    expect(st().agents.dev.expression).toBe('happy')
  })

  it('J3 no-op re-apply does not re-pop a bubble', () => {
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    const before = st().agents.dev.bubble
    apply([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(st().agents.dev.bubble).toBe(before)
  })
})
