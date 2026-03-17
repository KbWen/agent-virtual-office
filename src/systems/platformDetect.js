/**
 * Platform detection for Virtual Office
 *
 * Supported platforms:
 * - browser:     Standard browser (double-click HTML or dev server)
 * - claude-cli:  Claude Code CLI (opens in browser via preview)
 * - claude-desktop: Claude Desktop (artifact mode)
 * - codex-app:   OpenAI Codex App (embedded webview)
 * - codex-cli:   OpenAI Codex CLI (opens in browser)
 * - antigravity: Google Antigravity (embedded panel)
 */

export function detectPlatform() {
  if (typeof window === 'undefined') return 'node'

  const ua = navigator.userAgent || ''
  const url = window.location.href || ''
  const search = window.location.search || ''

  // Check URL params first (explicit override)
  const params = new URLSearchParams(search)
  const forced = params.get('platform')
  if (forced) return forced

  // Claude Desktop artifact context
  if (window.__claude_artifact__ || url.includes('artifact') || window.parent !== window) {
    // Check if we're in an iframe (artifact mode)
    try {
      if (window.parent !== window && window.parent.document) {
        // Same-origin iframe (e.g. dev preview) — treat as embedded
        return 'embedded'
      }
    } catch {
      // Cross-origin iframe — likely artifact or embedded
      if (ua.includes('Claude') || url.includes('claude')) return 'claude-desktop'
      if (ua.includes('Codex') || url.includes('codex')) return 'codex-app'
      if (ua.includes('Antigravity') || url.includes('antigravity')) return 'antigravity'
      return 'embedded'
    }
  }

  // Antigravity panel detection
  if (window.__antigravity__ || url.includes('antigravity') || document.querySelector('[data-antigravity]')) {
    return 'antigravity'
  }

  // Codex app detection
  if (window.__codex__ || ua.includes('Codex')) {
    return 'codex-app'
  }

  // Default: standard browser (works for claude-cli and codex-cli which open browsers)
  return 'browser'
}

/**
 * Get platform-specific config adjustments
 */
export function getPlatformConfig(platform) {
  const configs = {
    browser: {
      showControlPanel: true,
      animationQuality: 'full',
      maxAgents: 7,
      viewBoxWidth: 680,
      viewBoxHeight: 520,
    },
    'claude-cli': {
      showControlPanel: true,
      animationQuality: 'full',
      maxAgents: 7,
      viewBoxWidth: 680,
      viewBoxHeight: 520,
    },
    'claude-desktop': {
      showControlPanel: true,
      animationQuality: 'medium', // Lighter in artifact context
      maxAgents: 7,
      viewBoxWidth: 680,
      viewBoxHeight: 520,
    },
    'codex-app': {
      showControlPanel: true,
      animationQuality: 'medium',
      maxAgents: 7,
      viewBoxWidth: 680,
      viewBoxHeight: 520,
    },
    'codex-cli': {
      showControlPanel: true,
      animationQuality: 'full',
      maxAgents: 7,
      viewBoxWidth: 680,
      viewBoxHeight: 520,
    },
    antigravity: {
      showControlPanel: true,
      animationQuality: 'medium',
      maxAgents: 7,
      viewBoxWidth: 680,
      viewBoxHeight: 520,
    },
    embedded: {
      showControlPanel: false,
      animationQuality: 'light',
      maxAgents: 3,
      viewBoxWidth: 680,
      viewBoxHeight: 520,
    },
  }

  return configs[platform] || configs.browser
}

/**
 * Detect project mode based on what files exist nearby
 * This is for the Level B inference - checks if we're in an AgentCortex project
 */
export function detectProjectMode() {
  // In browser context, we rely on URL params or config
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  if (mode) return mode

  // Default: check if we have data-mode on root
  const root = document.getElementById('root')
  if (root?.dataset.mode) return root.dataset.mode

  // Fallback: agentcortex (full 7 agents)
  return 'agentcortex'
}
