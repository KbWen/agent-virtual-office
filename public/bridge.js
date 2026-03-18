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
  const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate']
  const VALID_STATUSES = ['idle', 'working', 'blocked', 'done']

  let bc = null
  try { bc = new BroadcastChannel(CHANNEL_NAME) } catch (_) {}

  function parseShorthand(obj) {
    const agents = []
    let workflow = obj.workflow || null
    let activeCount = obj.activeCount || 0
    let source = obj.source || null
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
    }
  }

  function send(shorthand) {
    const msg = shorthand.type === 'office-status' ? shorthand : parseShorthand(shorthand)

    // BroadcastChannel (same-origin cross-tab)
    if (bc) {
      try { bc.postMessage(msg) } catch (_) {}
    }

    // Also try postMessage to parent (for iframe/artifact embedding)
    if (window.parent && window.parent !== window) {
      try {
        const targetOrigin = window.location.origin || '*'
        window.parent.postMessage(msg, targetOrigin)
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
