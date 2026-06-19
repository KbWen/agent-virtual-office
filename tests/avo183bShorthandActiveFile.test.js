import { describe, it, expect } from 'vitest'
import { normalizePost } from '../src/utils/statusContract.mjs'

// AVO-183b — the shorthand POST format ({ pm: 'working', dev: 'working', activeFile: 'x.js' }) reads
// carry fields from the TOP-LEVEL body for EVERY role. `activeFile` is a per-agent concept that drives
// the pair-huddle co-editing overlay (findSharedFilePair): broadcasting one top-level activeFile to
// multiple roles makes them all "share" a file and FABRICATES a co-editing relationship that no real
// signal supports. A single-role shorthand may carry activeFile (one agent, no false pair); multi-role
// must not. (label/hint/reasonCode broadcasting is benign — they assert nothing cross-agent.)
describe('AVO-183b shorthand POST does not broadcast activeFile across multiple roles', () => {
  it('a 2-role shorthand + top-level activeFile never makes BOTH agents share the file', () => {
    const msg = normalizePost({ pm: 'working', dev: 'working', activeFile: 'src/foo.js' })
    const sharing = msg.agents.filter((a) => a.activeFile === 'src/foo.js')
    expect(sharing.length).toBeLessThanOrEqual(1)  // ≤1 → no fabricated co-edit pair
  })

  it('a single-role shorthand may still carry activeFile (one agent, no false pair)', () => {
    const msg = normalizePost({ dev: 'working', activeFile: 'src/foo.js' })
    expect(msg.agents).toHaveLength(1)
    expect(msg.agents[0].activeFile).toBe('src/foo.js')
  })

  it('full (per-agent) format is unaffected — each agent keeps its own activeFile', () => {
    const msg = normalizePost({ type: 'office-status', agents: [
      { role: 'dev', status: 'working', activeFile: 'a.js' },
      { role: 'qa', status: 'working', activeFile: 'b.js' },
    ] })
    const dev = msg.agents.find((a) => a.role === 'dev')
    const qa = msg.agents.find((a) => a.role === 'qa')
    expect(dev.activeFile).toBe('a.js')
    expect(qa.activeFile).toBe('b.js')
  })
})
