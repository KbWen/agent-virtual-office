/**
 * AVO-106 — PairLink pure overlay render contract (SSR, no jsdom needed).
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PairLink } from '../src/components/PairLink.jsx'

const render = (props) => renderToStaticMarkup(<PairLink {...props} />)

describe('PairLink overlay', () => {
  it('draws a connecting line + 🔗<file> label between two positions', () => {
    const html = render({ fromPos: { x: 100, y: 200 }, toPos: { x: 300, y: 240 }, file: 'store.js', ariaLabel: 'A & B — both editing store.js' })
    expect(html).toContain('<line')
    expect(html).toContain('🔗 store.js')
    expect(html).toContain('aria-label="A &amp; B — both editing store.js"')
  })

  it('renders nothing when an endpoint is missing (no crash)', () => {
    expect(render({ fromPos: null, toPos: { x: 1, y: 1 }, file: 'x.js' })).toBe('')
    expect(render({ fromPos: { x: 1, y: 1 }, toPos: null, file: 'x.js' })).toBe('')
  })

  it('omits the label when no file is given but still draws the line', () => {
    const html = render({ fromPos: { x: 1, y: 1 }, toPos: { x: 2, y: 2 }, file: '', ariaLabel: 'link' })
    expect(html).toContain('<line')
    expect(html).not.toContain('🔗')
  })
})
