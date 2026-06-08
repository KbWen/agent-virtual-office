---
title: Recurring failure-mode detection (AVO-117)
status: frozen
date: 2026-06-08
backlog_id: AVO-117
classification: feature
primary_domain: office-runtime
secondary_domains: [ui-rendering, observability]
primary_files:
  - src/systems/recurringFailure.js
  - src/systems/store.js
  - src/inference/desktopNotifier.js
  - src/components/AgentCharacter.jsx
  - src/locales/en.json
  - src/locales/zh-TW.json
test_files:
  - tests/recurringFailure.test.js
  - tests/storeReconcile.test.js
  - tests/desktopNotifier.test.js
  - tests/recurringSign.test.jsx
relationship: INDEPENDENT (downstream of AVO-110 docs/specs/blocked-reason-tags.md [shipped]; consumes its reasonCode stream)
---

# Recurring failure-mode detection (AVO-117)

## Problem

AVO-110 shipped a per-event `reasonCode` (test-run-failed / build-failed / deps-failed / blocked-unknown).
But a watcher still can't tell a one-off blip from an agent **stuck in a loop** — re-running the same
failing tests three times in five minutes is the signal that "this one genuinely needs me." AVO-110's
spec named AVO-117 as its downstream. The hard part is doing it **honestly**: the only observable unit
is the coarse `reasonCode`, so we must claim only what it proves.

## Goal

When the **same specific `reasonCode`** recurs across **≥N distinct blocked episodes** for the **same
agent** within a rolling time window, raise a calm "recurring issue" sign over that agent's desk and
(optionally, permission-gated) fire one desktop notification. Pure aggregation over the **real**
reasonCode event stream — never synthesized, never claiming a root cause it can't observe.

## Acceptance Criteria

- **AC-1** `src/systems/recurringFailure.js` exports pure helpers: `recordEpisode(state, {agentId, reasonCode, now})` → new state (append-only, capped, window-pruned); `isRecurring(state, {agentId, reasonCode, now, threshold, windowMs})` → boolean; `recurringInfo(...)` → `{recurring, count, reasonCode}`. No React, no store import — plain functions of plain data.
- **AC-2** **SPECIFIC-ONLY**: `blocked-unknown` (and any non-specific/absent reason) NEVER triggers recurring — `recordEpisode` ignores it. Only `test-run-failed` / `build-failed` / `deps-failed` accrue. (Recurring of an *unknown* cause is low-actionability noise and would over-claim.)
- **AC-3** **EPISODE-EDGE**: the count increments **once per distinct blocked episode** — i.e. on a transition INTO `blocked` with that reasonCode — NOT on every 5s poll re-reading the same ongoing block. Re-reading an unchanged (status, reasonCode) for the same agent must NOT double-count.
- **AC-4** **CLAIM-THE-PATTERN**: the sign + label claim only that the same KIND of block recurred ("反覆卡在測試" / "Tests keep failing"), NEVER "the same bug" or a specific root cause. Wording is reviewed against this.
- **AC-5** A distinct "recurring" sign renders over the affected agent (separate from / escalating the AVO-110 single badge) ONLY while the agent is currently `blocked` AND `isRecurring` is true for its current reasonCode. It clears the moment either is false (EPHEMERAL-SIGN). Reuses the over-head region; reduced-motion → static; a11y label present (not aria-hidden-only).
- **AC-6** Optional desktop notification: extends `desktopNotifier.js` to fire ONE notification when recurring is first detected for an (agent, reasonCode), permission-gated, deduped per recurring episode (a new recurrence after the pattern clears may re-fire). Reuses the existing permission + dedup machinery. OFF unless notifications are enabled.
- **AC-7** Rolling window + threshold are named constants (default `RECURRING_THRESHOLD = 3`, `RECURRING_WINDOW_MS = 600_000` / 10 min); per-(agent, reason) episode list capped (e.g. ≤ 20) to bound memory; episodes outside the window are pruned and don't count. en + zh-TW i18n for sign label + a11y + notification text.
- **AC-8** **WINDOW-DECAY**: episodes older than `windowMs` from `now` do not count toward recurrence (assert: 3 episodes spread beyond the window → not recurring).
- **AC-9** All honesty invariants below are covered by named unit tests (truth/data feature → heavy `/review`, `Verdict: PASS` required).
- **AC-10** Lifecycle verified by **loading the actual page** (headless Playwright — `preview_screenshot` hangs): drive 3 blocked episodes of the same reason for one agent within the window → recurring sign appears with correct wording; a single block → no sign; 0 console errors / no ErrorBoundary.

## Honesty Invariants (testable — core of AC-9)

- **SPECIFIC-ONLY** — `recordEpisode` with `reasonCode: 'blocked-unknown'` (or absent/non-enum) is a no-op; `isRecurring` for blocked-unknown is always false. (recurringFailure.test)
- **EPISODE-EDGE** — feeding the SAME (agentId, reasonCode) without an intervening non-blocked / different state must not increment the count; only a fresh blocked-edge does. (storeReconcile + recurringFailure)
- **WINDOW-DECAY** — episodes with timestamps older than `windowMs` are pruned and excluded; `threshold` occurrences spread beyond the window → not recurring. (recurringFailure)
- **THRESHOLD-FLOOR** — `count < threshold` (1 or 2 occurrences) → `recurring: false`, no sign, no notification. (recurringFailure)
- **REAL-SIGNAL-ONLY** — episodes are recorded ONLY from actual reasonCode events flowing through the store (AVO-110 contract); no timer/synthetic source manufactures episodes. (storeReconcile)
- **EPHEMERAL-SIGN** — the recurring sign renders ONLY while the agent's CURRENT status is `blocked` AND its current reasonCode is recurring; leaving blocked, or a different reason, clears it. (recurringSign render)
- **CLAIM-THE-PATTERN** — the i18n label/a11y strings assert the recurring PATTERN of a kind, never a specific root cause or "same bug". (locale + render assertion)
- **NOTIFY-ONCE-PER-EPISODE** — one notification per recurring detection; an unchanged ongoing recurrence does not re-fire; dedup resets when the pattern clears. (desktopNotifier)

## Non-goals

- **NOT** parsing error text / clustering by stack trace or message (AVO-110's firewall forbids free-text fabrication; reasonCode is the honest unit). No "same bug" claim.
- **NOT** recurring detection for `blocked-unknown` or the deferred permission/auth/rate-limit reasons.
- **NOT** cross-session persistence — the reasonCode stream is in-memory (store); recurrence is a live-window signal. Reload resets the window (documented; acceptable — it mirrors `externalStatus` being non-persisted).
- **NOT** a global "N recurring issues" dashboard counter, history timeline, or per-reason analytics panel — one per-agent live sign only.
- **NOT** changing AVO-110's single-badge behavior — recurring is an additive escalation layer.

## Constraints

- Honesty-first (inherits AVO-110 + the office's core value): a false "recurring" alarm misdirects the human worse than staying quiet. Threshold ≥ 3 distinct episodes; specific reasons only; window-bounded.
- Calm-tech: the sign is a quiet escalation, not an alarm — no screen-shake/sound/red-flash; one notification per episode; reduced-motion static.
- `recordEpisode`/`isRecurring` are PURE (store holds the state); the store is the single integration point (mirrors AVO-110's hook-single-source discipline — no second counter elsewhere).
- Protected Surfaces (movement/layout/scale, OfficePet) untouched; reuse the over-head region only.

## API / Data Contract

```
// store: a per-(agentId) rolling episode log lives in the store (in-memory, not persisted).
recurringFailureLog: { [agentId]: { [reasonCode]: number[/* episode timestamps, capped, window-pruned */] } }

// On a blocked-EDGE with a SPECIFIC reasonCode (detected in applyExternalStatus):
recordEpisode(state, { agentId, reasonCode, now }) -> newState   // no-op for blocked-unknown/absent

// Render/notify read a pure derivation:
recurringInfo(state, { agentId, reasonCode, now,
  threshold = RECURRING_THRESHOLD, windowMs = RECURRING_WINDOW_MS })
  -> { recurring: boolean, count: number, reasonCode }
```

MVP reasons that can recur = the 3 specific AVO-110 reasons. Defaults: threshold 3, window 10 min, cap 20.

## Domain Decisions

- [DECISION] Recurrence is keyed on the coarse `reasonCode` (the only honest observable unit); the sign claims the PATTERN ("same kind keeps failing"), never a specific bug. Rejected error-text/stack clustering — AVO-110's firewall forbids free-text fabrication.
- [CONSTRAINT] `blocked-unknown` is EXCLUDED from recurrence — recurring of an unknown cause is noise and over-claims. Only the 3 specific reasons accrue.
- [CONSTRAINT] Count distinct blocked EPISODES (edge into blocked), never poll ticks — a long single block must count once. The store's edge detection is the single source; no second counter.
- [DECISION] State lives in the store, in-memory, not persisted (reload resets the window) — the reasonCode stream itself is non-persisted (`externalStatus`); a live-window signal is the honest scope. Pure helpers in `recurringFailure.js`.
- [CONSTRAINT] The recurring sign is EPHEMERAL: shown only while currently blocked AND currently recurring; threshold ≥ 3 within a 10-min window. A false-positive alarm is worse than silence.
- [TRADEOFF] reasonCode is coarse, so "recurring" means "this KIND of step keeps failing", which may bundle distinct root causes. Accepted: it is still a true, actionable signal ("go look at this agent's tests"), and honest wording prevents over-claiming. Finer signatures wait for a structured-error hook signal (same Phase-2 boundary as AVO-110).

## File Relationship

INDEPENDENT spec, downstream of AVO-110 (`blocked-reason-tags.md` [shipped]). Consumes the shipped `reasonCode` stream; adds an orthogonal aggregation + escalation layer. Does not modify AVO-110 behavior. No conflicting legacy spec.

## Phasing

- **Phase 1 (this spec)**: pure `recurringFailure.js` + store episode-edge recording + recurring sign + optional notification + honesty tests + load-the-page verify.
- **Future**: finer error signatures (needs a structured-error hook field — shared Phase-2 boundary with AVO-110); cross-session window persistence if ever warranted.
