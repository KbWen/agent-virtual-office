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
import { taskChipLabel } from '../src/components/ControlPanel.jsx'

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
