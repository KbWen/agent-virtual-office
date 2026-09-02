import { describe, expect, it, vi } from 'vitest'
import { assessHermeticity, probeHermeticity, formatHermeticity } from '../scripts/soakHermeticity.mjs'

const response = (body, status = 200) => new Response(body, { status })
const STATUS = (roles) => JSON.stringify({
  type: 'office-status',
  agents: roles.map((role) => ({ role, status: 'working', task: 'Bash' })),
})

describe('assessHermeticity', () => {
  it('a spawned server is isolated by construction, and says BOTH isolations by name', () => {
    const v = assessHermeticity({ mode: 'spawned' })
    expect(v).toMatchObject({ isolated: true, mode: 'spawned' })
    // Naming only OFFICE_STATUS_DIR was an overclaim: the dev server's file-watcher fallback
    // manufactures status from edits to the project itself regardless of where the status dir
    // points. A reader must not be able to mistake one isolation for hermeticity.
    expect(v.reason).toMatch(/OFFICE_STATUS_DIR/)
    expect(v.reason).toMatch(/file-watcher/)
  })

  it('a reused server serving no status is isolated', () => {
    expect(assessHermeticity({ mode: 'reused', statusBody: 'null' })).toMatchObject({ isolated: true })
    expect(assessHermeticity({ mode: 'reused', statusBody: '   ' })).toMatchObject({ isolated: true })
  })

  it('a reused server serving live agent status is NOT isolated, and names who', () => {
    const v = assessHermeticity({ mode: 'reused', statusBody: STATUS(['dev', 'qa']) })
    expect(v.isolated).toBe(false)
    expect(v.reason).toContain('dev')
    expect(v.reason).toContain('qa')
  })

  it('an UNVERIFIABLE answer counts as not isolated — the whole point is not claiming a clean run', () => {
    const v = assessHermeticity({ mode: 'reused', statusBody: '', probeError: 'HTTP 500' })
    expect(v.isolated).toBe(false)
    expect(v.reason).toContain('HTTP 500')
  })

  it('a non-JSON body still counts as serving something', () => {
    // Parsing must not be the thing that decides: an unparseable body is still not "no status".
    expect(assessHermeticity({ mode: 'reused', statusBody: '<html>nope</html>' })).toMatchObject({ isolated: false })
  })
})

describe('probeHermeticity', () => {
  it('queries /api/status on the reused origin', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response('null'))
    const v = await probeHermeticity('http://localhost:5173/', { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:5173/api/status', expect.any(Object))
    expect(v).toMatchObject({ mode: 'reused', isolated: true })
  })

  it('a contaminated reused server is reported, not silently accepted', async () => {
    const v = await probeHermeticity('http://localhost:5173', {
      fetchImpl: vi.fn().mockResolvedValue(response(STATUS(['ops']))),
    })
    expect(v.isolated).toBe(false)
    expect(v.reason).toContain('ops')
  })

  it('a network failure is not read as a clean run', async () => {
    const v = await probeHermeticity('http://localhost:5173', {
      fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    })
    expect(v.isolated).toBe(false)
  })

  it('a non-200 is not read as a clean run', async () => {
    const v = await probeHermeticity('http://localhost:5173', {
      fetchImpl: vi.fn().mockResolvedValue(response('', 503)),
    })
    expect(v).toMatchObject({ isolated: false })
    expect(v.reason).toContain('503')
  })
})

describe('formatHermeticity', () => {
  it('states the verdict and the reason on one line', () => {
    expect(formatHermeticity({ isolated: true, reason: 'because' })).toBe('sim-soak hermeticity: ISOLATED — because')
    expect(formatHermeticity({ isolated: false, reason: 'nope' })).toBe('sim-soak hermeticity: NOT ISOLATED — nope')
  })
})
