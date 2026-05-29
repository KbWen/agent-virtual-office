/**
 * #A3 — unknownLog tests
 *
 * Verifies the dev-mode aggregation: tier 5 fallbacks from classify*
 * functions accumulate raw strings into per-kind buckets, sorted/capped
 * reports come back, dev-mode gate works, and production is no-op.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  recordUnknown,
  getUnknownReport,
  clearUnknownLog,
  isDevMode,
} from '../src/systems/unknownLog.js'
import {
  classifyTask,
  classifyStatus,
  classifyMood,
  classifyRole,
  classifyWorkflow,
} from '../src/systems/classify.js'

beforeEach(() => {
  clearUnknownLog()
  // Force dev mode ON for tests (deterministic)
  globalThis.__OFFICE_FORCE_UNKNOWN_LOG__ = true
})

afterEach(() => {
  delete globalThis.__OFFICE_FORCE_UNKNOWN_LOG__
  clearUnknownLog()
})

describe('unknownLog — basic recording', () => {
  it('records a single unknown task', () => {
    recordUnknown('task', 'xyzzy')
    const report = getUnknownReport()
    expect(report.task).toEqual([['xyzzy', 1]])
  })

  it('counts repeat occurrences', () => {
    recordUnknown('task', 'mcp__foo__bar')
    recordUnknown('task', 'mcp__foo__bar')
    recordUnknown('task', 'mcp__foo__bar')
    expect(getUnknownReport().task[0]).toEqual(['mcp__foo__bar', 3])
  })

  it('sorts report by count descending', () => {
    recordUnknown('task', 'low')
    recordUnknown('task', 'high'); recordUnknown('task', 'high'); recordUnknown('task', 'high')
    recordUnknown('task', 'mid'); recordUnknown('task', 'mid')
    const report = getUnknownReport()
    expect(report.task.map(([raw]) => raw)).toEqual(['high', 'mid', 'low'])
  })

  it('isolates kinds (task vs status vs mood vs role vs workflow)', () => {
    recordUnknown('task', 'taskA')
    recordUnknown('status', 'statusA')
    recordUnknown('mood', 'moodA')
    recordUnknown('role', 'roleA')
    recordUnknown('workflow', 'wfA')
    const r = getUnknownReport()
    expect(r.task).toEqual([['taskA', 1]])
    expect(r.status).toEqual([['statusA', 1]])
    expect(r.mood).toEqual([['moodA', 1]])
    expect(r.role).toEqual([['roleA', 1]])
    expect(r.workflow).toEqual([['wfA', 1]])
  })

  it('clearUnknownLog wipes all kinds', () => {
    recordUnknown('task', 'a')
    recordUnknown('mood', 'b')
    clearUnknownLog()
    const r = getUnknownReport()
    for (const kind of Object.keys(r)) expect(r[kind]).toEqual([])
  })

  it('report caps each kind at 20 entries', () => {
    for (let i = 0; i < 50; i++) recordUnknown('task', `tool-${i}`)
    expect(getUnknownReport().task.length).toBe(20)
  })
})

describe('unknownLog — defensive input handling', () => {
  it('silently drops unknown `kind` parameter', () => {
    recordUnknown('not-a-kind', 'something')
    const r = getUnknownReport()
    for (const kind of Object.keys(r)) expect(r[kind]).toEqual([])
  })

  it('silently drops non-string raw input', () => {
    recordUnknown('task', null)
    recordUnknown('task', undefined)
    recordUnknown('task', 42)
    recordUnknown('task', {})
    recordUnknown('task', '')
    expect(getUnknownReport().task).toEqual([])
  })
})

describe('unknownLog — dev-mode gate', () => {
  it('isDevMode returns true when forced ON', () => {
    globalThis.__OFFICE_FORCE_UNKNOWN_LOG__ = true
    expect(isDevMode()).toBe(true)
  })

  it('isDevMode returns false when forced OFF', () => {
    globalThis.__OFFICE_FORCE_UNKNOWN_LOG__ = false
    expect(isDevMode()).toBe(false)
  })

  it('recordUnknown is no-op when dev-mode is OFF', () => {
    globalThis.__OFFICE_FORCE_UNKNOWN_LOG__ = false
    recordUnknown('task', 'shouldntRecord')
    expect(getUnknownReport().task).toEqual([])
  })
})

describe('unknownLog — internal cap evicts oldest (Map insertion order)', () => {
  it('exceeding MAX_PER_KIND drops the oldest entry, not the newest', () => {
    // We seed enough unique tools to exceed the 200 cap by 1.
    for (let i = 0; i < 201; i++) recordUnknown('task', `t-${i}`)
    // The full bucket is still readable, capped to 20 in report. The internal
    // Map (exposed via globalThis if set, but we only check report shape) should
    // not contain the very first inserted key.
    const report = getUnknownReport()
    expect(report.task.length).toBe(20)
    // Direct probe — first inserted key should be evicted. We can't read the
    // Map directly here without using the global, so check via reinserting:
    recordUnknown('task', 't-0')
    // After re-recording 't-0', its count goes to 1 again (was evicted) — not 2.
    // To detect this, ensure 't-0' appears in report exactly once with count 1.
    const t0 = report.task.find(([raw]) => raw === 't-0')
    expect(t0).toBeUndefined() // 't-0' was already evicted before re-record
  })
})

describe('unknownLog — integration with classify*', () => {
  it('classifyTask Tier 5 records the raw task name', () => {
    classifyTask('completelyMysteriousTool')
    expect(getUnknownReport().task[0]).toEqual(['completelyMysteriousTool', 1])
  })

  it('classifyTask Tier 0/3/4 (known) do NOT record', () => {
    classifyTask('Bash')                  // Tier 0
    classifyTask('readConfig')             // Tier 3 verb
    classifyTask('mcp__notion__create')    // Tier 4 MCP
    expect(getUnknownReport().task).toEqual([])
  })

  it('classifyStatus Tier 5 records', () => {
    classifyStatus('processing')
    expect(getUnknownReport().status[0]).toEqual(['processing', 1])
  })

  it('classifyStatus known values do NOT record', () => {
    classifyStatus('idle')
    classifyStatus('working')
    classifyStatus('blocked')
    classifyStatus('done')
    classifyStatus('thinking')
    expect(getUnknownReport().status).toEqual([])
  })

  it('classifyMood Tier 5 records', () => {
    classifyMood('delegating')
    expect(getUnknownReport().mood[0]).toEqual(['delegating', 1])
  })

  it('classifyMood known values do NOT record', () => {
    classifyMood('normal')
    classifyMood('frustrated')
    classifyMood('stuck')
    expect(getUnknownReport().mood).toEqual([])
  })

  it('classifyRole Tier 5 records the BASE role (not the full agentId)', () => {
    classifyRole('security-officer')
    expect(getUnknownReport().role[0]).toEqual(['security-officer', 1])
  })

  it('classifyRole composite slug~role with known base does NOT record', () => {
    classifyRole('feat-x~dev')
    classifyRole('main~qa')
    expect(getUnknownReport().role).toEqual([])
  })

  it('classifyWorkflow Tier 5 records the normalized key (no leading slash)', () => {
    classifyWorkflow('/my-custom-flow')
    expect(getUnknownReport().workflow[0]).toEqual(['my-custom-flow', 1])
  })

  it('classifyWorkflow known phases do NOT record', () => {
    classifyWorkflow('/ship')
    classifyWorkflow('/test')
    classifyWorkflow('/research')
    expect(getUnknownReport().workflow).toEqual([])
  })

  it('mixed batch: records spread across correct buckets, frequencies accurate', () => {
    classifyTask('mcp__notion__weirdtool')   // Tier 4 — NOT unknown (MCP parses)
    classifyTask('unknownTool1')              // Tier 5
    classifyTask('unknownTool1')              // +1 — should count as 2
    classifyTask('unknownTool2')              // Tier 5
    classifyMood('confused')                   // Tier 5
    classifyRole('captain')                    // Tier 5
    classifyWorkflow('/unknown-flow')          // Tier 5
    classifyStatus('paused')                   // Tier 5

    const r = getUnknownReport()
    expect(r.task).toEqual([
      ['unknownTool1', 2],
      ['unknownTool2', 1],
    ])
    expect(r.status).toEqual([['paused', 1]])
    expect(r.mood).toEqual([['confused', 1]])
    expect(r.role).toEqual([['captain', 1]])
    expect(r.workflow).toEqual([['unknown-flow', 1]])
  })
})

describe('unknownLog — production no-op (gate=OFF)', () => {
  it('classifying unknown tools while gate is OFF does not pollute the report', () => {
    globalThis.__OFFICE_FORCE_UNKNOWN_LOG__ = false
    classifyTask('shouldNotRecord')
    classifyMood('shouldNotRecord')
    classifyStatus('shouldNotRecord')
    const r = getUnknownReport()
    for (const kind of Object.keys(r)) expect(r[kind]).toEqual([])
  })
})
