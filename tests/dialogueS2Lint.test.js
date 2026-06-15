/**
 * dialogueS2Lint.test.js — S2 deliverables
 *
 * D1) AC-O2 — open-ended ambient lint guard (T1 machine signal for ADR-007 D2)
 *     Scans gossip + react-colleague-* in both en+zh.
 *     Status-ack pools (*-working/*-done/*-error) are EXEMPT (licensed status echo).
 *
 * D2) AC-S2a — 8-role → archetype mapping test + blind-attribution fixture
 *
 * D3) en/zh key-set parity for contextBubbles (S2 sections)
 *
 * NOTE: This test file IS the T1 artifact for D2 (not guardrails §13).
 * The denylist data lives in src/locales/_bannedTerminalTokens.json.
 *
 * Scope asymmetry (documented): The lint targets ambient/social pools that
 * gesture at topic directions. Status-ack pools (role×action -working/-done/-error)
 * are "licensed status echo" — they acknowledge current status and are intentionally
 * concise/verb-first. They are NOT scanned by this lint.
 */

import { describe, it, expect } from 'vitest'
import denylist from '../src/locales/_bannedTerminalTokens.json'
import { ROLE_ARCHETYPE, ARCHETYPES } from '../src/systems/roleArchetype.js'

// ─── Load locales ──────────────────────────────────────────────────────────────
const enLocale = (await import('../src/locales/en.json')).default
const zhLocale = (await import('../src/locales/zh-TW.json')).default

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Collect all in-scope keys from contextBubbles. */
function collectInScopeKeys(locale) {
  const cb = locale.contextBubbles ?? {}
  return Object.keys(cb).filter((k) =>
    k === 'gossip' ||
    k.startsWith('react-colleague-') ||
    k === 'banter' ||
    k === 'murmurs'
  )
}

/** Gather all string values (flatten arrays) for a given key. */
function gatherStrings(locale, key) {
  const val = locale.contextBubbles?.[key]
  if (!val) return []
  if (Array.isArray(val)) return val.flatMap((v) => (typeof v === 'string' ? [v] : []))
  if (typeof val === 'string') return [val]
  return []
}

// ─── EN lint: case-insensitive word-boundary on work-outcome stems ─────────────

const EN_STEMS = denylist.en.stems // ["fix","solv","decid","final","done","nail","ship","merg","wrap"]

function enMatchesStem(str) {
  for (const stem of EN_STEMS) {
    // word-boundary, case-insensitive
    const re = new RegExp(`\\b${stem}`, 'i')
    if (re.test(str)) return { stem, str }
  }
  return null
}

// ─── ZH lint: substring on completion verb+了 collocations, with negation lookbehind ──

const ZH_COLLOCATIONS = denylist.zh.completionCollocations
// ["搞定了","修好了","弄好了","做完了","完成了","解決了","處理好了","結案了","收工了",
//  "上線了","改完了","收尾了","決定了","定案","大功告成","通過了","搞掂"]
const ZH_NEGATION_PREFIXES = denylist.zh.zhNegationPrefixes
// ["沒","未","不","還沒","難","很難","快","差點","還在"]

function zhMatchesCollocation(str) {
  for (const colloc of ZH_COLLOCATIONS) {
    const idx = str.indexOf(colloc)
    if (idx === -1) continue
    // Check negation lookbehind: is the char(s) immediately before the colloc a negation prefix?
    let negated = false
    for (const prefix of ZH_NEGATION_PREFIXES) {
      const start = idx - prefix.length
      if (start >= 0 && str.slice(start, idx) === prefix) {
        negated = true
        break
      }
    }
    if (!negated) return { colloc, str }
  }
  return null
}

// ─── AC-O2: EN lint ────────────────────────────────────────────────────────────

describe('AC-O2 — en ambient lint: no work-outcome stems in gossip/react-colleague-*', () => {
  const inScopeKeys = collectInScopeKeys(enLocale)

  it('at least one in-scope key exists (gossip)', () => {
    expect(inScopeKeys).toContain('gossip')
  })

  for (const key of inScopeKeys) {
    const lines = gatherStrings(enLocale, key)
    it(`en contextBubbles.${key} — no work-outcome stems (${lines.length} lines)`, () => {
      const hits = lines.map(enMatchesStem).filter(Boolean)
      expect(
        hits,
        `Found banned stem(s) in en contextBubbles.${key}:\n${hits.map((h) => `  stem="${h.stem}" in "${h.str}"`).join('\n')}`
      ).toHaveLength(0)
    })
  }
})

// ─── AC-O2: ZH lint ────────────────────────────────────────────────────────────

describe('AC-O2 — zh ambient lint: no completion-verb+了 collocations (with negation exemption)', () => {
  const inScopeKeys = collectInScopeKeys(zhLocale)

  it('at least one in-scope key exists (gossip)', () => {
    expect(inScopeKeys).toContain('gossip')
  })

  for (const key of inScopeKeys) {
    const lines = gatherStrings(zhLocale, key)
    it(`zh contextBubbles.${key} — no completion collocations (${lines.length} lines)`, () => {
      const hits = lines.map(zhMatchesCollocation).filter(Boolean)
      expect(
        hits,
        `Found banned collocation(s) in zh contextBubbles.${key}:\n${hits.map((h) => `  colloc="${h.colloc}" in "${h.str}"`).join('\n')}`
      ).toHaveLength(0)
    })
  }

  // ─── Documented zh test cases (≥6) ─────────────────────────────────────────

  describe('zh lint documented test cases', () => {
    it('搞定了 → FAIL (banned collocation, no negation)', () => {
      expect(zhMatchesCollocation('搞定了')).not.toBeNull()
    })

    it('卡住了 → PASS (bare 了 particle, not a banned collocation)', () => {
      expect(zhMatchesCollocation('卡住了')).toBeNull()
    })

    it('快好了 → PASS (bare 了 particle)', () => {
      expect(zhMatchesCollocation('快好了')).toBeNull()
    })

    it('又改了 → PASS (bare 了 particle)', () => {
      expect(zhMatchesCollocation('又改了')).toBeNull()
    })

    it('週五了 → PASS (bare 了 particle, temporal)', () => {
      expect(zhMatchesCollocation('週五了')).toBeNull()
    })

    it('還沒決定 → PASS (negation prefix 還沒 before 決定)', () => {
      // "決定了" is the collocation; "還沒決定" does not contain "決定了" → should pass regardless
      expect(zhMatchesCollocation('還沒決定')).toBeNull()
    })

    it('做完了 → FAIL (banned collocation)', () => {
      expect(zhMatchesCollocation('做完了')).not.toBeNull()
    })

    it('沒做完了 → PASS (negation prefix 沒 before colloc)', () => {
      // "做完了" present but preceded by "沒"
      expect(zhMatchesCollocation('沒做完了')).toBeNull()
    })

    it('還沒完成了 → PASS (negation prefix 還沒 before 完成了)', () => {
      expect(zhMatchesCollocation('還沒完成了')).toBeNull()
    })

    it('大功告成 → FAIL (banned collocation)', () => {
      expect(zhMatchesCollocation('大功告成')).not.toBeNull()
    })

    it('快搞定了 → PASS (negation prefix 快 before 搞定了)', () => {
      expect(zhMatchesCollocation('快搞定了')).toBeNull()
    })

    it('差點修好了 → PASS (negation prefix 差點 before 修好了)', () => {
      expect(zhMatchesCollocation('差點修好了')).toBeNull()
    })
  })
})

// ─── Scope exemption check: status-ack pools are NOT scanned ───────────────────

describe('AC-O2 scope asymmetry — licensed status echo pools are exempt from lint', () => {
  it('en role-done pools (dev-done, qa-done etc) are out of scope (licensed status echo)', () => {
    const keys = collectInScopeKeys(enLocale)
    // "role-done" keys: match <role>-done where role is a known role prefix, NOT react-colleague-done
    const roleDoneKeys = Object.keys(enLocale.contextBubbles ?? {}).filter(
      (k) => k.endsWith('-done') && !k.startsWith('react-colleague-')
    )
    for (const k of roleDoneKeys) {
      expect(keys, `${k} should be out of lint scope (licensed status echo)`).not.toContain(k)
    }
  })

  it('en role-working pools (dev-working, qa-working etc) are out of scope', () => {
    const keys = collectInScopeKeys(enLocale)
    const workingKeys = Object.keys(enLocale.contextBubbles ?? {}).filter(
      (k) => k.endsWith('-working') && !k.startsWith('react-colleague-')
    )
    for (const k of workingKeys) {
      expect(keys, `${k} should be out of lint scope`).not.toContain(k)
    }
  })

  it('en role-error pools (dev-error, qa-error etc) are out of scope', () => {
    const keys = collectInScopeKeys(enLocale)
    const errorKeys = Object.keys(enLocale.contextBubbles ?? {}).filter(
      (k) => k.endsWith('-error') && !k.startsWith('react-colleague-')
    )
    for (const k of errorKeys) {
      expect(keys, `${k} should be out of lint scope`).not.toContain(k)
    }
  })
})

// ─── AC-S2a: 8-role → archetype map ───────────────────────────────────────────

describe('AC-S2a — ROLE_ARCHETYPE: 8 VALID_ROLES each map to one of 5 archetypes', () => {
  const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']

  it('every VALID_ROLE has an archetype entry', () => {
    for (const role of VALID_ROLES) {
      expect(ROLE_ARCHETYPE, `missing role: ${role}`).toHaveProperty(role)
    }
  })

  it('every archetype value is one of the 5 named archetypes', () => {
    for (const [role, archetype] of Object.entries(ROLE_ARCHETYPE)) {
      expect(ARCHETYPES, `role ${role} has unknown archetype ${archetype}`).toContain(archetype)
    }
  })

  it('all 5 archetypes are used (none empty)', () => {
    const used = new Set(Object.values(ROLE_ARCHETYPE))
    for (const a of ARCHETYPES) {
      expect(used, `archetype ${a} has no assigned roles`).toContain(a)
    }
  })

  it('exactly 8 roles in the map (same as VALID_ROLES set size)', () => {
    expect(Object.keys(ROLE_ARCHETYPE)).toHaveLength(8)
  })

  it('Sprinter = dev + ops', () => {
    expect(ROLE_ARCHETYPE.dev).toBe('Sprinter')
    expect(ROLE_ARCHETYPE.ops).toBe('Sprinter')
  })

  it('Skeptic = qa + gate', () => {
    expect(ROLE_ARCHETYPE.qa).toBe('Skeptic')
    expect(ROLE_ARCHETYPE.gate).toBe('Skeptic')
  })

  it('Sage = arch + res', () => {
    expect(ROLE_ARCHETYPE.arch).toBe('Sage')
    expect(ROLE_ARCHETYPE.res).toBe('Sage')
  })

  it('Coordinator = pm', () => {
    expect(ROLE_ARCHETYPE.pm).toBe('Coordinator')
  })

  it('Aesthete = designer', () => {
    expect(ROLE_ARCHETYPE.designer).toBe('Aesthete')
  })
})

// ─── AC-S2a: blind-attribution fixture (≥5 lines per archetype) ───────────────
//
// Hand-labeled sample lines with expected archetype.
// Structural consistency assertion: each line maps to ONE archetype.
// Actual human blind-attribution accuracy (T3, ≥60%) is a coordinator step.

describe('AC-S2a — blind-attribution fixture: ≥5 samples/archetype, structurally consistent', () => {
  const FIXTURE = [
    // Sprinter (dev/ops voice)
    { line_en: 'almost... almost~',                   line_zh: '快了...快了~',                  archetype: 'Sprinter' },
    { line_en: 'keyboard goes brr',                   line_zh: '鍵盤啪啪啪',                    archetype: 'Sprinter' },
    { line_en: 'code first, think later!',            line_zh: '先寫再說！',                    archetype: 'Sprinter' },
    { line_en: '{ctx} 3..2..1',                       line_zh: '{ctx} 3..2..1',                 archetype: 'Sprinter' },
    { line_en: 'rollback! now.',                      line_zh: 'rollback！現在！',              archetype: 'Sprinter' },
    { line_en: 'all green. for now.',                 line_zh: '全綠。目前啦。',                archetype: 'Sprinter' },

    // Skeptic (qa/gate voice)
    { line_en: 'told you.',                           line_zh: '我就說吧。',                   archetype: 'Skeptic' },
    { line_en: 'something\'s off here…',              line_zh: '這裡不太對…嗯',                archetype: 'Skeptic' },
    { line_en: 'I smell a bug…',                      line_zh: '有 bug 的味道…',              archetype: 'Skeptic' },
    { line_en: 'scanning.',                           line_zh: '掃描中。',                      archetype: 'Skeptic' },
    { line_en: 'non-compliant. rejected.',            line_zh: '不合規。退回。',                archetype: 'Skeptic' },
    { line_en: 'clean. proceed.',                     line_zh: '乾淨。放行。',                  archetype: 'Skeptic' },

    // Sage (arch/res voice)
    { line_en: 'mm… will it hold?',                   line_zh: '嗯…撐得住嗎',                  archetype: 'Sage' },
    { line_en: 'tradeoffs everywhere…',               line_zh: '取捨無處不在…',                archetype: 'Sage' },
    { line_en: 'thinking about the edges…',           line_zh: '邊界條件想一想…',              archetype: 'Sage' },
    { line_en: 'wait, this might be something…',     line_zh: '等等，這個…',                   archetype: 'Sage' },
    { line_en: 'deeper and deeper…',                  line_zh: '越挖越深了…',                  archetype: 'Sage' },
    { line_en: 'need to rethink this…',               line_zh: '要重新想了…',                  archetype: 'Sage' },

    // Coordinator (pm voice)
    { line_en: 'where are we on this...',             line_zh: '進度到哪了…',                  archetype: 'Coordinator' },
    { line_en: 'ok let\'s re-prioritize everyone',   line_zh: '重排優先順序，大家注意',        archetype: 'Coordinator' },
    { line_en: 'let\'s make sure we\'re aligned~',   line_zh: '先對齊再說~',                   archetype: 'Coordinator' },
    { line_en: 'team\'s in the loop~',               line_zh: '大家都知道了~',                 archetype: 'Coordinator' },
    { line_en: 'timeline\'s slipping — let\'s regroup everyone', line_zh: 'timeline 在滑…來開個快會吧', archetype: 'Coordinator' },

    // Aesthete (designer voice)
    { line_en: 'beauty is restraint',                 line_zh: '美是一種剋制',                  archetype: 'Aesthete' },
    { line_en: 'every pixel is a choice',             line_zh: '每一個 px 都是一個決定',        archetype: 'Aesthete' },
    { line_en: 'let the composition breathe',         line_zh: '讓畫面有呼吸，有靜默',          archetype: 'Aesthete' },
    { line_en: 'the eye doesn\'t know where to go',  line_zh: '視線流動的方向不對',            archetype: 'Aesthete' },
    { line_en: 'balance isn\'t symmetry — it\'s tension', line_zh: '平衡不是對稱，是張力',    archetype: 'Aesthete' },
  ]

  it('fixture has ≥5 samples per archetype', () => {
    for (const a of ARCHETYPES) {
      const count = FIXTURE.filter((f) => f.archetype === a).length
      expect(count, `archetype ${a} has only ${count} samples (need ≥5)`).toBeGreaterThanOrEqual(5)
    }
  })

  it('every fixture entry has exactly one archetype (structural consistency)', () => {
    for (const entry of FIXTURE) {
      expect(ARCHETYPES, `"${entry.line_en}" filed under unknown archetype "${entry.archetype}"`).toContain(entry.archetype)
      expect(typeof entry.line_en).toBe('string')
      expect(typeof entry.line_zh).toBe('string')
    }
  })

  it('fixture en lines are non-empty strings', () => {
    for (const entry of FIXTURE) {
      expect(entry.line_en.length).toBeGreaterThan(0)
    }
  })

  it('fixture zh lines are non-empty strings', () => {
    for (const entry of FIXTURE) {
      expect(entry.line_zh.length).toBeGreaterThan(0)
    }
  })

  it('fixture covers all 5 archetypes', () => {
    const fixtureArchetypes = new Set(FIXTURE.map((f) => f.archetype))
    for (const a of ARCHETYPES) {
      expect(fixtureArchetypes).toContain(a)
    }
  })
})

// ─── en/zh key-set parity for contextBubbles (S2 scope) ──────────────────────

describe('en/zh contextBubbles key-set parity (S2 sections)', () => {
  const S2_ROLES = ['dev', 'qa', 'ops', 'res', 'pm', 'arch', 'gate']
  const S2_SUFFIXES = ['-edit', '-write', '-read', '-bash', '-search', '-delegate', '-working', '-done', '-error', '-web']

  const enCB = enLocale.contextBubbles ?? {}
  const zhCB = zhLocale.contextBubbles ?? {}

  it('both locales have the same set of contextBubbles keys', () => {
    const enKeys = new Set(Object.keys(enCB))
    const zhKeys = new Set(Object.keys(zhCB))
    const onlyInEn = [...enKeys].filter((k) => !zhKeys.has(k))
    const onlyInZh = [...zhKeys].filter((k) => !enKeys.has(k))
    expect(onlyInEn, `keys only in en: ${onlyInEn.join(', ')}`).toHaveLength(0)
    expect(onlyInZh, `keys only in zh: ${onlyInZh.join(', ')}`).toHaveLength(0)
  })

  for (const role of S2_ROLES) {
    for (const suffix of S2_SUFFIXES) {
      const key = `${role}${suffix}`
      if (enCB[key] !== undefined) {
        it(`en/zh array length parity: contextBubbles.${key}`, () => {
          const enArr = Array.isArray(enCB[key]) ? enCB[key] : [enCB[key]]
          const zhArr = Array.isArray(zhCB[key]) ? zhCB[key] : [zhCB[key]]
          expect(zhArr.length, `${key}: en=${enArr.length} zh=${zhArr.length}`).toBe(enArr.length)
        })
      }
    }
  }

  it('gossip: en/zh same array length', () => {
    const enG = enCB.gossip ?? []
    const zhG = zhCB.gossip ?? []
    expect(zhG.length).toBe(enG.length)
  })

  it('react-colleague-blocked: en/zh same array length', () => {
    const enL = enCB['react-colleague-blocked'] ?? []
    const zhL = zhCB['react-colleague-blocked'] ?? []
    expect(zhL.length).toBe(enL.length)
  })

  it('react-colleague-done: en/zh same array length', () => {
    const enL = enCB['react-colleague-done'] ?? []
    const zhL = zhCB['react-colleague-done'] ?? []
    expect(zhL.length).toBe(enL.length)
  })
})
