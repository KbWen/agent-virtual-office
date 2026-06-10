---
status: shipped
title: AVO-148 — Structured-event blocked reasons (AVO-110 Phase-2)
created: 2026-06-10
last_updated: 2026-06-10
---

# AVO-148 — Structured-Event Blocked Reasons

## Problem

AVO-110 shipped the 4-reason honest-narrow MVP and explicitly deferred `permission` / `auth` /
`rate-limit` because deriving them from free text is fabrication. Ground-truth research
(2026-06-10, official hooks docs) found STRUCTURED signals now exist:

- **`PermissionDenied`** hook event — fires only when the permission system denies a tool call;
  carries `tool_name` + `denial_reason`. Zero text parsing.
- **`StopFailure`** hook event — fires when the turn ends on a Claude-API error; the matcher is a
  structured enum (`rate_limit`, `authentication_failed`, `overloaded`, …). Zero text parsing.
- Tool-level 401/429 (a curl inside Bash, a WebFetch) have NO structured field → **rejected**
  (would require regex over rendered text = the exact fabrication AVO-110 refused).

## Honesty doctrine (inherited from AVO-110 PATH A)

Event-driven = honest by construction: a reason is stamped ONLY when the named event observably
fired. If the user's Claude Code version predates these events, the handlers never run and
nothing is claimed. Wording claims exactly the proven scope: "API rate-limited" (the session's
API call), never "a tool hit 429".

## New reason tokens (3)

| token | source event | claim (en / zh-TW) | scope of claim |
|---|---|---|---|
| `permission-denied` | `PermissionDenied` | Permission denied / 權限被拒 | THIS tool call was denied by the permission system |
| `api-rate-limit` | `StopFailure` matcher `rate_limit` | API rate-limited / API 限流中 | the session's Claude-API call was throttled |
| `api-auth-failed` | `StopFailure` matcher `authentication_failed` | API auth failed / API 認證失敗 | the session's Claude-API auth failed |

Other `StopFailure` matchers (overloaded, billing, …) → existing `blocked-unknown` floor
(blocked is TRUE — the turn died; the specific cause stays unclaimed).

## Acceptance Criteria

- **AC-1 Hook handlers** (`public/hooks/office-status-hook.js`):
  - `PermissionDenied` → role = `toolToRole(tool_name)` → that agent `status:'blocked'`,
    `reasonCode:'permission-denied'`. EPHEMERAL by the existing AVO-110 contract (next status
    change clears it). Handler is defensive: missing fields → fall back to `blocked-unknown` or
    no-op; NEVER throws; runs under the H3 write lock like other RMW handlers.
  - `StopFailure` → matcher from the event input; `rate_limit` → `api-rate-limit`,
    `authentication_failed` → `api-auth-failed`, anything else → `blocked-unknown`; applies to
    THIS session's agents currently `working`/`planning` (they are genuinely stalled — the turn
    died). Reuses the Stop handler's session-scoping discipline.
- **AC-2 Token plumbing** (first live run of the H2 checklist):
  `BLOCKED_REASONS` += 3 in `src/systems/classify.js` AND the `normalizePost.mjs` mirror;
  **new mechanical guard**: drift-guard test asserts `mjs BLOCKED_REASONS` toEqual canonical
  (list equality, not just probe equivalence) + add the 3 new tokens to the sanitizer probe
  table. `classifyBlockedReason` maps each token → distinct `{iconId, hue, a11yKey}`.
- **AC-3 UI**: `blockedReasonBadge.jsx` gains 3 distinct pixel glyphs (🚫-style deny / ⏳-style
  throttle / 🔑-style auth, as SVG silhouettes consistent with the existing 4); ControlPanel row
  + i18n labels (en + zh-TW) driven by the TOKEN (no label re-parse); reduced-motion identical
  treatment to existing badges.
- **AC-4 Registration surfaces** (all three): hook README/setup — `bin/cli.js` setup registers
  `PermissionDenied` + `StopFailure`; this repo's `.claude/settings.json` adds both; README hook
  docs updated. Registration must be harmless on Claude Code versions lacking these events
  (verify locally that settings with unknown event names don't break `claude` startup — if
  unverifiable, document as known-compatible-from-version note).
- **AC-5 Downstream honesty intact**: recurringFailure (AVO-117) automatically includes the new
  specific tokens (they are not `blocked-unknown`); desktopNotifier unchanged; the EPHEMERAL
  clear contract regression-tested for the new tokens (transport e2e per token like AVO-110's).
- **AC-6 Tests**: synthetic-event unit tests for both handlers (valid payload → correct
  agent+token; malformed → no-throw + floor); BLOCKED_REASONS mirror equality; badge render per
  token; full suite green; smoke exit 0.

## Non-Goals

- Tool-level 401/429/EACCES detection (no structured signal — rejected as fabrication).
- Distinguishing PermissionRequest dialogs (that is `awaiting-approval` territory, already
  handled by idle-gap inference; DENIED ≠ awaiting).
- Office-wide visual set-pieces for API outages (pure badge/reason scope).

## Risks & Rollback

- **Risk**: docs-vs-runtime schema drift (the local Claude Code may predate `PostToolUseFailure`
  -era schemas; our existing `is_error` usage suggests an older payload shape coexists).
  Mitigation: handlers key ONLY on `hook_event_name` + defensive field access; absent events =
  inert; unknownLog (#A3) will surface any unexpected shapes in dev.
- **Risk**: StopFailure attribution breadth (all active session agents get the badge) — accepted:
  the turn genuinely died for all of them; wording claims the API, not the agent's own task.
- **Rollback**: single PR revert; tokens are additive; absent tokens render as blocked-unknown.
