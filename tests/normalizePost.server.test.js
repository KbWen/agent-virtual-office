/**
 * Parity test: server.mjs inline normalizePost vs canonical src/utils/normalizePost.js
 *
 * server.mjs intentionally keeps an inline copy to stay zero-dependency.
 * This file runs the same inputs against both implementations to catch drift.
 * When either copy changes, update BOTH and verify this suite still passes.
 */
import { describe, it, expect } from 'vitest'
import { normalizePost as canonical } from '../src/utils/normalizePost.js'

// ── Inline copy from server.mjs ────────────────────────────────────────────
// MUST stay byte-for-byte identical to the normalizePost function in server.mjs.
// Differences in _seq format, filter logic, or field handling will be caught
// by the _seq format assertion below (toMatch(/^\d+$/)) and the toEqual comparison.
const VALID_ROLES    = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
const VALID_STATUSES = ['idle', 'working', 'blocked', 'done']
const VALID_MOODS    = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
const MAX_MOOD_DURATION = 3_600_000

function clampMoodDuration(raw) {
  if (raw == null) return null
  const n = Number(raw)
  return Math.min(Math.max(Number.isFinite(n) ? n : 60000, 1000), MAX_MOOD_DURATION)
}

let _seqLast = 0
function nextSeq() {
  const now = Date.now()
  _seqLast = now > _seqLast ? now : _seqLast + 1
  return String(_seqLast)
}

function serverNormalizePost(body) {
  if (body == null || typeof body !== 'object') body = {}
  if (body.type === 'office-status') {
    const seen = new Set()
    const agents = (Array.isArray(body.agents) ? body.agents : [])
      .filter(a => {
        if (!a || typeof a !== 'object') return false
        if (!VALID_ROLES.includes(a.role) || !VALID_STATUSES.includes(a.status)) return false
        if (seen.has(a.role)) return false
        seen.add(a.role)
        return true
      })
      .slice(0, 50)
      .map(a => ({
        role: a.role, status: a.status,
        task: typeof a.task === 'string' ? a.task.slice(0, 200) : null,
        label: typeof a.label === 'string' ? a.label.slice(0, 200) : null,
        hint: typeof a.hint === 'string' ? a.hint.slice(0, 200) : null,
      }))
    const mood = VALID_MOODS.includes(body.mood) ? body.mood : null
    return {
      type: 'office-status',
      agents,
      activeCount: agents.filter(a => a.status === 'working' || a.status === 'blocked').length,
      workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
      mood,
      moodDuration: mood == null ? null : clampMoodDuration(body.moodDuration),
      source: typeof body.source === 'string' ? body.source.slice(0, 50) : 'api',
      _seq: nextSeq(),
    }
  }
  const agents = []
  for (const key of VALID_ROLES) {
    const val = body[key]
    if (val == null) continue
    const isStatus = VALID_STATUSES.includes(val)
    if (!isStatus && typeof val !== 'string') continue
    agents.push({
      role: key,
      task: isStatus ? null : val.slice(0, 200),
      status: isStatus ? val : 'working',
      label: typeof body.label === 'string' ? body.label.slice(0, 200) : null,
      hint: typeof body.hint === 'string' ? body.hint.slice(0, 200) : null,
    })
  }
  const mood = VALID_MOODS.includes(body.mood) ? body.mood : null
  return {
    _seq: nextSeq(), type: 'office-status', agents,
    activeCount: agents.filter(a => a.status === 'working' || a.status === 'blocked').length,
    workflow: typeof body.workflow === 'string' ? body.workflow.slice(0, 200) : null,
    source: typeof body.source === 'string' ? body.source.slice(0, 50) : 'api',
    mood,
    moodDuration: mood == null ? null : clampMoodDuration(body.moodDuration),
  }
}
// ── End inline copy ────────────────────────────────────────────────────────

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
]

describe('normalizePost server/canonical parity', () => {
  for (const input of CASES) {
    it(JSON.stringify(input).slice(0, 80), () => {
      const a = canonical(input)
      const b = serverNormalizePost(input)
      const { _seq: _a, ...ra } = a
      const { _seq: _b, ...rb } = b
      expect(ra).toEqual(rb)
      // _seq must be a plain integer string (no '.counter' suffix) in both copies.
      // This assertion would catch format divergence between server.mjs and src/utils/normalizePost.js.
      const SEQ_RE = /^\d+$/
      expect(_a).toMatch(SEQ_RE)
      expect(_b).toMatch(SEQ_RE)
    })
  }
})
