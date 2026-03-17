/**
 * Level B: Infer office status from AgentCortex's current_state.md
 * Completely read-only — does not write anything
 *
 * In browser context, this can be fed data via:
 * - URL params: ?active=dev&phase=implementing
 * - postMessage from parent (artifact mode)
 * - Manual trigger from ControlPanel
 */

const commandToAgent = {
  '/bootstrap': 'pm', '/plan': 'pm', '/spec': 'pm',
  '/brainstorm': 'arch', '/decide': 'arch',
  '/implement': 'dev',
  '/test': 'qa', '/review': 'qa', '/test-classify': 'qa',
  '/ship': 'ops', '/handoff': 'ops', '/retro': 'ops',
  '/research': 'res',
}

/**
 * Parse inference data from various sources
 */
export function inferFromParams() {
  const params = new URLSearchParams(window.location.search)
  const command = params.get('command') || params.get('cmd')
  const phase = params.get('phase')
  const active = params.get('active')

  if (!command && !phase && !active) return null

  return {
    mode: 'agentcortex',
    activeAgent: active || commandToAgent[command] || null,
    activeCommand: command || null,
    phase: phase || null,
  }
}

/**
 * Listen for postMessage from parent (artifact / embedded mode)
 * Expected message format: { type: 'office-vibe', agent: 'dev', command: '/implement', phase: 'implementing' }
 */
export function listenForVibeUpdates(callback) {
  const handler = (event) => {
    const data = event.data
    if (data && data.type === 'office-vibe') {
      callback({
        mode: 'agentcortex',
        activeAgent: data.agent || commandToAgent[data.command] || null,
        activeCommand: data.command || null,
        phase: data.phase || null,
      })
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
