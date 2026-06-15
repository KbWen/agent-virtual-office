/**
 * Context Bubble Generator — makes characters feel alive
 *
 * Takes the actual work context (file names, commands, search patterns)
 * from hook events and transforms them into first-person character dialogue.
 *
 * Features:
 * - Role-specific personality (Dev is energetic, QA is meticulous, etc.)
 * - Context-aware: references actual files/commands being worked on
 * - Cross-agent reactions: characters react to each other's status changes
 * - Random office gossip and chitchat
 * - Bilingual (en + zh-TW) via i18n template pools
 */

import { t } from '../i18n'
import { rng } from './rng.js'
import { WORK_CLAIM_SIGNAL_WINDOW } from './constants.js'
import { findSharedFilePair } from './pairHuddle.js'

function pick(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  return arr[Math.floor(rng() * arr.length)]
}

/**
 * Extract short context from hook label
 * "✏️ 改 App.jsx" → "App.jsx"
 * "⚡ npm test" → "npm test"
 * "🔎 搜 useLocale" → "useLocale"
 */
export function extractContext(label) {
  if (!label) return null
  // Strip emoji prefix: "✏️ 改 App.jsx" → "改 App.jsx" → "App.jsx"
  // Pattern: optional emoji(s) + optional Chinese verb + space + context
  const stripped = label
    .replace(/^(?:[\p{Extended_Pictographic}\u200d\ufe0f]|[0-9#*]\ufe0f?\u20e3|\s)+/u, '') // leading emoji
    .replace(/^(改|寫|讀|找|搜|跑|派)\s*/u, '')                     // zh verb
    .replace(/^(editing|writing|reading|searching|running)\s*/i, '') // en verb
    .trim()
  return stripped || null
}

/**
 * Resolve a template key from i18n contextBubbles, fill in {ctx}
 */
function fromTemplate(key, ctx) {
  const pool = t(`contextBubbles.${key}`)
  if (!Array.isArray(pool) || pool.length === 0) return null
  const template = pick(pool)
  if (!template) return null
  // Use a function replacer (not a string) so `$`-sequences in ctx — which can be
  // a real filename or task string like `$&`, `$1`, `` $` `` — are inserted
  // literally rather than interpreted as String.prototype.replace substitution
  // patterns. A string replacement of "$&" would re-inject the matched "{ctx}".
  return ctx
    ? template.replace(/\{ctx\}/g, () => ctx)
    : template.replace(/\s*\{ctx\}\s*/g, '')
}

// AVO-104: map a raw skill / subagent name to a localized skill-bubble string. Mirrors the buckets
// (and order) of the hook's skillLabel() so the in-scene bubble matches the role-routing vocabulary.
// The icon lives INSIDE the i18n string (text channel, a11y-friendly — not an icon-only SVG). Derived
// on the CLIENT from the raw skill name so the bubble follows the viewer's locale, not the hook-time
// language. Returns null for a missing/non-string skill.
const SKILL_FAMILY = [
  [/plan/i, 'plan'],
  [/spec|bootstrap/i, 'spec'],
  [/review/i, 'review'],
  [/test/i, 'test'],
  [/implement|code/i, 'implement'],
  [/fix|debug/i, 'fix'],
  [/ship|deploy/i, 'ship'],
  [/research|explore/i, 'research'],
  [/architect|design/i, 'architect'],
  [/security|audit/i, 'security'],
]
export function skillBubbleText(skill, tt = t) {
  if (!skill || typeof skill !== 'string') return null
  for (const [re, fam] of SKILL_FAMILY) {
    if (re.test(skill)) return tt(`skillBubbles.${fam}`)
  }
  // generic fallback: "💼 {ctx}" — function replacer so `$`-sequences in the raw name stay literal.
  const generic = tt('skillBubbles.generic')
  return typeof generic === 'string' ? generic.replace(/\{ctx\}/g, () => skill) : null
}

/**
 * Map tool name to action category for template lookup
 */
export function toolToAction(task) {
  if (!task) return null
  switch (task) {
    case 'Edit': return 'edit'
    case 'Write': return 'write'
    case 'Read': return 'read'
    case 'Bash': return 'bash'
    case 'Grep': case 'Glob': return 'search'
    case 'Agent': return 'delegate'
    case 'WebFetch': case 'WebSearch': return 'web'
    case 'NotebookEdit': return 'edit'
    default: return 'generic'
  }
}

/**
 * Generate a context-aware bubble for an agent based on their current work
 *
 * @param {string} agentId - role id (dev, qa, ops, etc.)
 * @param {object} update - { status, task, label, hint }
 * @param {object} allExternalStatus - current externalStatus from store
 * @returns {string|null} bubble text
 */
export function generateContextBubble(agentId, update, allExternalStatus) {
  if (!update || typeof agentId !== 'string') return null

  // Strip worktree session prefix so 'feat-x~dev' resolves to 'dev' templates
  const baseRole = agentId.includes('~') ? agentId.split('~').pop() : agentId

  const { status, task, label, hint, skill } = update
  const ctx = extractContext(label)
  const action = toolToAction(task)

  // 1. Error reactions — highest priority, always show
  if (hint === 'error' || status === 'blocked') {
    const errorBubble = fromTemplate(`${baseRole}-error`, ctx)
      || fromTemplate('any-error', ctx)
    if (errorBubble) return errorBubble
  }

  // 2. Done reactions
  if (status === 'done') {
    const doneBubble = fromTemplate(`${baseRole}-done`, ctx)
      || fromTemplate('any-done', ctx)
    if (doneBubble) return doneBubble
  }

  // 2.5 Skill activation (AVO-104) — a real SubagentStart working-phase event. Blocked/done returned
  // above, and the explicit guard keeps a skill bubble off any blocked/done update (honest: skill is a
  // working-phase announcement only, never a 2nd channel over a real state). Announce the skill once
  // ("🧐 Reviewing"); it then competes at `working` priority in the bubble cap and expires on the
  // existing clearBubble timer — no persistence, no new over-head element (AVO-131 line held).
  if (skill && status !== 'blocked' && status !== 'done') {
    const skillBubble = skillBubbleText(skill)
    if (skillBubble) return skillBubble
  }

  // 3. Role × action specific (e.g., dev-edit, qa-search, ops-bash)
  if (action) {
    const specific = fromTemplate(`${baseRole}-${action}`, ctx)
    if (specific) return specific
  }

  // 4. Role generic working
  const working = fromTemplate(`${baseRole}-working`, ctx)
  if (working) return working

  // 5. Cross-agent awareness — react to other agents (AC-H4: gated on recentSignal)
  if (rng() < 0.25) {
    const reaction = generateCrossReaction(agentId, allExternalStatus, Date.now())
    if (reaction) return reaction
  }

  // 6. Random gossip (low chance, adds life)
  if (rng() < 0.1) {
    const gossip = fromTemplate('gossip', null)
    if (gossip) return gossip
  }

  return null
}

/**
 * Generate a reaction to another agent's current state.
 *
 * AC-H4 (ADR-007 D3 G2/G3/G7): returns null UNLESS the reacted-to agent's changedAt is
 * within WORK_CLAIM_SIGNAL_WINDOW (recentSignal). This prevents fabricating awareness of
 * another agent's state when the signal is stale.
 *
 * - react-colleague-blocked: gated on recentSignal alone (not co-edit).
 * - react-colleague-done: gated on recentSignal alone (not co-edit).
 *   (shared-artifact lines in S4 banter additionally require findSharedFilePair; that is S4
 *   scope, not S1b — included here only as the import is present for future use.)
 *
 * @param {string} agentId
 * @param {object|null} allExternalStatus
 * @param {number} now  Date.now() — callers pass this so tests can control time
 */
export function generateCrossReaction(agentId, allExternalStatus, now = Date.now()) {
  if (!allExternalStatus) return null

  const recentSignal = (es) =>
    !!(es && Number.isFinite(es.changedAt) && (now - es.changedAt) < WORK_CLAIM_SIGNAL_WINDOW)

  // Iterate keys directly — Object.entries() allocates an array of [id,ext] pair
  // arrays. This runs on the SSE/poll message path (generateContextBubble per
  // agent per applyExternalStatus); the id and ext are both read in place.
  for (const otherId of Object.keys(allExternalStatus)) {
    if (otherId === agentId) continue
    const ext = allExternalStatus[otherId]

    // React to blocked colleague — gated on recentSignal
    if (ext.status === 'blocked' && recentSignal(ext)) {
      return fromTemplate('react-colleague-blocked', null)
    }

    // React to done colleague — gated on recentSignal
    if (ext.status === 'done' && recentSignal(ext)) {
      return fromTemplate('react-colleague-done', null)
    }
  }

  return null
}
