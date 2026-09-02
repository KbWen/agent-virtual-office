---
status: living
title: Agent Virtual Office — Product Backlog
created: 2026-05-29
last_updated: 2026-08-26
---

# Agent Virtual Office — Product Backlog

> Living index of planned features. Bootstrap reads this to detect ongoing product work.

> [!IMPORTANT]
> **Backlog hygiene rule (owner, 2026-06-15): there is no "Deferred" limbo state.** Every item is
> exactly one of: **DO** (open + actionable), **REFINE** (rewrite into a more precise item), or
> **CLOSE** (`Cancelled` — won't build; reason + decision record required). Items never linger as
> "maybe later". When closing, either delete or move to `## Closed` with a one-line reason.

> **Rotations:**
> - 2026-05-29 — prior backlog #1–#73 (~100% Done) rotated to `_shipped-log.md`.
> - 2026-06-15 — AVO-101+ wave (54 Done/Shipped rows) rotated to `_shipped-log.md`; 11 items
>   closed (7 off-mission per ADR-006 · 2 ADR-rejected · AVO-112 + AVO-137 closed on review).
>   `main` is the canonical product state (all waves merged).

---

## Feature Inventory — Open / On-Mission Work

> The genuinely-remaining, actionable backlog. Theme law: **chill + fun, honest, REDUCE-not-add.**

| # | Feature | Kind | Labels | Priority | Spec File | Tier | Status | Dependencies |
|---|---------|------|--------|----------|-----------|------|--------|--------------|
| AVO-160 | Custom sprite-asset pipeline (public/sprites/ PNG auto-load → replace procedural SVG) | product | brand | P3 | docs/SPRITE_REQUIREMENTS.md | feature | Pending | foundation for hand-drawn art + AVO-124(b) |
| AVO-124 | Agent appearance customization (sprite cosmetics — hats/accessories/outfits) | product | brand | P3 | — | feature | Pending | AVO-160 for PNG path |
| AVO-141 | Comms / vertical (☰ roster) deeper optimization — "still lots of room" | product | vibe-rebalance | P2 | docs/specs/living-office-events.md | quick-win | Shipped | **Reframed by a 4-expert panel** to comms-feed honesty + dedup (the rail was already mature; "densify to fill room" rejected). Shipped: floating ActivityFeed → real-events `eventFeed` only + self-hide in roster mode. Idle-condense / adaptive-height / chrome-trim panel-rejected. |
| AVO-161 | Dialogue & interaction layer (台詞/文字) — Wave A SHIPPED, Wave B open | product | game-feel | P1 | docs/specs/dialogue-interaction-layer.md | feature | In Progress | ADR-007. **Wave A SHIPPED 2026-06-15 (PR #166)**: S1 quiet-worker reduction + rng seam · S1b de-fabricate generateCrossReaction · S2 5 voice archetypes (en+zh) + open-ended pools + AC-O2 lint. **Wave B**: **S5 = KILL** (2026-06-15 — redundant with shipped `idleGapInfer`; evidence in notes below) · **S3/S4 = open, GATED** on owner cold-watch of live A → S4 banter stop-question, whose outcome also sets S3 scope (ADR-007 fallback = no inter-agent dialogue). |

| AVO-187 | Door-crossing stack — agents pausing at a door are ALWAYS visually overlapped | product | office-runtime | **P1** | [Spec](avo-187-temporal-doorway-claim.md) | feature | Shipped | Atomic full-route physical-door claims now serialize both directions with stable FIFO tickets, fencing, and rendered-truth lifecycle release. Commit `018ef1e`; AC1–AC13 include all-door forced contention and a 10-minute visual cold-watch. |
| AVO-188 | Abort sites leave a stale `isMoving: true` on a standing agent | product | data-path | P2 | [Spec](avo-188-abort-movement-in-place.md) | quick-win | Shipped | Abort paths now atomically copy the last rendered position into `position` and `targetPosition`, clear motion/journey truth, and preserve live teardown restoration. Commit `ac07a4d`. |
| AVO-189 | `shouldRecordRafWatchdogRestart` is structurally dead — reads 0 on a broken build | product | ci-infra | P3 | [Spec](avo-189-reachable-raf-watchdog-diagnostic.md) | quick-win | Shipped | The first focused lost-chain restart is now observable while pending-frame and unfocused noise gates remain unchanged. Commit `feb23ef`. |
| AVO-190 | `sim-soak` blind-reuses ANY server on :5173 without verifying it is AVO | product | ci-infra | P2 | [Spec](avo-190-soak-target-identity.md) | quick-win | Shipped | Shared source-module identity probe now rejects unrelated or unproven targets before Playwright; only explicit connection refusal on the default origin permits spawning Vite. Commit `fec1086`. |
| AVO-191 | `pickParticipants` falls back to ALL agents when <2 are available — a genuinely-working agent can be taken over by an office event | review-finding | office-runtime | P2 | — | quick-win | Shipped | The roster fallback is gone: too few genuinely-idle agents now yields an EMPTY cast and the event simply does not happen. It was **four** sites, not the two this row recorded, and removing it needed an empty-cast guard at all six callers — `activeEvent` is the global event mutex, so a phantom one blocks every later event for its duration. Low blast radius for a measurable reason: `isAvailable` counts an untracked agent as available, so the fallback required ≥7 of 8 agents tracked working/blocked/in-event before it could fire. store.js's false R1-safe comment corrected in place. Commit `447b149`. |
| AVO-193 | A coffee-machine click on a fully-busy office gives no feedback at all | review-finding | game-feel | P3 | — | quick-win | Pending | Filed out of AVO-191 rather than folded into it. With no honest cast, `triggerInteractiveEvent` falls through to `fireInteractionReaction`, which maps only `deploy-success`→ops and `eureka`→arch — so a `tea-break` click produces nothing. Strictly better than the relocation it replaces and nothing false is claimed (ADR-008 honest-neutral bar), but the click reads as broken. Closing it means a new reactor mapping, a locale key in en + zh-TW, and a design call about **who** reacts — content, not a bug fix. |
| AVO-194 | `lunch-nap` shows a genuinely-working agent as asleep — the second R1 hole, and it does not go through `pickParticipants` | review-finding | office-runtime | P2 | — | quick-win | Pending | Found while fixing AVO-191, filed rather than folded in. `officeLife.js:788` picks nappers with `agentIds.filter(id => !inGroupEvent && Math.random() < 0.5)` — **externalStatus is never read**, so at 12:00 an agent that is really `working` or `blocked` gets `behavior: 'nap'`, `expression: 'sleepy'` and a lunch-nap bubble. It passes `groupTarget: null`, so it also enters the react-in-place branch of `setAgentGroupEvent` and can nudge that agent's resting spot. No relocation across the room, but the office states something false about a working agent, which is the ADR-008 line. Likely fix is one filter mirroring `isAvailable`; the open product question is whether a lunch nap should be **suppressed entirely** when too few are free, as AVO-191 now does for events. |
| AVO-195 | `sim-soak` has no invariant for a STALE BEHAVIOUR LABEL — the office can say an agent is doing X for minutes while it is doing something else, and the gate cannot see it | review-finding | ci-infra | P2 | — | quick-win | Pending | Filed from measured evidence, not a hunch. The four shipped invariants (`teleport` / `sustainedStack` / `frozenWalker` / `offFloorRest`) all read POSITION and the `isMoving` flag; none reads `behavior`. A rejected prototype on `experiment/ambient-rhythm-window` produced agents holding `eat-snack` for **254s** outside any group event while walking 260–551px — `isMoving` was `false` throughout, so `frozenWalker` (which requires the flag to be true) could not fire, and position-based checks saw a perfectly healthy walker. Two control runs on `main` bound the healthy range: event-set behaviours clear in **2–27s**, and the longest unchanged label is **74–78s** (consistent with the 65s duration ceiling plus walk time). So a workable invariant exists: label unchanged beyond ~90s while NOT `inGroupEvent` is outside anything `main` produces. On-mission because status legibility is the product's core value — an office that narrates the wrong activity is the ADR-008 class, and the memory rule is to back legibility with an automated guard. Note this is a DETECTION gap, not a live `main` defect: no stale-label defect is known to ship today. |

> [!NOTE]
> **Reality check (2026-06-15):** the planned-feature backlog is essentially exhausted. After the
> sprite-art pair (AVO-160 → AVO-124), only AVO-141 (a small polish) remains. That is a maturity
> signal, not a gap to backfill. **The real next-value work is not yet ticketed:**
> (a) the sprite/character **art** itself (content for AVO-160's pipeline);
> (b) **dialogue / text** (台詞、文字) — bubble message pools + i18n strings (owner's stated next
> direction).
> Open those as precise items when the angle is confirmed — do NOT manufacture busywork to fill
> the backlog (REDUCE-not-add).

---

## Optimization & Charm Backlog — Existing-Item Tuning (2026-06-19, must earn place)

> A 2026-06-19 internal research + code-audit pass produced these. All are framed in **AVO's own
> terms** (no external attribution). They are **candidates, NOT commitments** — each must self-justify
> via the per-visual-feature gate (chill/office-sim panel + automated legibility guard + adversarial
> verify of MERGED main) before it earns a Feature Inventory row. Owner lean = **optimize existing
> rhythm/pacing over net-new chrome.** Theme law: chill+fun, honest, REDUCE-not-add. Distinct tier
> from the committed Feature Inventory — keeps the SSoT "3 open on-mission items" honest. Each row
> cites the file/lever so a future `/plan` can lift it directly; every "AVO lacks X" was confirmed by
> a read file:line (after the AVO-162 dup-proposal was caught same-session).

| # | Optimization (testable) | Honesty / R1 guard | REDUCE? | Key file / lever |
|---|---|---|---|---|
| AVO-163 | Static idle agents get a phase-desynced **breathing/blink micro-loop** (+ ease-out motion) so they read "alive" with zero new assets. | Fires ONLY in genuine idle; breathe is IDENTICAL regardless of status (never implies progress/emotion); distinct from the existing supervising-breathe / working-pulse rings. | ~ (polish on existing motion) | `AgentCharacter.jsx` `CharacterPixelSprite` (idle body is static today, ~L368-397) |
| AVO-164 | An all-idle office renders a deliberate **"all quiet / all caught up"** calm state (vs reading dead) → honest permission-to-stop. | No streak, no "agents miss you", no fake activity to fill the screen. | ✅ (reframes empty, adds nothing) | new calm-state branch; not present today |
| ✅ AVO-165 | **Walk-rhythm — concurrent out-trip soft-cap** (panel chose this over weight reduction: the felt "always walking" is a CONCURRENCY effect, 8×~32%≈94%, not a per-agent rate the two prior tunes could fix). `MAX_CONCURRENT_OUT_TRIPS=2`; at cap an ambient agent stays at its desk this cycle. | R1-safe (keeps agent AT desk, never relocates a working agent); `social` weight untouched; +4 tests. | ✅✅ (fewer simultaneous walkers) | `behaviorEngine.js` getNextBehavior + `AgentCharacter.jsx` journeyTarget count |
| ✅ AVO-166 | **DONE (ADR-008, 2026-06-19)** — codified the "no-fabricated-need" rule as an N1–N7 checklist that gates every future ambient/pet/companion/charm/notification feature (anti decay/streak/loot; pet hides on blocker; no unbound decorative channel; honest-neutral degrade; real-clock variety; no engagement notification). | enforceable honesty boundary | ✅ (a guard, not a feature) | `docs/adr/ADR-008-no-fabricated-need-ambient-honesty.md` |
| AVO-167 | Give the **`awaiting-approval` ("waiting on you") state its own ring + name-tag colour** — today it falls back to identity colour and reads like a normal idle agent. | State already inferred from real signals (`idleGapInfer`); new colour must pass the existing contrast guard. | ~ (one colour entry + one ring branch) | `constants.js:82-88` STATUS_COLORS · `AgentCharacter.jsx:1411` ring branch |
| AVO-168 | **Ambient events rarer + more rewarding**: widen the daily/rare event intervals and give a rare event a slightly bigger juice payload. | Juice stays gated on real signals (`eventEligible`); no new event types added. | ✅ (less churn) | `constants.js:53-54` intervals · `eventJuice.js:15-16` counts |
| AVO-169 | Show **elapsed-time-in-state** ("blocked for 3m" / "waiting for 3m") in the agent inspector. | Driven only by real `changedAt`; inspector-only (no scene clutter). | ✅ (reuses `formatTimeAgo`) | `AgentInspector.jsx:~200` · `NarrowRoster.jsx:~59` |
| AVO-170 | **Notification etiquette**: make the OS blocked-alert chime a user preference (don't blind-silence a functional "come back" alert) + audit the 30s-notice vs recurring-pattern paths so one episode can't double-fire unintentionally. | Visual banner unchanged; only fires while tab hidden + permission granted. | ✅ (calmer default, no new surface) | `desktopNotifier.js:94/115` `silent` · `:30` threshold |
| ✅ AVO-186 | **DONE (2026-06-20)** — Cozy visual pass. (a) Declutter: plants 12→6 symmetric perimeter frame (dropped 4 redundant stacked pairs + the center crowder). (b) 5-expert design/game panel warm-palette restyle: lounge couch grey-blue→muted clay `#B97A4E` (4-tone ramp), CoffeeMachine body→espresso `#5A4A3E`, WaterCooler housing→putty `#D8CDBE`. Adversary lens pulled the group back from full terracotta to keep figure-ground. | Pure decoration/soft-furnishing only; NO signal-bearing colour touched (windows/monitors/gate/kanban/rug hues/clocks protected); plant count + desk-zone + no-cluster guarded. | ✅✅ (−6 specks; recolor adds nothing) | `PixelOffice.jsx` plants+Couch · `TopDownFurniture.jsx` Couch/CoffeeMachine/WaterCooler · guard `officeDecorationDensity.test.js` · `docs/reviews/2026-06-20-audit.md` |

> **AC-SEQ:** each resolves to `do | refine | kill` with evidence when picked up. Likely first
> pickups (owner pacing lean + core status-visibility value): **AVO-165** (walk-rhythm — measure
> `getNextBehavior` split first) + **AVO-167** (await-you visibility). AVO-168/169/170 are cheap
> measurable tunes; AVO-163/164 need the chill panel first; **AVO-166 is DONE (ADR-008)**.
>
> **Expert panel + build (2026-06-19, PR #177 — SHIPPED):** a 4-lens adversarial panel (cozy / honesty / REDUCE-skeptic
> / status-legibility) verdicted **AVO-165 + AVO-167 + AVO-169 → DO**; **AVO-168 → descope (rarity-only,
> drop the bigger-juice)**; **AVO-163 / AVO-164 → defer** (163 fights the owner's "calmer" goal; 164
> contested). The three DOs shipped (visually verified via headless render): AVO-167 cyan
> `awaiting-approval` ring + name-pill (contrast-guarded), AVO-169 inline "blocked · 3m" in the inspector
> (honest `changedAt`, ≥30s, hide-when-null), AVO-165 concurrent out-trip soft-cap (`MAX_CONCURRENT_OUT_TRIPS=2`).
>
> **Considered & declined 2026-06-19** (recorded so they are NOT re-proposed as actionable): auto-apply
> a calendar season tint (conflicts with AVO-123's deliberate manual opt-in; only ½ the year has
> tints) · a "stale-feed" glyph on idle agents (marginal; a new visual channel = clutter; unverified
> write path) · clamping office-pet wander cadence (pet liveliness is user-chosen) · tightening the
> time-of-day refresh below 60s (lighting changes hourly — no perceptible lag) · a spatial "error
> corner" zone for blocked agents (**violates R1** — never relocate a real agent; the in-place
> gate-desk tray AVO-107 is the honest equivalent).
>
> **Already-shipped — do NOT re-propose:** background push-ping (#8) · weather (#14) · soundscape
> (AVO-122) · seasonal tint (AVO-123) · blocked/await-you reasons (AVO-110/148/107) · zen far-view
> (AVO-137 closed) · time-of-day lighting (AVO-111 — `lighting.js`) · generative backstory/gossip +
> cost/DAG charts (ADR-006).
>
> **Codebase-verified 2026-06-19:** **AVO-162 RETRACTED** — duplicate of shipped AVO-111 (moved to
> `## Closed`). AVO-138 supervising-breathe / working-pulse rings already exist (AVO-163 must not
> stack on them). AVO-165 extends the 2026-06-14 walk-rhythm ship (−28% out-trips). AVO-164/166/167/
> 169/170 confirmed not present; AVO-168 tunes existing constants.

---

## Bugs & Correctness — Internal Audit (2026-06-19)

> A 2026-06-19 AVO-internal code audit (tech-debt + a11y + honesty edge-cases). Unlike the
> optimization tier above, several are **real defects** — AVO-171 violates a shipped honesty guarantee.
> HIGH-confidence items were re-verified by reading the cited file:line; lower-confidence ones carry a
> confirm step. AVO's own terms (no external attribution).
>
> **Status (branch `fix/avo-171-pet-await-honesty-a11y`, 2026-06-19):** ✅ FIXED — AVO-171 (pet honesty,
> +8 tests), AVO-172 (notifier recurring-prune + reset-helper, +1 test), **AVO-173** (idle-gap now reads
> `task` from externalStatus so a busy tool-using agent isn't mislabelled `thinking`; the old test used a
> non-production store shape — production-shape regression added + test-the-test verified, +1 test),
> AVO-175/176/177 (a11y). **AVO-174** (title-inference channel can no longer inject `blocked`/`done` —
> removed both conclusive patterns; channel capped to working role-hints; pure `classifyTitle` extracted
> + tested, test-the-test verified; PR #174). **AVO-178/179 CLOSED as audit false-positives** — both
> modules are already well-tested (movementSystem 54 cases / agentRouter 40 / contextBubble 27;
> re-grep 2026-06-19). **Open:** AVO-163..170 (optimizations — need a chill panel + owner visual confirm).
>
> **All 9 Bugs & Correctness items resolved**: AVO-171/172/173/174/175/176/177 fixed+merged (PR #173/#174);
> AVO-178/179 closed as false positives. Lesson: a subagent "no test coverage / glob-verified" claim must
> be re-verified by a direct `grep tests/` — the audit agent saw only 5 of 100 test files.

| # | Defect | Severity | Evidence (file:line) | Fix (small + reversible) | Verified |
|---|---|---|---|---|---|
| AVO-171 | **Pet hide-on-blocker guarantee misses `awaiting-approval`** — when an agent is stuck at a permission prompt (inferred `awaiting-approval` after 90s blocked), `blockedCount`=0, so the pet un-hides and a concurrent deploy/eureka can fire CELEBRATE/confetti while a real "needs-you" item is pending. | **P1 honesty** | `OfficePet.jsx:52-53` (count) + `:57-58` (point-at) only match `status==='blocked'`; `desktopNotifier.js:44` already treats `awaiting-approval` as blocked-derived | count `awaiting-approval` in both selectors (mirror `BLOCKED_DERIVED`) | ✅ read-verified |
| AVO-172 | `recurringNotifiedFor` not pruned on agent eviction → a re-spawned same-id agent never gets its recurring-failure OS notification (stale dedupe suppresses it). | P3 | `desktopNotifier.js:204-208` deletes `blockedSince`/`notifiedFor` but not `recurringNotifiedFor` (`:38`) | add `recurringNotifiedFor.delete(agentId)` to the cleanup loop | ✅ read-verified |
| AVO-173 | `idleGapInfer.computeSig` reads `agents[id].task`, but `task` lives on `externalStatus[id]` (not the agents slice) → a tool-busy agent (Read→Grep→Edit, status stays `working`) may be falsely inferred `working→thinking` after 45s. | P2 | `idleGapInfer.js:89-94` reads `a?.task`; `store.js:802,1017` put `task` on `externalStatus` only | point `computeSig` at `externalStatus[id]?.task` — **CONFIRM FIRST**: repro + reconcile with the SSoT "changedAt co-moves with idleGapInfer" claim | ◐ slice-location confirmed; impact needs a repro |
| AVO-174 | Title-inference channel can inject `blocked` for `dev` from non-agent signals (a browser tab titled "…failed/blocked") → most-alarming state from the weakest signal, persists 120s. | P3 | `inferStatus.js:651-687` (reported, not personally read) | cap this channel at `thinking`/`working`, never `blocked`; or gate it | ◌ unverified — read before acting |
| AVO-175 | Reduced-motion gaps: `animate-pulse` ungated on `reducedMotion` at the health-dot + activeEvent pill + connection-hint (HTML layer; the SVG layer is fully gated). | P2 a11y | `ControlPanel.jsx:47,424` · `PixelOffice.jsx:1255` | read `reducedMotion`, conditionally drop `animate-pulse` | ✅ pattern-verified |
| AVO-176 | Agent inspector ✕ close is a bare SVG `<text onClick>` — no keyboard path, no role/aria (Esc closes, but the visual target is keyboard/AT-invisible). | P2 a11y | `AgentInspector.jsx:150-152` | wrap in `role=button tabIndex=0 aria-label` + Enter/Space keydown | ✅ read-verified |
| AVO-177 | i18n/AT leaks: `aria-label="working"` hardcoded English (zh-TW AT hears English); `aria.showOffice`/`aria.showList` missing from both locales; ActivityFeed toggle has `title` but no `aria-label`. | P3 a11y | `NarrowRoster.jsx:28,30` · `ControlPanel.jsx:296` · `ActivityFeed.jsx:42-45` | route through `t()` / add the two locale keys / add `aria-label` | ✅ read-verified |
| ~~AVO-178~~ | **CLOSED — audit FALSE POSITIVE.** `movementSystem` is among the MOST-tested modules: `movementSystem.test.js` (54 cases, `calculatePath` ×18) · `lineHitsRect.test.js` (7) · `movementPathingDeep/Fuzz/Wedged` seeded suites. The audit's "no `movementSystem.test.js`" claim was wrong (it saw a stale 5-file glob). | — | none | no work — already covered | ❌ false positive (re-grep 2026-06-19) |
| ~~AVO-179~~ | **CLOSED — audit FALSE POSITIVE.** Honesty-path inference is well-tested: `agentRouter.test.js` (40 cases: routeTaskToAgent ×57 / routeExternalAgents / distributeFallbackCount) · `contextBubble.test.js` (27: extractContext ×29 / generateContextBubble / toolToAction) · `generateCrossReaction` in `dialogueS1.test.js`. | — | none | no work — already covered | ❌ false positive (re-grep 2026-06-19) |

> **Minor cleanups (low value — recorded, likely decline):** hour-14 drowsiness fires N sequential
> `setAgentBehavior` writes vs one `setMultipleAgentGroupEvents` batch (`officeLife.js:812-817`, once/day)
> · two parallel 60s `setInterval` loops could merge (`officeLife.js:746-753`) · possibly-stale `esbuild`
> override (`package.json:78`) · PixelOffice 600ms self-heal poll runs in non-panel mode too (`:980`,
> no-ops so harmless).
>
> **Confirmed SAFE (audit reassurance):** clickable-object work-claims fully `eventEligible`-gated · pet
> CELEBRATE suppressed on real `blocked` (AVO-171 is only the `awaiting-approval` sub-case) · done-counter
> dedupe airtight · `AGENT_CARRY_FIELDS` drift CI-guarded · blocked↔awaiting flap does not double-notify ·
> all clocks real (no accelerated/fake time). **Barrel signal:** honesty discipline is strong; AVO-171 is
> the one materially-visible leak — further auditing yields diminishing returns.

---

## Round-2 Sweep — verified LOW/MED items (2026-06-19)

> A second multi-agent bug/tech-debt sweep (owner: "多多測試檢查"). **No CRITICAL/HIGH bugs; the
> codebase is mature/healthy.** Every item below was re-verified by reading the cited file:line.
> Findings are PRE-EXISTING (the just-shipped AVO-165/167/169 passed a fresh adversarial review =
> clean). Dismissed FALSE POSITIVES (the agents only grepped `tests/`, missing co-located
> `src/systems/*.test.js`): "dailyCard/lighting/ambientSound have no tests" — all three DO have
> co-located tests (same class as the AVO-178/179 false positives). [[reference_agents_slice_vs_externalstatus]]

| # | Item | Sev | Evidence (file:line) | Fix |
|---|---|---|---|---|
| AVO-180 | **Eviction memory-leak** — `_recentPicks` (`behaviorEngine.js:210`), `_storeRecentPicks` (`store.js:24`), and per-agent `recurringFailureLog` keys are NOT pruned when a dynamic `slug~role` worktree agent is evicted (`store.js:~1141`). Slow unbounded growth in long multi-worktree sessions. **Owner-relevant** (runs many parallel worktree agents). | MED | grep: only `__clearRecentPicks()` (test-only); `idleGapInfer` DOES prune on eviction (precedent) | export `pruneRecentPicks(id)` + delete the 3 keys at the eviction site, mirroring `idleGapInfer` |
| ◑ AVO-181 | **Duplicated set/constant drift.** ✅ **blocked-family DONE** (PR #180 — single `BLOCKED_FAMILY` in `constants.js`, imported by petState/desktopNotifier/recurringFailure/agentInspectorModel; 4 copies → 1). **Remaining:** `VALID_ROLES` ×3 (mechanical hoist) · the "working\|blocked" active-count rule ×3 where **`planning` is silently excluded from all 3** — that's a SEMANTIC question (should planning count as active?) to resolve BEFORE consolidating, not a blind hoist. | MED | grep-confirmed | blocked-family done; VALID_ROLES + active-count are follow-ups |
| AVO-182 | **Defensive-guard gaps (latent)** — `charName(null)` has no guard (`i18n.js:96`); `darken()` returns `#NaNNaNNaN` and caches it for a non-`#RRGGBB` config color (`AgentCharacter.jsx:248`); `u[f] \|\| null` coerces a valid empty-string carry field to null (`store.js:980`, `agentRouter.js:128`); ambientSound gesture listeners use `{once:false}` (`ambientSound.js:292`); `validatePersistedDailyDoneLedger` has no upper cap. | LOW | all read-verified | add the cheap guards (nullish not falsy; hex validation; `{once:true}`) |
| AVO-183 | **RESOLVED (PR #181) after repro.** **183a `pushOutOfObstacle` = NOT A BUG** — the residual obstacle-clipping is a *known, documented, deliberately-accepted* trade-off (`movementSystem.js` OBSTACLE_RECTS comments: server-rack/gate-booth "accepted over trapping the gate", "no waypoint places agents there"). A "fix" (re-pass/spiral) would have undone that design decision; reverted. (The original fuzz also had a bug — `OBSTACLE_RECTS` isn't exported.) **183b shorthand-POST `activeFile` broadcast = REAL, FIXED** — a 2-role shorthand + top-level `activeFile` gave BOTH agents the same file → fabricated pair-huddle co-edit. Now `activeFile` is single-role-only in shorthand; +3 regression tests. | MED | repro-verified | 183a dismissed; 183b fixed |
| ◑ AVO-184 | **Complexity / dead code.** ✅ dead `MIN_AGENT_DIST` export removed (PR #182). ✅ **`applyExternalStatus` extraction DONE** (branch `refactor/avo-184-god-reducer-extraction`, Option 1): 3 pure file-local helpers hoisted (`buildExtEntry` / `resolveAgentVisual` / `assembleIntegrationPatch`), byte-identical, guarded by a 27-test equivalence harness (green on baseline AND head) + a fresh adversarial review (all PROVEN byte-equivalent). **Still DEFERRED** (off-mission tech-debt, not yet scheduled): `startStatusIntegration` 287-line closure (`inferStatus.js`, untouched — mostly irreducible timer/transport wiring; only the seq-gate decision is a clean extraction); batch B (ledger/overflow bookkeeping helpers); dynamic-create/eviction extraction. `package-lock.json` version skew (1.4.0 vs 1.6.0) is cosmetic — regenerates on the next `npm install`. | MED maint. | grep-confirmed | applyExternalStatus done; startStatusIntegration + batch B = future session |

> **Fix status (PR #179):** ✅ **AVO-180** (eviction prune — `pruneRecentPicks` + `_storeRecentPicks` +
> cloned-`rfLog` delete at the multi-session eviction site; +1 regression test) · ✅ **AVO-182** (the
> crash/corruption guards: `charName` null-guard +2 tests, `darken` non-`#RRGGBB` passthrough,
> ambientSound `{once:true}`) · ◑ **AVO-181** (PR #180 — blocked-family consolidated 4→1 in
> `constants.js`; VALID_ROLES + active-count remain as follow-ups, the latter has a `planning` semantic
> question) · ✅ **AVO-183** (PR #181 — 183b shorthand activeFile broadcast fixed +3 tests; 183a confirmed
> NOT a bug = a documented deliberately-accepted clipping trade-off, fix reverted) · ◑ **AVO-184**
> (PR #182 — dead `MIN_AGENT_DIST` export removed; `applyExternalStatus` 3-helper extraction DONE on
> branch `refactor/avo-184-god-reducer-extraction` via the planned `/plan` + equivalence-harness flow —
> startStatusIntegration + batch B/eviction extraction remain deferred as off-mission tech-debt).

---

## Closed

> Decided-out items, kept so they are not silently re-proposed. `Cancelled` = won't build. Each
> carries a reason + decision record. (No `Deferred` — see the hygiene rule above.)

| # | Feature | Status | Decision record | Why |
|---|---------|--------|-----------------|-----|
| AVO-116 | Per-agent cost attribution & daily $ trend | Cancelled | ADR-006 | $ dashboard; contradicts shipped README FAQ "not a cost dashboard" |
| AVO-113 | OpenTelemetry GenAI export (OTLP) | Cancelled | ADR-006 | developer telemetry infra; no chill/fun surface |
| AVO-114 | Event-stream replay scrubber | Cancelled | ADR-006 | observability DVR; the live ambient scene is the point |
| AVO-118 | Workflow graph minimap (DAG view) | Cancelled | ADR-006 | the spatial office (+AVO-105 arrows) IS the multi-agent view |
| AVO-119 | Language / file-type breakdown | Cancelled | ADR-006 | WakaTime-style stats donut; analytics not ambient |
| AVO-109 | Recent-files heatmap | Cancelled | ADR-006 | hot-path stats overlay; clutter vs REDUCE-not-add |
| AVO-120 | Daily MVP / productivity leaderboard | Cancelled | ADR-006 | ranking = fabrication hazard; already decided-closed mid-AVO-115 |
| AVO-112 | Eureka cascade (2+ eureka/10s → office-wide confetti) | Cancelled | 2026-06-15 review | honesty flaw — real eureka comes from a slow `mood→smooth` distillation (`officeLife.js`), so it structurally can't cluster within 10s; the cascade would only ever fire from whiteboard-click theater (the AVO-120 trap). AVO-136 already gives eureka a sparkle. A genuine collective beat would be a NEW item tied to a real done-cluster / `/ship` signal, not this |
| AVO-137 | Density-layer foundation / zen far-view | Cancelled | 2026-06-15 review | the glance-L1-default motivation already shipped (vibe-rebalance AVO-126/127/128 + declutter bubble-cap PR #81); the only unbuilt remainder was a wall-TV/streamer zen far-view, which is not a target use case |
| AVO-142 | Drag-to-move agents | Cancelled | ADR-005 (rejected) | position=state honesty; interaction redirected to AVO-158 Poke (shipped) |
| AVO-144 | Sustained per-frame inter-agent separation | Cancelled | ADR-004 (rejected) | doorway geometry + R1; target-time deconfliction is the mechanism |
| AVO-162 | Real-clock time-of-day light wash | Cancelled | 2026-06-19 research | DUPLICATE — already shipped as AVO-111 (`src/systems/lighting.js`, 15-keyframe 24h grade, `lightingEnabled` toggle, real-clock `getHours`; AVO-123/125 depend on it; `_shipped-log.md:172`). Proposed in error 2026-06-19; caught same-session by codebase grep. Lesson: grep code + `_shipped-log.md` before proposing "new" candidates (AVO-111 was not in the SSoT Spec Index). |

> **AVO-108 $ remainder cancelled** (ADR-006): the rolling-1h + $ cost + sparkline portion of the
> token meter is off-mission. AVO-108's honest core (🪙 ctx + model chip, in the inspector per
> AVO-127) stands as shipped.

---

## Status Key

- **Status**: `Pending` | `In Progress` | `Shipped` | `Cancelled` — **no `Deferred`** (banned by the hygiene rule).
- **Priority**: P0 (must) → P3 (nice to have)
- **Kind**: `product` (player-facing feature) | `infra` (developer-facing tooling/telemetry) | `chore` (hardening)
- **Tier**: expected classification when built (`feature` | `quick-win` | `architecture-change`)
- **Labels**: theme — `real-ai-behavior` · `multi-agent` · `info-density` · `game-feel` · `observability` · `brand` · `tech-debt` · `vibe-rebalance`

---

## Implementation Notes (open items only)

### AVO-160 Custom sprite-asset pipeline (P3, brand)
The unbuilt engine spec'd in `docs/SPRITE_REQUIREMENTS.md`: detect `public/sprites/<id>.png`,
switch from procedural `getBaseSprite` to image render, fallback on miss. Foundation for
hand-drawn art + AVO-124(b). Currently 0% built (no loader, no `public/sprites/`). This is the
geometry/loader half; the actual art is separate (and not yet ticketed).

### AVO-124 Agent appearance customization (P3, brand)
Name + color override already EXISTS and is documented (`?agents=` / `window.__office_config__`,
README) — that is identity color (inspector/roster/feed/idle name-pill), NOT pixel sprite
clothing. AVO-124 = the **sprite-cosmetic layer** (hats/accessories/outfits). Two impl paths:
(a) procedural — let users override `CHAR_STYLES` (hairStyle/clothes) per role, no asset pipeline;
(b) PNG sprite-assets via AVO-160. `characters.json` has an `accessory` field the renderer does
NOT consume (CHAR_STYLES is authoritative) — reconcile when building.

### AVO-141 Comms / vertical roster optimization (P2) — SHIPPED (reframed)
The ☰ roster → living-presence rail (PR #44) left "still lots of room". A 4-expert design panel
REFRAMED this from "densify the rail" to **comms-feed honesty + dedup**: the rail itself is already
mature, and "fill the empty space" is the additive instinct to resist (empty calm-tech space is a
feature). Shipped (quick-win): the floating `ActivityFeed` now sources the real-events `eventFeed`
only (was the all-origins `activityLog` + a decorative `activeEvent` banner = fabricated liveliness,
ADR-008) and self-hides in roster mode (the inline rail feed already covers it). Panel-rejected /
deferred: idle-row condense, density-adaptive feed height, uniform card-chrome trim (touches protected
responsive/label/sprite surfaces). Decision record: Work Log `feat-avo-141-comms-rail-optimization` D-1.

### AVO-161 Dialogue layer — Wave B verdicts (P1, game-feel)
Wave A shipped (PR #166). Wave B closes per AC-SEQ (`do|refine|kill` + evidence):
- **S5 (stale-working ring decay) → `kill`** (2026-06-15). Shipped `idleGapInfer`
  (`PixelOffice.jsx:851`, production) already reclassifies `working → thinking` after **45s** of no
  (status,task) change (`WORKING_GAP_MS=45000`); `changedAt` advances only on a real sig change
  (`store.js:993`) and co-moves with idleGapInfer's clock. So `{status==working ∧ changedAt age
  ≥120s}` is **unreachable** in production — S5 would render nothing; forcing it on a stable-sig
  long task violates S5's own kill-criterion ("never dim a genuine long task"). The honesty goal (a
  frozen agent must not keep showing a confident active ring) is already met earlier + better by
  idleGapInfer (45s→thinking) + the 120s staleness sweep (`inferStatus.js` clearExternalStatus). The `WATCHDOG_TIMEOUT=120000` the
  spec cites is the **animation-chain** restart timer (`AgentCharacter.jsx:1251`), not a status
  timer — a spec conflation.
- **S3 (≤7 status symbols) / S4 (banter) → open, GATED.** Per owner "先A後B": decide after
  cold-watching live A. Trigger = the S4 pre-build stop-question (is banter still wanted, judged vs
  the now-alive S2 baseline?); its outcome also sets whether S3 builds full or descopes to
  ring+prop-icon. No content/vocabulary authoring before that gate (AC-SEQ).

---

> History: 73 prior items shipped 2026-03–2026-05 and the 54-row AVO-101+ wave shipped
> 2026-05–2026-06 — both in `_shipped-log.md`. Off-mission scope boundary: `docs/adr/ADR-006`.
