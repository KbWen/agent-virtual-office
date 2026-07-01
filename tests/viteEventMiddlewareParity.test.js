import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

describe('vite /api/event middleware parity guard', () => {
  it('keeps dev webhook activeCount and default workflow aligned with production', () => {
    const src = fs.readFileSync('vite.config.js', 'utf8')

    expect(src).toMatch(/activeCount:\s*agents\.filter\(a => a\.status === 'working' \|\| a\.status === 'blocked' \|\| a\.status === 'planning' \|\| a\.status === 'awaiting-approval'\)\.length/)
    expect(src).toContain("workflow: typeof parsed.workflow === 'string' ? parsed.workflow.slice(0, 200) : null")
    expect(src).not.toContain("workflow: typeof parsed.workflow === 'string' ? parsed.workflow.slice(0, 200) : eventName")
  })
})
