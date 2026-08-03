/**
 * Shared session scan/dedup/merge pipeline for vite.config.js and server.mjs.
 *
 * Single source of truth for GET /api/status logic.
 *
 * Scan strategy:
 *   1. Strict pass  — sessions whose _cwd matches projectRoot; excludes file-watcher.
 *   2. Fallback pass — any non-stale session, including file-watcher (last resort for
 *      zero-config users who haven't installed hooks yet).
 * Dedup:
 *   Remove bare office-status.json when it is a _seq-duplicate of a slugged session.
 *   Keyed by filename (not slug) so a branch literally named "main" does not collide
 *   with the bare file.
 * Merge:
 *   Single session → pass-through.
 *   Multi-session  → one representative (most urgent) agent per session.
 */

import fs from 'node:fs'
import path from 'node:path'

const STATUS_FILE_RE = /^office-status(-[^.]+)?\.json$/
const isWin = process.platform === 'win32'
const VALID_ROLES = new Set(['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer'])

// Shared TTL constants — keep in sync between scanAndMerge and getSessionStats
const STALE_MS = 300_000   // sessions older than 5 min are stale
const FUTURE_MS = 300_000  // sessions more than 5 min in the future are implausible (NTP jump)
// A fully-finished session's only representative is 'done'. Render that terminal "wrapping up"
// beat for this long, then drop it — instead of letting the sprite loiter until STALE_MS (5 min)
// as a motionless green corpse. Multi-worktree finish-waves otherwise stack several dead sprites
// on the floor, exactly the clutter the REDUCE bias exists to avoid (panel review 2026-07-01).
const DONE_RENDER_MS = 45_000

function pathsEqual(a, b) {
  return isWin ? a.toLowerCase() === b.toLowerCase() : a === b
}

/**
 * The project directory that session files are matched against.
 *
 * Both servers are spawned by `bin/cli.js` with `cwd` set to the PACKAGE root (Vite must
 * resolve its own config and sources from there), so under `npx agent-virtual-office` the
 * process cwd is the npx cache directory — not the project the user launched us from.
 * Hooks stamp `_cwd` with the real project, so every hook file then looks foreign and is
 * filtered out, leaving only file-watcher fallback data. `bin/cli.js` forwards the invoking
 * cwd as OFFICE_PROJECT_ROOT; an explicitly set value wins (useful for multi-worktree
 * setups), and the process.cwd() default keeps `npm run dev` unchanged.
 *
 * MUST be used for BOTH the read sites (scanAndMerge/getSessionStats) and the write sites
 * that stamp `_cwd` on POSTed payloads — a root that differs between the two makes the
 * server filter out its own writes.
 */
export function resolveProjectRoot(env = process.env, cwd = process.cwd()) {
  const override = env.OFFICE_PROJECT_ROOT
  return typeof override === 'string' && override.trim() !== ''
    ? path.resolve(override)
    : cwd
}

function hasValidBaseRole(role) {
  if (typeof role !== 'string' || role.length === 0) return false
  const sep = role.lastIndexOf('~')
  const base = sep === -1 ? role : role.slice(sep + 1)
  return VALID_ROLES.has(base)
}

// ─── mtime-based parse cache ──────────────────────────────────────────────
// scanAndMerge runs on every GET /api/status poll, every SSE connect, and every
// file-watcher debounce. It used to readFileSync + JSON.parse EVERY status file on
// EVERY call. In the typical case — one active worktree — a single edit changes one
// file, yet all the others were re-read and re-parsed for nothing.
//
// Root-cause fix: cache parsed payloads keyed on (mtimeMs, size). A statSync is far
// cheaper than readFileSync+JSON.parse (no buffer allocation, no UTF-8 decode, no JSON
// parse). When a file's stat signature is unchanged since the last scan, reuse the
// cached parsed object — turning per-call work from O(all sessions) into O(changed
// sessions). Atomic rename writes always bump mtime; size is a second discriminator so
// a same-coarse-tick rewrite of different length is still detected.
const _parseCache = new Map()  // fullPath -> { mtimeMs, size, parsed }
const PARSE_CACHE_MAX = 256

/**
 * Read + parse a status file with an mtime/size cache. Returns the parsed object,
 * or null when the file cannot be stat'd / read / parsed (caller skips it — same as
 * the previous inline try/catch `continue`). The returned object is the SHARED cached
 * instance — callers MUST treat it as read-only (scanAndMerge already only spreads /
 * reads fields, never mutates a session's `data`).
 */
function readSessionFileCached(fullPath) {
  let st
  try {
    st = fs.statSync(fullPath)
  } catch {
    return null  // file vanished between readdir and stat
  }
  const cached = _parseCache.get(fullPath)
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
    return cached.parsed
  }
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
  } catch {
    // Drop any stale cache entry for this path; a malformed file is re-read next call
    // (malformed files are the rare exception, not the hot path — not worth caching).
    _parseCache.delete(fullPath)
    return null
  }
  // Bounded prune: worktree count is realistically small (<30); 256 is generous head-
  // room. When exceeded, clear the whole cache — a cold rebuild costs one normal scan
  // and keeps the map from growing unbounded as transient worktree slugs come and go.
  if (_parseCache.size >= PARSE_CACHE_MAX) _parseCache.clear()
  _parseCache.set(fullPath, { mtimeMs: st.mtimeMs, size: st.size, parsed })
  return parsed
}

/**
 * Scan, dedup, and merge all active session files.
 *
 * @param {string} dir         - Directory to scan (usually ~/.claude/)
 * @param {string} projectRoot - CWD of the serving process (for strict matching)
 * @returns {object|null}      - Merged status payload, or null if nothing active
 */
export function scanAndMerge(dir, projectRoot) {
  const now = Date.now()
  const sessions = []
  let fromFallback = false
  // Resolve the project root ONCE — it is invariant across the whole scan. Previously
  // path.resolve(projectRoot) was recomputed for every status file in both the strict
  // and fallback passes; with N session files that is 2N redundant path resolutions
  // per GET/SSE/watcher tick. The per-file _cwd still resolves inside the loop because
  // it differs per file.
  const resolvedRoot = path.resolve(projectRoot)

  function scanDir(strict) {
    if (!fs.existsSync(dir)) return
    let files
    try { files = fs.readdirSync(dir) } catch { return }  // dir is a file or permission denied
    for (const file of files) {
      if (!STATUS_FILE_RE.test(file)) continue
      try {
        const parsed = readSessionFileCached(path.join(dir, file))
        if (!parsed) continue  // unreadable / unparsable — skip (cache miss returns null)
        const seq = parseInt(parsed._seq, 10)
        // Skip stale or implausibly far future (e.g. NTP jump)
        if (!seq || now - seq > STALE_MS || seq > now + FUTURE_MS) continue
        if (strict) {
          if (parsed._cwd && !pathsEqual(path.resolve(parsed._cwd), resolvedRoot)) continue
          if (!parsed._cwd && file !== 'office-status.json') continue
          // File-watcher fires on every JS edit — exclude from strict to avoid
          // polluting multi-session views. Fallback pass includes it as last resort.
          if (parsed.source === 'file-watcher') continue
        } else {
          // Fallback: include file-watcher and the no-_cwd bare file, but exclude:
          // 1. Sessions from a different project (explicit _cwd set but doesn't match)
          // 2. Slugged files with no _cwd that strict mode excluded — they are from old
          //    hook versions or foreign tools and would suppress _hint:'no-hooks'.
          if (parsed._cwd && !pathsEqual(path.resolve(parsed._cwd), resolvedRoot)) continue
          if (!parsed._cwd && file !== 'office-status.json' && parsed.source !== 'file-watcher') continue
        }
        const slug = file === 'office-status.json'
          ? 'main'
          : file.replace(/^office-status-/, '').replace(/\.json$/, '')
        sessions.push({ slug, file, data: parsed })
      } catch {}
    }
  }

  scanDir(true)
  if (sessions.length === 0) {
    fromFallback = true
    scanDir(false)
  }

  if (sessions.length === 0) return null

  // Dedup: bare office-status.json is a hook duplicate when its _seq is within 2s
  // of any slugged session. Use file name as key (not slug) so branch="main" is safe.
  // Only apply timing dedup when the bare file was written by the hook (source='claude-cli');
  // POST/API writes are independent sessions and must not be dropped by timing proximity.
  if (sessions.length > 1) {
    const bareIdx = sessions.findIndex(s => s.file === 'office-status.json')
    if (bareIdx !== -1 && sessions[bareIdx].data.source === 'claude-cli') {
      const bareSeq = parseInt(sessions[bareIdx].data._seq, 10) || 0
      const bareWorkflow = sessions[bareIdx].data.workflow
      const isDup = sessions.some((s, i) =>
        i !== bareIdx && Math.abs((parseInt(s.data._seq, 10) || 0) - bareSeq) < 2000)
      const hasUniqueWorkflow = bareWorkflow &&
        !sessions.some((s, i) => i !== bareIdx && s.data.workflow === bareWorkflow)
      if (isDup && !hasUniqueWorkflow) sessions.splice(bareIdx, 1)
    }
  }

  if (sessions.length === 0) return null

  // C1: sort sessions deterministically before merging so JSON output is stable
  // (fs.readdirSync order is platform-dependent — unstable order → different JSON hash → no 304)
  sessions.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))

  let merged
  if (sessions.length === 1) {
    merged = { ...sessions[0].data }
    delete merged._cwd
  } else {
    const LIVE_STATUSES = new Set(['blocked', 'awaiting-approval', 'working', 'planning'])
    const PRI = { blocked: 0, 'awaiting-approval': 1, working: 2, planning: 3, done: 4 }
    const allAgents = []
    let workflow = null
    for (const { slug, data } of sessions) {
      // Pick the single most urgent agent from this session.
      // Role is the tiebreaker so the sort is stable across calls (C1).
      // `agents` is only validated to be JSON-parseable upstream, never schema-checked, so a
      // corrupt / old-hook-version / foreign-tool file can carry a truthy NON-ARRAY value
      // (string/number/object). `(data.agents || [])` let that through to `.filter` and threw
      // a TypeError that crashed the server at the unguarded SSE-connect + watch-debounce
      // callers. Array.isArray is the precise guard — a non-array session contributes no agent.
      const pick = (Array.isArray(data.agents) ? data.agents : [])
        .filter(a => a && typeof a === 'object' && hasValidBaseRole(a.role) && typeof a.status === 'string' && Object.prototype.hasOwnProperty.call(PRI, a.status))
        .sort((a, b) => {
          const pd = (PRI[a.status] ?? 9) - (PRI[b.status] ?? 9)
          return pd !== 0 ? pd : (a.role < b.role ? -1 : a.role > b.role ? 1 : 0)
        })[0]
      if (pick && typeof pick.role === 'string') {
        // Terminal 'done' representatives render only for DONE_RENDER_MS (a brief "just
        // finished" beat), then drop — so a finished session's sprite doesn't loiter for
        // the full STALE_MS. Live statuses are unaffected; idle is already filtered above.
        if (pick.status === 'done' && (now - (parseInt(data._seq, 10) || 0)) > DONE_RENDER_MS) continue
        // Only adopt workflow from a LIVE session. Done terminal sessions still render (for
        // the window above) but must not become a phantom active banner.
        if (!workflow && LIVE_STATUSES.has(pick.status) && data.workflow) workflow = data.workflow
        allAgents.push({ ...pick, role: `${slug}~${pick.role}`, session: slug })
      }
    }
    // C2: _seq is the max child _seq so the client's lastAppliedSeq stale-drop guard
    // stays armed during multi-session. A session exit can transiently lower _seq, but
    // the remaining session's next write advances it again within seconds. Colon-joined
    // strings fail the /^\d+$/ guard in inferStatus.js and silently disarm it entirely.
    // Plain loop instead of Math.max(...sessions.map(...)) — avoids the intermediate
    // mapped array and the argument-spread, both in the GET/SSE hot path.
    let maxSeqNum = 0
    for (const { data } of sessions) {
      const s = parseInt(data._seq, 10) || 0
      if (s > maxSeqNum) maxSeqNum = s
    }
    const maxSeq = String(maxSeqNum)
    let activeCount = 0
    for (const a of allAgents) if (LIVE_STATUSES.has(a.status)) activeCount++
    merged = {
      _seq: maxSeq,
      type: 'office-status',
      agents: allAgents,
      activeCount,
      workflow,
      source: 'multi-session',
      sessionCount: sessions.length,
    }
    // M6: carry forward mood from the most-recent *active* session that has one.
    // Restrict to sessions that contributed an active agent — same rationale as workflow:
    // a finished session (all agents done) must not inject its mood over an unrelated active
    // session whose own agents carry no mood of their own.
    const activeSlugs = new Set()
    for (const a of allAgents) if (LIVE_STATUSES.has(a.status)) activeSlugs.add(a.session)
    const moodSession = [...sessions]
      .filter(s => activeSlugs.has(s.slug))
      .sort((a, b) => (parseInt(b.data._seq, 10) || 0) - (parseInt(a.data._seq, 10) || 0))
      .find(s => s.data.mood)
    if (moodSession) {
      merged.mood = moodSession.data.mood
      if (moodSession.data.moodDuration != null) merged.moodDuration = moodSession.data.moodDuration
    }
    // AVO-108 / AVO-102: carry token usage + effort from the most-recent active session too,
    // mirroring mood — otherwise the token meter / thinking aura freeze at a stale value across
    // multiple concurrent worktrees (the single-session path passes them through via the spread).
    const recentActive = [...sessions]
      .filter(s => activeSlugs.has(s.slug))
      .sort((a, b) => (parseInt(b.data._seq, 10) || 0) - (parseInt(a.data._seq, 10) || 0))
    const tokSession = recentActive.find(s => s.data.tokens)
    if (tokSession) merged.tokens = tokSession.data.tokens
    const effSession = recentActive.find(s => s.data.effort)
    if (effSession) merged.effort = effSession.data.effort
    // AVO-helpers: concatenate helpers from all RECENT ACTIVE sessions, filter to well-formed
    // entries, de-dupe by id, and cap at 64. helpers are hook-produced (not POST-settable);
    // no restriction to activeSlugs — helpers may be emitted by any non-stale session.
    const VALID_PARENT_ROLES = new Set(['pm','arch','dev','qa','ops','res','gate','designer'])
    const seenHelperIds = new Set()
    const allHelpers = []
    for (const { data } of sessions) {
      if (!Array.isArray(data.helpers)) continue
      for (const h of data.helpers) {
        if (!h || typeof h !== 'object') continue
        if (typeof h.id !== 'string' || !h.id) continue
        if (typeof h.parentRole !== 'string' || !VALID_PARENT_ROLES.has(h.parentRole)) continue
        if (seenHelperIds.has(h.id)) continue
        seenHelperIds.add(h.id)
        const entry = { id: h.id, parentRole: h.parentRole }
        if (typeof h.label === 'string') entry.label = h.label
        allHelpers.push(entry)
        if (allHelpers.length >= 64) break
      }
      if (allHelpers.length >= 64) break
    }
    // Always assign merged.helpers — even when empty — so an explicit cleared state
    // (all subagent helpers finished) propagates on the next tick instead of lingering
    // up to TTL (~60 s). A missing field is treated as "no information" by ingestion;
    // an explicit [] is treated as "cleared". Asymmetry with single-session (which
    // passes helpers through via spread, including absence) is intentional: the multi-
    // session path is the only place that aggregates across subagents and must own the
    // cleared signal.
    merged.helpers = allHelpers
  }

  // Zero-config signal: all data comes from file-watcher, meaning hooks aren't installed yet.
  if (fromFallback && sessions.every(s => s.data.source === 'file-watcher')) {
    merged._hint = 'no-hooks'
  }

  return merged
}

/**
 * Lightweight stats for /api/health — does not do the full merge.
 *
 * @param {string} dir
 * @param {string} projectRoot
 * @returns {{ hookSessionCount: number, fileWatcherPresent: boolean }}
 */
export function getSessionStats(dir, projectRoot) {
  if (!fs.existsSync(dir)) return { hookSessionCount: 0, fileWatcherPresent: false }
  const now = Date.now()
  let hookSessionCount = 0
  let fileWatcherPresent = false
  let files
  try { files = fs.readdirSync(dir) } catch { return { hookSessionCount: 0, fileWatcherPresent: false } }
  // Resolve the project root once — invariant across the scan (see scanAndMerge).
  const resolvedRoot = path.resolve(projectRoot)
  for (const file of files) {
    if (!STATUS_FILE_RE.test(file)) continue
    try {
      const parsed = readSessionFileCached(path.join(dir, file))
      if (!parsed) continue  // shared mtime/size cache — skip unreadable files
      const seq = parseInt(parsed._seq, 10)
      if (!seq || now - seq > STALE_MS || seq > now + FUTURE_MS) continue
      if (parsed.source === 'file-watcher') {
        fileWatcherPresent = true
      } else if (
        (parsed._cwd && pathsEqual(path.resolve(parsed._cwd), resolvedRoot)) ||
        (!parsed._cwd && file === 'office-status.json' && parsed.source !== 'file-watcher')
      ) {
        hookSessionCount++
      }
    } catch {}
  }
  return { hookSessionCount, fileWatcherPresent }
}
