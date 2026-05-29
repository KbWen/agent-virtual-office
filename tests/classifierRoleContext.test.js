/**
 * #A2.1 — role × workflow integration tests through real store.
 *
 * Proves that the SAME tool produces DIFFERENT animations based on:
 *   1. Which role uses it (qa vs ops vs designer vs dev)
 *   2. Which workflow phase is active (/ship vs /test vs /research vs /plan)
 *   3. Status overrides (blocked/done win over everything)
 *
 * This is the "don't classify too casually" feedback (memory:
 * feedback_classification_rigor.md) made concrete.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'

const PRISTINE_AGENTS = JSON.parse(JSON.stringify(useOfficeStore.getState().agents))

function resetStore() {
  const agents = {}
  for (const [id, a] of Object.entries(PRISTINE_AGENTS)) {
    agents[id] = {
      ...a,
      status: 'idle',
      behavior: 'idle',
      expression: 'normal',
      bubble: null,
      inGroupEvent: false,
      groupTarget: null,
      deskItemCount: { coffee: 0, sticky: 0, books: 0 },
    }
  }
  useOfficeStore.setState({
    agents,
    externalStatus: {},
    statusSource: 'organic',
    activeWorkflow: null,
    activityLog: [],
    selectedAgent: null,
    dailyDoneLedger: { dayKey: 'reset', counts: {}, seenEventKeys: [] },
    dailyBlockedLedger: { dayKey: 'reset', counts: {} },
  })
}

function setWorkflow(workflow) {
  useOfficeStore.setState({ activeWorkflow: workflow })
}

describe('#A2.1: same tool, different roles → different animations', () => {
  beforeEach(resetStore)

  it.each([
    ['dev',      'Bash', 'typing'],         // default
    ['qa',       'Bash', 'magnifier'],      // role override: qa inspects
    ['ops',      'Bash', 'deploy-button'],  // role override: ops deploys
    ['gate',     'Bash', 'shield-verify'],  // role override: gate verifies
    ['designer', 'Bash', 'typing'],         // designer keeps default for Bash
  ])('working/%s/%s → %s', (role, task, expected) => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: role, status: 'working', task }])
    expect(useOfficeStore.getState().agents[role].behavior).toBe(expected)
  })

  it.each([
    ['dev',      'Edit', 'writing-notes'],
    ['designer', 'Edit', 'whiteboard'],     // designer sketches
    ['pm',       'Write', 'gantt-chart'],   // pm plans
    ['arch',     'Write', 'gantt-chart'],   // arch designs
  ])('working/%s/%s → %s (CREATE/UPDATE families)', (role, task, expected) => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: role, status: 'working', task }])
    expect(useOfficeStore.getState().agents[role].behavior).toBe(expected)
  })

  it.each([
    ['dev', 'Read', 'reading-screen'],
    ['qa',  'Read', 'magnifier'],   // qa inspects
    ['res', 'Read', 'research'],    // researcher digs
    ['gate','Read', 'magnifier'],   // gate audits
  ])('working/%s/%s → %s (READ family)', (role, task, expected) => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: role, status: 'working', task }])
    expect(useOfficeStore.getState().agents[role].behavior).toBe(expected)
  })
})

describe('#A2.1: workflow phase overrides role on ambiguous tools', () => {
  beforeEach(resetStore)

  it('qa + Bash + /ship → deploy-button (workflow wins over qa-magnifier)', () => {
    setWorkflow('/ship')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'qa', status: 'working', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.qa.behavior).toBe('deploy-button')
  })

  it('dev + Bash + /test → magnifier (workflow promotes default)', () => {
    setWorkflow('/test')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('magnifier')
  })

  it('dev + Bash + /ship → deploy-button (workflow promotes default)', () => {
    setWorkflow('/ship')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('deploy-button')
  })

  it('arch + Read + /research → research (workflow > arch default)', () => {
    setWorkflow('/research')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'arch', status: 'working', task: 'Read' }])
    expect(useOfficeStore.getState().agents.arch.behavior).toBe('research')
  })

  it('dev + Write + /plan → gantt-chart (workflow > default)', () => {
    setWorkflow('/plan')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Write' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('gantt-chart')
  })

  it('workflow=null reverts to role-based selection', () => {
    setWorkflow(null)
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'ops', status: 'working', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.ops.behavior).toBe('deploy-button') // role still applies
  })
})

describe('#A2.1: status overrides win over everything', () => {
  beforeEach(resetStore)

  it('blocked status → scratch-head even for qa during /ship', () => {
    setWorkflow('/ship')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'qa', status: 'blocked', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.qa.behavior).toBe('scratch-head')
  })

  it('done status → thumbs-up even for ops during /ship', () => {
    setWorkflow('/ship')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'ops', status: 'done', task: 'Bash' }])
    expect(useOfficeStore.getState().agents.ops.behavior).toBe('thumbs-up')
  })
})

describe('#A2.1: dev role baseline unchanged from #A2 (no regression)', () => {
  beforeEach(resetStore)

  it.each([
    ['Bash', 'typing'],
    ['Read', 'reading-screen'],
    ['Grep', 'research'],
    ['Glob', 'research'],
    ['Edit', 'writing-notes'],
    ['Write', 'writing-notes'],
    ['Task', 'gantt-chart'],
    ['xyzzy', 'typing'],
  ])('dev/%s → %s', (task, expected) => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe(expected)
  })
})

describe('#A2.1: lightweight-mode roster (planner/worker/checker)', () => {
  beforeEach(resetStore)

  // These roles arent in the agentcortex roster so we need to bootstrap a dynamic
  // agent via slug~role to exercise them through store.applyExternalStatus.
  it('feat-x~checker + Bash → magnifier', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'feat-x~checker', status: 'working', task: 'Bash', session: 'feat-x' }], { source: 'multi-session' })
    expect(useOfficeStore.getState().agents['feat-x~checker']?.behavior).toBe('magnifier')
  })

  it('feat-y~planner + Write → gantt-chart', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'feat-y~planner', status: 'working', task: 'Write', session: 'feat-y' }], { source: 'multi-session' })
    expect(useOfficeStore.getState().agents['feat-y~planner']?.behavior).toBe('gantt-chart')
  })

  it('feat-z~worker + Bash → typing (worker is generalist like dev)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'feat-z~worker', status: 'working', task: 'Bash', session: 'feat-z' }], { source: 'multi-session' })
    expect(useOfficeStore.getState().agents['feat-z~worker']?.behavior).toBe('typing')
  })
})

describe('#A2.1: real Claude/Codex scenarios', () => {
  beforeEach(resetStore)

  it('Shipping: ops runs git push during /ship → deploy-button', () => {
    setWorkflow('/ship')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'ops', status: 'working', task: 'Bash', label: 'git push' }])
    expect(useOfficeStore.getState().agents.ops.behavior).toBe('deploy-button')
  })

  it('Testing: dev runs npm test during /test → magnifier', () => {
    setWorkflow('/test')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Bash', label: 'npm test' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('magnifier')
  })

  it('Research: arch greps codebase during /research → research', () => {
    setWorkflow('/research')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'arch', status: 'working', task: 'Grep', label: 'symbol search' }])
    expect(useOfficeStore.getState().agents.arch.behavior).toBe('research')
  })

  it('Planning: pm writes spec during /plan → gantt-chart', () => {
    setWorkflow('/plan')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'pm', status: 'working', task: 'Write', label: 'spec.md' }])
    expect(useOfficeStore.getState().agents.pm.behavior).toBe('gantt-chart')
  })

  it('Designer edits CSS without any workflow → whiteboard', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'designer', status: 'working', task: 'Edit', label: 'styles.css' }])
    expect(useOfficeStore.getState().agents.designer.behavior).toBe('whiteboard')
  })

  it('Gate audits auth flow during /review → magnifier (workflow override beats gate role default)', () => {
    setWorkflow('/review')
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'gate', status: 'working', task: 'Read', label: 'auth.js' }])
    expect(useOfficeStore.getState().agents.gate.behavior).toBe('magnifier')
  })
})
