/**
 * Agent Virtual Office — Bridge Script
 *
 * Inject this into any page to send status updates to the Virtual Office.
 * Works cross-tab via BroadcastChannel (same origin) or cross-origin via postMessage.
 *
 * Usage from CLI:
 *   // Open office, then inject this script in any same-origin tab:
 *   <script src="http://localhost:5174/bridge.js"></script>
 *   <script>officeBridge.send({ dev: 'working', workflow: 'Build Feature' })</script>
 *
 * Usage from JS console:
 *   officeBridge.send({ dev: 'working', qa: 'testing', workflow: 'Sprint 42' })
 *   officeBridge.send({ dev: 'blocked', label: 'Stuck on auth' })
 *   officeBridge.send({ activeCount: 3 })
 *   officeBridge.stop()
 *
 * Shorthand format:
 *   officeBridge.send({ dev: 'working' })        → dev is working
 *   officeBridge.send({ dev: 'implement-auth' })  → dev is working on "implement-auth"
 *   officeBridge.send({ qa: 'blocked' })          → qa is blocked
 *   officeBridge.send({ pm: 'done' })             → pm is done
 */
;(function () {
  'use strict'
  if (typeof window === 'undefined') return

  const CHANNEL_NAME = 'agent-office'
  const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
  // Must stay in step with src/utils/statusContract.mjs. This list is not just a filter:
  // parseShorthand() below treats any value that is NOT in it as a TASK NAME, so a missing
  // status silently becomes `{ status: 'working', task: 'planning' }` -- the office then
  // showed a planning or awaiting-approval agent as busily working, with the real state
  // demoted to a label. 'planning' is AVO-101, 'awaiting-approval' is AVO-167.
  const VALID_STATUSES = ['idle', 'working', 'blocked', 'done', 'planning', 'awaiting-approval']
  const DEFAULT_SOURCE = detectDefaultSource()

  // 2026-09-26 audit finding 4 (bridge spoofing): must stay in sync with the identically-named
  // set in `src/inference/inferStatus.js` (`HOOK_ORIGIN`). This file is a standalone script
  // (loaded via a plain <script> tag, no bundler) so it cannot `import` that module — the set
  // is duplicated here deliberately. `inferStatus.js` treats these sources as sharing one
  // monotonic clock and uses their `_seq` as a stale-drop high-water mark; a page (or a crafted
  // `bridge.html?source=claude-cli&_seq=<future>` URL) claiming one of these origins could raise
  // that mark and cause real, later hook updates to be dropped as "stale". Any caller-supplied
  // `source` naming one of these is replaced with the page's own DEFAULT_SOURCE.
  const HOOK_ORIGIN = new Set(['claude-cli', 'codex-cli', 'multi-session', 'file-watcher'])

  function sanitizeSource(src) {
    if (src && HOOK_ORIGIN.has(src)) return DEFAULT_SOURCE
    return src || DEFAULT_SOURCE
  }

  let bc = null
  try { bc = new BroadcastChannel(CHANNEL_NAME) } catch (_) {}

  function detectDefaultSource() {
    const ua = navigator.userAgent || ''
    if (window.__codex__ || /Codex/i.test(ua)) return 'codex-app'
    if (window.__claude_artifact__ || /Claude/i.test(ua)) return 'claude-desktop'
    if (window.__antigravity__ || /Antigravity/i.test(ua)) return 'antigravity'
    return 'browser'
  }

  function parseShorthand(obj) {
    const agents = []
    let workflow = obj.workflow || null
    let activeCount = obj.activeCount || 0
    let source = sanitizeSource(obj.source)
    let globalLabel = obj.label || null

    for (const key of VALID_ROLES) {
      const val = obj[key]
      if (val == null) continue

      const isStatus = VALID_STATUSES.includes(val)
      agents.push({
        role: key,
        task: isStatus ? null : val,
        status: isStatus ? val : 'working',
        label: globalLabel,
      })
    }

    return {
      type: 'office-status',
      agents,
      activeCount,
      workflow,
      source,
      // Always our own — never the caller's. See HOOK_ORIGIN comment above: a caller-supplied
      // `_seq` (including one arriving via URL params) could otherwise poison the client's
      // stale-drop high-water mark.
      _seq: String(Date.now()),
    }
  }

  function send(shorthand) {
    const msg = shorthand.type === 'office-status'
      ? {
          ...shorthand,
          source: sanitizeSource(shorthand.source),
          _seq: String(Date.now()),
        }
      : parseShorthand(shorthand)

    // BroadcastChannel (same-origin cross-tab)
    if (bc) {
      try { bc.postMessage(msg) } catch (_) {}
    }

    // Also try postMessage to parent (for iframe/artifact embedding)
    if (window.parent && window.parent !== window) {
      try {
        const targetOrigin = window.location.origin
        if (targetOrigin) window.parent.postMessage(msg, targetOrigin)
      } catch (_) {}
    }
  }

  function stop() {
    send({ type: 'office-status', agents: [], activeCount: 0, workflow: null })
    if (bc) { bc.close(); bc = null }
  }

  // Auto-send from URL params: bridge.html?dev=working&qa=testing&workflow=Sprint
  if (window.location.search) {
    const params = new URLSearchParams(window.location.search)
    const auto = {}
    for (const [k, v] of params.entries()) auto[k] = v
    if (Object.keys(auto).length > 0) {
      send(auto)
    }
  }

  window.officeBridge = { send, stop, parseShorthand }
})()
