import { describe, expect, it } from 'vitest'

const { normalizeCodexStatusPayload } = await import('../public/hooks/office-status-codex.js')

describe('normalizeCodexStatusPayload', () => {
  it('normalizes shorthand Codex CLI payloads into office-status messages', () => {
    const result = normalizeCodexStatusPayload({
      dev: 'working',
      workflow: 'Build Feature',
    })

    expect(result).toMatchObject({
      type: 'office-status',
      source: 'codex-cli',
      workflow: 'Build Feature',
      agents: [
        { role: 'dev', task: null, status: 'working', label: null, hint: null },
      ],
    })
    // _seq is a fresh monotonic integer string when the caller supplies none.
    expect(result._seq).toMatch(/^\d+$/)
  })

  it('preserves full office-status payloads while ensuring Codex defaults', () => {
    const result = normalizeCodexStatusPayload({
      type: 'office-status',
      agents: [{ role: 'qa', status: 'done', label: 'Verified' }],
    })

    expect(result).toMatchObject({
      type: 'office-status',
      source: 'codex-cli',
      agents: [{ role: 'qa', status: 'done', label: 'Verified' }],
    })
    expect(result._seq).toMatch(/^\d+$/)
  })

  // AVO audit remediation (2026-09-26, review round 2, finding #1): a caller-supplied _seq
  // is NEVER honored, even a well-formed plain-integer string. 'codex-cli' is a HOOK_ORIGIN
  // source the client trusts to share its own monotonic clock high-water mark
  // (src/inference/inferStatus.js isHookOrigin()); a caller-set future _seq (server accepts
  // up to 5 min ahead — scanSessions.mjs FUTURE_MS) poisons that high-water mark and freezes
  // the client against the Codex session's own next real write for that whole window, and a
  // caller-set past _seq gets silently dropped as stale. Always stamp this process's own
  // nextSeq(), matching statusContract.mjs normalizePost (:137, :167), which never honors a
  // caller _seq either.
  it('ignores a caller-supplied _seq entirely and always stamps a fresh monotonic value', () => {
    // A GENUINELY future _seq (well within the server's 5-min FUTURE_MS tolerance) is the
    // one a naive "reject only obviously-stale/malformed" fix would still let through —
    // this is the exact shape that poisons the client's high-water mark and freezes the
    // office (review round 2, R-1). '1700000000000' below (2023, long past) does NOT catch
    // that class of bug on its own; keep both.
    const nearFuture = String(Date.now() + 240_000)
    const withNearFutureSeq = normalizeCodexStatusPayload({ type: 'office-status', agents: [], _seq: nearFuture })
    expect(withNearFutureSeq._seq).not.toBe(nearFuture)
    expect(withNearFutureSeq._seq).toMatch(/^\d+$/)

    const withFutureSeq = normalizeCodexStatusPayload({ type: 'office-status', agents: [], _seq: '1700000000000' })
    expect(withFutureSeq._seq).not.toBe('1700000000000')
    expect(withFutureSeq._seq).toMatch(/^\d+$/)

    const withPastSeq = normalizeCodexStatusPayload({ type: 'office-status', agents: [], _seq: '1' })
    expect(withPastSeq._seq).not.toBe('1')
    expect(withPastSeq._seq).toMatch(/^\d+$/)

    // Non-numeric / colon-joined _seq is likewise ignored (was already replaced before this
    // fix too — kept as a regression guard).
    const bad = normalizeCodexStatusPayload({ type: 'office-status', agents: [], _seq: '12:34' })
    expect(bad._seq).toMatch(/^\d+$/)
    expect(bad._seq).not.toBe('12:34')
  })

  it('emits strictly monotonic _seq across back-to-back calls in the same ms', () => {
    const a = normalizeCodexStatusPayload({ dev: 'working' })
    const b = normalizeCodexStatusPayload({ dev: 'working' })
    expect(parseInt(b._seq, 10)).toBeGreaterThan(parseInt(a._seq, 10))
  })

  it('M-2: activeCount counts only working+blocked, not idle (contract parity with server path)', () => {
    // Old formula was status !== 'done', which included idle in the active count.
    const result = normalizeCodexStatusPayload({
      type: 'office-status',
      agents: [
        { role: 'dev', status: 'working' },
        { role: 'qa', status: 'idle' },
        { role: 'ops', status: 'done' },
      ],
    }, 9999)
    expect(result.activeCount).toBe(1)  // only dev:working; qa:idle and ops:done excluded
  })

  it('M-2: mood is validated against VALID_MOODS (invalid mood becomes null)', () => {
    const valid = normalizeCodexStatusPayload({ type: 'office-status', agents: [], mood: 'rushing' }, 1)
    expect(valid.mood).toBe('rushing')
    const invalid = normalizeCodexStatusPayload({ type: 'office-status', agents: [], mood: 'panicking' }, 1)
    expect(invalid.mood).toBeNull()
  })

  it('M-2: flat-path activeCount also counts only working+blocked', () => {
    // Flat-object path: { dev: 'working', qa: 'idle' }
    const result = normalizeCodexStatusPayload({ dev: 'working', qa: 'idle' }, 9999)
    expect(result.activeCount).toBe(1)  // dev:working only; qa:idle excluded
  })

  // AVO audit remediation (2026-09-26, finding #3): the shorthand branch was missing the
  // typeof+slice sanitizer the full-format branch already applied to `workflow`, and neither
  // branch sanitized `source` at all — both drift from statusContract.mjs normalizePost.
  it('sanitizes workflow on the shorthand path the same way as the full-format path (was unsanitized)', () => {
    const oversized = 'x'.repeat(500)
    const result = normalizeCodexStatusPayload({ dev: 'working', workflow: oversized })
    expect(result.workflow).toBe(oversized.slice(0, 200))
    expect(result.workflow.length).toBe(200)
  })

  it('drops a non-string workflow on the shorthand path instead of passing it through raw', () => {
    const result = normalizeCodexStatusPayload({ dev: 'working', workflow: { evil: true } })
    expect(result.workflow).toBeNull()
  })

  // AVO audit remediation (2026-09-26, review round 2, finding #2): `source` is a PINNED
  // constant on both paths — never caller-settable. A caller-set 'claude-cli' would
  // re-enable office-status-hook.js's cleanupGhostAliases deleting this very Codex file
  // (it gates on source === 'claude-cli'); a caller-set 'multi-session' would escape the
  // client's per-source stale-drop handling for that reserved value. Neither is a
  // legitimate Codex identity, so nothing the caller supplies can change it.
  it('pins source to codex-cli on both paths regardless of what the caller supplies', () => {
    const full = normalizeCodexStatusPayload({ type: 'office-status', agents: [], source: 'claude-cli' })
    expect(full.source).toBe('codex-cli')
    const shorthand = normalizeCodexStatusPayload({ dev: 'working', source: 'multi-session' })
    expect(shorthand.source).toBe('codex-cli')
    const nonString = normalizeCodexStatusPayload({ dev: 'working', source: 12345 })
    expect(nonString.source).toBe('codex-cli')
  })
})
