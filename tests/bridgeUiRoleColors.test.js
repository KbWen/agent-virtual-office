/**
 * bridgeUiRoleColors.test.js
 *
 * `public/bridge-ui.js` is the standalone bridge demo page: plain static HTML/JS with no
 * bundler, so it cannot import `src/config/characters.json` and has to mirror the identity
 * colors. That mirror had drifted on 7 of 8 roles (only `designer` matched), so the same
 * agent was drawn in one colour in the office and a different one on the bridge page --
 * identity colour is how a viewer tells the agents apart, so a mismatch reads as two people.
 *
 * Pins the mirror to the canonical pack. `characters.json` stays the single source of truth.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import characters from '../src/config/characters.json'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Parse the `AGENTS` literal out of the un-bundled page source. */
function bridgeUiColors() {
  const src = fs.readFileSync(path.join(repoRoot, 'public/bridge-ui.js'), 'utf-8')
  const block = src.match(/const AGENTS = \[([\s\S]*?)\n\]/)
  expect(block, 'public/bridge-ui.js must declare a const AGENTS = [...] literal').not.toBeNull()
  const out = {}
  const re = /\{\s*id:\s*'([^']+)'[^}]*color:\s*'(#[0-9A-Fa-f]{6})'\s*\}/g
  let m
  while ((m = re.exec(block[1])) !== null) out[m[1]] = m[2].toUpperCase()
  return out
}

const pack = characters.agentcortex.characters ?? characters.agentcortex
const canonical = Object.fromEntries(pack.map((c) => [c.id, c.color.toUpperCase()]))
const uiColors = bridgeUiColors()

describe('bridge-ui identity colors mirror characters.json', () => {
  it('parses all 8 roles out of the page (guards against a vacuous pass)', () => {
    expect(Object.keys(uiColors).sort()).toEqual(
      ['arch', 'designer', 'dev', 'gate', 'ops', 'pm', 'qa', 'res'],
    )
  })

  it.each(Object.keys(uiColors))('%s uses the canonical color', (id) => {
    expect(canonical[id], `characters.json has no "${id}"`).toBeDefined()
    expect(uiColors[id]).toBe(canonical[id])
  })
})
