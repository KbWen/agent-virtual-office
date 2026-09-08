/**
 * codexHookContractParity.test.js
 *
 * `public/hooks/office-status-codex.js` is a standalone CommonJS script: users copy it out
 * of the package and run it with bare `node`, so it cannot `require` the canonical
 * `src/utils/statusContract.mjs` (ESM). It therefore MIRRORS the transport contract, and a
 * mirror with no guard drifts -- which is exactly what happened: the hook was still on the
 * pre-AVO-101 four-status list, so `normalizeAgent()` DROPPED every `planning` and
 * `awaiting-approval` agent, `activeCount` under-counted them, and the reasonCode /
 * activeFile / skill carry fields were stripped (a Codex-driven blocked agent silently lost
 * its blocked-reason badge).
 *
 * This suite pins the mirror to the canonical module so the next contract change fails here
 * instead of silently degrading Codex sessions.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import {
  VALID_ROLES, VALID_STATUSES, VALID_MOODS, BLOCKED_REASONS, AGENT_CARRY_FIELDS, normalizePost,
} from '../src/utils/statusContract.mjs'

const require = createRequire(import.meta.url)
const hook = require('../public/hooks/office-status-codex.js')

describe('codex hook mirrors the canonical transport contract', () => {
  it.each([
    ['VALID_ROLES', VALID_ROLES],
    ['VALID_STATUSES', VALID_STATUSES],
    ['VALID_MOODS', VALID_MOODS],
    ['BLOCKED_REASONS', BLOCKED_REASONS],
    ['AGENT_CARRY_FIELDS', AGENT_CARRY_FIELDS],
  ])('%s is identical to statusContract.mjs', (name, canonical) => {
    expect(hook[name]).toEqual([...canonical])
  })

  it('isActiveStatus agrees with the canonical activeCount for every valid status', () => {
    // Derive the canonical answer from normalizePost rather than restating it: a single-agent
    // payload's activeCount IS countActive() for that status.
    for (const status of VALID_STATUSES) {
      const canonicalActive = normalizePost({ type: 'office-status', agents: [{ role: 'dev', status }] }).activeCount === 1
      expect(hook.isActiveStatus(status), `status "${status}"`).toBe(canonicalActive)
    }
  })
})

describe('codex hook accepts the statuses the contract defines', () => {
  it.each(['planning', 'awaiting-approval'])('keeps a "%s" agent instead of dropping it', (status) => {
    const out = hook.normalizeCodexStatusPayload({
      type: 'office-status',
      agents: [{ role: 'dev', status }],
    })
    expect(out.agents).toHaveLength(1)
    expect(out.agents[0].status).toBe(status)
    expect(out.activeCount).toBe(1)
  })

  it('counts planning and awaiting-approval as active alongside working and blocked', () => {
    const out = hook.normalizeCodexStatusPayload({
      type: 'office-status',
      agents: [
        { role: 'dev', status: 'working' },
        { role: 'qa', status: 'blocked' },
        { role: 'pm', status: 'planning' },
        { role: 'gate', status: 'awaiting-approval' },
        { role: 'ops', status: 'idle' },
        { role: 'res', status: 'done' },
      ],
    })
    expect(out.activeCount).toBe(4)
  })

  it('accepts "planning" as a shorthand status rather than treating it as a task name', () => {
    const out = hook.normalizeCodexStatusPayload({ dev: 'planning' })
    expect(out.agents[0]).toMatchObject({ role: 'dev', status: 'planning', task: null })
  })
})

describe('codex hook preserves every carry field', () => {
  it('carries reasonCode / activeFile / skill through the full-format path', () => {
    const out = hook.normalizeCodexStatusPayload({
      type: 'office-status',
      agents: [{
        role: 'dev', status: 'blocked', task: 'Bash', label: 'npm test',
        hint: 'error', reasonCode: 'test-run-failed', activeFile: 'src/app.js', skill: 'implement',
      }],
    })
    expect(out.agents[0]).toMatchObject({
      task: 'Bash', label: 'npm test', hint: 'error',
      reasonCode: 'test-run-failed', activeFile: 'src/app.js', skill: 'implement',
    })
  })

  it('enum-validates reasonCode instead of passing an arbitrary string to the badge', () => {
    const out = hook.normalizeCodexStatusPayload({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'blocked', reasonCode: 'not-a-real-code' }],
    })
    expect(out.agents[0].reasonCode).toBeNull()
  })

  it('never broadcasts one shorthand activeFile across multiple roles (AVO-183b)', () => {
    const single = hook.normalizeCodexStatusPayload({ dev: 'working', activeFile: 'src/app.js' })
    expect(single.agents[0].activeFile).toBe('src/app.js')

    const pair = hook.normalizeCodexStatusPayload({ dev: 'working', qa: 'working', activeFile: 'src/app.js' })
    expect(pair.agents.map((a) => a.activeFile)).toEqual([null, null])
  })
})
