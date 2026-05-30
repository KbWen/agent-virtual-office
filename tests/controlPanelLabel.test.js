/**
 * Round 2 — ControlPanel task-chip label routing.
 *
 * The control panel's per-agent status line used to render the raw `ext.task`
 * wire string (e.g. `mcp__Claude_Preview__preview_eval`), which clashed with the
 * collapsed `Claude_Preview::preview_eval` chip the character's TaskLabel
 * (AVO-103) shows above the same agent's head. `taskChipLabel` routes the
 * control-panel label through the SAME `classifyTask(task).visualLabel` the
 * TaskLabel uses, so both surfaces agree. We pin the routing here (no full React
 * render needed — the helper is a thin pure wrapper, mirroring taskLabel.test.js).
 */
import { describe, it, expect } from 'vitest'
import { taskChipLabel, blockedReasonLabel, agentLineLabel, formatTokens } from '../src/components/ControlPanel.jsx'

describe('ControlPanel — formatTokens (AVO-108 compact token formatter)', () => {
  it.each([
    [842, '842'],
    [1000, '1k'],
    [604937, '605k'],
    [1_240_000, '1.2M'],
    [2_000_000, '2M'],
  ])('%d → "%s"', (n, expected) => {
    expect(formatTokens(n)).toBe(expected)
  })
  it('is defensive against junk input', () => {
    expect(formatTokens(-5)).toBe('0')
    expect(formatTokens(NaN)).toBe('0')
    expect(formatTokens(undefined)).toBe('0')
    expect(formatTokens('123')).toBe('0')
  })
})

// Minimal i18n stub: returns the fallback (2nd arg) the real t() would for an
// unknown key, so agentLineLabel's status-word branch is exercised deterministically.
const tStub = (_key, fallback) => fallback

describe('ControlPanel — taskChipLabel routing', () => {
  it.each([
    ['Bash',         'Bash'],
    ['Read',         'Read'],
    ['Edit',         'Edit'],
    ['Write',        'Write'],
    ['NotebookEdit', 'Notebook'],
    ['ExitPlanMode', 'Plan'],
  ])('built-in %s collapses to "%s"', (task, expected) => {
    expect(taskChipLabel(task)).toBe(expected)
  })

  it('MCP wire name collapses to server::tool (matches the SVG TaskLabel)', () => {
    expect(taskChipLabel('mcp__Claude_Preview__preview_eval'))
      .toBe('Claude_Preview::preview_eval')
    expect(taskChipLabel('mcp__notion__create_page')).toMatch(/^notion::/)
  })

  it('returns null for empty task so callers fall back to the status label', () => {
    expect(taskChipLabel(null)).toBeNull()
    expect(taskChipLabel(undefined)).toBeNull()
    expect(taskChipLabel('')).toBeNull()
  })

  it('an unrecognized long task is truncated, never echoed raw at full length', () => {
    const out = taskChipLabel('someExtremelyLongUnrecognizedToolNameThatExceedsTheCap')
    expect(out.length).toBeLessThanOrEqual(16)
  })

  it('a plain unknown short token passes through unchanged (e.g. UserPromptSubmit "thinking")', () => {
    expect(taskChipLabel('thinking')).toBe('thinking')
  })
})

describe('ControlPanel — blockedReasonLabel (AVO-110 lightweight)', () => {
  it('surfaces the failure reason for a blocked agent', () => {
    expect(blockedReasonLabel({ status: 'blocked', task: 'Bash', label: '❌ npm test failed' }))
      .toBe('❌ npm test failed')
  })

  it('returns null for non-blocked statuses (so the tool chip wins)', () => {
    expect(blockedReasonLabel({ status: 'working', task: 'Bash', label: '⚡ npm test' })).toBeNull()
    expect(blockedReasonLabel({ status: 'done', task: 'Bash', label: '✅ done' })).toBeNull()
  })

  it('returns null for a blocked agent with no label', () => {
    expect(blockedReasonLabel({ status: 'blocked', task: 'Bash', label: null })).toBeNull()
    expect(blockedReasonLabel({ status: 'blocked', task: 'Bash' })).toBeNull()
  })

  it('truncates an overly long reason with an ellipsis (compact status bar)', () => {
    const long = '❌ a really long failure message that would overflow the bar'
    const out = blockedReasonLabel({ status: 'blocked', label: long })
    expect(out.length).toBeLessThanOrEqual(28)
    expect(out.endsWith('…')).toBe(true)
  })

  it('keeps a reason exactly at the cap intact (no spurious ellipsis)', () => {
    const exact = 'x'.repeat(28)
    expect(blockedReasonLabel({ status: 'blocked', label: exact })).toBe(exact)
  })

  it('is defensive against null/garbage input', () => {
    expect(blockedReasonLabel(null)).toBeNull()
    expect(blockedReasonLabel(undefined)).toBeNull()
    expect(blockedReasonLabel({})).toBeNull()
  })
})

describe('ControlPanel — agentLineLabel fallback chain', () => {
  it('blocked reason wins over the tool chip', () => {
    expect(agentLineLabel({ status: 'blocked', task: 'Bash', label: '❌ build broke' }, tStub))
      .toBe('❌ build broke')
  })

  it('falls back to the collapsed tool chip when not blocked', () => {
    expect(agentLineLabel({ status: 'working', task: 'mcp__notion__create_page', label: '📝' }, tStub))
      .toMatch(/^notion::/)
  })

  it('falls back to the localized status word when there is no task', () => {
    expect(agentLineLabel({ status: 'working', task: null, label: null }, tStub)).toBe('working')
  })

  it('returns null when there is no external status (caller uses behaviorLabel)', () => {
    expect(agentLineLabel(null, tStub)).toBeNull()
  })
})
