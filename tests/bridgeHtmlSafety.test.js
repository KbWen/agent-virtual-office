import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const bridgeHtml = readFileSync(join(process.cwd(), 'public', 'bridge.html'), 'utf-8')
const bridgeUiJs = readFileSync(join(process.cwd(), 'public', 'bridge-ui.js'), 'utf-8')

describe('bridge.html dynamic rendering safety', () => {
  it('does not build dynamic UI with inline handlers or innerHTML assignments', () => {
    expect(bridgeHtml).not.toMatch(/\.innerHTML\s*=/)
    expect(bridgeHtml).not.toMatch(/\son[a-z]+\s*=/i)
    expect(bridgeHtml).toContain('<script src="/bridge-ui.js" defer></script>')
  })

  it('renders bridge log entries with text nodes', () => {
    expect(bridgeUiJs).not.toMatch(/\.innerHTML\s*=/)
    expect(bridgeUiJs).toContain('document.createTextNode(` ${agents}`)')
    expect(bridgeUiJs).toContain('document.createTextNode(` | ${msg.workflow}`)')
  })
})
