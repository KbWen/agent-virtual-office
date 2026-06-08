---
title: Blocked-reason tags (AVO-110 / #29)
status: shipped
date: 2026-06-08
backlog_id: AVO-110
classification: feature
primary_domain: office-runtime
secondary_domains: [hook-integration, ui-rendering]
primary_files:
  - public/hooks/office-status-hook.js
  - src/systems/classify.js
  - src/systems/store.js
  - src/components/AgentCharacter.jsx
  - src/components/controlPanelLabels.js
  - src/locales/en.json
  - src/locales/zh-TW.json
test_files:
  - tests/classify.test.js          # classifyBlockedReason mapping + COLOR-NEVER-ONLY
  - tests/blockedReasonDerivation.test.js  # hook reasonCode derivation + honesty invariants (NEW)
  - tests/storeReconcile.test.js     # store ext.reasonCode carry/clear (EPHEMERAL)
  - tests/controlPanelLabels.test.js # agentLineLabel no double-surface
  - tests/blockedReasonBadge.test.jsx # AC-5/AC-8 render + reduced-motion + anti-nag (NEW, SSR/render)
  - tests/blockedReasonLifecycle.e2e  # AC-11 load-the-page lifecycle (headless Playwright) (NEW)
relationship: INDEPENDENT (extends the classify.js classifier family; classifyStatus untouched)
---

# Blocked-reason tags (AVO-110 / #29)

## Problem

Today a blocked agent only shows a generic blocked status plus a truncated free-text
label (`blockedReasonLabel` in `controlPanelLabels.js:19` just slices `ext.label` to 28
chars). The office tells you an agent is **stuck** but not **stuck on what**. Upgrading
"卡住了" → "卡在什麼" is the highest-value next item (user + product both named it) and
unlocks downstream AVO-117 (recurring failure-mode detection).

A 13-agent design panel + adversarial honesty audit (2026-06-08) **refuted 6 of 7**
candidate reasons. Root cause: `bashVibeLabel` returns the **first matching segment's**
noun (`office-status-hook.js:251`), but `is_error` is one boolean for the **whole compound
command** (`:684`) → mapping a specific reason guesses *which segment failed* (fabricated
attribution). The office-vibe buckets were built for friendly *display* (AVO-126), not as a
truthful failure taxonomy (`\binstall\b`/`\bbuild\b`/`\bmake\b` over-match `./install.sh`,
`make deploy`, `tsc`). A second 6-expert spec review (2026-06-08) confirmed the honesty half
is code-accurate but caught a broken delivery path + a phantom render slot — both fixed here.
This spec encodes the honesty-corrected, owner-approved **PATH A (honest-narrow)** design.

## Goal

Emit a structured, language-neutral `reasonCode` for blocked agents and render it as a
"status-effect" badge — a **game surface** (an RPG-debuff glyph over the agent's head, single
RM-safe entry-pop) carrying **real info** (every glyph is a 1:1 map of a signal the hook
actually observed; hover/inspect reveals the raw label). Specificity scales with honesty: a
specific reason renders **only** when the signal proves it; everything ambiguous degrades to
the honest `blocked-unknown` floor.

## Acceptance Criteria

- **AC-1** `classify.js` exports a pure `classifyBlockedReason(reasonCode)` → `{ family: BLOCKED, reason, iconId, hue, a11yKey }` with a mandatory `blocked-unknown` fallback for any absent/unrecognized code. `a11yKey` is a **language-neutral i18n key** (e.g. `blockedReason.test-run-failed.a11y`), NOT a localized string. `classifyStatus` is **not modified** (reason is orthogonal to status). The function inspects ONLY its `reasonCode` argument — it never sees command/error text (derivation already happened at the hook).
- **AC-2** `office-status-hook.js` derives + stamps a language-neutral `reasonCode` on the agent record inside PostToolUse **only when the computed `isError` is true** (`:684-690`). Non-error and non-blocked paths emit **no** `reasonCode`.
- **AC-3** A specific reason (`test-run-failed` / `build-failed` / `deps-failed`) is stamped **only** when ALL hold: `event.is_error === true` **explicitly** (the trusted boolean — not the first-line heuristic fallback) AND the Bash command is **single-segment** (contains none of `&&`, `||`, `;`, `|`, newline, `&`) AND the segment matches that reason's **tight `^`-anchored allowlist** AND the `tool_result` first line does **not** match a launch-failure token (see RUNNER-PRESENT). Otherwise → `blocked-unknown`.
- **AC-4** Reason labels claim only what the signal proves: the en/zh-TW text + a11y string (resolved at render from the locale files via `a11yKey`) say "blocked on the test **run**" / "卡在測試**執行**", never "test failed" / "測試失敗". (No assertion-level claim.)
- **AC-5** Two render surfaces, split by space:
  - **ControlPanel row** — `reasonCode`→table lookup renders **icon + i18n text together** (never icon-only, never color-only). It **never** re-parses `ext.label`. `agentLineLabel` must not double-surface the reason (one source).
  - **Office-scene over-head badge** — glyph + a non-`aria-hidden` SVG `<title>`/`<desc>` (or folded into the agent group `aria-label`) carrying the localized a11y string; hover/focus reveals the raw `ext.label`. The over-head glyph is NOT the sole honest channel — the panel row + the a11y text carry the words.
- **AC-6** A reason badge renders only when `classifyStatus(ext.status).family === BLOCKED` (one consistent gate; replaces the raw `ext.status!=='blocked'` compare in `blockedReasonLabel`). `awaiting-approval` (FAMILIES.GATE) receives **no** failure badge.
- **AC-7** The over-head badge renders **per blocked agent** as an element in `AgentCharacter`'s over-head `BehaviorIndicator` region (`AgentCharacter.jsx:~1181-1189`), **overriding the normal BehaviorIndicator glyph while `status === 'blocked'`**. The singleton `OfficePet` barometer (`OfficePet.jsx:157-159`, one shared pet, already hides on any blocker) is **untouched** and is a different surface — there is no per-agent "emote slot" to arbitrate. Glyphs are bespoke vector-path art in the pixel-office idiom (NOT reused emoji), drawn at BehaviorIndicator scale; the exact `<path>` glyph set + grid is finalized in `/plan` and acknowledged as new art. Protected Surfaces (label scale, layout) untouched — verified by a `getBoundingClientRect` overlap check.
- **AC-8** Entry-pop fires **iff** the rendered `reasonCode` differs from the previously-rendered `reasonCode` for that `agentId` — implemented as `key={reasonCode}` on the badge group (React remounts → replays the pop), **independent of** the store's `sigChanged` (which keys on status+task only, `store.js:779`). A same-`reasonCode` re-render MUST NOT re-pop. The pop is ~250–600ms (scale 0.6→1.1→1); no pulsing. The badge's reduced-motion source matches `AgentCharacter`'s existing `reducedMotion` plumbing; under RM the badge updates in place with no pop and loses **zero** information (distinct static silhouette + text carry it). RM info-preservation is an explicit, owner-acknowledged tradeoff (RM users notice a change by silhouette/text, not motion).
- **AC-9** All honesty invariants below are covered by **named unit tests**, each mapped to its backing test file (truth-half = heavy review, `/review` `Verdict: PASS` required).
- **AC-10** i18n en + zh-TW strings exist in `src/locales/{en,zh-TW}.json` for every shipped reason's text label and a11y string; glyphs are identical across locales.
- **AC-11** Lifecycle verified by **loading the actual page** (headless-Playwright — `preview_screenshot` hangs here): load → block (`test-run-failed`) → succeed → idle → reload, confirming the badge appears with the right glyph and **clears** when the agent leaves blocked; PLUS a cross-agent check (A blocked, B fires an event → A's badge persists) and a measured `getBoundingClientRect` check that the 4 glyphs stay distinct at the labelScale floor (not just at native size).
- **AC-12** Data-path wiring (the field must survive end to end): `reasonCode` is added to EVERY normalizer/whitelist between the hook and the store — (a) the hook `newAgents` record literal + (b) the hook existing-agents **merge-read** field list (so a still-blocked agent carries it forward), (c) the GET/file transport: `sanitizeAgent` (`inferStatus.js`, enum-validated) + `routeExternalAgents` (`agentRouter.js`), (d) the **POST `/api/status` ingest**: `normalizePost.js` (dev/vite) AND its `server.mjs` inline mirror (prod) — enum-validated, parity-tested, (e) the store `ext` rebuild as `ext[id].reasonCode = u.reasonCode || null` (`store.js`). The renderer reads `ext.reasonCode`, NOT the raw agent record. (Review caught (c)+(d) as FIVE whitelists in series, not the originally-assumed three.)

## Honesty Invariants (testable — the core of AC-9)

- **FALLBACK-IS-DEFAULT** — `{is_error:true, command:'echo done'}` (vague noun) → `blocked-unknown`. (`blockedReasonDerivation`)
- **SAME-EVENT ANCHOR** — reason derives only from the command on the **same** PostToolUse event, and requires `event.is_error === true` **explicitly**; when `is_error` is `undefined` (first-line-heuristic path) → `blocked-unknown` even on an allowlist match; a passing run (`is_error:false`) → no reasonCode. (`blockedReasonDerivation`)
- **SINGLE-SEGMENT GUARD** — any command containing `&&`/`||`/`;`/`|`/newline/`&` → `blocked-unknown` (mirrors the `office-status-hook.js:251` splitter; kills `npm install && npm run build` and heredoc wrong-segment attribution). (`blockedReasonDerivation`)
- **ANCHORED-ALLOWLIST** — specific reasons match only `^`-anchored program allowlists; the overloaded bare `\binstall\b`/`\bbuild\b`/`\bmake\b`/`\bcompile\b` keywords are **dropped**. Near-miss negatives tested: `npx vitest`, `make test`, `npm run pretest`, `npm install-foo`. (`blockedReasonDerivation`)
- **RUNNER-PRESENT (LAUNCH-VS-RUN)** — even a single-segment allowlisted command whose `tool_result` first line matches `/^(ENOENT|EACCES|EPERM|command not found|.*: not found|No such file)/i` → `blocked-unknown` (the shell never launched the runner, so "blocked on the test run" would over-claim). (`blockedReasonDerivation`)
- **NO-RENDER-SIDE-DERIVATION** — given `ext.label='❌ deploy failed'` but `ext.reasonCode='blocked-unknown'`, the badge shows the unknown glyph; the renderer never guesses from label text. (`classify` + `blockedReasonBadge`)
- **UNKNOWN-ON-UNRECOGNIZED** — any reasonCode not in the enum (or absent) → `blocked-unknown` badge; never a half-parsed string, never a crash. (`classify`)
- **GATE-IS-NOT-FAILURE** — `awaiting-approval` → no reason badge. (`classify` + `blockedReasonBadge`)
- **DEFERRED-REASONS-NOT-EMITTED** — until the Phase-2 hook signal ships, an `EACCES`/`EPERM`/`429`/`401` first-line classifies as `blocked-unknown`, never `permission`/`auth`/`rate-limit`. (`blockedReasonDerivation`)
- **LANGUAGE-NEUTRAL-TOKEN** — the same command yields the same `reasonCode` token under `LANG='en'` and `LANG='zh-TW'`; `classifyBlockedReason` returns a key, the localized string is chosen at render. (`blockedReasonDerivation` + `classify`)
- **EPHEMERAL** — two paths: (1) a blocked agent's own next non-error/done/Stop/idle event **omits** `reasonCode` (presence semantics, like tokens at `hook:~983`) and the store sets `ext.reasonCode = u.reasonCode || null`, so no stale value survives; (2) the hook merge **carries `reasonCode` forward** for any agent still `blocked` so another agent's event can't stale-clear it. Tests: EPHEMERAL-CLEARS-ON-TRANSITION (blocked→done ⇒ `ext.reasonCode===null` AND no badge) + CROSS-AGENT-NO-STALE-CLEAR (A blocked, B fires done ⇒ A badge present). (`storeReconcile`)
- **ANTI-NAG-NO-REPOP** — same `{status:blocked, reasonCode}` rendered twice ⇒ exactly one entry animation. (`blockedReasonBadge`)
- **COLOR-NEVER-ONLY** — no two reasons share an `iconId`; every reason has a non-empty word `a11yKey` that resolves in both locales. (Silhouette grayscale distinctness is a human design gate, not a string test.) (`classify`)

## Non-goals

- **NOT** classifying assertion-level outcomes ("a test failed" vs "the test command failed") — the hook cannot observe it.
- **NOT** shipping `permission-blocked` / `auth-error` / `rate-limit` — deferred to Phase-2 (need a structured errno/HTTP-status payload field; substring regex over free-text is fabrication).
- **NOT** aggregation / per-reason counts / recurring-failure history — that is downstream AVO-117; this spec emits a **per-event** reason only.
- **NOT** per-reason character animations / pet-skin reactions / debuff postures — the pet is frozen; reuse the existing blocked expression.
- **NOT** a severity meter, fake ETA/countdown, multi-badge stacking, a docked legend widget, sound, screen-shake, or red alarm flash.
- **NOT** NLP / full-body error-text parsing; stay on structured command + first-line launch-token signals only.

## Constraints

- Honesty-first: a wrong-but-specific tag is worse than an honest-but-vague one (it misdirects human repair attention). `blocked-unknown` is the load-bearing default, mirroring the office pet's hide-on-blocker guarantee.
- The `blocked-unknown` glyph is the **most frequent** state by design and MUST read as honest uncertainty (neutral "stuck/?", lowest-chroma hue), NOT a red failure ✗ (which would imply the assertion-level outcome AC-4 forbids). Specific-reason hues are muted/desaturated and must coexist with the existing mood-weather palette without adding a new alarm color.
- `reasonCode` is a single source of truth derived at the hook; the renderer is a pure table lookup with **no** second classifier.
- Reduced-motion + en/zh-TW i18n parity are hard requirements (project-wide).
- Protected Surfaces (movement/layout/scale, AgentCharacter label scale) untouched — the badge reuses the over-head BehaviorIndicator region only, overlap-verified.
- Ship the `reasonCode` **contract** (field + enum) even if most events initially land as `blocked-unknown`, because AVO-117 depends on a stable structured reason field in the event stream.

## API / Data Contract

```
// Hook derivation (PostToolUse, only when computed isError true):
//   reasonCode = deriveBlockedReason({ is_error, command, toolResultFirstLine })
//   → specific only if: is_error===true (explicit) && single-segment && ^-allowlist && !launchFailure
//   → else 'blocked-unknown'
agentRecord.reasonCode: 'test-run-failed' | 'build-failed' | 'deps-failed' | 'blocked-unknown'
  // absent on non-error/non-blocked events (presence semantics); carried forward while still blocked

// Transport + store:
u.reasonCode (SSE/poll payload)  →  ext[id].reasonCode = u.reasonCode || null   (store.js:780-791)

// Render (pure table lookup, reads ext.reasonCode):
classifyBlockedReason(reasonCode?: string): {
  family: FAMILIES.BLOCKED,
  reason: string,     // normalized enum; unknown/absent → 'blocked-unknown'
  iconId: string,     // bespoke vector glyph id (language-neutral, unique per reason)
  hue: string,        // 3rd redundant channel only
  a11yKey: string,    // language-neutral i18n key; localized string resolved at render
}
```

MVP reason set = **4**: `test-run-failed`, `build-failed`, `deps-failed`, `blocked-unknown`.
Provisional anchored allowlists (single-segment only; **non-normative — finalized in `/plan`** with the near-miss negatives above):
tests `^(vitest|jest|pytest|mocha|npm (run )?test|yarn test|pnpm test)\b`;
build `^(npm run build|vite build|tsc|webpack|rollup)\b`; deps `^(npm (i|ci|install)|yarn add|pnpm (i|add)|pip install)\b`.

## Domain Decisions

- [DECISION] `reasonCode` is derived + stamped at the hook (single source of truth) gated on the explicit `is_error===true` boolean; `classifyBlockedReason` is a pure render-side table lookup. Rejected re-deriving on the render side from `ext.label` — a second classifier drifts.
- [DECISION] `classifyStatus` is untouched; reason is a NEW orthogonal axis. Keeps the 90+ existing classifier tests green and status/reason concerns separable.
- [CONSTRAINT] A specific reason renders ONLY for single-segment commands (no `&&`/`||`/`;`/`|`/newline/`&`) matching a tight `^`-anchored allowlist, with explicit `is_error===true`, AND no launch-failure first-line. Any other case → `blocked-unknown`. This is the honesty firewall against wrong-segment attribution AND launch-vs-run over-claim.
- [CONSTRAINT] Labels claim only what the signal proves ("blocked on the test run", not "test failed"); the `blocked-unknown` glyph is neutral uncertainty, never a red failure mark.
- [DECISION] The badge is a PER-AGENT over-head element overriding the BehaviorIndicator glyph while blocked; the singleton OfficePet (already hides on blockers) is a separate surface and is untouched.
- [CONSTRAINT] The `reasonCode` field MUST survive the full path — hook `newAgents` literal + hook merge-read carry-forward + transport `u` payload + store `ext` rebuild — or the feature renders nothing while EPHEMERAL tests pass trivially (false confidence).
- [TRADEOFF] MVP under-specifies (many real blocks land as `blocked-unknown`) in exchange for zero false-positive specific tags. The Claude Code harness wraps commands as `cd "<dir>" && <cmd>` (`hook:204-205,221-224`), which trips the single-segment guard, so specific tags may be **rare** until a `/plan`-decided narrow exception strips a leading glue-only `cd <path> &&` prefix (cd cannot be the failing program) — value rests primarily on the AVO-117 contract field meanwhile. Accepted: a false negative preserves honesty; a false positive breaks it.

## File Relationship

INDEPENDENT spec. EXTENDS the `classify.js` classifier family (`classifier-foundation` / `classifier-wiring` / `classifier-unknown-log`, all [Shipped]) by adding a new orthogonal pure function — does **not** modify or replace any frozen/shipped spec. No conflicting legacy spec exists in the Spec Index.

## Phasing

- **Phase 1 (this spec, MVP)** — truth-half (`classifyBlockedReason` + hook `reasonCode` derivation for the 4-reason set + data-path wiring + all honesty-invariant tests; heavy `/review`) and cosmetic-half (per-agent over-head badge + new vector glyph set + i18n + RM behavior; light review over an already-trusted signal).
- **Phase 2 (deferred, separate ticket)** — hook enrichment forwarding a **structured** errno/HTTP-status payload field (NEVER substring-matching free text — same firewall principle as Phase 1) to honestly unlock `permission-blocked` / `auth-error` / `rate-limit`; then AVO-117 aggregation.
