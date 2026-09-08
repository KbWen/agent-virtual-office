/**
 * hookEventRegistrationParity.test.js
 *
 * `bin/cli.js` (`npx agent-virtual-office setup`) is the SSoT for which Claude Code hook
 * events the office registers. Three other places restate that list for people who wire the
 * hook up by hand, and all three had drifted behind AVO-148: `docs/INTEGRATIONS.md` still
 * said "all 6 events" and shipped a 6-event snippet, and `public/hooks/hooks-config.json` —
 * the file the docs tell you to paste — was missing `PermissionDenied` and `StopFailure`.
 *
 * The consequence is not cosmetic: those two events are what turn a denied tool call or a
 * Claude-API failure into an honest `blocked` state. A hand-wired install silently lost that
 * and showed an agent frozen mid-task with no reason.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf-8')

/** The event list `setup` actually writes into settings.json. */
function cliEvents() {
  const src = read('bin/cli.js')
  const lists = [...src.matchAll(/for \(const event of \[([^\]]+)\]\)/g)]
    .map((m) => m[1].match(/'([^']+)'/g).map((q) => q.slice(1, -1)))
  expect(lists.length, 'bin/cli.js must register hook events in a literal array').toBeGreaterThan(0)
  // Every registration site must agree with the first before it can be the SSoT.
  for (const l of lists) expect(l).toEqual(lists[0])
  return lists[0]
}

const expected = cliEvents()

describe('hand-wiring instructions match what `setup` registers', () => {
  it('the CLI list is non-empty and includes the AVO-148 honesty events', () => {
    expect(expected.length).toBeGreaterThan(0)
    expect(expected).toContain('PermissionDenied')
    expect(expected).toContain('StopFailure')
  })

  it('public/hooks/hooks-config.json registers exactly the same events', () => {
    const cfg = JSON.parse(read('public/hooks/hooks-config.json'))
    expect(Object.keys(cfg.hooks).sort()).toEqual([...expected].sort())
  })

  it('docs/INTEGRATIONS.md states the right event count', () => {
    const doc = read('docs/INTEGRATIONS.md')
    const m = doc.match(/for all (\d+) events automatically/)
    expect(m, 'INTEGRATIONS.md must state the event count').not.toBeNull()
    expect(Number(m[1])).toBe(expected.length)
  })

  it('the INTEGRATIONS.md settings.json snippet names every event', () => {
    const doc = read('docs/INTEGRATIONS.md')
    const snippet = doc.match(/\{\s*"hooks":\s*\{[\s\S]*?\n\}\n```/)
    expect(snippet, 'INTEGRATIONS.md must contain a settings.json hooks snippet').not.toBeNull()
    for (const event of expected) {
      expect(snippet[0], `snippet is missing "${event}"`).toContain(`"${event}"`)
    }
  })
})
