# Changelog

All notable user-facing changes to Agent Virtual Office. Engineering details
live in `docs/specs/_shipped-log.md`; this file is the high-level story.

Format loosely follows [Keep a Changelog](https://keepachangelog.com).

## v1.6.3 — 2026-06-27 — Fuller corners, honest windows

### Added

- **The office got more furnished** — the previously-empty meeting-room right column now has a cozy
  breakout corner (couch, coffee table, plants);
  the entrance hallway gained framed wall art and a reception water-cooler corner; a third meeting-room
  window and a meeting wall clock round it out. Every new piece is pure decoration — it carries no
  agent status and never sits where a status ring, name label, or speech bubble needs the space.

### Fixed

- **Windows only on real exterior walls** — removed four "night-sky" windows that were mounted on an
  interior partition wall (you'd have been looking into the hallway, not outside); that wall now holds
  framed art and the clock instead.

## v1.6.2 — 2026-06-23 — Docs catch up to the cozy office

A docs + internal-maintenance release — **no runtime changes**. The app behaves exactly as in
v1.6.1; this release brings the README and design docs in line with what already shipped.

### Changed

- **README visuals refreshed to the cozy build** — the hero and scene images were regenerated from
  the current cozy office (decluttered plants, warm palette) introduced in v1.6.1; the prior shots
  predated it. Staged in daylight so the hero stays sunny.

### Documentation

- **Dialogue / voice layer documented** — agents murmuring in their own per-role voices, with the
  speech bubble reserved for voice while status rides the colour ring + work symbol (Wave A, ADR-007),
  is now described in the README (English + 繁體中文) and cross-referenced from the design spec.

### Internal

- **Governance tooling upgraded** — the Agentic OS workflow brain used during development was updated
  v1.5.2 → v1.8.1 (new credential/safety layer). Dev-time only; no effect on the shipped app.

## v1.6.1 — 2026-06-20 — Calmer, cozier, and harder to fool

A maintenance + polish release: the room got cozier to look at, calmer to watch, and even
harder to mislead about what your agents are actually doing.

### Added

- **"Waiting on you" agents stand out** — an agent stuck at a permission prompt (`awaiting-approval`)
  now gets its own ring + name-tag colour instead of looking like a normal idle agent.
- **Elapsed-time-in-state in the inspector** — open an agent and you can see "blocked for 3m" /
  "waiting for 3m", driven only by real timestamps (never a fabricated count).

### Changed

- **Cozy visual pass** — the office is less cluttered (decorative plants thinned to a deliberate
  few in a balanced frame) and warmer: the lounge couch, coffee machine, and water-cooler moved
  from cold corporate greys to a warm, lived-in palette. Status colours and every signal-bearing
  cue were left exactly as they were.
- **Calmer walk rhythm** — fewer agents wander the floor at the same time (a concurrent-trip cap),
  so the room reads relaxed without going dead.
- **Comms feed honesty + roster de-dup** — the activity feed is more honest and the roster no longer
  double-lists.

### Fixed

- **A browser tab title can no longer fake a status** — the document-title channel used to inject
  "blocked"/"done" from any unrelated tab titled e.g. "build failed". It now only ever reads as
  working, never a conclusive state.
- **The pet won't celebrate while you're needed** — the office-pet hide-on-blocker guarantee now
  also covers "waiting on you", so it can't bounce happily while an agent is stuck at a prompt.
- **No cross-role file bleed** — a shorthand status POST no longer broadcasts one role's active file
  onto the others.
- **Honesty + accessibility polish** — reduced-motion gating, a keyboard-operable inspector close,
  and English/繁體中文 aria parity.

### Internal

- God-reducer cleanup (equivalence-guarded pure-helper extraction; blocked-family constants
  single-sourced), a per-agent memory-leak prune on worktree-agent eviction, crash/corruption
  guards, and **ADR-008** — a codified "no-fabricated-need" rule that gates every future
  ambient/pet/charm/notification feature.

## v1.6.0 — 2026-06-15 — Everyone finds their voice — quietly, and honestly

The office learned to talk in character — and got calmer and more honest at the same time.

### Added

- **Agent voices (dialogue layer, wave A)** — each role now speaks in its own voice: short,
  in-character lines from per-role archetypes (Sprinter, Skeptic, Sage, Coordinator, Aesthete),
  fully bilingual (English + 繁體中文). Lines are open-ended on purpose — they never claim a
  work outcome that didn't happen.

### Changed

- **Quieter by default** — working agents talk a lot less (the over-chatty baseline was cut)
  and the office walks around less. The room reads calmer without going dead.
- **Dev RAF diagnostic is opt-in** — the frame-rate watchdog chip now only appears with
  `?debug=raf` instead of always sitting in the corner.

### Fixed

- **Clicking the deploy button or whiteboard no longer fakes a result** — a click used to pop
  "Deploy Success! 🚀" / "got it! 💡" (plus confetti and the pet celebrating) with nothing real
  behind it. Those celebrations now fire only when a real signal backs them; an idle click gets
  an honest, non-committal reaction instead. The office still never fakes activity.
- **De-fabricated cross-agent reactions** — an agent reacts to a colleague's state only when
  there's a fresh real signal for it, not stale or absent state.

### Internal

- Bubble-render perf (one compute/write per tick instead of N), single-sourced the office-status
  transport contract, refreshed the README imagery + a branded social-preview card, and a
  backward-audit pass that corrected stale docs.

## v1.5.1 — 2026-06-14 — Card + poke polish

### Fixed

- **Share card looks better** — redesigned the postcard into a populated little office
  (wall + windows, a row of desks with agents, a plant) with fuller weather and tighter
  spacing, instead of the earlier mostly-empty layout. The data behind it is unchanged.
- **Poke is shown as a GIF** — the README now demonstrates the poke reaction with a short
  animation instead of a static frame that didn't read as anything happening.

## v1.5.0 — 2026-06-14 — Make it yours: share it, poke it, theme it

A more personal release: poke your agents, save the day as a card, re-skin the room. The
resting UI also got quieter. As always, nothing here invents an agent's state.

### Added

- **Poke / acknowledge (AVO-158)** — click a character and it bobs and shows what it's doing
  right now (text comes from its real status). `Space` pokes again; right-click pokes without
  opening the inspector. It never moves the character or changes its status. Drag-to-move was
  considered and rejected — see ADR-005.
- **Shareable end-of-day card (AVO-115)** — one click exports the day as a pixel-art card
  (weather/mood + the day's done count + a short caption). Runs in the browser (no upload),
  download or native Share, English and 繁體中文. An empty day is labeled as such.
- **Office theme selector (AVO-123)** — re-skin the room from the ⚙ menu (Default / Winter /
  Autumn light tints). Contrast is checked so status colors stay readable.
- **Skill activation badge (AVO-104)** — a brief skill bubble when a subagent picks up a skill.
- **Rare-event juice (AVO-136)** — deploy confetti, eureka sparkle, and a local desk-slam
  shake. Rare, capped, and reduced-motion-safe.
- **Ambient touches** — time-of-day lighting, desk-lamp halos, and an optional procedural
  soundscape (off by default, 0 KB).

### Changed

- **Quieter control bar (AVO-130)** — the four health pills became one dot; language, view,
  run, and help moved into a ⚙ menu.
- **Review-gate "waiting" tray (AVO-107)** — the Gatekeeper shows an awaiting-approval tray
  driven by real awaiting-approval signals only (no made-up queue or ticket types).
- **Build** — Vite 6 → 8 (clears the esbuild advisory); React 19.2, Tailwind CSS 4.3, Zustand 5.0.

## v1.4.0 — 2026-06-10 — A calmer, honest office that can't pile up — and watches itself overnight

The "characters keep stacking / teleporting / rushing around" era ends here. Every fix in
this release was driven by **measurement first** (live forensic recorders, engine
simulations, A/B protocols), then locked in by a soak gate that re-checks the office
every night so this bug class can't silently return.

### Added

- **Pair-programming link (AVO-106)** — two agents editing the SAME file within 90s show an
  honest desk-to-desk collaboration link (no fake relocation; the claim expires with its truth).
- **Sim-soak gate (AVO-157)** — `npm run soak` runs the office headless for N minutes and
  fails on world-invariant violations: teleports, sustained standing stacks, frozen walkers,
  characters standing inside furniture. Nightly CI workflow + on-demand dispatch; the gate
  logic itself is unit-tested (a gate that can't fail protects nothing). Forensic tooling
  family included: `scripts/zone-audit.mjs` (rhythm/zone occupancy), `scripts/overlap-recorder.mjs`
  (stack forensics with per-agent state chains).

### Fixed

- **Standing overlaps, structurally (AVO-156)** — five stacked root causes closed in one
  forensics-driven pass: walk freezes on unguarded animation legs (stall watchdog now guards
  the WHOLE journey), all cross-room walks funneling through one exact door pixel (per-transit
  jitter), walkers' landing spots invisible to others (journey targets published), circular
  spacing that allowed fully-overlapped "vertical separations" (visual-ellipse contract,
  32×44px), and no recovery once stacked (polite arrival side-step). Live 12-min A/B:
  **12 sustained stack events → 0**.
- **Three-sprite stack at the gate** — social visitors now approach from the SIDE (±45°
  lateral cones, 並肩聊天); vertical pile-ups are geometrically impossible.
- **Restless walking (躁動)** — removed the solo meeting-room march (≈20% of all behavior
  cycles!), slowed walks 80→60px/s, lengthened desk focus and break-room dwells. Working
  agents now read as working; the break room and research library actually get visited.
  Live A/B: screen time with 2+ simultaneous walkers 46% → 24%.
- **Sudden position resets / brief disappearances** — hidden-tab walk freezes now snap
  cleanly (5s threshold, A/B-proven) and branch-hop ghost sessions are cleaned at the hook
  (43 stale roster entries → 1).
- **Pet wall-phasing** — wander hops are accepted only when every 2px sample of the segment
  is walkable; the pet pauses instead of ghosting through walls.

### Notes

- Engineering details, forensic captures, and review receipts: `docs/specs/standing-overlap-deconfliction.md`,
  `docs/specs/sim-soak-gate.md`, and `.agentcortex/context/archive/`.

## v1.3.0 — 2026-06-08 — Blocked-reason tags + recurring-failure detection

The office stopped just saying "stuck" and started saying **stuck on what** — and **stuck again**.
Two honesty-first observability features built on the real hook signal.

### Added

- **Blocked-reason tags (AVO-110 / #29)** — a blocked agent now shows a small over-head pixel
  "status-effect" badge: 🧪 the test run failed · 🔨 the build failed · 📦 a dependency install
  failed · ❔ blocked, cause unknown. The ControlPanel roster row mirrors it as icon + label.
  **Honest-narrow by design**: a *specific* reason shows only when a single-segment command matches
  a tight allowlist on a real error and actually launched — anything ambiguous degrades to the
  neutral ❔ (never a guessed cause). Wording claims only "blocked on the test **run**", never
  "test failed". Raw error text stays on hover. en + zh-TW.
- **Recurring-failure detection (AVO-117)** — when the *same kind* of failure recurs across ≥3
  distinct blocked episodes for one agent within ~10 minutes, the badge gains a quiet ↻ mark and
  (if notifications are on) fires one desktop notice. It claims only the recurring **pattern**
  ("tests keep failing"), never a specific root cause; `blocked-unknown` never escalates; and an
  idle-gap `blocked↔awaiting-approval` flap of a single stuck state can't manufacture a false alarm.

### Notes

- Both reasons flow from the existing Claude Code status hook (`reasonCode` on the event stream),
  so they light up from your *real* session — a failing `npm test` shows the 🧪 badge live.
- `permission` / `auth` / `rate-limit` reasons and finer error signatures are intentionally
  deferred — they need a structured errno/HTTP-status hook field (substring-matching free text
  would be fabrication). Honesty invariants are covered by the test suite (now 1411 tests).

## v1.2.0 — 2026-06-05 — Honest living office + responsive fill (UX Vibe Rebalance wave)

Shipped on branch `feat/ux-vibe-rebalance` (pending human PR review + merge). The office
became a fluid, honest, alive companion — and stopped breaking on resize.

### Added

- **Living-office events** — the office now *honestly* reflects real work. A derived
  **team-affect layer**: `teamPulse` makes the room "lean in" as real-signal density rises;
  `focusAnchor` orients idle agents toward the live desk. **Honesty gating** — the 5 work-claim
  events (deploy/review/eureka/etc.) fire only on a recent real signal; social/world events stay
  free. **Reluctant participant** — a busy agent torn by a team event shows a sub-dominant ⏳
  (pure overlay, never hides its real status). **Real-seeded triggers** — a real deploy / block /
  subagent *causally* fires the matching team moment (globally rate-limited for calm-tech).
  Iron rule: per-agent real status is never hidden, frozen, or faked.
- Earlier in the wave: **POINT-2 readable in-scene labels**, **COMMS living presence rail + feed**,
  **subagent helper huddle**.

### Changed / Fixed

- **Responsive office** — fills the full browser **width** at every window shape (no left/right
  whitespace; agent sides never cropped). Top-row speech bubbles flip *below* the head when they
  would clip the top edge. The ☰ roster fills width.
- **Readability** — enlarged too-small decorative labels (kanban headers, wall signs); the cryptic
  red **"OT"** night badge spelled out to **"OVERTIME"**.
- **Stability** — fixed agents piling on top of each other during `standup`; **every event gather
  target is now clamped to a walkable floor cell** (no agent can stand in a wall); real-seed events
  globally cooldown-gated to stay rare; **speech bubbles + activity-feed entries + the mood engine
  now react only to real status changes, not to every status poll/heartbeat** (killed the "every
  character suddenly speaks for no reason / refresh" glitch and false `rushing`/weather inflation);
  **gather events now deconflict their targets** so agents never pile onto one cell (which previously
  let the upper sprite fully hide the others — "4 piled, one disappeared").

### Notes

- 1263 tests / 50 files pass; build clean. Behavioral logic is test-verified; **pixel/visual
  appearance pending owner confirm** (preview screenshots unavailable in this build env). Not yet
  merged to `main` (human PR).

## v1.1.0 — 2026-05-29 — Classifier + observability wave

The biggest single-session push since v0.10. Eight new features + two
follow-up fixes shipped, taking the project from a status visualizer to a
**richer activity classifier with self-improving feedback loops**.

### Added

- **#6 底部效能指標 (perf metrics)** — `✓N / ✗M` chip in the bottom status bar
  showing today's done / blocked counts. `dailyBlockedLedger` transition counter
  parallel to `dailyDoneLedger`, atomic day rollover, i18n + sr-only mirror.
- **#14 天氣系統 (weather)** — Window weather overlays mapped to team mood:
  `frustrated → rain`, `stuck → thunderstorm`, `rushing → cloudy`. Lightning
  capped at 0.35 opacity / 5s cycle for photosensitivity safety. `reducedMotion`
  drops animations. Raindrop stroke tuned for daytime contrast.
- **#15 白板手寫動畫 (whiteboard handwriting)** — Confirmed pre-existing
  (`PixelOffice.jsx:146` `WhiteboardAnimation`); closure-documented.
- **#A1 Standards-aligned classifier foundation** — `src/systems/classify.js`
  4-tier waterfall (Tier 0 built-in registry → Tier 3 W3C Activity Streams 2.0
  verb taxonomy → Tier 4 MCP `mcp__server__tool` namespace parser → Tier 5
  unknown). 90 unit tests.
- **#A2 Classifier wiring** — `store.applyExternalStatus` falls through to
  `familyToBehavior(classifyTask(task).family)` for non-built-in tools. MCP /
  verb-recognizable tasks now pick family-appropriate animations.
- **#A2.1 Role-aware classifier** — `classifyRole` + `classifyWorkflow` +
  `decideBehavior(task, role, status, workflow)` 4-priority resolver
  (status > workflow > role > family). Same tool produces different animations
  per role: `qa+Bash → magnifier`, `ops+Bash → deploy-button`,
  `gate+Bash → shield-verify`, `designer+Edit → whiteboard`, etc.
- **#A3 unknownLog (self-improving classifier)** — Dev-mode aggregator for
  Tier 5 unknown task/status/mood/role/workflow raws (LangSmith pattern).
  `window.__office_unknownLog` + `window.__office_logUnknowns()` for DevTools.
  Zero-cost in production via `import.meta.env.PROD` gate.
- **#8 桌面通知 (desktop notifications)** — Browser Notification when an
  agent stays blocked ≥30s + tab hidden + permission granted. Per-episode
  dedupe (blocked→working→blocked = 2 notifications). 🔔 button in
  ControlPanel for permission request (user-gesture required).
- **#C Idle-gap inference** — Closes [Pixel Agents'](https://github.com/pablodelucca/pixel-agents)
  publicly admitted heuristic gap. Conservative thresholds: `working + 45s
  no update → 'thinking'`; `blocked + 90s no update → 'awaiting-approval'`.
  Real hook events overwrite inferred status (reversibility by construction).

### Changed

- **#27 CSP compatibility** — Weather `@keyframes` moved from inline `<style>`
  tag (CSP violation under strict `style-src 'self'`) to bundled `src/index.css`.
  Production JS now contains zero `@keyframes`; CSS bundle gained ~0.3 KB.
  README troubleshooting expanded with CSP guidance.

### Fixed

- **moodEngine empty-batch guard** — `pushEventBatch([])` previously called
  `updateStoreMood()` unconditionally, silently flipping mood→idle. Now gated
  by `if (added > 0)`. Real-world impact was zero (callers gated upstream) but
  the contract is now safe by construction.
- **MCP Tier 4 inner-verb bubble-up** — `mcp__notion__create_page` etc. now
  bubble the inner verb's family up (CREATE / DELETE / SEARCH / READ) instead
  of collapsing to flat EXTERNAL → typing.

### Stats

- **925 tests** (up from 614 at session start, +311)
- **~16 commits**, all on `main`
- **Bundle**: 384 KB JS / 24 KB CSS (≈+5 KB raw / +1.6 KB gzip for the wave)
- **0 spawned follow-up chips** outstanding

## 2026-05-26 — movementSystem unit tests

- Added 27 vitest cases for `src/systems/movementSystem.js` covering
  `calcFacing` / `needsLocationChange` / `calculatePath` / `getTargetForBehavior`
  and key constants. No production code changes.

## 2026-05-16 — Character growth + clickable objects (closure)

- **#1 角色成長系統** — Coffee / sticky / books accumulate per agent based on
  daily `done` events; 4-level visual growth (0/1/3/6 thresholds); daily reset
  via `dayKey`.
- **#7 可點擊辦公室物件** — Closure-documented as pre-existing: coffee
  machine → tea-break, whiteboard → eureka, deploy button → deploy-success.

## 2026-04-08 — Inspector enhancement + Codex parity

- **#5 Inspector 資訊加強** — Durable same-day done count, mood / workflow
  rows, Codex CLI/App parity.

## 2026-04-02 — Multi-platform + smart routing

- **#10 Smart file routing** (`fileToRole` in hook): `*.test.* → qa`,
  `*.css/svg → designer`, `Dockerfile → ops`, `*.md → res`.
- **#11 Multi-worktree support** — Per-session JSON files; merge picks
  representative agent per worktree session.
- **#12 Webhook endpoint** — `POST /api/event` accepts 11 event types
  (PR-merged → deploy-success, etc.) for CI/CD integration.
- **Designer character** — Pink-clad female persona with design corner;
  reacts to CSS/SVG/design file edits.
- **Skill-aware hooks** — `Stop` / `UserPromptSubmit` / subagent context
  carries skill metadata.

## Pre-2026-04

- v0.10 vitality wave shipped via PR #19: relationship dynamics (15 cross-role
  events), time-of-day enrichment (lunch / tea-break / Friday boost), Sprint
  Kanban, broadcast workflow banner, night mode, plus 30 rounds of perf
  hardening (R48–R86).
- Foundational structure: 8 roles, status/mood enums, behavior engine,
  movement system, externalStatus integration.
