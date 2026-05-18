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

function pathsEqual(a, b) {
  return isWin ? a.toLowerCase() === b.toLowerCase() : a === b
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

  function scanDir(strict) {
    if (!fs.existsSync(dir)) return
    for (const file of fs.readdirSync(dir)) {
      if (!STATUS_FILE_RE.test(file)) continue
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
        const parsed = JSON.parse(raw)
        const seq = parseInt(parsed._seq, 10)
        // Skip stale (>5 min old) or implausibly far future (>5 min ahead, e.g. NTP jump)
        if (!seq || now - seq > 300_000 || seq > now + 300_000) continue
        if (strict) {
          if (parsed._cwd && !pathsEqual(path.resolve(parsed._cwd), path.resolve(projectRoot))) continue
          if (!parsed._cwd && file !== 'office-status.json') continue
          // File-watcher fires on every JS edit — exclude from strict to avoid
          // polluting multi-session views. Fallback pass includes it as last resort.
          if (parsed.source === 'file-watcher') continue
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
  if (sessions.length > 1) {
    const bareIdx = sessions.findIndex(s => s.file === 'office-status.json')
    if (bareIdx !== -1) {
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

  let merged
  if (sessions.length === 1) {
    merged = { ...sessions[0].data }
    delete merged._cwd
  } else {
    const PRI = { blocked: 0, working: 1, done: 2, idle: 3 }
    const allAgents = []
    let workflow = null
    for (const { slug, data } of sessions) {
      if (!workflow && data.workflow) workflow = data.workflow
      // Pick the single most urgent agent from this session
      const pick = (data.agents || [])
        .filter(a => a && typeof a === 'object' && (a.status === 'working' || a.status === 'blocked'))
        .sort((a, b) => (PRI[a.status] ?? 9) - (PRI[b.status] ?? 9))[0]
      if (pick && typeof pick.role === 'string') {
        allAgents.push({ ...pick, role: `${slug}~${pick.role}`, session: slug })
      }
    }
    const mergedSeq = sessions.reduce((max, { data }) => {
      const s = parseInt(data._seq, 10)
      return Number.isFinite(s) && s > max ? s : max
    }, 0)
    merged = {
      _seq: String(mergedSeq || Date.now()),
      type: 'office-status',
      agents: allAgents,
      activeCount: allAgents.filter(a => a.status === 'working' || a.status === 'blocked').length,
      workflow,
      source: 'multi-session',
      sessionCount: sessions.length,
    }
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
  for (const file of fs.readdirSync(dir)) {
    if (!STATUS_FILE_RE.test(file)) continue
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
      const parsed = JSON.parse(raw)
      const seq = parseInt(parsed._seq, 10)
      if (!seq || now - seq > 300_000 || seq > now + 60_000) continue
      if (parsed.source === 'file-watcher') {
        fileWatcherPresent = true
      } else if (parsed._cwd && pathsEqual(path.resolve(parsed._cwd), path.resolve(projectRoot))) {
        hookSessionCount++
      }
    } catch {}
  }
  return { hookSessionCount, fileWatcherPresent }
}
