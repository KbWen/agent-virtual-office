#!/usr/bin/env node
/**
 * pack-smoke.mjs — npm-pack install smoke harness (AVO-151)
 *
 * Packs the repo into a tarball, installs it in a fresh temp project, then
 * asserts the four contract properties of the published artifact:
 *
 *   Assertion 0: library subpath exports import from an installed tarball.
 *   Assertion 1: setup exits 0; ALL 8 hook events are registered; hook file exists.
 *   Assertion 2: setup is idempotent — a second run adds no duplicate entries.
 *   Assertion 3: the installed hook runs standalone — pipe a __noop__ event → exit 0,
 *                no non-benign stderr (mirrors hookWriteLock.test.js filter).
 *   Assertion 4: Quick-Start boot — dev mode serves HTML at / within 120s.
 *
 * Dev-mode readiness note (discovered in cli.js lines 280-375):
 *   The default launch (`node bin/cli.js`) starts Vite dev server, NOT server.mjs.
 *   Vite does NOT expose /api/health — that endpoint only exists in server.mjs (serve).
 *   Therefore: poll GET / for HTTP 200 + body containing '<div id="root"' (index.html
 *   mount point, confirmed at line 24 of index.html). Budget: 120s (first run installs
 *   dev deps via npm install if Vite can't be resolved).
 *
 * EXIT CODES:
 *   0  — all assertions passed
 *   1  — any assertion failed or unexpected error (diagnostics on stderr)
 *
 * USAGE:
 *   npm run smoke:pack          # from repo root
 *   node scripts/pack-smoke.mjs
 */

import { execSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Canonical hook event list (from cli.js line 68) ───────────────────────────
// SYNC CONTRACT: keep in lockstep with bin/cli.js's event array. A DROPPED event is
// caught (assertion fails); an ADDED 9th event would NOT be (coverage gap) — update
// this list whenever cli.js's setup registration changes.
const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'SubagentStart',
  'SubagentStop',
  'UserPromptSubmit',
  'Stop',
  'PermissionDenied',
  'StopFailure',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Print failure and exit 1. */
function fail(label, ...lines) {
  process.stderr.write(`\nFAIL [${label}]\n`)
  for (const line of lines) process.stderr.write(`  ${line}\n`)
  process.exit(1)
}

/** Find a free TCP port by asking the OS for an ephemeral port. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

/** Poll fn() every intervalMs until it returns true or deadline expires. */
async function poll(fn, deadlineMs, intervalMs = 500) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    if (await fn()) return true
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return false
}

/** Kill a process tree (Windows: taskkill /T /F; POSIX: SIGTERM then SIGKILL). */
async function killTree(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') {
    try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }) } catch {}
  } else {
    try { child.kill('SIGTERM') } catch {}
    await new Promise(r => setTimeout(r, 2000))
    try { if (child.exitCode === null) child.kill('SIGKILL') } catch {}
  }
}

// ── State ──────────────────────────────────────────────────────────────────────
let tmpDir = null
let tarballPath = null
let devChild = null

async function cleanup() {
  await killTree(devChild)
  if (tarballPath && existsSync(tarballPath)) {
    try { rmSync(tarballPath) } catch {}
  }
  if (tmpDir && existsSync(tmpDir)) {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

// Ensure cleanup on any exit path
process.on('exit', () => {
  // Synchronous best-effort kill on exit (cleanup already ran in try/finally for normal path)
  if (devChild && devChild.exitCode === null) {
    if (process.platform === 'win32') {
      try { execSync(`taskkill /pid ${devChild.pid} /T /F`, { stdio: 'ignore' }) } catch {}
    } else {
      try { devChild.kill('SIGKILL') } catch {}
    }
  }
  if (tarballPath && existsSync(tarballPath)) { try { rmSync(tarballPath) } catch {} }
  if (tmpDir && existsSync(tmpDir)) { try { rmSync(tmpDir, { recursive: true, force: true }) } catch {} }
})

// ── Main ───────────────────────────────────────────────────────────────────────

let port
try {
  port = await getFreePort()
} catch (e) {
  fail('port-probe', `Could not find a free port: ${e.message}`)
}

try {
  // ── Step 0: npm pack ─────────────────────────────────────────────────────────
  console.log('[pack-smoke] Step 0: npm pack...')
  const packDest = os.tmpdir()
  let packOutput
  try {
    packOutput = execSync(`npm pack --pack-destination "${packDest}"`, {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim()
  } catch (e) {
    fail('npm-pack', `npm pack failed: ${e.message}`, e.stderr || '')
  }
  // npm pack outputs the tarball filename (last non-empty line)
  const packLines = packOutput.split('\n').map(l => l.trim()).filter(Boolean)
  const tarballName = packLines[packLines.length - 1]
  tarballPath = path.join(packDest, tarballName)
  if (!existsSync(tarballPath)) {
    fail('npm-pack', `Tarball not found at expected path: ${tarballPath}`, `pack stdout: ${packOutput}`)
  }
  console.log(`[pack-smoke] Tarball: ${tarballPath}`)

  // ── Step 1: Create temp project, npm init + install tarball ─────────────────
  console.log('[pack-smoke] Step 1: creating temp project...')
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'avo-pack-smoke-'))
  console.log(`[pack-smoke] Temp dir: ${tmpDir}`)

  try {
    execSync('npm init -y', { cwd: tmpDir, stdio: 'pipe' })
  } catch (e) {
    fail('npm-init', `npm init -y failed: ${e.message}`)
  }

  console.log('[pack-smoke] Installing tarball (this installs all dependencies)...')
  try {
    execSync(`npm install "${tarballPath}"`, {
      cwd: tmpDir,
      stdio: 'inherit',
    })
  } catch (e) {
    fail('npm-install', `npm install <tarball> failed: ${e.message}`)
  }

  const cliPath = path.join(tmpDir, 'node_modules', 'agent-virtual-office', 'bin', 'cli.js')
  const hookSrcPath = path.join(tmpDir, 'node_modules', 'agent-virtual-office', 'public', 'hooks', 'office-status-hook.js')
  if (!existsSync(cliPath)) {
    fail('install-check', `bin/cli.js not found at: ${cliPath}`, 'Check package.json "files" whitelist includes bin/')
  }
  if (!existsSync(hookSrcPath)) {
    fail('install-check', `Hook source not found at: ${hookSrcPath}`, 'Check package.json "files" whitelist includes public/')
  }
  console.log('[pack-smoke] Install OK — cli.js and hook source present.')

  // ── Assertion 0: reusable library subpaths import from installed package ──────
  console.log('[pack-smoke] Assertion 0: library subpath imports...')
  const libraryCheckPath = path.join(tmpDir, 'library-import-check.mjs')
  writeFileSync(libraryCheckPath, `
import { VALID_STATUSES, normalizePost } from 'agent-virtual-office/status-contract'
import { normalizePost as normalizePostAlias } from 'agent-virtual-office/normalize-post'
import { assembleIntegrationPatch, buildExternalStatusEntry } from 'agent-virtual-office/status-runtime'
import { buildDoneEventKey as buildDoneEventKeyFromLedgerModel } from 'agent-virtual-office/daily-ledger-model'
import { computeBubbleLayout as computeBubbleLayoutFromSpeechModel } from 'agent-virtual-office/speech-bubble-model'
import { buildHelperHuddleViewModel as buildHelperHuddleViewModelFromModel } from 'agent-virtual-office/helper-huddle-model'
import { buildPairLinkViewModel as buildPairLinkViewModelFromModel } from 'agent-virtual-office/pair-huddle-model'
import { buildContextBubblePlan as buildContextBubblePlanFromModel } from 'agent-virtual-office/context-bubble-model'
import { buildBubbleVisibilityViewModel as buildBubbleVisibilityViewModelFromModel } from 'agent-virtual-office/bubble-visibility-model'
import { POKE_QUIP_MS as POKE_QUIP_MS_FROM_MODEL, buildPokeReactionViewModel as buildPokeReactionViewModelFromModel, poolKeyForStatus as poolKeyForStatusFromPokeModel } from 'agent-virtual-office/poke-reaction-model'
import { buildEventJuiceViewModel as buildEventJuiceViewModelFromModel } from 'agent-virtual-office/event-juice-model'
import { buildEventGateViewModel as buildEventGateViewModelFromModel, floorTickAllowed as floorTickAllowedFromModel } from 'agent-virtual-office/event-gate-model'
import { buildSeedEventViewModel as buildSeedEventViewModelFromModel, seedEventCandidates as seedEventCandidatesFromModel } from 'agent-virtual-office/event-seed-model'
import { buildEventCatalogViewModel as buildEventCatalogViewModelFromModel, EVENT_CATEGORY as EVENT_CATEGORY_FROM_MODEL } from 'agent-virtual-office/event-catalog-model'
import { buildTimeEventViewModel as buildTimeEventViewModelFromModel, TIME_EVENT_REASON as TIME_EVENT_REASON_FROM_MODEL } from 'agent-virtual-office/time-event-model'
import { buildMovementLayoutViewModel as buildMovementLayoutViewModelFromModel, zoneForPoint as zoneForPointFromModel } from 'agent-virtual-office/movement-layout-model'
import { WEATHER_KIND as WEATHER_KIND_FROM_AMBIENT_MODEL, buildAmbientAppearanceViewModel as buildAmbientAppearanceViewModelFromModel, moodToWeather as moodToWeatherFromAmbientModel } from 'agent-virtual-office/ambient-appearance-model'
import { buildAmbientSoundViewModel as buildAmbientSoundViewModelFromModel, meanIntervalForPulse as meanIntervalForPulseFromSoundModel, rainTargetGain as rainTargetGainFromSoundModel } from 'agent-virtual-office/ambient-sound-model'
import { PET_MODES as PET_MODES_FROM_MODEL, buildPetStateViewModel as buildPetStateViewModelFromModel, countAttentionBlockers as countAttentionBlockersFromPetModel } from 'agent-virtual-office/pet-state-model'
import { statusVisualState as statusVisualStateFromModel } from 'agent-virtual-office/status-visual-model'
import { buildActionStripViewModel as buildActionStripViewModelFromModel } from 'agent-virtual-office/action-strip-model'
import { behaviorIndicatorState as behaviorIndicatorStateFromModel } from 'agent-virtual-office/behavior-indicator-model'
import { characterStatusVisual as characterStatusVisualFromModel } from 'agent-virtual-office/agent-character-model'
import { inspectorPanelLayout as inspectorPanelLayoutFromModel, inspectorTaskToken as inspectorTaskTokenFromModel } from 'agent-virtual-office/agent-inspector-model'
import { buildActivityFeedViewModel as buildActivityFeedViewModelFromModel } from 'agent-virtual-office/activity-feed-model'
import { agentStatus, presenceRows } from 'agent-virtual-office/agent-status-model'
import { buildAgentStatusSnapshot } from 'agent-virtual-office/agent-status-snapshot'
import { blockedReasonState as blockedReasonStateFromModel } from 'agent-virtual-office/blocked-reason-model'
import { healthDotState as healthDotStateFromIntegrationModel } from 'agent-virtual-office/integration-status-model'
import { gateWaiting as gateWaitingFromReviewGateModel } from 'agent-virtual-office/review-gate-model'
import { createRequire } from 'node:module'
import {
  blockedReasonState,
  buildActionStripViewModel,
  buildActivityFeedViewModel,
  buildAgentStatusSnapshot as buildAgentStatusSnapshotFromCore,
  buildDynamicStatusAgent,
  buildDoneEventKey,
  computeBubbleLayout,
  buildHelperHuddleViewModel,
  buildPairLinkViewModel,
  buildContextBubblePlan,
  buildBubbleVisibilityViewModel,
  buildPokeReactionViewModel,
  buildEventJuiceViewModel,
  buildEventGateViewModel,
  buildEventCatalogViewModel,
  buildSeedEventViewModel,
  buildTimeEventViewModel,
  buildMovementLayoutViewModel,
  buildAmbientAppearanceViewModel,
  buildAmbientSoundViewModel,
  buildPetStateViewModel,
  EVENT_CATEGORY,
  TIME_EVENT_REASON,
  WEATHER_KIND,
  AMBIENT_SOUND_MASTER_CAP,
  PET_MODES,
  pokePoolKeyForStatus,
  eventEligible,
  floorTickAllowed,
  seedEventCandidates,
  behaviorIndicatorState,
  characterStatusVisual,
  inspectorPanelLayout,
  inspectorTaskToken,
  buildPresenceRailViewModel,
  comparePresence,
  feedEntries,
  gateWaiting,
  healthDotState,
  normalizeAgentStatusUpdates,
  reconcileMultiSessionAgents,
  statusVisualState,
  teamStatus,
  zoneForPoint,
  moodToWeather,
} from 'agent-virtual-office/status-core'
import { comparePresence as comparePresenceFromRoster } from 'agent-virtual-office/roster-model'

const norm = normalizePost({ dev: 'working' })
if (!VALID_STATUSES.includes('awaiting-approval')) throw new Error('status-contract export missing awaiting-approval')
if (norm.agents[0]?.status !== 'working') throw new Error('status-contract normalizePost failed')
if (normalizePostAlias({ qa: 'blocked' }).agents[0]?.status !== 'blocked') throw new Error('normalize-post export failed')
if (buildExternalStatusEntry(null, { status: 'done' }, 1000).entry.expiresAt !== 11000) throw new Error('status-runtime export failed')
if (assembleIntegrationPatch({ statusSource: 'organic', integrationSource: null }, { statusSource: 'external' }, {}).statusSource !== 'external') throw new Error('status-runtime integration patch export failed')
if (buildDoneEventKeyFromLedgerModel({ agentId: 'dev' }, { source: 'codex', seq: '7' }) !== 'codex:7:dev') throw new Error('daily-ledger-model export failed')
if (computeBubbleLayoutFromSpeechModel('修好🧪流程').displayMsg !== '修好🧪流程') throw new Error('speech-bubble-model export failed')
if (buildHelperHuddleViewModelFromModel({ helpers: [{ parentRole: 'dev' }], agents: { dev: { position: { x: 10, y: 20 } } } }).rows[0]?.sprites.length !== 1) throw new Error('helper-huddle-model export failed')
if (buildPairLinkViewModelFromModel({ now: 1000, externalStatus: { dev: { status: 'working', task: 'Edit', activeFile: '/r/a.js', activeFileAt: 1000 }, qa: { status: 'working', task: 'Write', activeFile: '/r/a.js', activeFileAt: 900 } } }).link?.file !== 'a.js') throw new Error('pair-huddle-model export failed')
if (buildPairLinkViewModelFromModel({ now: 1000, externalStatus: { dev: { status: 'working', task: 'Edit', activeFile: '/r/a.js', activeFileAt: 1000 }, qa: { status: 'working', task: 'Read', activeFile: '/r/a.js', activeFileAt: 900 } } }).visible !== false) throw new Error('pair-huddle-model Read gate failed')
if (buildContextBubblePlanFromModel('feat-x~dev', { status: 'blocked', label: 'editing App.jsx' }).keys?.[0] !== 'contextBubbles.dev-error') throw new Error('context-bubble-model export failed')
if (buildBubbleVisibilityViewModelFromModel({ agents: { qa: { status: 'blocked', bubble: 'stuck' }, dev: { status: 'working', bubble: 'typing' } }, externalStatus: { qa: { status: 'blocked', changedAt: 1 }, dev: { status: 'working', changedAt: 99 } }, cap: 1 }).visibleIds?.[0] !== 'qa') throw new Error('bubble-visibility-model export failed')
const pokeModel = buildPokeReactionViewModelFromModel({ status: 'done', history: [100, 200, 300, 400], now: 500, poolLength: 3 })
if (poolKeyForStatusFromPokeModel('awaiting-approval') !== 'blocked' || POKE_QUIP_MS_FROM_MODEL !== 1200 || pokeModel.intensity !== 'turnaway' || pokeModel.quipIndex !== 1 || pokeModel.timing.motion.dur !== '0.5s') throw new Error('poke-reaction-model export failed')
if (buildEventJuiceViewModelFromModel('eureka').juice?.animationName !== 'office-sparkle' || buildEventJuiceViewModelFromModel('eureka', { reducedMotion: true }).visible !== false) throw new Error('event-juice-model export failed')
if (buildEventGateViewModelFromModel({ id: 'deploy-success' }, { externalStatus: {}, mood: 'normal' }, { now: 2000 }).eligible !== false) throw new Error('event-gate-model export failed')
if (floorTickAllowedFromModel({ statusSource: 'external', teamPulse: 0.9 }, { random: () => 0.99 }) !== false) throw new Error('event-gate-model floor export failed')
if (seedEventCandidatesFromModel({ mood: 'smooth' }, { mood: 'normal' })[0]?.eventId !== 'eureka') throw new Error('event-seed-model candidates export failed')
if (buildSeedEventViewModelFromModel({ state: { mood: 'smooth' }, prev: { mood: 'normal' }, eventById: { eureka: { id: 'eureka' } }, seedState: { lastSeedAt: 0 }, now: 200000 }).selectedEventId !== 'eureka') throw new Error('event-seed-model view export failed')
if (buildEventCatalogViewModelFromModel({ daily: [{ id: 'eureka', participants: ['arch'], duration: 8000 }], rare: [] }).byCategory[EVENT_CATEGORY_FROM_MODEL.WORK_CLAIM][0] !== 'eureka') throw new Error('event-catalog-model export failed')
const timeEventModel = buildTimeEventViewModelFromModel({ hour: 15 }, { day: 5, lastTriggeredHour: -1 })
if (timeEventModel.reason !== TIME_EVENT_REASON_FROM_MODEL.DUE || timeEventModel.eventIds.join(',') !== 'tea-break,group-meeting') throw new Error('time-event-model export failed')
const movementLayoutModel = buildMovementLayoutViewModelFromModel()
if (movementLayoutModel.homePositions.dev.x !== 340 || movementLayoutModel.overflowPositions[1].slot !== 1 || zoneForPointFromModel(900, 900) !== null) throw new Error('movement-layout-model export failed')
const ambientAppearanceModel = buildAmbientAppearanceViewModelFromModel({ hour: 0, mood: 'frustrated', themeId: 'winter' })
if (ambientAppearanceModel.weather.kind !== WEATHER_KIND_FROM_AMBIENT_MODEL.RAIN || ambientAppearanceModel.theme.overlay.opacity !== 0.07 || moodToWeatherFromAmbientModel('stuck') !== WEATHER_KIND_FROM_AMBIENT_MODEL.THUNDERSTORM) throw new Error('ambient-appearance-model export failed')
const ambientSoundModel = buildAmbientSoundViewModelFromModel({ mood: 'stuck', soundscapeEnabled: true, teamPulse: 0.5 })
if (ambientSoundModel.weather.gain !== 0.08 || ambientSoundModel.keyboard.meanIntervalMs !== meanIntervalForPulseFromSoundModel(0.5) || rainTargetGainFromSoundModel('frustrated', true, false) !== 0.05) throw new Error('ambient-sound-model export failed')
const petStateModel = buildPetStateViewModelFromModel({ mood: 'smooth', externalStatus: { qa: { status: 'awaiting-approval' } }, celebrate: true, petType: 'dog', targetPosition: { x: 300, y: 200 } })
if (petStateModel.mode !== PET_MODES_FROM_MODEL.HIDE || petStateModel.blocked.firstId !== 'qa' || petStateModel.type.next !== 'rabbit' || countAttentionBlockersFromPetModel({ qa: { status: 'blocked' } }) !== 1) throw new Error('pet-state-model export failed')
if (statusVisualStateFromModel('awaiting-approval').color !== '#1E9FD4') throw new Error('status-visual-model export failed')
if (buildActionStripViewModelFromModel({ agents: [{ id: 'qa', status: 'blocked' }] }).attention.count !== 1) throw new Error('action-strip-model export failed')
if (behaviorIndicatorStateFromModel('goto-coffee-machine').iconKey !== 'coffee') throw new Error('behavior-indicator-model export failed')
if (characterStatusVisualFromModel({ status: 'blocked', color: '#abc' }).ring.kind !== 'blocked') throw new Error('agent-character-model export failed')
if (inspectorPanelLayoutFromModel({ hasTask: true, detailCount: 3, activityCount: 5, sceneScale: 0.5, position: { x: 20, y: 20 } }).scale !== 3) throw new Error('agent-inspector-model export failed')
if (inspectorTaskTokenFromModel({ task: 'mcp__notion__create_page' }).kind !== 'task') throw new Error('agent-inspector-model semantic export failed')
if (buildActivityFeedViewModelFromModel([{ id: 1, type: 'status', status: 'done', timestamp: 1 }], { now: 2 }).unreadCount !== 1) throw new Error('activity-feed-model export failed')
if (agentStatus({ status: 'idle' }, { status: 'done' }) !== 'done') throw new Error('agent-status-model export failed')
if (presenceRows({ agents: [{ id: 'dev', status: 'idle' }], externalStatus: { dev: { status: 'done' } } }).rows[0]?.status !== 'done') throw new Error('presenceRows export failed')
if (blockedReasonStateFromModel('api-rate-limit').iconId !== 'hourglass') throw new Error('blocked-reason-model export failed')
if (healthDotStateFromIntegrationModel({ statusSource: 'fallback', externalCount: 2 }).labelVal !== 2) throw new Error('integration-status-model export failed')
if (gateWaitingFromReviewGateModel({ qa: { status: 'awaiting-approval' } }, '/review').phaseGlyph !== 'review') throw new Error('review-gate-model export failed')
if ([{ id: 'b', status: 'working' }, { id: 'a', status: 'blocked' }].sort(comparePresenceFromRoster)[0]?.id !== 'a') throw new Error('roster-model export failed')
if ([{ id: 'b', status: 'working' }, { id: 'a', status: 'blocked' }].sort(comparePresence)[0]?.id !== 'a') throw new Error('status-core comparePresence export failed')
if (statusVisualState('blocked').color !== '#E24B4A') throw new Error('status-core status visual export failed')
if (buildActionStripViewModel({ agents: [{ id: 'qa', status: 'blocked' }] }).attention.count !== 1) throw new Error('status-core action strip export failed')
if (behaviorIndicatorState('desk-slam').iconKey !== 'frustration') throw new Error('status-core behavior indicator export failed')
if (characterStatusVisual({ status: 'done', color: '#abc' }).tagFill !== '#5CB88A') throw new Error('status-core character model export failed')
if (inspectorPanelLayout({ activityCount: 4, sceneScale: 1, position: { x: 400, y: 300 } }).activityRows !== 3) throw new Error('status-core inspector model export failed')
if (inspectorTaskToken({ label: 'Review PR', task: 'Edit' }).kind !== 'label') throw new Error('status-core inspector semantic export failed')
if (teamStatus({ activeWorkflow: 'review', activeCount: 2 }).kind !== 'workflow') throw new Error('status-core teamStatus export failed')
if (feedEntries([{ origin: 'organic' }, { origin: 'hook' }]).length !== 1) throw new Error('status-core feedEntries export failed')
if (buildActivityFeedViewModel([{ id: 1, type: 'status', status: 'blocked', timestamp: 1 }], { now: 2 }).entries[0]?.tone !== 'danger') throw new Error('status-core activity feed view-model export failed')
if (buildPresenceRailViewModel({ agents: { dev: { id: 'dev', status: 'idle' } }, externalStatus: { dev: { status: 'blocked' } } }).team.kind !== 'blocked') throw new Error('status-core presence rail view-model export failed')
if (buildDynamicStatusAgent({ id: 'dev' }, { agentId: 'wt~dev', position: { x: 1, y: 2 } }).deskItemCount.coffee !== 0) throw new Error('status-core dynamic agent export failed')
if (buildDoneEventKey({ agentId: 'dev' }, { eventKey: 'done-1' }) !== 'done-1:dev') throw new Error('status-core daily ledger export failed')
if (computeBubbleLayout('abcdefghijklmnopq').displayMsg !== 'abcdefghijklmnop…') throw new Error('status-core speech bubble export failed')
if (buildHelperHuddleViewModel({ helpers: [{ parentRole: 'dev' }], agents: { dev: { position: { x: 10, y: 20 } } } }).rows[0]?.role !== 'dev') throw new Error('status-core helper huddle export failed')
if (buildPairLinkViewModel({ now: 1000, externalStatus: { dev: { status: 'working', task: 'Edit', activeFile: '/r/a.js', activeFileAt: 1000 }, qa: { status: 'working', task: 'Write', activeFile: '/r/a.js', activeFileAt: 900 } } }).pair?.[1] !== 'qa') throw new Error('status-core pair huddle export failed')
if (buildContextBubblePlan('dev', { status: 'working', task: 'Edit', label: 'editing a.js' }).fallbackKeys?.[0] !== 'contextBubbles.dev-working') throw new Error('status-core context bubble export failed')
if (buildBubbleVisibilityViewModel({ agents: { done: { status: 'done', bubble: 'ok' }, work: { status: 'working', bubble: 'typing' } }, cap: 1 }).visibleIds?.[0] !== 'done') throw new Error('status-core bubble visibility export failed')
const pokeCore = buildPokeReactionViewModel({ status: 'blocked', history: [100, 200], now: 300, poolLength: 2 })
if (pokePoolKeyForStatus('awaiting-approval') !== 'blocked' || pokeCore.poolKey !== 'blocked' || pokeCore.quipIndex !== 0 || pokeCore.timing.quipMs !== 1200) throw new Error('status-core poke reaction export failed')
if (buildEventJuiceViewModel('deploy-success').juice?.delayStepMs !== 40 || buildEventJuiceViewModel('deploy-success', { reducedMotion: true }).visible !== false) throw new Error('status-core event juice export failed')
if (eventEligible({ id: 'review-debate' }, { externalStatus: { gate: { changedAt: 1000 } }, mood: 'normal' }, 2000) !== true) throw new Error('status-core event gate export failed')
if (buildEventGateViewModel({ id: 'eureka' }, { externalStatus: {}, mood: 'normal' }, { now: 2000 }).workClaim !== true) throw new Error('status-core event gate view export failed')
if (floorTickAllowed({ statusSource: 'external', teamPulse: 0.9 }, { random: () => 0.99 }) !== false) throw new Error('status-core floor gate export failed')
if (seedEventCandidates({ mood: 'smooth' }, { mood: 'normal' })[0]?.eventId !== 'eureka') throw new Error('status-core seed candidates export failed')
if (buildSeedEventViewModel({ state: { mood: 'smooth' }, prev: { mood: 'normal' }, eventById: { eureka: { id: 'eureka' } }, seedState: { lastSeedAt: 0 }, now: 200000 }).selectedEventId !== 'eureka') throw new Error('status-core seed view export failed')
if (buildEventCatalogViewModel({ daily: [{ id: 'eureka', participants: ['arch'], duration: 8000 }], rare: [] }).byCategory[EVENT_CATEGORY.WORK_CLAIM][0] !== 'eureka') throw new Error('status-core event catalog export failed')
const timeEventCore = buildTimeEventViewModel({ hour: 15 }, { day: 5, lastTriggeredHour: -1 })
if (timeEventCore.reason !== TIME_EVENT_REASON.DUE || timeEventCore.eventIds.join(',') !== 'tea-break,group-meeting') throw new Error('status-core time event export failed')
if (buildMovementLayoutViewModel().homePositions.dev.y !== 364 || zoneForPoint(900, 900) !== null) throw new Error('status-core movement layout export failed')
if (buildAmbientAppearanceViewModel({ hour: 0, mood: 'frustrated', themeId: 'winter' }).weather.kind !== WEATHER_KIND.RAIN || moodToWeather('stuck') !== WEATHER_KIND.THUNDERSTORM) throw new Error('status-core ambient appearance export failed')
if (buildAmbientSoundViewModel({ mood: 'stuck', soundscapeEnabled: true, teamPulse: 1 }).master.cap !== AMBIENT_SOUND_MASTER_CAP || buildAmbientSoundViewModel({ mood: 'stuck', soundscapeEnabled: true, teamPulse: 1 }).weather.gain !== 0.08) throw new Error('status-core ambient sound export failed')
if (buildPetStateViewModel({ mood: 'smooth', externalStatus: { qa: { status: 'awaiting-approval' } }, blockedCount: 0, celebrate: true }).mode !== PET_MODES.HIDE) throw new Error('status-core pet state export failed')
if (reconcileMultiSessionAgents({ agents: { 'wt~dev': { session: 'wt' } }, externalStatus: { 'wt~dev': { status: 'working' } }, updates: [] }).evicted[0] !== 'wt~dev') throw new Error('status-core reconcile export failed')
if (normalizeAgentStatusUpdates({ type: 'office-status', agents: [{ role: 'frontend', status: 'working' }] }).updates[0]?.agentId !== 'frontend') throw new Error('status-core generic normalize export failed')
if (blockedReasonState('permission-denied').iconId !== 'slash-circle') throw new Error('status-core blocked reason export failed')
if (healthDotState({ integrationHealth: { state: 'offline' } }).level !== 'offline') throw new Error('status-core health export failed')
if (gateWaiting({ gate: { status: 'awaiting-approval' } }, '/ship').phaseGlyph !== 'ship') throw new Error('status-core review gate export failed')

const require = createRequire(import.meta.url)
const pkg = require('agent-virtual-office/package.json')
const exportedSubpaths = Object.keys(pkg.exports)
  .filter((subpath) => subpath !== '.' && subpath !== './package.json' && subpath !== './src/*')
  .sort()
const checkedSubpaths = [
  './action-strip-model',
  './ambient-appearance-model',
  './ambient-sound-model',
  './activity-feed-model',
  './agent-character-model',
  './agent-inspector-model',
  './agent-status-model',
  './agent-status-snapshot',
  './behavior-indicator-model',
  './blocked-reason-model',
  './bubble-visibility-model',
  './context-bubble-model',
  './daily-ledger-model',
  './event-catalog-model',
  './event-gate-model',
  './event-juice-model',
  './event-seed-model',
  './helper-huddle-model',
  './integration-status-model',
  './movement-layout-model',
  './normalize-post',
  './pair-huddle-model',
  './pet-state-model',
  './poke-reaction-model',
  './review-gate-model',
  './roster-model',
  './speech-bubble-model',
  './status-contract',
  './status-core',
  './status-runtime',
  './status-visual-model',
  './time-event-model',
].sort()
if (JSON.stringify(exportedSubpaths) !== JSON.stringify(checkedSubpaths)) {
  throw new Error('package export smoke coverage drift: exports=' + exportedSubpaths.join(',') + ' checked=' + checkedSubpaths.join(','))
}

const snapshot = buildAgentStatusSnapshot({
  agents: { dev: { id: 'dev', status: 'idle' } },
  externalStatus: { dev: { status: 'done', task: 'Edit' } },
})
if (snapshot.agents[0]?.status !== 'done' || snapshot.presence.rows[0]?.task !== 'Edit') {
  throw new Error('agent-status-snapshot export failed')
}
if (snapshot.agents[0]?.visual?.color !== '#5CB88A') throw new Error('agent-status-snapshot visual token failed')
if (snapshot.agents[0]?.character?.ring?.kind !== 'done') throw new Error('agent-status-snapshot character token failed')
if (snapshot.agents[0]?.character?.indicator?.known !== true) throw new Error('agent-status-snapshot behavior indicator token failed')
if (snapshot.integration?.health?.level !== 'idle') throw new Error('agent-status-snapshot integration health failed')
if (buildAgentStatusSnapshotFromCore({
  agents: { dev: { id: 'dev', status: 'idle' } },
  externalStatus: { dev: { status: 'done' } },
}).agents[0]?.status !== 'done') {
  throw new Error('status-core snapshot export failed')
}
console.log('library imports OK')
`)
  try {
    execSync(`node "${libraryCheckPath}"`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
  } catch (e) {
    fail('assertion-0-library-imports', `Library subpath import check failed: ${e.message}`, `stdout: ${e.stdout}`, `stderr: ${e.stderr}`)
  }
  console.log('[pack-smoke]   status-contract, status-core, normalize-post, status-runtime, daily-ledger-model, speech-bubble-model, helper-huddle-model, pair-huddle-model, context-bubble-model, bubble-visibility-model, poke-reaction-model, event-juice-model, event-gate-model, event-seed-model, event-catalog-model, time-event-model, movement-layout-model, ambient-appearance-model, ambient-sound-model, pet-state-model, status-visual-model, action-strip-model, behavior-indicator-model, agent-character-model, agent-inspector-model, activity-feed-model, agent-status-model, agent-status-snapshot, blocked-reason-model, integration-status-model, review-gate-model, roster-model imported.')
  console.log('[pack-smoke] Assertion 0: PASS')

  // ── Assertion 1: setup exits 0; all events registered; hook path exists ──────
  console.log('[pack-smoke] Assertion 1: running setup...')

  // Use a per-test home dir so we don't pollute the real ~/.claude/settings.json
  const fakeHome = path.join(tmpDir, 'fake-home')
  const fakeClaudeDir = path.join(fakeHome, '.claude')
  // cli.js reads os.homedir() — we override via HOME (POSIX) / USERPROFILE (Windows)
  const homeEnv = {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    // Prevent npm from reading/writing the real user config during the child runs
    npm_config_userconfig: path.join(fakeHome, '.npmrc'),
  }

  let setupOut1, setupErr1
  try {
    const result = execSync(`node "${cliPath}" setup`, {
      cwd: tmpDir,
      env: homeEnv,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    setupOut1 = result
  } catch (e) {
    fail('assertion-1-setup-exit', `setup exited non-zero: ${e.message}`, `stdout: ${e.stdout}`, `stderr: ${e.stderr}`)
  }
  console.log('[pack-smoke]   setup exited 0.')

  // Parse settings.json
  const settingsPath = path.join(fakeClaudeDir, 'settings.json')
  if (!existsSync(settingsPath)) {
    fail('assertion-1-settings', `settings.json not created at: ${settingsPath}`)
  }
  let settings
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
  } catch (e) {
    fail('assertion-1-settings-parse', `settings.json is not valid JSON: ${e.message}`)
  }

  // Verify all hook events are registered
  const missingEvents = []
  for (const event of HOOK_EVENTS) {
    const entries = settings?.hooks?.[event]
    if (!Array.isArray(entries) || entries.length === 0) {
      missingEvents.push(event)
    }
  }
  if (missingEvents.length > 0) {
    fail('assertion-1-events', `Missing hook registrations for: ${missingEvents.join(', ')}`)
  }
  console.log(`[pack-smoke]   All ${HOOK_EVENTS.length} events registered.`)

  // Verify hook command path exists on disk
  // cli.js copies hook to <home>/.claude/office-status-hook.js and registers that path
  const hookDest = path.join(fakeClaudeDir, 'office-status-hook.js')
  if (!existsSync(hookDest)) {
    fail('assertion-1-hookfile', `Hook file not found at: ${hookDest}`)
  }
  // Also verify settings.json references a path that contains 'office-status-hook'
  const sampleEvent = HOOK_EVENTS[0]
  const sampleEntries = settings.hooks[sampleEvent]
  const hookCmds = sampleEntries.flatMap(e => (e.hooks || []).map(h => h.command || ''))
  if (!hookCmds.some(cmd => cmd.includes('office-status-hook'))) {
    fail('assertion-1-hookref', `settings.json hook command does not reference office-status-hook`, `commands found: ${JSON.stringify(hookCmds)}`)
  }
  console.log('[pack-smoke]   Hook file exists on disk and referenced in settings.json.')
  console.log('[pack-smoke] Assertion 1: PASS')

  // ── Assertion 2: idempotency — second setup run adds no duplicates ────────────
  console.log('[pack-smoke] Assertion 2: running setup again (idempotency)...')
  try {
    execSync(`node "${cliPath}" setup`, {
      cwd: tmpDir,
      env: homeEnv,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
  } catch (e) {
    fail('assertion-2-setup2-exit', `Second setup exited non-zero: ${e.message}`, e.stderr || '')
  }

  let settings2
  try {
    settings2 = JSON.parse(readFileSync(settingsPath, 'utf-8'))
  } catch (e) {
    fail('assertion-2-parse', `settings.json invalid after second setup: ${e.message}`)
  }

  const dupEvents = []
  for (const event of HOOK_EVENTS) {
    const entries = settings2?.hooks?.[event] || []
    const count = entries.filter(e =>
      (e.hooks || []).some(h => h.command && h.command.includes('office-status-hook'))
    ).length
    if (count > 1) dupEvents.push(`${event} (count=${count})`)
  }
  if (dupEvents.length > 0) {
    fail('assertion-2-duplicates', `Duplicate hook entries after second setup:`, ...dupEvents)
  }
  console.log('[pack-smoke]   No duplicates. Per-event count === 1.')
  console.log('[pack-smoke] Assertion 2: PASS')

  // ── Assertion 3: standalone hook exits 0 with __noop__ event ─────────────────
  console.log('[pack-smoke] Assertion 3: standalone hook test...')
  const noopEvent = JSON.stringify({ hook_event_name: '__noop__' })

  await new Promise((resolve, reject) => {
    const hookChild = spawn(process.execPath, [hookDest], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stderrBuf = ''
    let stdoutBuf = ''
    hookChild.stdout.on('data', d => { stdoutBuf += d.toString() })
    hookChild.stderr.on('data', d => { stderrBuf += d.toString() })
    hookChild.stdin.write(noopEvent)
    hookChild.stdin.end()

    hookChild.on('error', err => reject(new Error(`spawn error: ${err.message}`)))
    hookChild.on('close', code => {
      if (code !== 0) {
        reject(new Error(`hook exited ${code}. stderr: ${stderrBuf.slice(0, 500)}`))
        return
      }
      // Filter out benign [office-hook] prefixed messages (mirrors hookWriteLock.test.js)
      const nonBenignStderr = stderrBuf.split('\n').filter(line => {
        const trimmed = line.trim()
        return trimmed.length > 0 && !trimmed.includes('[office-hook]')
      }).join('\n')
      if (nonBenignStderr.length > 0) {
        reject(new Error(`hook produced non-benign stderr:\n${nonBenignStderr.slice(0, 500)}`))
        return
      }
      resolve()
    })
  }).catch(e => fail('assertion-3-hook', e.message))

  console.log('[pack-smoke]   Hook exited 0, no non-benign stderr.')
  console.log('[pack-smoke] Assertion 3: PASS')

  // ── Assertion 4: Quick-Start boot — dev mode serves HTML at / ─────────────────
  // Dev mode readiness design:
  //   cli.js default mode spawns Vite (not server.mjs). Vite does NOT expose
  //   /api/health — only server.mjs (serve command) does. We poll GET / for
  //   HTTP 200 + '<div id="root"' (index.html mount, confirmed in index.html:24).
  //   Budget: 120s (first run may npm-install dev deps via npm install if Vite
  //   can't be resolved; in practice deps are in node_modules already so it skips).
  console.log(`[pack-smoke] Assertion 4: Quick-Start boot on port ${port}...`)
  console.log('[pack-smoke]   (polls GET / for 200+HTML; dev mode has no /api/health)')

  devChild = spawn(process.execPath, [cliPath, `--port=${port}`, '--no-open'], {
    cwd: tmpDir,
    env: {
      ...process.env,
      HOME: fakeHome,
      USERPROFILE: fakeHome,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let devStdout = ''
  let devStderr = ''
  devChild.stdout.on('data', d => { devStdout += d.toString() })
  devChild.stderr.on('data', d => { devStderr += d.toString() })
  devChild.on('error', err => {
    fail('assertion-4-spawn', `Failed to spawn dev server: ${err.message}`)
  })

  // Check if child died early
  let devExited = false
  let devExitCode = null
  devChild.on('close', code => {
    devExited = true
    devExitCode = code
  })

  const BOOT_TIMEOUT_MS = 120_000
  const ready = await poll(async () => {
    if (devExited) return false // child crashed — stop polling
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`)
      if (res.ok) {
        const body = await res.text()
        return body.includes('<div id="root"')
      }
      return false
    } catch {
      return false
    }
  }, BOOT_TIMEOUT_MS, 1000)

  if (!ready) {
    const reason = devExited
      ? `Dev server exited prematurely with code ${devExitCode}`
      : `Dev server did not respond within ${BOOT_TIMEOUT_MS}ms`
    fail('assertion-4-boot',
      reason,
      `stdout (tail): ${devStdout.slice(-600)}`,
      `stderr (tail): ${devStderr.slice(-600)}`
    )
  }

  // GET / → 200 + HTML with app mount
  let rootBody = ''
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`)
    if (!res.ok) {
      fail('assertion-4-root', `GET / returned ${res.status} (expected 200)`)
    }
    rootBody = await res.text()
  } catch (e) {
    fail('assertion-4-root', `GET / threw: ${e.message}`)
  }

  if (!rootBody.includes('<div id="root"')) {
    fail('assertion-4-root-content',
      `GET / body does not contain '<div id="root"'`,
      `body snippet: ${rootBody.slice(0, 300)}`
    )
  }

  console.log('[pack-smoke]   Dev server responded with HTML containing app mount.')
  console.log('[pack-smoke] Assertion 4: PASS')

  console.log('\n[pack-smoke] ALL ASSERTIONS PASSED\n')

} finally {
  await cleanup()
}
