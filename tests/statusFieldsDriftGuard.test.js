/**
 * AVO-146 — statusFields drift guard + AC-6 field-survival end-to-end test.
 *
 * (a) Hook drift guard (AC-4):
 *     The hook (public/hooks/office-status-hook.js) is a standalone CJS file that cannot
 *     import AGENT_CARRY_FIELDS. This test reads the hook source and asserts that every
 *     field in AGENT_CARRY_FIELDS appears in BOTH hook whitelist sites:
 *       SITE 1 — payload-build object literal (~lines 948-961, anchor: `// Replace agent with same role`)
 *       SITE 2 — merge re-map  object literal (~lines 900-916, anchor: `// AVO-106: carry the OTHER agents`)
 *     Failure message names the missing field AND the missing site. The hook itself is unchanged.
 *
 * (b) AC-6 field-survival end-to-end:
 *     For EVERY field in AGENT_CARRY_FIELDS, push a synthetic value through:
 *       normalizePost (POST /api/status ingest shape) →
 *       normalizeStatusMessage / sanitizeAgent (in-browser channel) →
 *       routeExternalAgents →
 *       store applyExternalStatus
 *     and assert the value lands in store.getState().externalStatus[agentId].
 *     Looping over AGENT_CARRY_FIELDS means a future field addition is automatically covered —
 *     a silent drop anywhere in the chain fails this test by construction.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { AGENT_CARRY_FIELDS, FIELD_SANITIZERS } from '../src/utils/statusFields.js'
import { normalizePost } from '../src/utils/normalizePost.js'
import {
  normalizePost as normalizePostMjs,
  AGENT_CARRY_FIELDS as MJS_CARRY_FIELDS,
  FIELD_SANITIZERS as MJS_FIELD_SANITIZERS,
} from '../src/utils/normalizePost.mjs'
import { BLOCKED_REASONS, BLOCKED_REASON_TABLE_CODES } from '../src/systems/classify.js'
import { BLOCKED_REASONS as MJS_BLOCKED_REASONS } from '../src/utils/normalizePost.mjs'
import { normalizeStatusMessage } from '../src/inference/inferStatus.js'
import { routeExternalAgents } from '../src/inference/agentRouter.js'
import { useOfficeStore } from '../src/systems/store.js'

// ── (a) Hook drift guard ────────────────────────────────────────────────────

describe('AGENT_CARRY_FIELDS — hook drift guard (AC-4)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const hookSrc = readFileSync(
    path.join(here, '..', 'public', 'hooks', 'office-status-hook.js'),
    'utf-8',
  )

  // Extract the payload-build site starting from anchor, taking up to maxLen chars.
  function extractSite(anchor, maxLen = 1000) {
    const idx = hookSrc.indexOf(anchor)
    if (idx === -1) throw new Error(`Hook source: anchor not found: "${anchor}"`)
    return hookSrc.slice(idx, idx + maxLen)
  }

  // SITE 1: The newAgents array literal — contains the per-event agent object with
  // task/label/hint/reasonCode/activeFile. Anchor: the `const newAgents = [` declaration.
  const PAYLOAD_BUILD_ANCHOR = 'const newAgents = ['
  // SITE 2: The .map() that re-carries OTHER agents' fields when reading from disk.
  // Anchor: the assignment that builds the existing-agents array from the JSON file.
  const MERGE_REMAP_ANCHOR   = "existing = Array.isArray(data.agents)"

  for (const field of AGENT_CARRY_FIELDS) {
    it(`field "${field}" appears in SITE 1 (payload-build)`, () => {
      const site1 = extractSite(PAYLOAD_BUILD_ANCHOR)
      // The field must appear as an object key (bare word followed by colon or `[field]` lookup).
      const present = site1.includes(`${field}:`) || site1.includes(`['${field}']`) || site1.includes(`["${field}"]`)
      expect(present, `field "${field}" missing from SITE 1 (payload-build ~line 948). Update the hook's newAgents literal.`).toBe(true)
    })

    it(`field "${field}" appears in SITE 2 (merge re-map)`, () => {
      const site2 = extractSite(MERGE_REMAP_ANCHOR)
      const present = site2.includes(`${field}:`) || site2.includes(`['${field}']`) || site2.includes(`["${field}"]`)
      expect(present, `field "${field}" missing from SITE 2 (merge re-map ~line 900). Update the hook's existing-agents map.`).toBe(true)
    })
  }
})

// ── (b) AC-6: field-survival end-to-end ────────────────────────────────────
// For each carry field, send a synthetic value through the full pipeline and assert
// it lands in the store. This loop auto-covers future fields added to AGENT_CARRY_FIELDS.

// Synthetic test values per field — chosen to be valid for each sanitizer and
// distinct enough to confirm the right field is being tested.
const SYNTHETIC = {
  task:       'synthetic-task-value',
  label:      'synthetic-label-value',
  hint:       'synthetic-hint-value',
  reasonCode: 'test-run-failed',   // must be a valid BLOCKED_REASONS member
  activeFile:  '/synthetic/active/file.js',
  skill:      'review',            // AVO-104: raw skill name
}

// ── (c) Single-source wiring guard (#122) ───────────────────────────────────
// Before #122, src/utils/normalizePost.mjs INLINED a second copy of every constant +
// sanitizer + the normalizePost logic, and these tests proved the two copies matched.
// #122 eliminated the mirror: both the canonical `.js` side and the bare-Node `.mjs` side
// now re-export the SINGLE source of truth, src/utils/statusContract.mjs. These checks are
// retained as a regression guard — they catch any future re-introduction of a divergent
// copy (they pass trivially while the single-source wiring holds, and fail loudly if the
// .mjs and .js exports ever stop resolving to the same contract).

describe('transport contract — single-source wiring guard (#122)', () => {
  it('.mjs and canonical AGENT_CARRY_FIELDS resolve to the same list', () => {
    expect(MJS_CARRY_FIELDS).toEqual(AGENT_CARRY_FIELDS)
  })

  it('.mjs and canonical FIELD_SANITIZERS behave identically (probe table)', () => {
    const probes = [
      'plain-string', '', 'x'.repeat(300), 42, null, undefined, {}, [],
      'test-run-failed', 'build-failed', 'deps-failed', 'blocked-unknown', 'not-a-reason',
      // AVO-148: 3 new structured-event tokens must be accepted by the sanitizer
      'permission-denied', 'api-rate-limit', 'api-auth-failed',
    ]
    for (const field of AGENT_CARRY_FIELDS) {
      for (const probe of probes) {
        expect(
          MJS_FIELD_SANITIZERS[field](probe),
          `sanitizer drift for field "${field}" on probe ${JSON.stringify(typeof probe === 'string' && probe.length > 20 ? probe.slice(0, 20) + '…' : probe)}`,
        ).toEqual(FIELD_SANITIZERS[field](probe))
      }
    }
  })

  // Behavioral parity: representative payloads through BOTH implementations must
  // deep-equal (minus the _seq timestamp). Covers role/status/mood/workflow/source
  // semantics — any future drift in EITHER copy fails here.
  const PARITY_PAYLOADS = [
    // full format, valid agent with every carry field
    { type: 'office-status', agents: [{ role: 'dev', status: 'blocked', task: 't', label: 'l', hint: 'h', reasonCode: 'test-run-failed', activeFile: '/a/b.js' }] },
    // full format, invalid status → #52 coerce-to-idle (the divergence this PR fixed)
    { type: 'office-status', agents: [{ role: 'qa', status: 'exploded', task: 'x' }] },
    // full format, invalid role → dropped; duplicate role → first wins
    { type: 'office-status', agents: [{ role: 'nope', status: 'working' }, { role: 'dev', status: 'working' }, { role: 'dev', status: 'done' }] },
    // full format with mood + duration clamp + long workflow
    { type: 'office-status', agents: [], mood: 'rushing', moodDuration: 99999999, workflow: 'w'.repeat(300) },
    // AVO-148: new structured-event tokens survive both normalizers
    { type: 'office-status', agents: [{ role: 'dev', status: 'blocked', reasonCode: 'permission-denied' }] },
    { type: 'office-status', agents: [{ role: 'ops', status: 'blocked', reasonCode: 'api-rate-limit'    }] },
    { type: 'office-status', agents: [{ role: 'qa',  status: 'blocked', reasonCode: 'api-auth-failed'  }] },
    // shorthand: status value, task value, with top-level carry fields
    { dev: 'working', qa: 'running the tests', reasonCode: 'build-failed', activeFile: '/c/d.js', hint: 'hh' },
    // shorthand: invalid mood ignored, non-string role value skipped
    { dev: 42, ops: 'done', mood: 'bogus' },
    // junk
    {}, null, { type: 'office-status', agents: 'not-an-array' },
  ]

  // The .mjs and classify.js BLOCKED_REASONS resolve to the same contract list (was: mirror
  // equality; now: single-source wiring). AVO-148 H2 gate retained.
  it('.mjs and classify.js BLOCKED_REASONS resolve to the same list', () => {
    expect(MJS_BLOCKED_REASONS).toEqual(BLOCKED_REASONS)
  })

  // #122 — the ONE real drift point that remains: the rich presentation table in classify.js
  // (iconId/hue/a11y) lives separately from the contract's code list, so its key set MUST equal
  // the contract codes, IN ORDER. A code in the contract but missing from the table would make
  // classifyBlockedReason fall back to 'blocked-unknown' metadata (wrong icon); an extra table
  // entry would be a dead reason normalizePost rejects. Either way this guard fails loudly.
  it('classify.js presentation table covers exactly the contract codes, in order (#122)', () => {
    expect(BLOCKED_REASON_TABLE_CODES).toEqual([...BLOCKED_REASONS])
  })

  it('normalizePost behaves identically via the .js and .mjs entry points', () => {
    for (const payload of PARITY_PAYLOADS) {
      const a = normalizePost(payload ? JSON.parse(JSON.stringify(payload)) : payload)
      const b = normalizePostMjs(payload ? JSON.parse(JSON.stringify(payload)) : payload)
      delete a._seq
      delete b._seq
      expect(b, `behavior drift for payload ${JSON.stringify(payload)?.slice(0, 80)}`).toEqual(a)
    }
  })

  // #122 AC-2 — the whole reason the .mjs exists: package.json "type":"commonjs" makes the ESM
  // `.js` sources unloadable by BARE Node, so server.mjs imports the `.mjs`. This spawns a real
  // `node` (NOT vitest's Vite runtime) and imports the normalizePost.mjs → statusContract.mjs
  // chain, then runs normalizePost. A regression that makes the .mjs depend on a `.js` source
  // (re-introducing the transpile requirement) fails HERE, not in production.
  it('normalizePost.mjs loads + runs under bare Node — no Vite/transpile (AC-2)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const url = pathToFileURL(path.join(here, '..', 'src', 'utils', 'normalizePost.mjs')).href
    const script = `
      import('${url}').then(m => {
        const r = m.normalizePost({ dev: 'working', qa: 'running tests' })
        const dev = r.agents.find(a => a.role === 'dev')
        if (!dev || dev.status !== 'working') { console.error('normalizePost output wrong'); process.exit(2) }
        if (!m.VALID_ROLES.includes('dev') || !m.BLOCKED_REASONS.includes('test-run-failed')) { console.error('exports missing'); process.exit(3) }
        if (typeof m.nextSeq() !== 'string') { console.error('nextSeq wrong'); process.exit(4) }
        process.stdout.write('OK')
      }).catch(e => { console.error(String(e)); process.exit(5) })
    `
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf-8' })
    expect(out).toContain('OK')
  })
})

describe('AGENT_CARRY_FIELDS — field-survival end-to-end (AC-6)', () => {
  beforeEach(() => {
    useOfficeStore.setState({ externalStatus: {}, statusSource: 'organic', activeWorkflow: null })
  })

  for (const field of AGENT_CARRY_FIELDS) {
    it(`field "${field}" survives normalizePost → sanitizeAgent → routeExternalAgents → store`, () => {
      const syntheticValue = SYNTHETIC[field]

      // Step 1: normalizePost (POST /api/status ingest shape, full-format branch)
      // reasonCode needs status=blocked to round-trip cleanly through sanitizeAgent
      const status = field === 'reasonCode' ? 'blocked' : 'working'
      const postResult = normalizePost({
        type: 'office-status',
        agents: [{ role: 'dev', status, [field]: syntheticValue }],
      })
      expect(postResult.agents[0][field], `normalizePost dropped field "${field}"`).toBe(syntheticValue)

      // Step 2: normalizeStatusMessage / sanitizeAgent (in-browser channel path)
      const msgResult = normalizeStatusMessage({
        type: 'office-status',
        agents: [{ role: 'dev', status, [field]: syntheticValue }],
      })
      expect(msgResult.agents[0][field], `sanitizeAgent dropped field "${field}"`).toBe(syntheticValue)

      // Step 3: routeExternalAgents
      const routed = routeExternalAgents([{ role: 'dev', status, [field]: syntheticValue }])
      expect(routed[0][field], `routeExternalAgents dropped field "${field}"`).toBe(syntheticValue)

      // Step 4: applyExternalStatus → store
      useOfficeStore.getState().applyExternalStatus(
        [{ agentId: 'dev', status, [field]: syntheticValue }],
        { source: 'external', statusSource: 'external' },
      )
      const ext = useOfficeStore.getState().externalStatus.dev
      expect(ext[field], `store.applyExternalStatus dropped field "${field}"`).toBe(syntheticValue)
    })
  }
})
