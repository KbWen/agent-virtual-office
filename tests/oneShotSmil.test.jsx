import { describe, it, expect } from 'vitest'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import OneShotSmil from '../src/components/OneShotSmil.jsx'

// AVO-197. Every one-shot SMIL animation in the office was dead: SMIL resolves `begin="0s"`
// against the DOCUMENT timeline, so an element mounted on a status change / behaviour change /
// poke is already past its active duration and snaps to its end value. Measured before the fix,
// the AVO-135 "celebratory flash" was mounted for 60 frames and visible on exactly 1.
//
// Whether the animation actually PLAYS can only be proven in a real browser — that is the whole
// point of the defect, since the markup looked correct the entire time. Evidence lives in the work
// log (all six: DEAD 1-2 distinct values → PLAYS 19-43). These tests hold the two things a unit
// test CAN hold: the wrapper's markup contract, and that no one-shot escapes the wrapper again.

const SRC = path.join(process.cwd(), 'src', 'components')
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8')

describe('OneShotSmil — the markup contract', () => {
  it('parks the animation with begin="indefinite" so it waits to be started', () => {
    const html = renderToStaticMarkup(
      <svg><circle><OneShotSmil><animate attributeName="r" values="16;30" dur="0.7s" /></OneShotSmil></circle></svg>)
    expect(html).toContain('begin="indefinite"')
  })

  it('adds no DOM node of its own — the animation stays a direct child of its target', () => {
    const wrapped = renderToStaticMarkup(
      <svg><circle><OneShotSmil><animate attributeName="r" values="16;30" dur="0.7s" /></OneShotSmil></circle></svg>)
    const bare = renderToStaticMarkup(
      <svg><circle><animate attributeName="r" values="16;30" dur="0.7s" begin="indefinite" /></circle></svg>)
    expect(wrapped).toBe(bare)
  })

  it('keeps every timing attribute untouched — this is a repair, not a re-tune', () => {
    const html = renderToStaticMarkup(
      <svg><g><OneShotSmil>
        <animateTransform attributeName="transform" type="translate" additive="sum"
          values="0 0;0 -4;0 0" keyTimes="0;0.5;1" dur="0.32s" repeatCount="1" fill="freeze" />
      </OneShotSmil></g></svg>)
    for (const attr of ['type="translate"', 'additive="sum"', 'values="0 0;0 -4;0 0"',
      'keyTimes="0;0.5;1"', 'dur="0.32s"', 'repeatCount="1"', 'fill="freeze"']) {
      expect(html, attr).toContain(attr)
    }
  })

  it('handles several animations on one element (the done flash animates r AND opacity)', () => {
    const html = renderToStaticMarkup(
      <svg><circle><OneShotSmil>
        <animate attributeName="r" values="16;30" dur="0.7s" />
        <animate attributeName="opacity" values="0.6;0" dur="0.7s" />
      </OneShotSmil></circle></svg>)
    expect(html.match(/begin="indefinite"/g)).toHaveLength(2)
  })

  it('tolerates a falsy child rather than throwing (conditional animations)', () => {
    expect(() => renderToStaticMarkup(
      <svg><circle><OneShotSmil>{null}</OneShotSmil></circle></svg>)).not.toThrow()
  })
})

describe('AVO-197 regression guard — no one-shot escapes the wrapper', () => {
  // A bare one-shot re-introduced anywhere in these files would be silently dead again: no error,
  // no console warning, correct-looking markup. Only this guard would notice.
  const files = ['AgentCharacter.jsx', 'PixelOffice.jsx', 'TopDownFurniture.jsx']

  // Comments discuss `<animate begin="0s">` by name — including the one this fix left behind in
  // TopDownFurniture — so they must not be scanned as markup.
  const stripComments = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))

  const animations = (text) => {
    const out = []
    const re = /<(animate|animateTransform)\b/g
    let m
    while ((m = re.exec(text))) {
      const end = text.indexOf('/>', m.index)
      out.push({ index: m.index, tag: text.slice(m.index, end + 2) })
    }
    return out
  }

  it.each(files)('%s has no unwrapped one-shot SMIL animation', (file) => {
    const text = stripComments(read(file))
    const offenders = animations(text)
      .filter((a) => !/repeatCount="indefinite"/.test(a.tag))
      .filter((a) => {
        // Wrapped means the nearest <OneShotSmil> before it is closer than the nearest </OneShotSmil>.
        const open = text.lastIndexOf('<OneShotSmil', a.index)
        const close = text.lastIndexOf('</OneShotSmil>', a.index)
        return !(open !== -1 && open > close)
      })
      .map((a) => a.tag.split('\n')[0].trim())
    expect(offenders, `unwrapped one-shot(s) in ${file}`).toEqual([])
  })

  it('the guard can actually fail — an unwrapped one-shot is detected', () => {
    // Newline-agnostic on purpose: an exact '\n' match silently becomes a no-op on a CRLF checkout,
    // which would turn this self-test into a false alarm rather than a real check.
    const source = stripComments(read('AgentCharacter.jsx'))
    const opener = /<OneShotSmil>(\s*)<animate attributeName="r"/
    expect(source, 'the mutation target must exist').toMatch(opener)
    const text = source.replace(opener, '<>$1<animate attributeName="r"')
    const unwrapped = animations(text)
      .filter((a) => !/repeatCount="indefinite"/.test(a.tag))
      .filter((a) => {
        const open = text.lastIndexOf('<OneShotSmil', a.index)
        const close = text.lastIndexOf('</OneShotSmil>', a.index)
        return !(open !== -1 && open > close)
      })
    expect(unwrapped.length).toBeGreaterThan(0)
  })

  it('indefinite animations are deliberately left alone (they are always mid-cycle)', () => {
    const all = files.flatMap((f) => animations(stripComments(read(f))))
    const indefinite = all.filter((a) => /repeatCount="indefinite"/.test(a.tag))
    expect(indefinite.length).toBeGreaterThan(5)
    for (const a of indefinite) expect(a.tag).not.toContain('begin="indefinite"')
  })
})
