# Work Log: chore/isolated-status-dir-for-staging

## Header

- Branch: `chore/isolated-status-dir-for-staging`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `true`
- Created Date: `2026-08-26`
- Owner: `KbWen`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Diff Base SHA: `6f1be0c`
- Checkpoint SHA: `c7ecbd9`
- Recommended Skills: `verification-before-completion (auto), red-team-adversarial (auto), karpathy-principles (auto)`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `118`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-08-26 claude-code`
- Platform: `claude-code`
- Files Read: `4`
- Context Read Receipt:
  - `current_state.md` -> read this session; Update Sequence `118`
  - Spec Scope -> none; this is dev tooling, no product spec covers it

---

## Task Description

Every visual judgement in this project is currently taken under uncontrolled conditions: the dev
server reads status from `~/.claude/office-status*.json`, which is the operator's own live Claude
Code hook traffic, so staged scenes are overwritten within ~2s. Measured three times in one session
(`window.__office_status__` injection, `applyExternalStatus` staging, and `sim-soak`). Give the dev
server an `OFFICE_STATUS_DIR` override so a shot can run against an isolated, empty status
directory and the EXISTING staging path becomes deterministic.

**This is not a mock.** No new fabrication capability is added — `applyExternalStatus` staging
already exists and is what every `*-shot.mjs` uses. This only removes the contention that
overwrites it.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-08-26 | classified `quick-win`; branch cut from `main` @ `6f1be0c` |
| plan | done | 2026-08-26 | 3 files; dev-tooling only, no runtime app code |
| implement | done | 2026-08-26 | env override + asserting shot harness + warning on the silent one |
| review | done | 2026-08-26 | PASS; R1 proven by absence from dist/ |
| test | done | 2026-08-26 | 2319/2319; validators fail=0; harness proved on both branches of its own flag |
| handoff | n/a | — | quick-win exempt |
| ship | done | 2026-08-26 | SSoT entry; log archived |

---

## Phase Summary

- plan: the obvious design -- a browser-side status mock -- was rejected before it was written. It
  would put a fabricated-status capability inside the product, which is the one thing this product
  exists not to do. Two facts found by reading instead made a far smaller design possible: the status
  API is registered under `configureServer` **only** (no `configurePreviewServer`, no `apply`), so it
  never runs for a built/preview/packaged office; and `STALENESS_TIMEOUT` is 2 minutes, so a staged
  scene survives easily once nothing is overwriting it. So the fix is not a mock at all -- it isolates
  the EXISTING staging path from live traffic. 3 files, zero runtime app code.
- implement: `OFFICE_STATUS_DIR` overrides the directory the dev server reads status from
  (`vite.config.js`), defaulting to the previous homedir path when unset. New
  `scripts/staged-capture.mjs` spawns its own dev server against an empty temp dir, stages, and
  then **asserts the staging reached the RENDER** -- reading the DOM, not the store it just wrote to
  -- and exits non-zero if it did not. A `--hide-names` flag applies a render-only counterfactual so
  a design question can be answered with an A/B image without touching source. Finally,
  `clutter-audit-shot.mjs` got a warning header: it does not assert, and it is the script that
  produced a "6 quiet" shot while claiming six busy agents (that script is gitignored, so the
  warning is local-only).
- drift: the harness was first written as `staged-office-shot.mjs`, which `.gitignore:87`
  (`scripts/*-shot.mjs`) silently excludes -- that pattern is the **one-off** class; durable tools
  (`render-smoke`, `sim-soak`, `zone-audit`) are named otherwise. Renamed to `staged-capture.mjs`
  so it lands tracked, rather than `git add -f`-ing against the repo's own convention.
- review: PASS. R1 (a fabrication seam must never be reachable in a shipped office) is proven by
  construction and then measured, not asserted: `grep -rl OFFICE_STATUS_DIR dist/` after a real build
  returns nothing, and `configurePreviewServer` count is 0. Default behaviour is unchanged --
  verified by resolving the path with the variable unset (`C:\Users\wen\.claude\office-status.json`,
  identical to before) and set. No new fabrication capability: `applyExternalStatus` staging already
  existed and is what every `*-shot.mjs` uses.
- test: full suite 116 files / 2319 tests, build PASS, both validators `fail=0`. The harness was
  proven on both branches of its own flag -- `--scenario busy` staged 8/8 agents and the render
  confirmed all 8, and `--hide-names` produced the counterfactual. Its assertion is not decorative:
  it is the exact check whose absence let the old script pass while staging nothing.
- ship: PASS. The tool paid for itself immediately -- see `## Decisions` D-1, where the A/B it
  produced rejected the very proposal it was built to evaluate.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T10:30:00+08:00
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T10:35:00+08:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T10:45:00+08:00
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T10:52:00+08:00
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T10:58:00+08:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-26T11:05:00+08:00

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Code | `vite.config.js:24` | `STATUS_PATH` — the hard-coded homedir path being made overridable |
| Code | `src/inference/inferStatus.js:709` | `STALENESS_TIMEOUT = 120000` — staged agents survive 2 min unopposed |
| ADR | `docs/adr/ADR-008-no-fabricated-need-ambient-honesty.md` | the honesty rule this change must not weaken |

---

## Known Risk

- **R1 (the one that matters) — a status-fabrication seam must never be reachable in a shipped
  office.** Mitigated by construction, not by discipline: the status API plugin is registered under
  `configureServer` ONLY (no `configurePreviewServer`, no `apply`), so it does not run for
  `vite build` / `vite preview` / the packaged `bin/cli.js` serve path. `vite.config.js` is Node
  build tooling and is never bundled into the browser payload, so the override cannot reach a user's
  office at all. To be proven, not asserted: grep the built bundle for the env name.
- **R2 — an operator sets `OFFICE_STATUS_DIR` and then forgets, and later reads a stale office as
  real.** The override is opt-in per-process and absent by default. Accepted; the alternative
  (auto-detection) would be worse.
- **R3 — the staged scene still drifts** because expiry or the ambient sim moves agents. Bounded by
  `STALENESS_TIMEOUT` 2 min and the existing freeze recipe (`isPaused`, `isMoving:false`).

---

## Decisions

### D-1: Reject the name-pill text reduction -- refuted by the A/B this tool made possible

- **Decision**: do NOT suppress agent name tags for routine active states. The proposal is closed,
  not parked. → local
- **Reason**: with the deterministic harness the counterfactual is renderable, and it loses badly.
  In the 8-agent staged scene, the "before" reads at a glance -- PM purple (planning), Researcher
  green (done), DevOps red (blocked), the rest amber (working). In `--hide-names` the office becomes
  anonymous sprites: the surviving status rings are thin and low-contrast, and **working / planning /
  done rings are not distinguishable at a glance**, so the pill FILL was carrying most of the status
  signal, not merely duplicating it.
- **What I got wrong, recorded because the reasoning error is the reusable part**: I argued from
  `AgentCharacter.jsx:1713` ("the name-pill FILL color and the glow RING already encode status"),
  which justified deleting the corner status glyph. That comment is about removing a **third**
  redundant channel. Reusing it to justify removing the **second** is a different claim, and the
  image shows it is false. A precedent for deleting channel 3 is not a precedent for deleting
  channel 2.
- **Also corrected**: my original clutter diagnosis came from a live screenshot where agents were
  bunched mid-walk. In the staged scene at home positions, 8 pills are spatially separated and read
  fine. The clutter driver is **positional bunching**, which is already governed by the separation
  and out-trip work (AVO-156 / AVO-165 / ADR-004) -- not the number of text channels.
- **Alternatives**: V2 (hide the pill only while that agent's bubble is visible) is also rejected by
  the same evidence -- it removes the status chip at the exact moment the agent is most salient.
- **Impact**: `showName` is unchanged. If the owner wants this revisited, the re-open condition is
  the sprite-art work (AVO-160 / AVO-124) landing, since that is the only thing that could carry
  identity without text. Worth an ADR if it keeps coming back; recorded as `local` for now.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

none

---

## Review Feedback

none

---

## Red Team Findings

none

---

## Design Reference

none

---

## Observability

none

---

## Resume

none

---

## Test Gate Results

none

---

## Evidence

- **R1 proof (cannot reach a shipped office)**: `npm run build` exit 0, then
  `grep -rl OFFICE_STATUS_DIR dist/` -> no match; `grep -c configurePreviewServer vite.config.js` -> `0`.
- **Default unchanged**: unset -> `C:\Users\wen\.claude\office-status.json` (identical to the prior
  hard-coded path); set -> the override dir.
- **Harness works**: `--scenario busy` -> staged 8, render confirmed 8/8
  (`gate/qa/arch/dev/designer working, pm planning, res done, ops blocked`), census
  `activeAgents 8 + visibleBubbles 3 = 11 text objects`, `consoleErrors: []`. This is the first
  reproducible measurement of the busy case in this repo, and it matches the source-derived
  arithmetic `N + min(3, N)` exactly.
- **Counterfactual**: `--hide-names` renders the same scene with name tags suppressed for routine
  states, rings kept, blocked kept.
- **Suite**: `vitest 116 files / 2319 tests` passed; `validate.sh pass=113 warn=6 fail=0 skip=5`.
