/**
 * #A2 — integration tests verifying classifier wiring through real store.
 *
 * Confirms:
 *   1. Existing built-in tools (Bash/Read/Grep/Glob) get IDENTICAL behavior
 *      to pre-#A2 (regression safety).
 *   2. NEW MCP / verb-classified / unknown tasks get classifier-derived
 *      behavior instead of the static 'typing' fallback.
 *   3. blocked/done statuses STILL override task-based behavior
 *      (scratch-head / thumbs-up regardless of task).
 *   4. moodToWeather delegation produces byte-identical output to the
 *      pre-delegation switch for all 7 documented moods.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'
import { moodToWeather } from '../src/components/TopDownFurniture.jsx'
import { classifyMood } from '../src/systems/classify.js'

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

describe('#A2 regression: existing built-in tasks keep their pre-#A2 behavior', () => {
  beforeEach(resetStore)

  it.each([
    ['Bash', 'typing'],
    ['Read', 'reading-screen'],
    ['Grep', 'research'],
    ['Glob', 'research'],
  ])('working/%s → behavior=%s (matches STATUS_BEHAVIOR_MAP exactly)', (task, expectedBehavior) => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task }])
    const dev = useOfficeStore.getState().agents.dev
    expect(dev.behavior).toBe(expectedBehavior)
  })
})

describe('#A2 new capability: classifier-derived behavior for non-built-in tasks', () => {
  beforeEach(resetStore)

  it('working/Edit → writing-notes (Tier 0 UPDATE family)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Edit' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('writing-notes')
  })

  it('working/Write → writing-notes (Tier 0 CREATE family)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Write' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('writing-notes')
  })

  it('working/Task → gantt-chart (Tier 0 DISPATCH — subagent dispatch)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'Task' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('gantt-chart')
  })

  it('working/WebSearch → research (Tier 0 SEARCH)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'WebSearch' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('research')
  })

  it('working/mcp__notion__create_page → typing (Tier 4 EXTERNAL default)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'mcp__notion__create_page' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('typing')
  })

  it('working/readConfig → reading-screen (Tier 3 verb)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'readConfig' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('reading-screen')
  })

  it('working/searchIndex → research (Tier 3 verb)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'searchIndex' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('research')
  })

  it('working/authenticate → shield-verify (Tier 3 AUTH — gate aesthetic)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'authenticate' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('shield-verify')
  })

  it('working/dispatchJob → gantt-chart (Tier 3 DISPATCH)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'dispatchJob' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('gantt-chart')
  })

  it('working/sendEmail → chat (Tier 3 COMMUNICATE)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'sendEmail' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('chat')
  })

  it('working/xyzzy → typing (Tier 5 unknown — safe default)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working', task: 'xyzzy' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('typing')
  })

  it('working with no task → typing (Tier 5 empty unknown)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working' }]) // no task field
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('typing')
  })
})

describe('#A2 status overrides: blocked / done ignore task-based behavior', () => {
  beforeEach(resetStore)

  it('blocked status → scratch-head regardless of task (was Edit but blocked)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'blocked', task: 'Edit' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('scratch-head')
  })

  it('done status → thumbs-up regardless of task (was searchIndex but done)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'done', task: 'searchIndex' }])
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('thumbs-up')
  })
})

describe('#A2 moodToWeather delegation: byte-identical for all documented moods', () => {
  it.each([
    'normal', 'smooth', 'intense', 'idle', 'rushing', 'frustrated', 'stuck',
  ])('mood=%s: moodToWeather matches classifyMood().family', (mood) => {
    expect(moodToWeather(mood)).toBe(classifyMood(mood).family)
  })

  it.each([
    ['normal',     'clear'],
    ['smooth',     'clear'],
    ['intense',    'clear'],
    ['idle',       'clear'],
    ['rushing',    'cloudy'],
    ['frustrated', 'rain'],
    ['stuck',      'thunderstorm'],
  ])('mood=%s → weather=%s (no regression vs pre-delegation switch)', (mood, weather) => {
    expect(moodToWeather(mood)).toBe(weather)
  })

  it('unknown mood → clear (conservative — preserved across delegation)', () => {
    expect(moodToWeather('delegating')).toBe('clear')
    expect(moodToWeather('mystery-mood')).toBe('clear')
    expect(moodToWeather(null)).toBe('clear')
    expect(moodToWeather(undefined)).toBe('clear')
  })
})
