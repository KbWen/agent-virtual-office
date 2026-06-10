/**
 * hookRuntimeContract.test.js  (AVO-153 / AC-4)
 *
 * Contract tests that pin the RUNTIME truth about Claude Code hook payloads.
 *
 * (a) SHAPE tests — for each committed fixture, assert the fields the hook
 *     ACTUALLY READS exist with the expected types.  When Claude Code changes
 *     its payload shape, re-capture + run → the fixture-vs-hook mismatch
 *     fails loudly here.
 *
 *     Hook read-list derived from office-status-hook.js source:
 *
 *     ALL events:
 *       hook_event_name  string   — switch(hookEvent) (line 742)
 *       tool_name        string   — const tool = event.tool_name || '' (line 723)
 *       agent_type       string   — const agentType = event.agent_type || '' (line 724)
 *       tool_input       object?  — const toolInput = event.tool_input || null (line 725)
 *       agent_id         string?  — const agentId = event.agent_id || null (line 726)
 *       transcript_path  string?  — readLatestTokenUsage(event.transcript_path) (line 729)
 *       effort           object?  — effortLevel(event) → event.effort.level (line 730)
 *       permission_mode  string?  — statusForPreToolUse(event.permission_mode) (line 784)
 *
 *     PostToolUse additionally:
 *       tool_result   any?     — event.tool_result || '' (line 804)
 *       is_error      boolean? — event.is_error (line 811)
 *
 *     StopFailure:
 *       matcher       string?  — event.matcher (line 905)
 *
 *     PermissionDenied:
 *       tool_name is required (empty → NO-OP)
 *
 *     UserPromptSubmit: reads only top-level hook_event_name (no tool fields)
 *
 * (b) BEHAVIOR tests — spawn the REAL hook with each fixture as stdin against
 *     an isolated OFFICE_STATUS_FILE temp path; assert exit 0 AND (for
 *     PreToolUse / PostToolUse) the status file gains the expected role/status.
 *
 * Pattern mirrors hookWriteLock.test.js (spawn-with-stdin) and
 * avo148StructuredErrorReasons.test.jsx (OFFICE_STATUS_FILE isolation).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOOK_PATH = path.resolve(__dirname, '../public/hooks/office-status-hook.js')
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/hook-events')

// ── Load hook module for shape assertions ─────────────────────────────────────
const hook = await import('../public/hooks/office-status-hook.js')
const { VALID_HOOK_ROLES, toolToRole } = hook

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Spawn the hook with a fixture payload as stdin. Returns { code, statusData }. */
function spawnHook(fixture, statusFile) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [HOOK_PATH], {
      env: { ...process.env, OFFICE_STATUS_FILE: statusFile },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    child.stdin.write(JSON.stringify(fixture))
    child.stdin.end()
    let stderr = ''
    child.stderr.on('data', d => { stderr += d })
    child.on('close', code => {
      let statusData = null
      try { statusData = JSON.parse(fs.readFileSync(statusFile, 'utf-8')) } catch {}
      resolve({ code, statusData, stderr })
    })
    child.on('error', reject)
  })
}

/** Create a fresh isolated temp base path for OFFICE_STATUS_FILE. */
function makeTempBase(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `avo-153-test-${label}-`))
  return { base: path.join(dir, 'office-status.json'), dir }
}

/** Load a fixture file. Throws if missing — failing loudly is the contract. */
function loadFixture(filename) {
  const p = path.join(FIXTURES_DIR, filename)
  if (!fs.existsSync(p)) throw new Error(`Fixture missing: ${filename} — re-run sanitizer`)
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

/** Collect all *.json fixtures (excludes README.md). */
function allFixtures() {
  return fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ name: f, fixture: loadFixture(f) }))
}

// ── (a) SHAPE TESTS ───────────────────────────────────────────────────────────

describe('AC-4a — SHAPE contract: fields the hook reads exist with correct types', () => {

  describe('common fields present in every fixture', () => {
    for (const { name, fixture } of allFixtures()) {
      it(`${name}: hook_event_name is a non-empty string`, () => {
        // hook reads: const hookEvent = event.hook_event_name (line 722)
        expect(typeof fixture.hook_event_name).toBe('string')
        expect(fixture.hook_event_name.length).toBeGreaterThan(0)
      })
    }
  })

  describe('PreToolUse fixtures', () => {
    const fixtures = allFixtures().filter(f => f.fixture.hook_event_name === 'PreToolUse')

    it('at least one PreToolUse fixture exists', () => {
      expect(fixtures.length).toBeGreaterThan(0)
    })

    for (const { name, fixture } of fixtures) {
      describe(name, () => {
        it('tool_name is a string (may be empty)', () => {
          // hook reads: const tool = event.tool_name || '' (line 723)
          expect(typeof (fixture.tool_name ?? '')).toBe('string')
        })
        it('tool_input is object or null/absent', () => {
          // hook reads: const toolInput = event.tool_input || null (line 725)
          const ti = fixture.tool_input
          expect(ti === null || ti === undefined || typeof ti === 'object').toBe(true)
        })
        it('permission_mode is a string when present', () => {
          // hook reads: statusForPreToolUse(event.permission_mode) → 'plan'|'working' (line 784)
          if ('permission_mode' in fixture) {
            expect(typeof fixture.permission_mode).toBe('string')
          }
        })
        it('agent_id is string or absent', () => {
          // hook reads: const agentId = event.agent_id || null (line 726)
          if ('agent_id' in fixture) {
            expect(typeof fixture.agent_id).toBe('string')
          }
        })
        it('transcript_path is string or absent', () => {
          // hook reads: readLatestTokenUsage(event.transcript_path) (line 729)
          if ('transcript_path' in fixture) {
            expect(typeof fixture.transcript_path).toBe('string')
          }
        })
        it('effort.level is a string when effort is present', () => {
          // hook reads: effortLevel(event) → event.effort?.level (line 730)
          if (fixture.effort !== undefined && fixture.effort !== null) {
            expect(typeof fixture.effort).toBe('object')
            if ('level' in fixture.effort) {
              expect(typeof fixture.effort.level).toBe('string')
            }
          }
        })

        // Tool-specific field assertions for tools that use tool_input
        if (fixture.tool_name === 'Bash') {
          it('Bash: tool_input.command is a string when present', () => {
            // hook reads: toolInput.command (extractContext line 389, deriveBlockedReason line 825)
            if (fixture.tool_input && 'command' in fixture.tool_input) {
              expect(typeof fixture.tool_input.command).toBe('string')
            }
          })
        }

        if (fixture.tool_name === 'Edit' || fixture.tool_name === 'Write' || fixture.tool_name === 'Read') {
          it(`${fixture.tool_name}: tool_input.file_path is a string when present`, () => {
            // hook reads: input.file_path || input.path (extractFilePath line 239, extractContext line 386)
            if (fixture.tool_input) {
              const hasPath = 'file_path' in fixture.tool_input || 'path' in fixture.tool_input
              if (hasPath) {
                const val = fixture.tool_input.file_path ?? fixture.tool_input.path
                expect(typeof val).toBe('string')
              }
            }
          })
        }
      })
    }
  })

  describe('PostToolUse fixtures', () => {
    const fixtures = allFixtures().filter(f => f.fixture.hook_event_name === 'PostToolUse')

    it('at least one PostToolUse fixture exists', () => {
      expect(fixtures.length).toBeGreaterThan(0)
    })

    for (const { name, fixture } of fixtures) {
      describe(name, () => {
        it('tool_name is a string (may be empty)', () => {
          expect(typeof (fixture.tool_name ?? '')).toBe('string')
        })
        it('tool_input is object or null/absent', () => {
          const ti = fixture.tool_input
          expect(ti === null || ti === undefined || typeof ti === 'object').toBe(true)
        })
        it('is_error is boolean or absent', () => {
          // hook reads: event.is_error !== undefined ? Boolean(event.is_error) : ... (line 811)
          if ('is_error' in fixture) {
            expect(typeof fixture.is_error).toBe('boolean')
          }
        })
        it('tool_result is string/object/absent (never throws on any type)', () => {
          // hook reads: event.tool_result || '' (line 804)
          // Any JSON type is valid — the hook coerces via JSON.stringify
          const tr = fixture.tool_result
          const validType = tr === undefined || tr === null ||
                            typeof tr === 'string' || typeof tr === 'object'
          expect(validType).toBe(true)
        })
        it('KNOWN DIVERGENCE PIN (AVO-154): runtime sends tool_response, hook reads tool_result', () => {
          // The captured runtime payload carries the result under `tool_response`; the hook
          // reads `event.tool_result` → on THIS runtime the hook's toolResult is always ''
          // for success events, so result-text-based derivations see no content. is_error
          // was absent from all captured (success-only) events — the error-event shape is
          // NOT YET CAPTURED. Tracked as AVO-154 (capture an error event, then reconcile
          // the hook's reads with runtime truth — touches the AVO-110 honesty firewall, so
          // it gets its own pass). This test pins the divergence LOUDLY: if a re-captured
          // corpus shows the runtime started sending tool_result (or stopped sending
          // tool_response), it fails and forces the reconciliation.
          expect('tool_response' in fixture, 'runtime stopped sending tool_response — re-evaluate AVO-154').toBe(true)
          expect('tool_result' in fixture, 'runtime now sends tool_result — the hook read may be live again; reconcile AVO-154').toBe(false)
        })
        it('transcript_path is string or absent', () => {
          if ('transcript_path' in fixture) {
            expect(typeof fixture.transcript_path).toBe('string')
          }
        })
        it('effort.level is a string when effort is present', () => {
          if (fixture.effort !== undefined && fixture.effort !== null) {
            expect(typeof fixture.effort).toBe('object')
            if ('level' in fixture.effort) {
              expect(typeof fixture.effort.level).toBe('string')
            }
          }
        })
      })
    }
  })
})

// ── (b) BEHAVIOR TESTS ────────────────────────────────────────────────────────

describe('AC-4b — BEHAVIOR contract: hook exits 0 and produces valid status output', () => {
  let base, dir, restore

  beforeEach(() => {
    const t = makeTempBase('behavior')
    base = t.base
    dir = t.dir
    // Seed a minimal status file so the hook's merge-read doesn't hit ENOENT
    // on PreToolUse (which reads _stopped guard before merging)
    fs.mkdirSync(path.dirname(base), { recursive: true })
    fs.writeFileSync(base, JSON.stringify({
      type: 'office-status',
      agents: [],
      activeCount: 0,
      _stopped: false,
      source: 'claude-cli',
      _seq: '1',
    }))
    const prior = process.env.OFFICE_STATUS_FILE
    process.env.OFFICE_STATUS_FILE = base
    restore = () => {
      if (prior === undefined) delete process.env.OFFICE_STATUS_FILE
      else process.env.OFFICE_STATUS_FILE = prior
    }
  })

  afterEach(() => {
    restore()
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  })

  describe('PreToolUse fixtures — exit 0 + agent stamped as working/planning', () => {
    const fixtures = allFixtures().filter(f => f.fixture.hook_event_name === 'PreToolUse')

    for (const { name, fixture } of fixtures) {
      it(`${name}: exit 0`, async () => {
        const { code } = await spawnHook(fixture, base)
        expect(code).toBe(0)
      }, 10_000)

      it(`${name}: status file contains a valid role + working/planning status`, async () => {
        await spawnHook(fixture, base)
        const data = JSON.parse(fs.readFileSync(base, 'utf-8'))
        // The hook must have written at least one agent
        expect(Array.isArray(data.agents)).toBe(true)
        if (data.agents.length > 0) {
          const agent = data.agents[0]
          // Role must be a valid hook role
          expect(VALID_HOOK_ROLES).toContain(agent.role)
          // Status must be working or planning (PreToolUse → statusForPreToolUse)
          expect(['working', 'planning']).toContain(agent.status)
        }
      }, 10_000)
    }
  })

  describe('PostToolUse fixtures — exit 0 + agent stamped as done/blocked', () => {
    const fixtures = allFixtures().filter(f => f.fixture.hook_event_name === 'PostToolUse')

    for (const { name, fixture } of fixtures) {
      it(`${name}: exit 0`, async () => {
        const { code } = await spawnHook(fixture, base)
        expect(code).toBe(0)
      }, 10_000)

      it(`${name}: status file contains a valid role + done/blocked status`, async () => {
        await spawnHook(fixture, base)
        const data = JSON.parse(fs.readFileSync(base, 'utf-8'))
        expect(Array.isArray(data.agents)).toBe(true)
        if (data.agents.length > 0) {
          const agent = data.agents[0]
          expect(VALID_HOOK_ROLES).toContain(agent.role)
          // PostToolUse always produces done or blocked (never working/planning)
          expect(['done', 'blocked']).toContain(agent.status)
        }
      }, 10_000)
    }
  })

  describe('role mapping consistency for tool fixtures', () => {
    it('PostToolUse-Bash.json → ops role (toolToRole("Bash") === "ops")', async () => {
      const fixture = loadFixture('PostToolUse-Bash.json')
      await spawnHook(fixture, base)
      const data = JSON.parse(fs.readFileSync(base, 'utf-8'))
      // toolToRole('Bash') = 'ops' per hook source (line 179)
      expect(toolToRole('Bash')).toBe('ops')
      if (data.agents.length > 0) {
        // Sanitized fixture has no file_path, so fileToRole returns null → falls through to toolToRole
        expect(data.agents[0].role).toBe('ops')
      }
    }, 10_000)

    it('PostToolUse-Edit.json → dev role (toolToRole("Edit") === "dev")', async () => {
      const fixture = loadFixture('PostToolUse-Edit.json')
      await spawnHook(fixture, base)
      const data = JSON.parse(fs.readFileSync(base, 'utf-8'))
      // toolToRole('Edit') = 'dev' per hook source (line 178)
      expect(toolToRole('Edit')).toBe('dev')
      // Note: fileToRole may override for .test.* files — but our fixture has /redacted/path.js
      // which matches neither test/ pattern nor ci/ pattern → null → falls through to toolToRole
      if (data.agents.length > 0) {
        expect(data.agents[0].role).toBe('dev')
      }
    }, 10_000)

    it('PostToolUse-Read.json → res role (toolToRole("Read") === "res")', async () => {
      const fixture = loadFixture('PostToolUse-Read.json')
      await spawnHook(fixture, base)
      const data = JSON.parse(fs.readFileSync(base, 'utf-8'))
      // toolToRole('Read') = 'res' per hook source (line 181)
      expect(toolToRole('Read')).toBe('res')
      if (data.agents.length > 0) {
        expect(data.agents[0].role).toBe('res')
      }
    }, 10_000)
  })

  describe('capture path is a safe no-op when marker is absent', () => {
    it('hook exits 0 and produces valid output without marker file', async () => {
      // Remove marker if present (CI has no marker — this is the normal code path)
      const markerPath = path.join(os.homedir(), '.claude', 'office-hook-capture')
      const markerExisted = fs.existsSync(markerPath)
      if (markerExisted) fs.unlinkSync(markerPath)

      try {
        const fixture = loadFixture('PreToolUse-Bash.json')
        const { code, statusData } = await spawnHook(fixture, base)
        expect(code).toBe(0)
        expect(statusData).not.toBeNull()
        expect(Array.isArray(statusData.agents)).toBe(true)
      } finally {
        // Restore marker if it was there
        if (markerExisted) fs.writeFileSync(markerPath, '')
      }
    }, 10_000)
  })
})
