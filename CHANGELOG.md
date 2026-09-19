# Changelog

All notable user-facing changes to Agent Virtual Office. Engineering details
live in `docs/specs/_shipped-log.md`; this file is the high-level story.

Format loosely follows [Keep a Changelog](https://keepachangelog.com).

## v1.6.9 — 2026-09-20 — Nothing gets cut off in the small window, and English gets whole sentences

Three pull requests since v1.6.8, all answering an external review that was worked as untrusted
input: every finding was re-checked against the code before anything changed, and two of its ten
were rejected on evidence. **Two of the three are user-facing.** The third is build hygiene and is
listed as such.

### Fixed

- **The compact panel (`?mode=panel`) no longer cuts off the agent inspector.** Clicking a desk
  agent put the card's name and close button above the visible window — 155px in a wide panel — and
  in a tall panel the right-hand values were cut off too. The card now stays inside whatever the
  panel shows. The full office is unchanged, measured to the pixel. (#236)
- **An agent speaking in the top aisle or doorway is heard in the panel.** Its speech bubble used to
  render above the panel's view; it now flips below the agent. (#236)
- **No speech bubble without a visible speaker.** Agents in the meeting room sit outside every panel
  crop, yet their bubbles were being pulled sideways into view — already true in v1.6.8, and made
  worse by the first version of this fix before a review caught it. A bubble is now never moved into
  view for an agent you cannot see. (#236)
- **"Waiting · 3m" keeps counting.** Times like "3m" only updated when something unrelated happened
  to change, so when every agent was waiting on you — exactly when the number matters — they froze.
  The roster, the inspector and the activity feed now refresh every 10 seconds. (#236)
- **English speech bubbles stopped getting cut mid-word.** Every bubble was cut at 16 characters,
  and 16 English characters are only about 60% as wide as 16 Chinese ones, so nearly half of the
  English lines read like "forgot a semicol…". Bubbles now fit by measured width and prefer to
  break between words: whole English lines went from 52% to 85% (Chinese 92% to 95%), and the
  average bubble got narrower in both languages, because the old per-character estimate overstated
  English width — real English text measures about 22% narrower than it assumed. (#237)

### Removed

- **A status channel that guessed "working" from the page title.** It could only ever read the
  office's own tab title, which the office never changes, so it had never fired in normal use. Its
  only reachable effect was a trap: any future "status in the tab title" feature would have fed back
  into fake work. (#236)

### Housekeeping — not user-facing

Nothing in this section changes what you see in the office.

- **Every `vite` / `vitest` run stopped printing three config warnings.** The dev-server config is
  now native ESM (`vite.config.mjs`); Vite's own warning says the old form would stop loading in a
  future major version. A new test fails if the Dockerfile or the npm package list names a file that
  does not exist — both used to drop a missing file silently. This finishes the part of the
  September 8 audit that v1.6.8 left open. (#238)
- Two stale comments still said the doorway stacking bug was "known, unfixed"; it was fixed in
  August. (#236)

### What this release does not claim

- In the compact panel the inspector card, now fully visible, can cover the agent you clicked — the
  full office already did this; changing it needs a placement design.
- A speaker just **below** the panel's view (in the lounge) still shows its bubble inside the panel.
  That predates this release and is tracked as AVO-196, because hiding it would silence an agent's
  real speech.
- When an agent crosses the north door in the panel, its bubble can appear below it while only its
  feet are in view, for about a second.
- The bubble width is measured in the font your browser actually uses, so line breaks can differ
  slightly between Windows and macOS — by design, since the old fixed estimate was only right for
  one font.

## v1.6.8 — 2026-09-14 — A calmer office, and waiting finally looks like waiting

Five commits since v1.6.7. **Two of them are user-facing**: a new, calmer look for the office, and
an audit sweep whose headline fixes are a container that never started and a waiting agent that
looked busy. The other three are tooling and governance and are listed as such below.

### Changed

- **A warmer, calmer office.** The main floor is a lighter warm oak and the walls a softer walnut,
  so every status colour stands out more against the floor while rooms stay clearly separated. The
  ENGINEERING sign is now readable. The agent inspector is a paper card with a light tint of the
  agent's role colour behind the name, readable ink text and sans type. The status colour moved from
  the text to the dot, because no status colour is readable as text — not even on white. The look was
  chosen from rendered candidates before any code was written. Positions, sprites, status and role
  colours, movement and translations are unchanged. (#234)
- **The office palette is now tokens with rules.** Floors, walls, doors, signs and the inspector card
  live in `src/systems/officePalette.js`, and `tests/officePalette.test.js` checks five legibility
  rules (status vs floor, wall vs room, card text contrast, status colour only on the dot, no stray
  palette literals). Each failure message says what to fix. Contributor notes are in
  `docs/ARCHITECTURE.md` §Office palette. (#234)

### Fixed

- **A container built from this repo exited immediately.** The Docker image did not copy two modules
  the server imports, so `docker run` died on `ERR_MODULE_NOT_FOUND` while the build, tests and smoke
  gates all stayed green. The image now copies exactly what the server needs, a test walks the import
  graph so a new import cannot silently break it again, and CI now builds and runs the image and
  waits on its own health check. (#232)
- **An agent waiting on your permission prompt looked busy.** It sat at its desk typing and saying
  "almost... almost~" — a work claim over the exact absence of work. It now shows an hourglass at its
  desk and has its own lines in both languages. It does not walk anywhere, because in this office
  position means state. (#232)
- **Codex-driven agents could vanish or lose their reason badge.** The Codex hook was still on an
  old four-status list, so it dropped `planning` and `awaiting-approval` agents, under-counted active
  agents, and stripped the fields that carry a blocked agent's reason. (#232)
- **`setOfficeStatus({ dev: 'planning' })` produced a "working" agent labelled "planning"** in the
  browser bridge. Status values are now recognised as statuses. (#232)
- **The shell hook's sequence number was in the wrong unit on Linux and invalid on macOS**, which the
  office uses to de-duplicate and expire updates. It is now milliseconds everywhere. (#232)
- **`hooks-config.json` — the file the docs tell you to paste — was missing `PermissionDenied` and
  `StopFailure`,** the two events that turn a denied tool call or an API failure into an honest
  `blocked`. The docs said six events; the CLI registers eight. Both are now pinned to the CLI. (#232)
- Smaller parity fixes: `bridge-ui.js` used different role colours than the office for 7 of 8 roles;
  the generic LLM bridge ignored the language setting; `server.mjs` now honours `OFFICE_STATUS_DIR`
  like the dev server does and prints it at startup; `README.zh-TW.md` caught up on four sections and
  `ARCHITECTURE.md` gained the missing Designer desk and Gate station. (#232)

### Housekeeping — not user-facing

Nothing in this section changes what you see in the office.

- The soak can now see an agent whose displayed activity has gone stale (AVO-195). It **warns, it
  does not fail**: an unchanged label cannot be told apart from the same activity picked again, so a
  hard gate would be claiming more than it can measure. (#231)
- An old June work log that kept a validator warning lit for months was archived as-is. (#233)
- Ship records and the audit chain for the v1.6.7 cut. (#230)

### What this release does not claim

- The palette's floor rule compares each status colour **at full strength**, while status rings
  render slightly transparent. It guards the floor from camouflaging a status; it does not certify
  every ring's contrast.
- One audit finding is only partly closed: a deprecated Rollup option is fixed, but two build
  warnings remain because clearing them means renaming `vite.config.js`, which is out of scope for
  a defect sweep.
- Known and accepted: the ENGINEERING sign sits about 3px under the Developer name tag (the tag draws
  on top). In panel mode the inspector can overflow its cropped view — that was already true in
  v1.6.7.

## v1.6.7 — 2026-09-02 — Nobody is shown napping through real work

Ten commits since v1.6.6. **Two of them are user-facing**, and both are the same shape as the last
release: the office said something about an agent that was not true. The other eight are governance
and tooling and are listed as such below rather than dressed up as product value.

### Fixed

- **The office could show a genuinely working agent asleep, or tired.** At 12:00 the lunch nap
  picked its cast with a coin flip and never looked at whether an agent was really working — so a
  tracked `working` or `blocked` agent got a nap animation, a sleepy face and a "lunch nap" speech
  bubble. At 14:00 the post-lunch drowsiness did the same with a `tired` expression, and because of
  how it was written it also **cleared whatever that agent was saying**. The status ring and name
  pill were never affected, which is what kept the damage to the agent's *voice* rather than its
  *state*. Both now draw only from agents with no real work signal, and a lunch nap with nobody free
  simply does not happen instead of silently blocking every other office event for 45 seconds. This
  was reported as one site; it was three. (AVO-194)
- **A whole table of agents said the identical line.** When food arrived, every reacting agent got
  the same "awesome! let's eat!" — not by chance, but because those lines were stored as a single
  string while their seven sibling event lines were stored as pools. The same was true of the
  fan-yourself reaction and, found while fixing it, of the dog-visit bark, where up to three agents
  barked in unison. All three now have pools; the original line is still the first in each.

### Housekeeping — not user-facing

Nothing in this section changes what you see in the office.

- Governance brain upgraded v1.8.24 → v1.8.25 (banner-only; no gate, engine or state-model change).
- The soak stopped measuring the operator's own machine. It read `~/.claude`, where live Claude Code
  hook traffic lands every few seconds, so runs were fed by whatever else you were doing — and an
  invariant violation could have been caused by an unrelated editing session with nothing saying so.
- A new `npm run rhythm` reports whether the office reads *alive* or merely *busy*, and a
  `docs/specs/_product-backlog.md` entry (AVO-195) records that the soak cannot currently see an
  agent whose displayed activity has gone stale.
- One spec's status was written `Shipped` instead of `shipped`, which was the entire disagreement
  between the two validators on this repo.
- Ship records, work-log archival and the audit chain for the whole wave.

### What this release does not claim

The rhythm tool above shipped with a measurement claim that **did not survive the same day**. It
reported that ambient motion is spread rather than clustered — "someone is always walking" — and two
further runs did not reproduce it. The cause turned out to be the metric: the number it compared was
bounded by the very quantity it was measured against, so runs at different motion levels were never
comparable. It now reports a ratio instead, and the finding is recorded as **not established**. No
behaviour was changed on the strength of it.

## v1.6.6 — 2026-08-26 — Nobody gets dragged away from real work

An honesty release. Both fixes are the same shape: the office was doing something to an agent that
was genuinely working, and the code claimed it wasn't.

### Fixed

- **An office event could take over an agent that was really working.** When fewer than two agents
  were free, the participant picker fell back to the *entire* roster — so on a busy office a tea
  break or a stand-up could grab someone mid-task and walk them across the room to the coffee
  machine. `store.js` documented the opposite ("R1-safe: pickParticipants never selects tracked
  working/blocked agents"), so the guarantee existed only as a comment. Too few genuinely-idle
  agents now means the event simply does not happen. A fresh or demo office is unaffected: an agent
  with no tracked status already counted as available, so the fallback only ever fired when people
  were really busy — which is exactly when it must not. (AVO-191)
- **An event could freeze an agent inside the furniture.** The react-in-place branch only validated
  where a frozen participant came to rest when it happened to overlap someone else; with nobody
  nearby it left them wherever they stood, including inside a desk, for the whole event. (AVO-192)
- **Two dependency advisories cleared** and nine stale direct dependencies refreshed.

### Housekeeping

Not user-facing, listed so the release is not oversold: the vendored governance framework moved
v1.8.17 → v1.8.24, which turned up 16 audit-log entries in this repo that predated the hash chain
and quietly had no integrity coverage; a dead `DeskCluster` export was removed; and staged office
screenshots became reproducible — they used to be silently overwritten by whatever the operator's
own agents were doing at the time, which meant every past visual judgement here was made under
uncontrolled conditions.

## v1.6.5 — 2026-08-03 — It works where you actually run it

A correctness release. The headline fix is embarrassing and worth stating plainly: launched the way
the README tells you to, the office could not see your agents at all.

### Fixed

- **The office shows your agents over `npx` again** — launched via `npx agent-virtual-office`, every
  hook-written status file was discarded as belonging to "another project", so the banner sat on
  *"No agent signal yet"* and agent names degraded to raw `.jsonl` filenames no matter how correctly
  the hook was installed. The office matched sessions against its own package directory instead of the
  directory you launched it from. It also affected `serve` (production / Docker) mode. Reported and
  diagnosed by [@whoffmandesign](https://github.com/whoffmandesign) (#201, #205).
- **Agents take turns at doorways** — two agents heading for the same door used to arrive on top of
  each other and stand there overlapping. Doorway crossings are now claimed one route at a time, in
  arrival order, so the queue is visible instead of a pile (#204).
- **A stopped agent stops where it stands** — when a walk was cut short the agent could keep an
  internal "still moving" flag, and the inspector would report movement that wasn't happening. Aborted
  walks now settle at the position actually on screen (#204).
- **No more stuck bubbles or undelivered handoffs** — a re-render at the wrong moment could cancel an
  agent's in-flight walk and silently drop its pending timers: a speech bubble left asserting a state
  the agent no longer had, and a handoff document drawn but never received (#202).

### Documentation

- **`OFFICE_PROJECT_ROOT` is documented** — set it to watch a project other than the directory you
  launched from (multi-worktree setups). README troubleshooting, the deployment env table, and the
  architecture notes all describe the real matching rule now, instead of the outdated
  "filters by `process.cwd()`".

### Internal

- **The nightly soak is trustworthy again** — a 32-run red streak turned out to be two defects in the
  test rig, not the office. It also now refuses to sample a server that isn't this project (#202,
  #204). The green streak is a starting point for measurement, not a clean bill of health.
- **Tests are timezone-portable** — part of the suite only passed on UTC and UTC+8 hosts, so a
  contributor on US time saw failures on a clean checkout. Green from UTC-11 to UTC+14 now (#205).
- **Governance tooling upgraded** — the Agentic OS workflow brain used during development moved
  v1.8.1 → v1.8.17. Dev-time only; no effect on the shipped app (#199, #204).

## v1.6.4 — 2026-07-04 — Clearer signals, plainer words

### Added

- **Action strip** — the control panel now surfaces actionable blockers up front, so a stuck agent is
  visible at a glance without opening anything.

### Changed

- **The activity feed speaks plainer** — implementation-shaped entries (raw filenames, hook artifacts)
  are translated into product-readable copy, with the raw text kept in the tooltip. The bottom rail now
  shows agents that have a live signal and folds the quiet ones into a tidy count.
- **Fewer interruptions** — the settings popover closes itself after you switch major views, and the
  most meme-like high-frequency Chinese speech bubbles were removed. The first-run setup hint is easier
  to read.

### Fixed

- **Honest rail status** — the rail status dot and its accessibility label now read from the normalized
  external status, so they can't drift from what the agent is actually doing.

### Documentation

- **ADR-009** — recorded the decision to keep the speculative "portable status-core" package layer out
  of AVO; it is deferred to a clean-room copy-out into a new repo if a real second consumer ever firms
  up. No user-facing effect.

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
