---
status: frozen
title: Dialogue & Interaction Layer
feature: dialogue-interaction-layer
created: 2026-06-15
last_updated: 2026-06-15
primary_domain: ui-rendering
secondary_domains: [office-runtime]
adr: docs/adr/ADR-007-dialogue-channel-separation-and-honesty-gate.md
signal_tier: T1
---

# Dialogue & Interaction Layer

> Design authority: this spec + **ADR-007**. Full panel design in memory `project_dialogue_interaction_design`.
> Hardened against an adversarial red-team (15 HIGH/19 MED) AND a domain-expert + PM review (4 HIGH/10 MED) on
> 2026-06-15 — see Work Log Evidence. UI feature → Design-First (§4.4); visual proof via headless Playwright.

## Goal

Make the office feel **alive and legible** without clutter, serving the owner's stated dialogue/text (台詞、文字)
direction. Method: **subtract first** (quiet the over-talky baseline + remove an existing fabrication leak),
then reserve the bubble for VOICE while status rides ring+symbol (ADR-007 D1).

> **Read this framing (PM):** S1/S1b are the *enabling reduction*, **not the deliverable**. **S2 (per-role
> voices + open-ended lines + verb-first work-status) is the slice that actually answers the owner's 台詞/text
> ask** — it is killable on *quality* (rate/attribution/warmth), NOT droppable on scope.
>
> **Quiet ≠ dead (game-feel):** S1's reduction must NOT silence the office. The metrics below are CEILINGS;
> AC-C1b adds a liveliness **FLOOR**. `STATUS_BUBBLE.working.chance = 0.20` is a *starting hypothesis* — retune
> upward if the post-S1 office reads dead (owner cold-watch "does it still feel like someone's home").

## Phasing — TWO unconditional commits; S2–S5 killable hypotheses

| Slice | Scope | Type | Kill-criterion (measurable) |
|---|---|---|---|
| **S1** | Quiet the worker: lower `STATUS_BUBBLE.working.chance` 0.55→0.20 AND gate/anti-repeat the **second** working emitter (`store.js` `generateContextBubble`/`randomBubble('working-status')` fallback, today ungated); caller-owned anti-repeat in `pickMessage`. **Add `rng.js` seeded-RNG seam** (random + test-setter; route behaviorEngine + i18n `randomBubble`/`eventBubble` + the store.js path through it) so baselines are reproducible. **Mechanical only.** Commit the post-S1 baseline fixture (rate + mean/p95 count **+ liveliness floor**). | pure reduction — **unconditional commit** | none |
| **S1b** | Gate `generateCrossReaction` (contextBubble.js:172-194) so `react-colleague-*` fires only on a real in-window edge; prune the named cross-awareness gossip lines; rewrite the legacy `react-colleague-done` zh line `哦做完了? 讚` (a real fabrication + denylist hit) **before** the lint turns on. Add the missing tests. | pure reduction + honesty fix — **unconditional commit** | none |
| **S2** | **The deliverable.** 4 voice archetypes + open-ended pools (en+zh 1:1) + verb-first work-status rewrite. Re-skins existing emissions; **adds no new emission trigger.** | killable on quality | KILL/revert if (a) working-bubble emission RATE rises vs S1 baseline beyond the noise band, OR (b) blind archetype-attribution < 60% (chance 25%), OR (c) warmth check fails (below) |
| **S3** | ≤7 work-type status symbols (D1) + the family→symbol mapping table | killable; **conditional on the S4 decision** | **GATE: 10px legibility validated FIRST**; KILL the vocabulary (keep ring+animated prop-icon) if owner cold-blind-label confusion > 1/7 OR pairwise pixel-diff < 15% OR fails at smallest docked sceneScale. **If the S4 stop-question (after S1+S2) concludes "no banter", reconsider S3 — the bubble may not be contended enough to justify the re-architecture; descope to ring+prop-icon.** |
| **S4** | `banter.js` — Valve-followup, bubble-only, R1-safe, real-seeded | killable + **pre-build gate** | **PRE-BUILD (after S1+S2 ship — NOT after S3):** STOP and ask owner if banter is still wanted, judged against the **post-S2 alive baseline** (voices shipped), not the bare post-S1 quiet. **POST-MERGE:** owner live review within 7 days; if none → **auto-DISABLE (flag off, code retained)**, NOT revert. KILL/revert only on an actual clutter (mean simultaneous-bubble count > S1 baseline in a 3-min sample) or honesty-gate failure. |
| **S5** | stale-working ring decay (`STALE_WORKING_MS ≥ WATCHDOG_TIMEOUT=120000`) | killable | KILL/retune if it dims a genuine long-running task (decay must never fire before the watchdog would) |

**AC-SEQ (ordering gate):** S2–S5 MUST NOT merge until **S1 + S1b ship AND the AC-C1/C1b baseline is captured**. No authoring of S2 pools / S3 vocabulary before that. Each of S2–S5 closes with a recorded verdict in Work Log Evidence: `S<n>: do|refine|kill — evidence: <artifact>`.

## Acceptance Criteria

### Honesty gate (ADR-007 D3 G1–G10)
- **AC-H1 (G1, scoped + SR-inclusive)**: a pure `statusRenderModel(agent, ext)` — ring color + symbol id + name-pill + **the group `aria-label`/sr-only status string** (AgentCharacter.jsx:1360) + inspector fields; transient/rotation fields excluded — is `deepEqual` with the dialogue flag ON vs OFF. The status render path takes NO banter/voice input. *(Bubble layer = voice, out of this AC's scope.)*
- **AC-H2 (G6, split)**: write-side spy → `fireBanter` calls only `setBubble`-class APIs (0 position/status writes); select-side → `pickResponder`/`banterEligible` return null/false for any candidate with `ext[id].status ∈ {working, blocked}` and for a tracked initiator. *(Mirror bubbleVisibility.test.js seeding.)*
- **AC-H3 (G4, closed-set)**: `createPersistedState` (store.js:63-89) emits ONLY the documented keys, test FAILS on any new key; `banter.js` pure (call-twice determinism, no module-level accumulator); scoped grep of NEW code for `history|streak|count|partner|chemistry|seen|knows|affinity|rapport|relationship` with `pairHuddle`/`pairLink` allowlisted.
- **AC-H4 (G2/G3/G7, named — in S1b)**: `generateCrossReaction(..., now)` returns null unless the reacted-to agent's `changedAt` is within `WORK_CLAIM_SIGNAL_WINDOW` (`recentSignal`); shared-artifact lines also require `findSharedFilePair` (co-EDIT only; `colleague-blocked` gates on `recentSignal` alone). *(Test: mirror **bubbleVisibility.test.js** seeding — stale colleague → null, fresh → line. NOTE: eventHonestyGate.test.js does not exist.)*
- **AC-H5 (G8, structural)**: `createPersistedState` has no banter/voice/murmur key for any state; `localStorage.setItem` spy = 0 during `fireBanter`; transient banter slot bounded (cleared on cooldown, capped, doesn't grow across N banters).

### Open-ended content (ADR-007 D2)
- **AC-O1 (open-test)**: criteria (1 topic-guessable) & (3 outcome-open) = non-gating **T3** heuristic whose catches feed back into AC-O2's denylist; criterion (2 archetype-identifiable) machine-gated by AC-S2a. Note: the ban targets fabricated **work-outcome** closure, NOT emotional warmth — a non-work contented beat ("cozy in here today") is allowed/desired.
- **AC-O2 (lint-guard, T1 — the machine signal for D2)**: a CI test (THIS test is the T1 artifact — do NOT cite guardrails §13) imports a committed denylist `src/locales/_bannedTerminalTokens.json` and FAILS if any string under `banter`/`murmurs`/`contextBubbles`/`gossip`/`react-colleague-*` keys matches. **Scope note (i18n):** legacy `bubbles.done`/`bubbles.working-status` are intentionally OUT of scope — they are short status-acks tied to the ring state ("licensed status echo"), not open dialogue; this asymmetry is accepted and documented.
  - **en**: case-insensitive word-boundary on work-outcome STEMS (`fix`,`solv`,`decid`,`final`,`done`,`nail`,`ship`,`merg`,`wrap`).
  - **zh (CORRECTED — `了` is NOT banned as a particle; that was a linguistic error):** ban only completion **verb+了** collocations as substrings, NOT the bare particle. Denylist: `搞定了`,`修好了`,`弄好了`,`做完了`,`完成了`,`解決了`,`處理好了`,`結案了`,`收工了`,`上線了`,`改完了`,`收尾了`,`決定了`,`定案`,`大功告成`,`通過了`,`搞掂` (× optional `了/啦/囉`). **Negation lookbehind**: do NOT fire when immediately preceded by `沒/未/不/還沒/難/很難/快/差點/還在` (so `沒完成`/`還沒決定`/`快完成`/`沒修好` PASS). Documented test cases (≥6): `搞定了`→fail, `卡住了`→pass, `快好了`→pass, `又改了`→pass, `週五了`→pass, `還沒決定`→pass, `做完了`→fail. Denylist is living/non-exhaustive-but-CI-blocking; AC-O1 catches feed in. Templated `{ctx}` lines matched post-interpolation.

### REDUCE-not-add — ceiling AND floor (with a frozen baseline)
- **AC-C1 (ceiling, both emitters, seeded)**: via the `rng.js` seeded seam, measure TOTAL working-bubble emission across `getNextBehavior` AND the store.js `randomBubble('working-status')` fallback, N=10000/arm; assert `afterRate ≤ baselineRate × 0.45`. S1 commits the measured baseline numbers as a fixture.
- **AC-C1b (FLOOR — new, game-feel)**: over a K-seeded ambient sample, the fraction of time ≥1 voice/murmur bubble is visible must stay within `[floor, baseline]` — must NOT collapse toward 0. S1 must not starve the existing `bubbleVisibility` rotation (the "keeps talking in turns instead of freezing" mechanism). Owner T3 cold-watch: "does it still feel like someone's home?" If dead → retune `working.chance` up before S2.
- **AC-C2 (cap + priority + mean)**: `selectVisibleBubbles` never > `BUBBLE_VISIBLE_CAP=3`; add a `banter` priority tier (3, below `working`=2, far below `blocked`=0/`done`=1); a blocked agent wins the only slot at cap=1. Banter must not raise the mean simultaneous-bubble count vs S1 baseline (rarity via quantified cooldowns, an AC not an unconstrained constant).

### Per-slice functional
- **AC-S1a (anti-repeat, real signature, seeded)**: `pickMessage(msgKey, recent=[])` caller-owned ring buffer (in `getNextBehavior`/transient agent slot, à la pokeReaction.js — not module-global, not persisted). Seeded test: 50 calls one (agent,pool), ≥3-line pool → no return equals its previous 2; `pickMessage` pure given `(msgKey, recent)`.
- **AC-S1b**: `working.chance` = 0.20 (was 0.55); `blocked` unchanged; store.js working fallback gains the same anti-repeat/gating.
- **AC-S2a (archetypes, 8 roles, warmth)**: every id in `VALID_ROLES` (store.js — **8**: pm/arch/dev/qa/ops/res/gate/designer) maps to one archetype; set == {Sprinter, Skeptic, Sage, Coordinator, Aesthete}; en/zh key-set equality for new sections. Blind-attribution ≥5 lines/archetype, KILL if < 60%. **Warmth/variety (T3):** distinctiveness must be *distributed*, not one tic per archetype (removing any single line must not drop attribution < 60%); two same-archetype agents must vary ≥1 surface dimension (length/opener/register) so they don't read as clones. **zh authoring note:** lean on sentence-final 語助詞 (欸/喔/啦/齁/吧/呢/嘛/捏) + trailing「…」 as the primary non-conclusive + voice marker (seed 1–2 signature particles per archetype) — do NOT translate the en line literally.
- **AC-S3a (mapping + SR)**: explicit table routing ALL ~16 `classify.js` families → one of ≤7 glyphs OR the inspector tier; collapse loses no glance-needed state (or it's inspector-recoverable).
- **AC-S3b (legibility — HARD gate, before content)**: render all glyphs headless at the on-screen chip px **at the smallest supported docked/panel sceneScale** (the chip is OUTSIDE the labelScale counter-scale group, so gate at min scale; **recommended: do NOT move the chip** — if moved inside the group, `BlockedReasonBadge` must move lockstep [shares the ox=14/oy=-8 slot] and re-run the 8-agent 320–1280px overlap sweep with the chip present, re-verifying LABEL_SCALE_MAX). Pass bar: (machine) pairwise pixel-diff > 15% AND grayscale-stripped still pairwise-distinct (not-color-alone); (T3) owner cold blind-label (no hover, incl. touch profile) ≥ 6/7 correct, zero cross-confusions, confusion-matrix artifact. Declared-without-artifact = FAIL. A DOM render test proves only co-presence, not legibility.
- **AC-S3c (SR accessible name — new, a11y)**: the work-symbol chip MUST expose its meaning to assistive tech via a REAL accessible name (`role='img'` + `aria-label`, or `<title>` as first child of a `role='img'` element — NOT a bare nested `<title>`), localized via a new `workSymbolLabels.*` locale section (en+zh 1:1, mirroring `statusLabels`); **NOT hover-only**. Test: chip accessible name non-empty and matches the AC-S3a family for all ≤7 glyphs.
- **AC-S4a (banter, atomic + SR)**: S4a-1 flag OFF → `fireBanter` no-op (0 setBubble); production default `false`, CI FAILS if flipped without an ADR-007 amendment. S4a-2 turns ∈ [2,3]. S4a-3/4 global + per-initiator cooldown reject. S4a-5 `activeEvent` set → false. S4a-6 no new walk (cross-ref AC-H2). S4a-7 real-seeded (blocked/done→`recentSignal`, co-edit→`findSharedFilePair`). **S4a-8 (a11y):** banter bubble copies the AMBIENT bubble path (no `role`/`aria-live`) — NOT the poke-quip live-region path; test asserts the banter bubble container has no `aria-live`/`role='status'`. Voice/murmur/banter TEXT stays decorative (aria-hidden / no accessible name) — only STATUS is announced (AC-S3c); a "…"-only murmur is never announced as gibberish.
- **AC-S5a (stale decay)**: pure `ringDecayOpacity(changedAt, now, reducedMotion)`; full before `changedAt + STALE_WORKING_MS`, reduced after; `reducedMotion=true` → static (no pulse field); assert `STALE_WORKING_MS ≥ WATCHDOG_TIMEOUT (120000ms)`.

## Non-goals
- NO per-pair relationship/affinity memory (ADR-007 G4 — rejected).
- NO new agent movement/walking for dialogue (R1).
- NO authoring of S2 pools / S3 vocabulary before the S1 baseline is measured (AC-SEQ).
- NO sprite-art / cosmetic customization (AVO-160/124).
- NO audio beyond an OPTIONAL off-by-default two-tone reply blip.
- NO **persisted** transport/store/schema changes; banter cooldown/mutex state is transient module-local (like `pairLink`/`teamPulse`). *(Banter holds transient engine state; the claim is "no persisted state", not "pure render overlay".)*
- NOT raising the ≤3 bubble cap.
- S1b gossip pruning scoped to lines asserting knowledge of a specific named other-agent action or external-team state (e.g. `昨天那個 bug 到底誰寫的` / `聽說隔壁組的 API 又改了` / `聽說新來的超強的`); ambient self-flavor kept.

## Constraints
- Honesty gate G1–G10 (ADR-007).
- REDUCE-not-add proven against the committed S1 baseline (AC-C1) — **with a liveliness floor (AC-C1b), not just a ceiling**.
- **Positive-value check (PM/chill-fun, T3 required-non-gating):** for S2 and S4, run a short chill/office-sim game-design panel on the actual authored lines (memory `feedback_visual_feature_panel_and_integration_verify`) asking "does this make the office more fun to leave open?" — recorded in the S<n> verdict alongside do/refine/kill. Guards the WIN, not just the absence of harm.
- en + zh-TW 1:1 parity; reduced-motion fully supported (semantic state never depends on motion).
- Visual proof via headless Playwright + owner confirmation for S3/S4 (preview_screenshot broken).
- Design-First (§4.4): /plan carries the visual-language design reference.
- **Backlog registration:** at /ship, add a row to `_product-backlog.md` (e.g. AVO-161, P1, feature, spec=this file, dep=ADR-007; S1/S1b unconditional, S2–S5 killable) so future bootstraps see it.

## API / Data Contract
- New pure module `src/systems/banter.js`: `withinBanterRange`, `pickResponder`, `pickBanterLine`, `banterEligible` — pure; writes only bubbles.
- New `src/systems/rng.js`: seeded random + test-setter; behaviorEngine + i18n `randomBubble`/`eventBubble` + store.js working path route through it.
- `pickMessage(msgKey, recent=[])`; `generateCrossReaction(..., now)`; `ringDecayOpacity(changedAt, now, reducedMotion)`.
- New data/constants: `src/locales/_bannedTerminalTokens.json`; `workSymbolLabels.*` locale section (en+zh); `BANTER_GLOBAL_COOLDOWN_MS`, `BANTER_PER_INITIATOR_COOLDOWN_MS`, `BANTER_RANGE_RX/RY`, `STALE_WORKING_MS (≥120000)`, banter flag (default false).
- New locale sections: `murmurs`, `banter`; revised archetype `contextBubbles`.

## Domain Decisions
- [DECISION] Channel separation — bubble = VOICE; status = ring + ≤7 symbol + posture; detail → inspector (ADR-007 D1; extends AVO-131). **SR: status meaning preserved/extended via accessible names (AC-S3c), never hover-only.**
- [DECISION] Open-ended content, machine-enforced by the AC-O2 lint (the test IS the T1 artifact; denylist data-file). zh bans completion **verb+了** collocations with negation-lookbehind, never the bare `了` particle.
- [CONSTRAINT] Inter-agent honesty gate G1–G10; NO relationship memory; banter bubble-only, R1-safe, real-seeded, SR-silent ambient.
- [DECISION] TWO unconditional reductions (S1 + S1b); S2–S5 killable with measurable kill-criteria + recorded verdicts.
- [CONSTRAINT] AC-SEQ ordering gate + liveliness FLOOR (AC-C1b) — reduction must not ship a dead office; a default-off un-evaluated flag = banned Deferred.
- [TRADEOFF] Banter net-additive vs REDUCE → time-boxed hypothesis; PRE-BUILD stop-question judged against the **post-S2 alive baseline**; auto-DISABLE (not revert) on review-latency.
- [DECISION] S2 is the headline deliverable (the owner's 台詞/text ask); S1/S1b enable it.
- [CONSTRAINT] ≤7 symbols; 10px legibility = HARD gate at smallest sceneScale (pixel-diff + cold-blind-label), runnable before the vocabulary is built; symbols carry SR accessible names.

## File Relationship
INDEPENDENT (new). Governed by **ADR-007**. Relates to (does NOT replace): `living-office-events.md`, `ux-vibe-rebalance.md`, `poke-acknowledge.md`. Touches code shipped by AVO-126/127/128/131/136/158.
