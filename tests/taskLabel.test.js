/**
 * AVO-103 — TaskLabel routing tests.
 *
 * TaskLabel itself is a tiny SVG component — we don't full-render React for
 * it; we test the classification routing that drives the label text. The
 * component is a thin wrapper around `classifyTask(task).visualLabel`, so
 * the meaningful behavior to pin is "what shows up for a representative
 * sample of real Claude/Codex tool names".
 */
import { describe, it, expect } from 'vitest'
import { classifyTask } from '../src/systems/classify.js'

// Snapshot the visualLabel a TaskLabel would render for a given task name.
function labelOf(task) {
  return classifyTask(task).visualLabel
}

describe('TaskLabel — classifier-driven label routing', () => {
  it.each([
    ['Bash',          'Bash'],
    ['Read',          'Read'],
    ['Edit',          'Edit'],
    ['Write',         'Write'],
    ['Grep',          'Grep'],
    ['Glob',          'Glob'],
    ['Task',          'Task'],
    ['WebFetch',      'WebFetch'],
    ['WebSearch',     'WebSearch'],
    ['NotebookEdit',  'Notebook'],
    ['ExitPlanMode',  'Plan'],
  ])('built-in %s → label "%s"', (task, expected) => {
    expect(labelOf(task)).toBe(expected)
  })

  it('MCP namespaced tool is shortened to server::tool (post-bubble-up)', () => {
    // mcp__notion__create_page → CREATE family with subFamily=notion
    // visualLabel format: `${server}::${inner.visualLabel.toLowerCase()}`
    const r = classifyTask('mcp__notion__create_page')
    expect(r.subFamily).toBe('notion')
    expect(r.visualLabel).toMatch(/^notion::/)
    expect(r.visualLabel.toLowerCase()).toContain('create')
  })

  it('MCP with no inner verb match falls back to server::raw_tool', () => {
    const r = classifyTask('mcp__notion__weirdtool')
    expect(r.visualLabel).toBe('notion::weirdtool')
  })

  it('verb-classified tool (readConfig) renders as the verb family label', () => {
    expect(labelOf('readConfig')).toBe('Read')
    expect(labelOf('searchIndex')).toBe('Search')
    expect(labelOf('writeFile')).toBe('Create')
  })

  it('unknown task name is preserved (truncated if >16 chars)', () => {
    expect(labelOf('xyzzy')).toBe('xyzzy')
    const long = 'verylongtoolnameabcdef'  // 22 chars
    const r = classifyTask(long)
    expect(r.visualLabel.length).toBeLessThanOrEqual(16)
    expect(r.visualLabel).toContain('…')
  })

  it('null / undefined / empty task → returns shape but visualLabel is "?"', () => {
    expect(classifyTask(null).visualLabel).toBe('?')
    expect(classifyTask(undefined).visualLabel).toBe('?')
    expect(classifyTask('').visualLabel).toBe('?')
  })
})
