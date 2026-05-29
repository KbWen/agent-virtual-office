/**
 * #A1 — classifier tests
 *
 * Covers the 4-tier waterfall and the output shape contract.
 */
import { describe, it, expect } from 'vitest'
import {
  classifyTask,
  classifyStatus,
  classifyMood,
  FAMILIES,
} from '../src/systems/classify.js'

// Output shape contract (panel decision): every classify* function returns
// the same fields, no exceptions, no nulls.
const REQUIRED_FIELDS = ['tier', 'family', 'severity', 'visualLabel', 'a11yLabel', 'raw']
function expectValidShape(result) {
  for (const field of REQUIRED_FIELDS) {
    expect(result[field], `missing field: ${field}`).toBeDefined()
  }
  expect([0, 3, 4, 5]).toContain(result.tier)
  expect(['low', 'medium', 'high']).toContain(result.severity)
  expect(typeof result.family).toBe('string')
  expect(typeof result.visualLabel).toBe('string')
  expect(typeof result.a11yLabel).toBe('string')
  expect(typeof result.raw).toBe('string')
}

describe('classifyTask — Tier 0 built-in registry', () => {
  it.each([
    ['Bash',         FAMILIES.EXECUTE,  'medium'],
    ['Read',         FAMILIES.READ,     'low'],
    ['Edit',         FAMILIES.UPDATE,   'medium'],
    ['Write',        FAMILIES.CREATE,   'medium'],
    ['Grep',         FAMILIES.SEARCH,   'low'],
    ['Glob',         FAMILIES.SEARCH,   'low'],
    ['Task',         FAMILIES.DISPATCH, 'high'],
    ['WebFetch',     FAMILIES.NAVIGATE, 'medium'],
    ['WebSearch',    FAMILIES.SEARCH,   'low'],
    ['NotebookEdit', FAMILIES.UPDATE,   'medium'],
    ['ExitPlanMode', FAMILIES.PLAN,     'low'],
    ['TodoWrite',    FAMILIES.UPDATE,   'low'],
    ['TodoRead',     FAMILIES.READ,     'low'],
  ])('classifies built-in %s → family=%s severity=%s (tier 0)', (task, family, severity) => {
    const r = classifyTask(task)
    expectValidShape(r)
    expect(r.tier).toBe(0)
    expect(r.family).toBe(family)
    expect(r.severity).toBe(severity)
    expect(r.raw).toBe(task)
  })

  it('Task (subagent dispatch) is marked as high severity (special case)', () => {
    const r = classifyTask('Task')
    expect(r.severity).toBe('high')
    expect(r.family).toBe(FAMILIES.DISPATCH)
  })
})

describe('classifyTask — Tier 4 MCP namespace', () => {
  it('parses `mcp__notion__create_page` → external/notion', () => {
    const r = classifyTask('mcp__notion__create_page')
    expectValidShape(r)
    expect(r.tier).toBe(4)
    expect(r.family).toBe(FAMILIES.EXTERNAL)
    expect(r.subFamily).toBe('notion')
    expect(r.raw).toBe('mcp__notion__create_page')
    // Inner verb 'create' should bubble through
    expect(r.visualLabel).toContain('notion')
  })

  it('parses `mcp__atlassian__search_issues` and sub-classifies as search', () => {
    const r = classifyTask('mcp__atlassian__search_issues')
    expect(r.tier).toBe(4)
    expect(r.subFamily).toBe('atlassian')
    expect(r.visualLabel).toContain('atlassian')
    expect(r.severity).toBe('low') // search → low
  })

  it('handles MCP server names with dashes (`mcp__notion-eu__create`)', () => {
    const r = classifyTask('mcp__notion-eu__create_database')
    expect(r.tier).toBe(4)
    expect(r.subFamily).toBe('notion-eu')
  })

  it('handles MCP tool names with underscores (split on FIRST `__` only)', () => {
    const r = classifyTask('mcp__server__tool_with_underscores')
    expect(r.tier).toBe(4)
    expect(r.subFamily).toBe('server')
    expect(r.raw).toBe('mcp__server__tool_with_underscores')
  })

  it('malformed MCP prefix falls through (no separator)', () => {
    const r = classifyTask('mcp__notoolname')
    // No '__' after server → not parsed as MCP → falls through. 'notoolname'
    // has no verb prefix → Tier 5 unknown.
    expect(r.tier).toBe(5)
    expect(r.family).toBe(FAMILIES.UNKNOWN)
  })

  it('empty MCP namespace falls through', () => {
    expect(classifyTask('mcp__').tier).toBe(5)
    expect(classifyTask('mcp____tool').tier).toBe(5) // empty server
  })

  it('high-severity MCP (delete) bubbles up', () => {
    const r = classifyTask('mcp__notion__delete_page')
    expect(r.tier).toBe(4)
    expect(r.severity).toBe('high') // delete inner verb
  })
})

describe('classifyTask — Tier 3 verb heuristic (W3C Activity Streams-aligned)', () => {
  it.each([
    // Read family
    ['readConfig',     FAMILIES.READ],
    ['getStatus',      FAMILIES.READ],
    ['listFiles',      FAMILIES.READ],
    ['fetchUser',      FAMILIES.READ],
    ['inspectNode',    FAMILIES.READ],
    // Search family
    ['searchIndex',    FAMILIES.SEARCH],
    ['queryDatabase',  FAMILIES.SEARCH],
    ['grepLog',        FAMILIES.SEARCH],
    // Create family
    ['createUser',     FAMILIES.CREATE],
    ['addRecord',      FAMILIES.CREATE],
    ['newProject',     FAMILIES.CREATE],
    ['generateReport', FAMILIES.CREATE],
    // Update family
    ['updateProfile',  FAMILIES.UPDATE],
    ['modifyConfig',   FAMILIES.UPDATE],
    ['patchFile',      FAMILIES.UPDATE],
    ['renameFile',     FAMILIES.UPDATE],
    // Delete family
    ['deleteRow',      FAMILIES.DELETE],
    ['removeUser',     FAMILIES.DELETE],
    ['dropTable',      FAMILIES.DELETE],
    // Execute family
    ['executeQuery',   FAMILIES.EXECUTE],
    ['runMigration',   FAMILIES.EXECUTE],
    ['spawnWorker',    FAMILIES.EXECUTE],
    // Auth family
    ['authenticate',         FAMILIES.AUTH],
    ['login',                FAMILIES.AUTH],
    ['authorizeRequest',     FAMILIES.AUTH],
    // Communicate
    ['sendEmail',      FAMILIES.COMMUNICATE],
    ['postMessage',    FAMILIES.COMMUNICATE],
    ['notifyTeam',     FAMILIES.COMMUNICATE],
    // Navigate
    ['navigateTo',     FAMILIES.NAVIGATE],
    ['openTab',        FAMILIES.NAVIGATE],
    // Dispatch
    ['dispatchJob',    FAMILIES.DISPATCH],
    ['delegateTask',   FAMILIES.DISPATCH],
    // Memory
    ['saveCheckpoint', FAMILIES.MEMORY],
    ['loadSnapshot',   FAMILIES.MEMORY],
  ])('classifies %s → %s (tier 3)', (task, family) => {
    const r = classifyTask(task)
    expectValidShape(r)
    expect(r.tier).toBe(3)
    expect(r.family).toBe(family)
  })

  it('verb prefix requires word boundary — `redo` does NOT match `read*`', () => {
    const r = classifyTask('redo')
    expect(r.family).not.toBe(FAMILIES.READ)
    expect(r.tier).toBe(5) // falls to unknown
  })

  it('`delegate` does NOT match `delete*`', () => {
    const r = classifyTask('delegate')
    expect(r.family).not.toBe(FAMILIES.DELETE)
  })

  it('`refresh` does NOT match `read*` or any other verb (falls to unknown)', () => {
    const r = classifyTask('refresh')
    expect(r.tier).toBe(5)
  })

  it('camelCase boundary is honored (`readData`, `writeFile`)', () => {
    expect(classifyTask('readData').family).toBe(FAMILIES.READ)
    expect(classifyTask('writeFile').family).toBe(FAMILIES.CREATE)
  })

  it('snake_case boundary is honored (`read_data`, `write_file`)', () => {
    expect(classifyTask('read_data').family).toBe(FAMILIES.READ)
    expect(classifyTask('write_file').family).toBe(FAMILIES.CREATE)
  })

  it('auth comes BEFORE create — `authorizeAccess` is auth not create', () => {
    const r = classifyTask('authorizeAccess')
    expect(r.family).toBe(FAMILIES.AUTH)
  })
})

describe('classifyTask — Tier 5 unknown fallback', () => {
  it.each([
    'completelyRandomString',
    'xyzzy',
    'plugh',
    'foobarbaz',
  ])('preserves raw for unrecognized name: %s', (task) => {
    const r = classifyTask(task)
    expectValidShape(r)
    expect(r.tier).toBe(5)
    expect(r.family).toBe(FAMILIES.UNKNOWN)
    expect(r.raw).toBe(task)
  })

  it('truncates over-long unknown task labels to keep UI sane', () => {
    const long = 'a'.repeat(40)
    const r = classifyTask(long)
    expect(r.visualLabel.length).toBeLessThanOrEqual(16)
    expect(r.raw).toBe(long) // raw stays full
  })

  it('handles non-string input defensively (no exception, returns unknown)', () => {
    for (const input of [null, undefined, 42, {}, [], true]) {
      const r = classifyTask(input)
      expectValidShape(r)
      expect(r.tier).toBe(5)
      expect(r.family).toBe(FAMILIES.UNKNOWN)
    }
  })

  it('empty string → unknown, doesnt crash', () => {
    const r = classifyTask('')
    expect(r.family).toBe(FAMILIES.UNKNOWN)
  })
})

describe('classifyStatus', () => {
  it.each([
    ['idle',               FAMILIES.IDLE,      'low'],
    ['working',            FAMILIES.WORK,      'medium'],
    ['blocked',            FAMILIES.BLOCKED,   'high'],
    ['done',               FAMILIES.SUCCESS,   'low'],
    ['thinking',           FAMILIES.COGNITION, 'low'],
    ['compacting',         FAMILIES.MEMORY,    'low'],
    ['awaiting-approval',  FAMILIES.GATE,      'high'],
  ])('%s → family=%s severity=%s', (status, family, severity) => {
    const r = classifyStatus(status)
    expectValidShape(r)
    expect(r.tier).toBe(0)
    expect(r.family).toBe(family)
    expect(r.severity).toBe(severity)
  })

  it('unknown status falls to tier 5 with raw preserved', () => {
    const r = classifyStatus('processing')
    expect(r.tier).toBe(5)
    expect(r.family).toBe(FAMILIES.UNKNOWN)
    expect(r.raw).toBe('processing')
  })

  it('non-string defensive: never throws', () => {
    expect(() => classifyStatus(null)).not.toThrow()
    expect(() => classifyStatus(undefined)).not.toThrow()
    expect(() => classifyStatus(42)).not.toThrow()
  })
})

describe('classifyMood', () => {
  it.each([
    ['normal',     FAMILIES.CLEAR],
    ['smooth',     FAMILIES.CLEAR],
    ['intense',    FAMILIES.CLEAR],
    ['idle',       FAMILIES.CLEAR],
    ['rushing',    FAMILIES.CLOUDY],
    ['frustrated', FAMILIES.RAIN],
    ['stuck',      FAMILIES.THUNDERSTORM],
  ])('%s → %s (matches existing moodToWeather contract)', (mood, family) => {
    const r = classifyMood(mood)
    expectValidShape(r)
    expect(r.tier).toBe(0)
    expect(r.family).toBe(family)
  })

  it('unknown mood defaults to CLEAR (conservative — no false-positive weather)', () => {
    const r = classifyMood('delegating')
    expect(r.tier).toBe(5)
    expect(r.family).toBe(FAMILIES.CLEAR) // not UNKNOWN — never scary weather
    expect(r.raw).toBe('delegating')
  })

  it('non-string defensive: never throws, returns CLEAR family', () => {
    for (const input of [null, undefined, 42, {}, []]) {
      const r = classifyMood(input)
      expectValidShape(r)
      expect(r.family).toBe(FAMILIES.CLEAR)
    }
  })

  it('classifyMood family DIRECTLY mirrors moodToWeather (so #A2 can swap)', async () => {
    const { moodToWeather } = await import('../src/components/TopDownFurniture.jsx')
    for (const mood of ['normal', 'smooth', 'intense', 'idle', 'rushing', 'frustrated', 'stuck']) {
      expect(classifyMood(mood).family).toBe(moodToWeather(mood))
    }
  })
})

describe('FAMILIES — vocabulary export', () => {
  it('is frozen (immutable downstream)', () => {
    expect(Object.isFrozen(FAMILIES)).toBe(true)
  })

  it('every classify result family value matches a FAMILIES constant', () => {
    const validFamilies = new Set(Object.values(FAMILIES))
    const samples = [
      classifyTask('Bash').family,
      classifyTask('mcp__notion__create').family,
      classifyTask('readData').family,
      classifyTask('xyzzy').family,
      classifyStatus('working').family,
      classifyStatus('unknown-status').family,
      classifyMood('frustrated').family,
      classifyMood('mystery-mood').family,
    ]
    for (const f of samples) {
      expect(validFamilies, `${f} not in FAMILIES`).toContain(f)
    }
  })
})

describe('Output shape contract', () => {
  it('every classifier call returns the required shape (cross-cutting)', () => {
    const samples = [
      classifyTask('Bash'),
      classifyTask('mcp__x__y'),
      classifyTask('readSomething'),
      classifyTask('xyzzy'),
      classifyTask(null),
      classifyStatus('idle'),
      classifyStatus('unknown'),
      classifyStatus(null),
      classifyMood('normal'),
      classifyMood('xyz'),
      classifyMood(null),
    ]
    for (const r of samples) {
      expectValidShape(r)
    }
  })
})
