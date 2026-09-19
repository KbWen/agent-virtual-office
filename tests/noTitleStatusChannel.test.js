import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// 2026-09-19 review, REV-03 — the office never infers agent status from a page title.
//
// The deleted `listenTitleChanges` channel watched `document.title` and synthesized a `working`
// agent from keywords. A page can only observe its OWN title — never another tab's — and the office
// never sets its own (index.html is static), so the channel was dead in normal use. Its only
// reachable behaviour was self-feedback: any future "show status in the tab title" feature would
// have fed straight back in as a fabricated `working`. (AVO-174 had already stripped its blocked/done
// patterns for the same honesty reason.) This guard keeps a title observer from quietly returning.
//
// The review's own suggestion — keep it behind an `OFFICE_ENABLE_TITLE_INFER=1` flag — is not
// adopted: a browser bundle cannot read that process variable, and a flag would keep dead code alive.

const SRC = path.resolve(__dirname, '..', 'src')

function sourceFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(m?js|jsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

// Reads of the page title, or DOM lookups of the <title> element (the MutationObserver target).
const TITLE_READ = /document\s*\.\s*title|querySelector(All)?\(\s*['"`]title['"`]\s*\)|getElementsByTagName\(\s*['"`]title['"`]\s*\)/

describe('no status channel reads the page title (REV-03)', () => {
  it('no file under src/ reads document.title or looks up the <title> element', () => {
    const files = sourceFiles(SRC)
    expect(files.length).toBeGreaterThan(50) // the walk really covered the tree
    const offenders = files
      .filter((f) => TITLE_READ.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(SRC, f))
    expect(offenders).toEqual([])
  })

  it('the pattern really matches the deleted observer (test-the-test)', () => {
    // Verbatim shapes from the removed listenTitleChanges.
    expect(TITLE_READ.test('let lastTitle = document.title')).toBe(true)
    expect(TITLE_READ.test("const titleEl = document.querySelector('title')")).toBe(true)
    // …and does not trip on unrelated uses of the word.
    expect(TITLE_READ.test('<title>{label}</title>')).toBe(false)
    expect(TITLE_READ.test("t('activityFeed.expand', 'Activity Feed') // title=")).toBe(false)
  })

  it('inferStatus no longer exports the title classifier', async () => {
    const mod = await import('../src/inference/inferStatus.js')
    expect(mod.classifyTitle).toBeUndefined()
  })
})
