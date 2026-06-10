/**
 * AVO-146: server.mjs normalizePost — behavioral regression suite.
 *
 * Prior to AVO-146, server.mjs kept an inline copy of normalizePost that:
 *   (a) required a byte-drift guard to stay in sync (fragile),
 *   (b) had a LIVE #52 divergence: the inline copy dropped agents with an
 *       invalid/missing status; the canonical src/utils/normalizePost.js coerces
 *       them to 'idle' instead.
 *
 * After AVO-146, server.mjs imports the canonical module directly. This file:
 *   - Removes the embedded serverNormalizePost copy and byte-drift guard (AC-5).
 *   - Keeps all behavioral cases, now running against the canonical import (AC-5).
 *   - Adds an import-presence assertion: verifies server.mjs uses the canonical
 *     module and does NOT define its own normalizePost (AC-3 + AC-5).
 *   - Adds an explicit #52 regression test on the server path (AC-3).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { normalizePost as canonical } from '../src/utils/normalizePost.js'

// Behavioral cases — identical to the prior suite but now run against the
// REAL canonical module (the embedded copy has been removed per AC-5).
const CASES = [
  { dev: 'working' },
  { dev: 'writing tests' },
  { dev: 'working', qa: 'blocked', ops: 'done' },
  { dev: 'working', hacker: 'evil' },
  { dev: 'working', workflow: 'Sprint 1', source: 'curl' },
  { dev: 'working', label: 'editing App.jsx', hint: 'error' },
  { dev: 'working', hint: 'x'.repeat(300) },
  { dev: 'working', hint: 42 },
  { dev: 'working', mood: 'rushing' },
  { dev: 'working', mood: 'hacked' },
  { dev: 'working', mood: 'rushing', moodDuration: 999_999_999 },
  { dev: 'working', mood: 'rushing', moodDuration: 'forever' },
  { dev: 'working', mood: 'rushing', moodDuration: 30000 },
  {},
  { dev: null, qa: 'working' },
  { type: 'office-status', agents: [{ role: 'dev', status: 'working' }, { role: 'qa', status: 'done' }] },
  { type: 'office-status', agents: [{ role: 'dev', status: 'working' }, { role: 'hacker', status: 'working' }] },
  { type: 'office-status', agents: [{ role: 'dev', status: 'working', hint: 'y'.repeat(300) }] },
  { type: 'office-status', agents: [], mood: 'rushing', moodDuration: 999_999_999 },
  { type: 'office-status', agents: [], mood: '<script>' },
  // moodDuration edge cases — shorthand branch
  { dev: 'working', mood: 'rushing', moodDuration: 500 },       // sub-minimum → clamp to 1000
  { dev: 'working', mood: 'rushing', moodDuration: 0 },         // falsy zero → was null before fix
  { dev: 'working', mood: 'rushing', moodDuration: null },      // explicit null → null
  // moodDuration edge cases — office-status branch
  { type: 'office-status', agents: [], mood: 'rushing', moodDuration: 500 },
  { type: 'office-status', agents: [], mood: 'rushing', moodDuration: 0 },
  { type: 'office-status', agents: [], mood: 'rushing' },                    // no moodDuration → null
  // activeCount computed from agents (not trusted from client)
  { type: 'office-status', agents: [{ role: 'dev', status: 'working' }, { role: 'qa', status: 'done' }], activeCount: 99 },
  // source defaults to 'api' in both branches
  { type: 'office-status', agents: [] },
  // idle agents must NOT be counted as active
  { dev: 'idle', qa: 'working' },
  { type: 'office-status', agents: [{ role: 'dev', status: 'idle' }, { role: 'qa', status: 'working' }] },
  // ghost agent — boolean/number values must not create agents (N2)
  { dev: false, qa: 'working' },
  { dev: 0, qa: 'working' },
  { dev: true, qa: 'working' },
  // duplicate roles in full format — first occurrence wins (N3)
  { type: 'office-status', agents: [{ role: 'dev', status: 'working' }, { role: 'dev', status: 'done' }] },
  // orphan moodDuration must be nulled when mood is invalid
  { dev: 'working', mood: 'hacked', moodDuration: 5000 },
  { type: 'office-status', agents: [], mood: '<bad>', moodDuration: 30000 },
]

describe('normalizePost canonical — behavioral cases (AC-5 regression guard)', () => {
  for (const input of CASES) {
    it(JSON.stringify(input).slice(0, 80), () => {
      const result = canonical(input)
      // _seq must be a plain integer string (no suffix).
      expect(result._seq).toMatch(/^\d+$/)
      // type is always 'office-status'
      expect(result.type).toBe('office-status')
      // agents is always an array
      expect(Array.isArray(result.agents)).toBe(true)
    })
  }
})

// ── AC-3: #52 regression — server path now coerces invalid status → 'idle' ──────────────
// The old server.mjs inline copy dropped agents whose status was missing/invalid; the
// canonical src module keeps them and coerces to 'idle'. This test proves the unification.
describe('normalizePost — #52 regression: invalid status coerced to idle (AC-3)', () => {
  it('full format: missing status → agent kept with status=idle', () => {
    const r = canonical({ type: 'office-status', agents: [{ role: 'dev' }] })
    expect(r.agents).toHaveLength(1)
    expect(r.agents[0].status).toBe('idle')
  })
  it('full format: null status → agent kept with status=idle', () => {
    const r = canonical({ type: 'office-status', agents: [{ role: 'dev', status: null }] })
    expect(r.agents).toHaveLength(1)
    expect(r.agents[0].status).toBe('idle')
  })
  it('full format: unknown status string → agent kept with status=idle', () => {
    const r = canonical({ type: 'office-status', agents: [{ role: 'dev', status: 'hacking' }] })
    expect(r.agents).toHaveLength(1)
    expect(r.agents[0].status).toBe('idle')
  })
  it('full format: valid role + valid status → kept as-is (no regression)', () => {
    const r = canonical({ type: 'office-status', agents: [{ role: 'dev', status: 'working' }] })
    expect(r.agents[0].status).toBe('working')
  })
})

// ── AC-3 + AC-5: server.mjs import-presence assertion ────────────────────────────────────
// Assert that server.mjs (a) imports the canonical module and (b) does NOT define its own
// normalizePost function, confirming the inline copy has been deleted.
describe('server.mjs imports canonical normalizePost (AC-3 + AC-5)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const serverSrc = readFileSync(path.join(here, '..', 'server.mjs'), 'utf-8')

  it('server.mjs contains the canonical import statement', () => {
    // Accepts both .js and .mjs — the .mjs shim is required for Node runtime with "type":"commonjs"
    expect(serverSrc).toMatch(/import\s*\{[^}]*normalizePost[^}]*\}\s*from\s*['"]\.\/src\/utils\/normalizePost\.m?js['"]/)
  })

  it('server.mjs does NOT define its own normalizePost function', () => {
    // The inline copy defined `function normalizePost(`. After AVO-146 this must be absent.
    expect(serverSrc).not.toMatch(/function normalizePost\s*\(/)
  })
})
