import { describe, it, expect } from 'vitest'
import { routeTaskToAgent, routeExternalAgents, distributeFallbackCount } from '../src/inference/agentRouter.js'

describe('routeTaskToAgent', () => {
  it('returns null for null/empty input', () => {
    expect(routeTaskToAgent(null)).toBeNull()
    expect(routeTaskToAgent('')).toBeNull()
  })

  it('maps legacy slash commands exactly', () => {
    expect(routeTaskToAgent('/plan')).toBe('pm')
    expect(routeTaskToAgent('/implement')).toBe('dev')
    expect(routeTaskToAgent('/test')).toBe('qa')
    expect(routeTaskToAgent('/review')).toBe('qa')
    expect(routeTaskToAgent('/ship')).toBe('ops')
    expect(routeTaskToAgent('/research')).toBe('res')
    expect(routeTaskToAgent('/bootstrap')).toBe('pm')
    expect(routeTaskToAgent('/brainstorm')).toBe('arch')
    expect(routeTaskToAgent('/decide')).toBe('arch')
    expect(routeTaskToAgent('/handoff')).toBe('ops')
  })

  it('matches pm keywords', () => {
    expect(routeTaskToAgent('create a sprint plan')).toBe('pm')
    expect(routeTaskToAgent('update the product roadmap')).toBe('pm')
    expect(routeTaskToAgent('manage backlog grooming')).toBe('pm')
  })

  it('matches arch keywords', () => {
    expect(routeTaskToAgent('system design for the auth module')).toBe('arch')
    expect(routeTaskToAgent('draw an architecture diagram')).toBe('arch')
    expect(routeTaskToAgent('define the database schema')).toBe('arch')
  })

  it('matches dev keywords', () => {
    expect(routeTaskToAgent('implement the login feature')).toBe('dev')
    expect(routeTaskToAgent('refactor the payment module')).toBe('dev')
    expect(routeTaskToAgent('fix the null pointer bug')).toBe('dev')
  })

  it('matches qa keywords', () => {
    expect(routeTaskToAgent('validate and verify test coverage quality')).toBe('qa') // 5 qa keywords
    expect(routeTaskToAgent('validate the API response')).toBe('qa')
    expect(routeTaskToAgent('check test coverage')).toBe('qa')
  })

  it('matches ops keywords', () => {
    expect(routeTaskToAgent('deploy to production')).toBe('ops')
    expect(routeTaskToAgent('set up CI/CD pipeline')).toBe('ops')
    expect(routeTaskToAgent('publish the docker image')).toBe('ops')
  })

  it('matches res keywords', () => {
    expect(routeTaskToAgent('research best practices for caching')).toBe('res')
    expect(routeTaskToAgent('explore alternative approaches')).toBe('res')
    expect(routeTaskToAgent('investigate and analyze findings')).toBe('res') // investigate+analyze=2
  })

  it('matches gate keywords', () => {
    expect(routeTaskToAgent('security audit of the API')).toBe('gate')            // security+audit=2
    expect(routeTaskToAgent('compliance policy and guard checks')).toBe('gate')   // compliance+policy+guard=3
    expect(routeTaskToAgent('grant permission and approve access')).toBe('gate')  // permission+approve=2
  })

  it('matches gate for auth as a word or word-prefix (auth, authn, authz, authentication, authorization)', () => {
    expect(routeTaskToAgent('auth token required for the endpoint')).toBe('gate')
    expect(routeTaskToAgent('authn configuration for SSO')).toBe('gate')
    expect(routeTaskToAgent('authz policy enforcement')).toBe('gate')
    expect(routeTaskToAgent('authentication required for the endpoint')).toBe('gate')
    expect(routeTaskToAgent('authorize the new role')).toBe('gate')
    expect(routeTaskToAgent('authorization flow')).toBe('gate')
  })

  it('does not match gate for "auth" embedded inside unrelated words', () => {
    // \bauth regex requires a word boundary before "auth" AND excludes author/authority
    expect(routeTaskToAgent('write the author biography')).not.toBe('gate')       // author → not gate
    expect(routeTaskToAgent('oauth setup for provider')).not.toBe('gate')         // oauth has no \b before auth
  })

  it('matches designer keywords', () => {
    expect(routeTaskToAgent('design the onboarding UI')).toBe('designer')
    expect(routeTaskToAgent('update CSS styles for dark mode')).toBe('designer')
    expect(routeTaskToAgent('review the typography and spacing')).toBe('designer')
  })

  it('breaks multi-keyword ties by FALLBACK_ORDER priority', () => {
    // "implement" → dev (score 1), "test" → qa (score 1) — FALLBACK_ORDER puts dev before qa
    // strict-greater tie-break keeps the first → dev
    expect(routeTaskToAgent('implement and test the feature')).toBe('dev')
  })

  it('returns null for unrecognized task with no matches', () => {
    expect(routeTaskToAgent('do something unrecognizable xyz123')).toBeNull()
  })

  it('returns null for non-string truthy inputs (no crash)', () => {
    expect(routeTaskToAgent(42)).toBeNull()
    expect(routeTaskToAgent({})).toBeNull()
    expect(routeTaskToAgent([])).toBeNull()
    expect(routeTaskToAgent(true)).toBeNull()
  })

  it('does not match res for words that only contain "read" as substring', () => {
    expect(routeTaskToAgent('thread the needle')).not.toBe('res')
    expect(routeTaskToAgent('already done')).not.toBe('res')
    expect(routeTaskToAgent('spread the load')).not.toBe('res')
  })

  it('matches res for "read" as a standalone word', () => {
    expect(routeTaskToAgent('read the documentation')).toBe('res')
    expect(routeTaskToAgent('read and study the codebase')).toBe('res')
  })
})

describe('routeExternalAgents', () => {
  it('returns empty array for empty input', () => {
    expect(routeExternalAgents([])).toEqual([])
    expect(routeExternalAgents(null)).toEqual([])
  })

  it('tier 1: routes by explicit role', () => {
    const result = routeExternalAgents([{ role: 'qa', status: 'working', task: 'run tests' }])
    expect(result).toHaveLength(1)
    expect(result[0].agentId).toBe('qa')
    expect(result[0].status).toBe('working')
  })

  it('tier 2: routes by keyword when no explicit role', () => {
    // "deploy and monitor" → ops scores 2 (deploy + monitor), no other role matches both
    const result = routeExternalAgents([{ task: 'deploy and monitor the release', status: 'working' }])
    expect(result).toHaveLength(1)
    expect(result[0].agentId).toBe('ops')
  })

  it('tier 3: uses fallback order when no role and no keyword match', () => {
    const result = routeExternalAgents([{ task: 'xyz-unrecognized', status: 'blocked' }])
    expect(result).toHaveLength(1)
    expect(result[0].agentId).toBe('dev') // first in FALLBACK_ORDER
  })

  it('avoids assigning two tasks to the same character', () => {
    const agents = [
      { role: 'dev', status: 'working', task: 'implement auth' },
      { role: 'dev', status: 'blocked', task: 'implement payments' },
    ]
    const result = routeExternalAgents(agents)
    expect(result).toHaveLength(2)
    const ids = result.map(r => r.agentId)
    expect(new Set(ids).size).toBe(2) // no duplicates
    expect(ids[0]).toBe('dev')
    expect(ids[1]).not.toBe('dev') // second falls through to next available
  })

  it('passes through status, task, label, hint, session', () => {
    const result = routeExternalAgents([{
      role: 'pm', status: 'blocked', task: 'write spec',
      label: 'Stuck on AC', hint: 'needs input', session: 'feat-xyz'
    }])
    expect(result[0]).toMatchObject({
      agentId: 'pm',
      status: 'blocked',
      task: 'write spec',
      label: 'Stuck on AC',
      hint: 'needs input',
      session: 'feat-xyz',
    })
  })

  it('defaults missing status to "working"', () => {
    const result = routeExternalAgents([{ role: 'arch' }])
    expect(result[0].status).toBe('working')
  })

  it('handles multiple agents with mixed tier routing', () => {
    const agents = [
      { role: 'pm', status: 'working' },
      { task: 'validate and verify test coverage quality', status: 'working' },  // keyword → qa (validate+verify+test+coverage+quality = 5)
      { task: 'unrecognized-abc', status: 'blocked' },  // fallback
    ]
    const result = routeExternalAgents(agents)
    expect(result).toHaveLength(3)
    expect(result[0].agentId).toBe('pm')
    expect(result[1].agentId).toBe('qa')
    // third gets first available fallback that isn't pm or qa
    expect(['dev', 'ops', 'arch', 'res', 'designer', 'gate']).toContain(result[2].agentId)
  })

  it('can route all 8 roles without collision', () => {
    const agents = [
      { role: 'pm' }, { role: 'arch' }, { role: 'dev' }, { role: 'qa' },
      { role: 'ops' }, { role: 'res' }, { role: 'gate' }, { role: 'designer' },
    ]
    const result = routeExternalAgents(agents)
    expect(result).toHaveLength(8)
    const ids = result.map(r => r.agentId)
    expect(new Set(ids).size).toBe(8)
  })

  it('silently skips null/non-object entries without crashing', () => {
    const result = routeExternalAgents([null, undefined, 42, { role: 'dev', status: 'working' }])
    expect(result).toHaveLength(1)
    expect(result[0].agentId).toBe('dev')
  })

  it('tier 1: rejects role not in FALLBACK_ORDER, falls through to tier 2/3', () => {
    const result = routeExternalAgents([{ role: 'hacker', task: 'xyz', status: 'working' }])
    expect(result).toHaveLength(1)
    expect(result[0].agentId).not.toBe('hacker')
    expect(result[0].agentId).toBe('dev')  // tier 3 fallback (no keyword match)
  })

  it('tier 1: rejects __proto__ role injection', () => {
    const result = routeExternalAgents([{ role: '__proto__', status: 'working' }])
    expect(result[0].agentId).not.toBe('__proto__')
    expect(['dev', 'qa', 'pm', 'ops', 'arch', 'res', 'designer', 'gate']).toContain(result[0].agentId)
  })
})

describe('distributeFallbackCount', () => {
  it('returns empty array for count 0', () => {
    expect(distributeFallbackCount(0)).toEqual([])
  })

  it('returns first N agents from fallback order', () => {
    expect(distributeFallbackCount(1)).toEqual(['dev'])
    expect(distributeFallbackCount(3)).toEqual(['dev', 'qa', 'pm'])
  })

  it('clamps to maximum available agents (8)', () => {
    const result = distributeFallbackCount(100)
    expect(result).toHaveLength(8)
  })

  it('clamps negative count to 0', () => {
    expect(distributeFallbackCount(-5)).toEqual([])
  })

  it('returns stable order across calls', () => {
    expect(distributeFallbackCount(4)).toEqual(distributeFallbackCount(4))
  })

  it('handles NaN count as 0', () => {
    expect(distributeFallbackCount(NaN)).toEqual([])
  })

  it('floors float inputs', () => {
    expect(distributeFallbackCount(2.9)).toEqual(['dev', 'qa'])
  })
})
