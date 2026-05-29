/**
 * #A3 — dev-mode unknown-classification accumulator (LangSmith-style).
 *
 * When any classify* function falls to Tier 5 (unknown), the raw input is
 * recorded here so devs can see "what tools/statuses/moods/roles/workflows
 * have we been called with that we don't have specific mappings for yet?"
 *
 * Self-improving loop: high-frequency entries become candidates for Tier 0
 * registration in `src/systems/classify.js`. Low-frequency entries reveal
 * MCP servers or external integrations new to the project.
 *
 * Strictly dev-only: production bundles short-circuit `recordUnknown` to a
 * no-op via `isDevMode()`. The data lives in-memory only — no persistence,
 * no network reporting, no user data (raw values are tool/status/mood/role
 * /workflow names).
 *
 * Browser convenience: `window.__office_unknownLog` exposes the raw Maps,
 * and `window.__office_logUnknowns()` prints a sorted console report.
 */

const MAX_PER_KIND = 200

// Five buckets — one per classify* function's "unknown" branch.
const counts = {
  task:     new Map(),
  status:   new Map(),
  mood:     new Map(),
  role:     new Map(),
  workflow: new Map(),
}

/**
 * Decide whether recording is enabled.
 *
 * Default: ON for dev/test, OFF when Vite's `import.meta.env.PROD === true`.
 * Override hooks (for tests and manual control):
 *   `globalThis.__OFFICE_FORCE_UNKNOWN_LOG__ = true`  forces ON
 *   `globalThis.__OFFICE_FORCE_UNKNOWN_LOG__ = false` forces OFF
 *
 * The PROD check is wrapped in try/catch because Node-side test runners may
 * not provide an `import.meta.env` and reading it throws.
 */
export function isDevMode() {
  if (globalThis.__OFFICE_FORCE_UNKNOWN_LOG__ === true)  return true
  if (globalThis.__OFFICE_FORCE_UNKNOWN_LOG__ === false) return false
  try {
    // eslint-disable-next-line no-undef
    if (typeof import.meta !== 'undefined' && import.meta.env?.PROD === true) return false
  } catch { /* import.meta unavailable — assume dev */ }
  return true
}

/**
 * Record one Tier 5 fallback. No-op outside dev mode.
 *
 * `kind` MUST be one of: 'task' | 'status' | 'mood' | 'role' | 'workflow'.
 * `raw` MUST be a non-empty string (defensive — silently drops other types
 * since the consumers are pure classify functions that already coerce).
 */
export function recordUnknown(kind, raw) {
  if (!isDevMode()) return
  if (typeof raw !== 'string' || raw.length === 0) return
  const bucket = counts[kind]
  if (!bucket) return
  bucket.set(raw, (bucket.get(raw) || 0) + 1)
  // Cap: evict oldest entry when over limit (Map preserves insertion order,
  // so .keys().next() gives the oldest).
  if (bucket.size > MAX_PER_KIND) {
    const firstKey = bucket.keys().next().value
    bucket.delete(firstKey)
  }
  // Expose the buckets globally so devs can inspect via DevTools without
  // needing a console-bound import.
  if (typeof window !== 'undefined') {
    window.__office_unknownLog = counts
  }
}

/**
 * Get a sorted, capped report. Returns an object keyed by kind, with each
 * value an array of `[raw, count]` tuples sorted by count descending.
 *
 * Safe to call in any environment — purely reads `counts`.
 */
export function getUnknownReport() {
  const out = {}
  for (const kind of Object.keys(counts)) {
    out[kind] = Array.from(counts[kind].entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
  }
  return out
}

/**
 * Reset all buckets. Called by vitest beforeEach to prevent cross-test pollution.
 */
export function clearUnknownLog() {
  for (const kind of Object.keys(counts)) counts[kind].clear()
}

// Console reporter convenience — only attached in browser, only printable
// from DevTools. The function itself is harmless in production (just reads
// the empty Maps and prints nothing).
if (typeof window !== 'undefined') {
  window.__office_logUnknowns = function logUnknowns() {
    const report = getUnknownReport()
    let printed = false
    for (const kind of Object.keys(report)) {
      if (report[kind].length === 0) continue
      printed = true
      // eslint-disable-next-line no-console
      console.group(`Unknown ${kind}s (top ${report[kind].length}):`)
      for (const [raw, count] of report[kind]) {
        // eslint-disable-next-line no-console
        console.log(`  ${count}× ${raw}`)
      }
      // eslint-disable-next-line no-console
      console.groupEnd()
    }
    if (!printed) {
      // eslint-disable-next-line no-console
      console.log('Unknown log is empty — every classification hit Tier 0–4.')
    }
  }
}
