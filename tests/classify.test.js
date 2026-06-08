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
  classifyRole,
  classifyWorkflow,
  decideBehavior,
  familyToBehavior,
  classifyBlockedReason,
  BLOCKED_REASONS,
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

describe('classifyTask — Tier 4 MCP namespace (inner verb bubbles up)', () => {
  it('mcp__notion__create_page → tier 4, family=CREATE (inner verb bubbles up)', () => {
    const r = classifyTask('mcp__notion__create_page')
    expectValidShape(r)
    expect(r.tier).toBe(4)
    expect(r.family).toBe(FAMILIES.CREATE)   // bubbled — NOT external
    expect(r.subFamily).toBe('notion')        // server preserved
    expect(r.raw).toBe('mcp__notion__create_page')
    expect(r.visualLabel).toContain('notion')
  })

  it('mcp__atlassian__search_issues → tier 4, family=SEARCH', () => {
    const r = classifyTask('mcp__atlassian__search_issues')
    expect(r.tier).toBe(4)
    expect(r.family).toBe(FAMILIES.SEARCH)   // bubbled
    expect(r.subFamily).toBe('atlassian')
    expect(r.visualLabel).toContain('atlassian')
    expect(r.severity).toBe('low')            // search → low
  })

  it('mcp__notion__delete_page → tier 4, family=DELETE (high severity preserved)', () => {
    const r = classifyTask('mcp__notion__delete_page')
    expect(r.tier).toBe(4)
    expect(r.family).toBe(FAMILIES.DELETE)
    expect(r.subFamily).toBe('notion')
    expect(r.severity).toBe('high')
  })

  it('mcp__notion__read_database → tier 4, family=READ', () => {
    const r = classifyTask('mcp__notion__read_database')
    expect(r.tier).toBe(4)
    expect(r.family).toBe(FAMILIES.READ)
    expect(r.subFamily).toBe('notion')
  })

  it('mcp__notion__weirdtool (no verb match) → tier 4, family=EXTERNAL (fallback)', () => {
    // When the MCP tool name doesnt match any verb pattern, we fall back to
    // EXTERNAL so the tool still has a category.
    const r = classifyTask('mcp__notion__weirdtool')
    expect(r.tier).toBe(4)
    expect(r.family).toBe(FAMILIES.EXTERNAL)
    expect(r.subFamily).toBe('notion')
    expect(r.severity).toBe('medium')
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

describe('familyToBehavior — #A2 wiring helper', () => {
  // Build a reference of every existing AgentCharacter.jsx animation `case`
  // so we can prove every family→behavior maps to a real animation.
  const KNOWN_ANIMATIONS = new Set([
    'typing', 'reading-screen', 'writing-notes', 'research', 'gantt-chart',
    'magnifier', 'shield-verify', 'deploy-button', 'drink-coffee',
    'goto-coffee-machine', 'whiteboard', 'meeting', 'chat', 'check-phone',
    'stretch', 'nap', 'thumbs-up', 'print', 'scratch-head', 'idle',
    'pass-document', 'desk-slam', 'happy', 'focused', 'confused',
  ])

  it('every action family maps to a known animation', () => {
    const actionFamilies = [
      FAMILIES.READ, FAMILIES.SEARCH, FAMILIES.CREATE, FAMILIES.UPDATE,
      FAMILIES.DELETE, FAMILIES.EXECUTE, FAMILIES.AUTH, FAMILIES.COMMUNICATE,
      FAMILIES.NAVIGATE, FAMILIES.DISPATCH, FAMILIES.PLAN, FAMILIES.MEMORY,
      FAMILIES.SYSTEM, FAMILIES.COGNITION, FAMILIES.EXTERNAL,
    ]
    for (const f of actionFamilies) {
      const b = familyToBehavior(f)
      expect(KNOWN_ANIMATIONS, `${f} → ${b} is not a known animation`).toContain(b)
    }
  })

  it('preserves Tier 0 contract: Bash/Read/Grep/Glob produce identical behaviors', () => {
    // These are the four explicit entries in store.js STATUS_BEHAVIOR_MAP.working.behavior;
    // #A2's fallback (familyToBehavior(classifyTask(task).family)) MUST produce the same
    // result so backward compat is preserved by construction.
    expect(familyToBehavior(classifyTask('Bash').family)).toBe('typing')
    expect(familyToBehavior(classifyTask('Read').family)).toBe('reading-screen')
    expect(familyToBehavior(classifyTask('Grep').family)).toBe('research')
    expect(familyToBehavior(classifyTask('Glob').family)).toBe('research')
  })

  it('MCP-namespaced create_page → writing-notes (inner verb bubbles up post-fix)', () => {
    // Post-fix: Tier 4 returns the inner verbs family when matched, not a flat
    // EXTERNAL. So `mcp__notion__create_page` → family=CREATE → behavior=writing-notes,
    // matching the semantic intent (this MCP call CREATES content).
    const t = classifyTask('mcp__notion__create_page')
    expect(t.family).toBe(FAMILIES.CREATE)
    expect(familyToBehavior(t.family)).toBe('writing-notes')
  })

  it('MCP-namespaced search → research animation (inner verb routing)', () => {
    const t = classifyTask('mcp__atlassian__search_issues')
    expect(t.family).toBe(FAMILIES.SEARCH)
    expect(familyToBehavior(t.family)).toBe('research')
  })

  it('MCP-namespaced delete → typing (DELETE family + no specific delete anim yet)', () => {
    // DELETE family currently maps to 'typing' in familyToBehavior — no specific
    // delete animation exists. The important contract: family is DELETE (high severity),
    // so future animation additions (if any) can target this case precisely.
    const t = classifyTask('mcp__notion__delete_page')
    expect(t.family).toBe(FAMILIES.DELETE)
    expect(t.severity).toBe('high')
    expect(familyToBehavior(t.family)).toBe('typing')
  })

  it('MCP tool with no verb match falls back to EXTERNAL → typing', () => {
    const t = classifyTask('mcp__notion__weirdtool')
    expect(t.family).toBe(FAMILIES.EXTERNAL)
    expect(familyToBehavior(t.family)).toBe('typing')
  })

  it('verb-classified read tools → reading-screen', () => {
    expect(familyToBehavior(classifyTask('readConfig').family)).toBe('reading-screen')
    expect(familyToBehavior(classifyTask('getStatus').family)).toBe('reading-screen')
    expect(familyToBehavior(classifyTask('listFiles').family)).toBe('reading-screen')
  })

  it('verb-classified search tools → research', () => {
    expect(familyToBehavior(classifyTask('searchIndex').family)).toBe('research')
    expect(familyToBehavior(classifyTask('queryDatabase').family)).toBe('research')
  })

  it('verb-classified auth tools → shield-verify', () => {
    expect(familyToBehavior(classifyTask('authenticate').family)).toBe('shield-verify')
    expect(familyToBehavior(classifyTask('login').family)).toBe('shield-verify')
  })

  it('verb-classified dispatch tools → gantt-chart (planner aesthetic)', () => {
    expect(familyToBehavior(classifyTask('dispatchJob').family)).toBe('gantt-chart')
    expect(familyToBehavior(classifyTask('delegateTask').family)).toBe('gantt-chart')
  })

  it('verb-classified communicate tools → chat', () => {
    expect(familyToBehavior(classifyTask('sendEmail').family)).toBe('chat')
    expect(familyToBehavior(classifyTask('postMessage').family)).toBe('chat')
  })

  it('unknown task → typing (matches pre-#A2 default)', () => {
    expect(familyToBehavior(classifyTask('xyzzy').family)).toBe('typing')
    expect(familyToBehavior(classifyTask('').family)).toBe('typing')
  })

  it('status/mood families fall through to default typing (they have their own paths)', () => {
    expect(familyToBehavior(FAMILIES.IDLE)).toBe('typing')
    expect(familyToBehavior(FAMILIES.WORK)).toBe('typing')
    expect(familyToBehavior(FAMILIES.RAIN)).toBe('typing')
    expect(familyToBehavior(FAMILIES.CLEAR)).toBe('typing')
  })

  it('completely unknown family string → typing (safe default)', () => {
    expect(familyToBehavior('not-a-real-family')).toBe('typing')
    expect(familyToBehavior(undefined)).toBe('typing')
    expect(familyToBehavior(null)).toBe('typing')
  })
})

describe('classifyRole — AgentCortex roster taxonomy', () => {
  it.each([
    ['pm',       'orchestrator', true],
    ['arch',     'orchestrator', true],
    ['dev',      'builder',      false],  // dev is generalist — no overrides
    ['qa',       'verifier',     true],
    ['ops',      'deployer',     true],
    ['res',      'investigator', true],
    ['gate',     'verifier',     true],
    ['designer', 'builder',      true],
    ['planner',  'orchestrator', true],
    ['worker',   'builder',      false],  // worker is dev-equivalent
    ['checker',  'verifier',     true],
  ])('%s → family=%s hasOverrides=%s', (role, family, hasOverrides) => {
    const r = classifyRole(role)
    expect(r.tier).toBe(0)
    expect(r.family).toBe(family)
    expect(r.hasOverrides).toBe(hasOverrides)
  })

  it('extracts base role from composite slug~role agent IDs', () => {
    const r = classifyRole('feat-x~qa')
    expect(r.tier).toBe(0)
    expect(r.family).toBe('verifier')
    expect(r.raw).toBe('feat-x~qa')
  })

  it('handles slugs that themselves contain ~ (splits on LAST separator)', () => {
    const r = classifyRole('feat~with~tilde~dev')
    expect(r.tier).toBe(0)
    expect(r.family).toBe('builder')
  })

  it('unknown role → unknown family', () => {
    const r = classifyRole('security-officer')
    expect(r.tier).toBe(5)
    expect(r.family).toBe(FAMILIES.UNKNOWN)
    expect(r.raw).toBe('security-officer')
  })

  it('non-string defensive: never throws', () => {
    expect(() => classifyRole(null)).not.toThrow()
    expect(() => classifyRole(undefined)).not.toThrow()
    expect(() => classifyRole(42)).not.toThrow()
  })
})

describe('classifyWorkflow — AgentCortex lifecycle phases', () => {
  it.each([
    'bootstrap', 'plan', 'implement', 'review', 'test', 'ship', 'handoff',
    'spec', 'spec-intake', 'app-init', 'adr',
    'hotfix', 'research', 'brainstorm', 'audit',
    'decide', 'retro', 'sync-docs', 'govern-docs',
  ])('recognizes phase: %s', (phase) => {
    const r = classifyWorkflow(phase)
    expect(r.tier).toBe(0)
    expect(r.family).toBe('workflow-phase')
  })

  it('accepts leading slash (/ship and ship both work)', () => {
    expect(classifyWorkflow('/ship').tier).toBe(0)
    expect(classifyWorkflow('ship').tier).toBe(0)
    expect(classifyWorkflow('/ship').family).toBe('workflow-phase')
  })

  it('case-insensitive (Ship == ship)', () => {
    expect(classifyWorkflow('Ship').tier).toBe(0)
    expect(classifyWorkflow('SHIP').tier).toBe(0)
  })

  it('phases with workflow overrides are flagged hasOverrides=true', () => {
    expect(classifyWorkflow('/ship').hasOverrides).toBe(true)
    expect(classifyWorkflow('/test').hasOverrides).toBe(true)
    expect(classifyWorkflow('/research').hasOverrides).toBe(true)
  })

  it('phases WITHOUT workflow overrides flagged hasOverrides=false', () => {
    expect(classifyWorkflow('/handoff').hasOverrides).toBe(false)
    expect(classifyWorkflow('/retro').hasOverrides).toBe(false)
  })

  it('unknown workflow → unknown family, raw preserved', () => {
    const r = classifyWorkflow('/my-custom-flow')
    expect(r.tier).toBe(5)
    expect(r.family).toBe(FAMILIES.UNKNOWN)
    expect(r.raw).toBe('/my-custom-flow')
  })

  it('null/undefined → unknown without crash', () => {
    expect(() => classifyWorkflow(null)).not.toThrow()
    expect(() => classifyWorkflow(undefined)).not.toThrow()
    expect(classifyWorkflow(null).family).toBe(FAMILIES.UNKNOWN)
  })
})

describe('decideBehavior — priority resolver (status > workflow > role > default)', () => {
  describe('Priority 1: Status overrides everything', () => {
    it('blocked → scratch-head regardless of task/role/workflow', () => {
      expect(decideBehavior({ task: 'Bash', role: 'qa', status: 'blocked', workflow: '/ship' })).toBe('scratch-head')
      expect(decideBehavior({ task: 'Edit', role: 'designer', status: 'blocked' })).toBe('scratch-head')
    })
    it('done → thumbs-up regardless of task/role/workflow', () => {
      expect(decideBehavior({ task: 'Bash', role: 'ops', status: 'done', workflow: '/ship' })).toBe('thumbs-up')
    })
  })

  describe('Priority 2: Workflow override beats role', () => {
    it('qa + Bash + /ship → deploy-button (workflow wins over qa magnifier)', () => {
      expect(decideBehavior({ task: 'Bash', role: 'qa', status: 'working', workflow: '/ship' })).toBe('deploy-button')
    })
    it('dev + Bash + /test → magnifier (workflow > default)', () => {
      expect(decideBehavior({ task: 'Bash', role: 'dev', status: 'working', workflow: '/test' })).toBe('magnifier')
    })
    it('dev + Read + /research → research (workflow > default)', () => {
      expect(decideBehavior({ task: 'Read', role: 'dev', status: 'working', workflow: '/research' })).toBe('research')
    })
    it('dev + Write + /plan → gantt-chart (workflow > default)', () => {
      expect(decideBehavior({ task: 'Write', role: 'dev', status: 'working', workflow: '/plan' })).toBe('gantt-chart')
    })
    it('dev + Bash + /review → falls through (review only overrides READ/SEARCH, not EXECUTE)', () => {
      // The override table for /review doesnt include EXECUTE; falls to default familyToBehavior('execute') = 'typing'
      expect(decideBehavior({ task: 'Bash', role: 'dev', status: 'working', workflow: '/review' })).toBe('typing')
    })
  })

  describe('Priority 3: Role override (no workflow override active)', () => {
    it('qa + Bash → magnifier (qa role override on EXECUTE)', () => {
      expect(decideBehavior({ task: 'Bash', role: 'qa', status: 'working' })).toBe('magnifier')
    })
    it('ops + Bash → deploy-button (ops role override)', () => {
      expect(decideBehavior({ task: 'Bash', role: 'ops', status: 'working' })).toBe('deploy-button')
    })
    it('gate + Bash → shield-verify (gate role)', () => {
      expect(decideBehavior({ task: 'Bash', role: 'gate', status: 'working' })).toBe('shield-verify')
    })
    it('designer + Edit → whiteboard (designer override on UPDATE)', () => {
      expect(decideBehavior({ task: 'Edit', role: 'designer', status: 'working' })).toBe('whiteboard')
    })
    it('designer + Write → whiteboard (designer override on CREATE)', () => {
      expect(decideBehavior({ task: 'Write', role: 'designer', status: 'working' })).toBe('whiteboard')
    })
    it('pm + Write → gantt-chart (pm override on CREATE)', () => {
      expect(decideBehavior({ task: 'Write', role: 'pm', status: 'working' })).toBe('gantt-chart')
    })
    it('arch + Write → gantt-chart (arch override on CREATE)', () => {
      expect(decideBehavior({ task: 'Write', role: 'arch', status: 'working' })).toBe('gantt-chart')
    })
    it('res + Read → research (researcher digs into docs)', () => {
      expect(decideBehavior({ task: 'Read', role: 'res', status: 'working' })).toBe('research')
    })
  })

  describe('Priority 4: Default family→behavior (no overrides)', () => {
    it('dev + Bash → typing (no overrides)', () => {
      expect(decideBehavior({ task: 'Bash', role: 'dev', status: 'working' })).toBe('typing')
    })
    it('dev + Read → reading-screen (no overrides)', () => {
      expect(decideBehavior({ task: 'Read', role: 'dev', status: 'working' })).toBe('reading-screen')
    })
    it('worker + Bash → typing (worker = dev equivalent)', () => {
      expect(decideBehavior({ task: 'Bash', role: 'worker', status: 'working' })).toBe('typing')
    })
  })

  describe('Dynamic agents (slug~role IDs)', () => {
    it('feat-x~qa + Bash → magnifier (base role extracted)', () => {
      expect(decideBehavior({ task: 'Bash', role: 'feat-x~qa', status: 'working' })).toBe('magnifier')
    })
    it('hotfix~ops + Bash → deploy-button', () => {
      expect(decideBehavior({ task: 'Bash', role: 'hotfix~ops', status: 'working' })).toBe('deploy-button')
    })
  })

  describe('Lightweight-mode roster', () => {
    it('checker + Read → magnifier (checker = qa equivalent)', () => {
      expect(decideBehavior({ task: 'Read', role: 'checker', status: 'working' })).toBe('magnifier')
    })
    it('planner + Write → gantt-chart (planner = pm equivalent)', () => {
      expect(decideBehavior({ task: 'Write', role: 'planner', status: 'working' })).toBe('gantt-chart')
    })
  })

  describe('Defensive', () => {
    it('no args → typing default (status undefined → no override → family unknown → typing)', () => {
      expect(decideBehavior()).toBe('typing')
      expect(decideBehavior({})).toBe('typing')
    })
    it('unknown role → falls to family default', () => {
      expect(decideBehavior({ task: 'Bash', role: 'security-officer', status: 'working' })).toBe('typing')
    })
    it('unknown workflow → falls through to role/family', () => {
      expect(decideBehavior({ task: 'Bash', role: 'qa', status: 'working', workflow: '/my-custom' })).toBe('magnifier')
    })
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

describe('planning status — AVO-101 plan mode', () => {
  it('classifyStatus maps planning to the PLAN family', () => {
    const r = classifyStatus('planning')
    expect(r.family).toBe('plan')
    expect(r.visualLabel).toBe('Planning')
    expect(r.tier).toBe(0)
  })
  it('decideBehavior gives planning a distinct architecting animation (gantt-chart)', () => {
    expect(decideBehavior({ status: 'planning', role: 'dev', task: 'Read' })).toBe('gantt-chart')
    // status override wins over role/task/workflow
    expect(decideBehavior({ status: 'planning', role: 'ops', task: 'Bash', workflow: '/ship' })).toBe('gantt-chart')
  })
})

// AVO-110 / #29 — classifyBlockedReason (pure render-side mapping; no second classifier)
describe('classifyBlockedReason (AVO-110)', () => {
  it('maps each known reason to BLOCKED family + complete badge metadata', () => {
    for (const code of BLOCKED_REASONS) {
      const r = classifyBlockedReason(code)
      expect(r.family).toBe(FAMILIES.BLOCKED)
      expect(r.reason).toBe(code)
      expect(typeof r.iconId).toBe('string')
      expect(r.iconId.length).toBeGreaterThan(0)
      expect(typeof r.a11yKey).toBe('string')
      expect(r.a11yKey.length).toBeGreaterThan(0)
      expect(typeof r.hue).toBe('string')
    }
  })

  it('UNKNOWN-ON-UNRECOGNIZED: absent / garbage / non-string → blocked-unknown, never throws', () => {
    expect(classifyBlockedReason('xyz').reason).toBe('blocked-unknown')
    expect(classifyBlockedReason(undefined).reason).toBe('blocked-unknown')
    expect(classifyBlockedReason(null).reason).toBe('blocked-unknown')
    expect(classifyBlockedReason(42).reason).toBe('blocked-unknown')
    expect(classifyBlockedReason('').reason).toBe('blocked-unknown')
  })

  it('COLOR-NEVER-ONLY: every reason has a UNIQUE iconId and a non-empty a11yKey', () => {
    const iconIds = BLOCKED_REASONS.map(c => classifyBlockedReason(c).iconId)
    expect(new Set(iconIds).size).toBe(iconIds.length)
    expect(BLOCKED_REASONS.every(c => classifyBlockedReason(c).a11yKey.length > 0)).toBe(true)
  })

  it('blocked-unknown is in the enum and is the fallback identity', () => {
    expect(BLOCKED_REASONS).toContain('blocked-unknown')
    expect(classifyBlockedReason('blocked-unknown').reason).toBe('blocked-unknown')
  })

  it('GATE-IS-NOT-FAILURE: awaiting-approval is not the BLOCKED family (gets no failure badge)', () => {
    expect(classifyStatus('awaiting-approval').family).toBe(FAMILIES.GATE)
    expect(classifyStatus('awaiting-approval').family).not.toBe(FAMILIES.BLOCKED)
  })
})
