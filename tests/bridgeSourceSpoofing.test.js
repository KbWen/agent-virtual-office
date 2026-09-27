/**
 * bridgeSourceSpoofing.test.js — 2026-09-26 audit finding 4.
 *
 * `public/bridge.js` is a standalone, un-bundled script (no import/export) meant to be loaded
 * via a plain <script> tag into arbitrary pages, including `bridge.html?...` URL params fed
 * straight into `send()`/`parseShorthand()`. Before this fix, both functions forwarded a
 * caller-supplied `source` and `_seq` unchanged. `src/inference/inferStatus.js` treats
 * HOOK_ORIGIN sources (`claude-cli`, `codex-cli`, `multi-session`, `file-watcher`) as sharing
 * one monotonic clock and uses their `_seq` as a stale-drop high-water mark — a page (or a
 * crafted URL) claiming `source=claude-cli&_seq=<now+N>` could raise that mark and cause real,
 * later hook updates to be dropped as stale.
 *
 * The project has no jsdom dependency (SSR-render pattern is used elsewhere instead — see
 * tests/blockedReasonBadge.test.jsx), so this test evaluates the actual bridge.js source in a
 * minimal Node `vm` sandbox exposing just enough of the browser surface (window/navigator/
 * URLSearchParams) rather than adding a new dependency for one file.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, it, expect } from 'vitest'

const bridgeSrc = readFileSync(path.join(process.cwd(), 'public', 'bridge.js'), 'utf-8')

/**
 * Evaluate bridge.js in a fresh sandbox. `window.parent` is a DISTINCT object with a spy
 * `postMessage`, so `send()`'s cross-frame branch fires and we can inspect exactly what it
 * broadcast — `bc` (BroadcastChannel) is intentionally left undefined so the constructor
 * throws and is swallowed by bridge.js's own try/catch, keeping this harness dependency-free.
 */
function makeBridge({ search = '' } = {}) {
  const posted = []
  const win = {}
  win.window = win
  win.location = { search, origin: 'http://localhost:5174' }
  win.navigator = { userAgent: 'test-agent/1.0' }
  win.parent = {
    postMessage: (msg, origin) => posted.push({ msg, origin }),
  }
  const sandbox = { window: win, navigator: win.navigator, URLSearchParams }
  vm.createContext(sandbox)
  vm.runInContext(bridgeSrc, sandbox, { filename: 'bridge.js' })
  return { win, posted }
}

describe('bridge.js — never forwards a hook-origin source (finding 4)', () => {
  it('replaces a caller-claimed "claude-cli" source on a full office-status message', () => {
    const { win, posted } = makeBridge()
    win.officeBridge.send({ type: 'office-status', agents: [], activeCount: 0, source: 'claude-cli' })
    expect(posted).toHaveLength(1)
    expect(posted[0].msg.source).not.toBe('claude-cli')
  })

  it('replaces every HOOK_ORIGIN value (codex-cli, multi-session, file-watcher)', () => {
    for (const spoofed of ['codex-cli', 'multi-session', 'file-watcher']) {
      const { win, posted } = makeBridge()
      win.officeBridge.send({ type: 'office-status', agents: [], activeCount: 0, source: spoofed })
      expect(posted[0].msg.source).not.toBe(spoofed)
    }
  })

  it('leaves a non-hook-origin source untouched (does not over-sanitize legitimate sources)', () => {
    const { win, posted } = makeBridge()
    win.officeBridge.send({ type: 'office-status', agents: [], activeCount: 0, source: 'my-custom-tool' })
    expect(posted[0].msg.source).toBe('my-custom-tool')
  })

  it('shorthand form (parseShorthand path) also sanitizes a spoofed source', () => {
    const { win, posted } = makeBridge()
    win.officeBridge.send({ dev: 'working', source: 'claude-cli' })
    expect(posted[0].msg.source).not.toBe('claude-cli')
  })

  it('parseShorthand is directly reachable and sanitizes too', () => {
    const { win } = makeBridge()
    const msg = win.officeBridge.parseShorthand({ dev: 'working', source: 'file-watcher' })
    expect(msg.source).not.toBe('file-watcher')
  })
})

describe('bridge.js — always stamps its own _seq, never the caller\'s (finding 4)', () => {
  it('ignores a caller-supplied _seq on a full office-status message', () => {
    const { win, posted } = makeBridge()
    const future = String(Date.now() + 5 * 60_000)  // 5 minutes in the future
    win.officeBridge.send({ type: 'office-status', agents: [], activeCount: 0, _seq: future })
    expect(posted[0].msg._seq).not.toBe(future)
    expect(Number(posted[0].msg._seq)).toBeLessThanOrEqual(Date.now())
  })

  it('ignores a caller-supplied _seq in the shorthand form', () => {
    const { win, posted } = makeBridge()
    const future = String(Date.now() + 5 * 60_000)
    win.officeBridge.send({ dev: 'working', _seq: future })
    expect(posted[0].msg._seq).not.toBe(future)
  })

  it('a crafted bridge.html?source=claude-cli&_seq=<future> URL cannot spoof either field', () => {
    const future = Date.now() + 5 * 60_000
    const { posted } = makeBridge({ search: `?source=claude-cli&_seq=${future}&dev=blocked` })
    // Auto-send fires at script-load time when window.location.search is non-empty.
    expect(posted).toHaveLength(1)
    expect(posted[0].msg.source).not.toBe('claude-cli')
    expect(Number(posted[0].msg._seq)).not.toBe(future)
    expect(Number(posted[0].msg._seq)).toBeLessThanOrEqual(Date.now())
  })
})
