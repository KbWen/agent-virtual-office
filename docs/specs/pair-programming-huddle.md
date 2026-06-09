---
status: Shipped
title: Co-Editing Pair Overlay (shared-file link)
ticket: AVO-106
classification: feature
labels: [multi-agent]
created: 2026-06-09
---

# AVO-106 — Co-Editing Pair Overlay

> **Design note (2026-06-09):** the first implementation rendered this as a fired EVENT that
> relocated both agents to a whiteboard "huddle" (mutex + cooldown). A 4-expert game-design panel
> (game-feel · calm-tech · systems · sim-fidelity) found that relocating genuinely-*working* agents
> off their desks was the first set-piece to violate the project's R1 "a tracked desk is never
> modulated" guarantee, that Read+Read over-claimed collaboration, and that the shared global cooldown
> crowded out the real deploy/eureka seeds. It was **redesigned to a pure in-place OVERLAY** (below).

## Intent

When two distinct agents are genuinely **co-editing the same file**, draw a faint desk-to-desk
connecting line (+ 🔗 `<basename>`) between them — a calm, peripheral, honest depiction of a real
shared-artifact correlation. The agents stay exactly where they are; nothing is fabricated.

## Honesty Contract (load-bearing)

A real-signal feature in the spirit of `office-pet-barometer.md` and `blocked-reason-tags.md`. The
overlay asserts only "these two are both editing this file right now" and MUST be true when shown:

1. **Distinct identities** — the two ends are different office agent ids (role or `slug~role`). Two
   events that route to the *same* role collapse to one store key → no pair. (We never invent a 2nd agent.)
2. **Byte-identical normalized path** — comparison uses the FULL path (separators normalized,
   lower-cased for the Windows host), NOT the basename. Two `index.js` in different dirs are not the same file.
3. **Co-EDITING, not co-reading** — `activeFile` is published ONLY for write-class tools (Edit/Write);
   Read is excluded at the hook (`activeFileForTool`). Two agents merely *reading* the same file is
   not collaboration and must not show a link.
4. **Both recently active** — each end's `activeFileAt` is within `PAIR_HUDDLE_WINDOW` (90s) and
   neither is `idle`. A stale file clears the link.
5. **Pure overlay — never modulates a tracked desk (R1)** — the cue NEVER moves an agent, never sets
   `inGroupEvent`/`groupTarget`, never touches behavior/status/bubble. It is NOT a fired event: no
   `activeEvent`, no mutex, no cooldown. It is "show while true" derived state (`store.pairLink`),
   recomputed on each `externalStatus` change and cleared when the co-edit ends.

Realistic signal source: a main session + a subagent (reviewer/Explore) editing in the SAME working
dir. Multi-worktree co-editing is NOT a source (hooks don't fire in worktrees + paths differ).

## Data Path — per-agent `activeFile`

`activeFile` threads through the SAME whitelists as `reasonCode` (the AVO-110 lesson: trace a new
field through EVERY normalizer or it is silently dropped):

1. `public/hooks/office-status-hook.js` — publish `activeFile` on Pre/PostToolUse via the pure
   `activeFileForTool` gate (Edit/Write only — Read excluded); carry forward for other agents in the merge.
2. `src/utils/normalizePost.js` + `server.mjs` (inline copy + its parity-test embedded copy) — validate
   in the `office-status` map (server ingest).
3. `src/inference/inferStatus.js` `sanitizeAgent` — validate for in-browser channels.
4. `src/inference/agentRouter.js` `routeExternalAgents` — carry through routing.
5. `src/systems/store.js` `applyExternalStatus` — store `activeFile` + stamp `activeFileAt` when the
   file changes (decoupled from `sigChanged` — `task` is the TOOL name, not the file; never touches the bubble path).

## Behavior

- Pure `src/systems/pairHuddle.js`: `findSharedFilePair(externalStatus, now, window)` → `[id1, id2]`
  (two most-recent co-editors of the shared file) or `null`.
- `src/systems/officeLife.js`: inside the existing `seedUnsub` store subscription (gated on
  `externalStatus` identity change so it never runs on 60fps position ticks), compute the pair and
  call `store.setPairLink({a,b,file})` or `setPairLink(null)`. This runs BEFORE the pause/activeEvent
  guard (it is not an event); the mood/deploy real-seeds below stay pause/mutex gated.
- `src/systems/store.js`: `pairLink` field (transient, not persisted) + `setPairLink` (no-op when unchanged).
- `src/components/PairLink.jsx`: `PairLinkOverlay` reads `pairLink` + the two agents' LIVE positions
  (never writes them) and renders a faint dashed line + 🔗`<basename>` label, painted behind the
  agents. Pure presentational `PairLink` exported for SSR tests.
- `src/locales/{en,zh-TW}.json`: `pairLink.coediting` (a11y label).

## Acceptance Criteria

- **AC-1** Two distinct agents co-editing the byte-identical path → `pairLink` set; a link renders.
- **AC-2** Two agents editing different paths (incl. same basename, different dir) → NO link.
- **AC-3** Two events collapsing to the same role → one agent → NO link.
- **AC-4** A stale `activeFileAt` (> window) or an idle agent → NO link.
- **AC-5** Read+Read on the same file → NO link (only co-editing counts; `activeFileForTool` excludes Read).
- **AC-6** `activeFile` survives ALL data-path whitelists (hook → normalizePost/server → sanitizeAgent
  → routeExternalAgents → applyExternalStatus).
- **AC-7 (R1 honesty)** The overlay NEVER relocates or locks an agent: `inGroupEvent` stays false,
  `groupTarget` null, no `activeEvent`. The agents remain at their desks.
- **AC-8** It is NOT a fired event — no mutex, no cooldown, no entry in the daily/rare pool; it cannot
  crowd out the deploy/eureka real-seeds.
- **AC-9** Load-the-page: injecting two co-editing agents renders the link in place with 0 console
  errors / no ErrorBoundary AND with the agents un-relocated (green tests ≠ renders).

## Rollback

Pure additions. Remove `PairLink.jsx` + the `pairLink` store field/setter + the subscription branch +
`pairHuddle.js`, and revert the `activeFile` field additions.
