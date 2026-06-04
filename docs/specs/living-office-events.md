---
kind: feature
status: draft
primary_domain: frontend
parent_spec: docs/specs/ux-vibe-rebalance.md
created: 2026-06-04
---

# Spec: Living Office — Honest Team Liveliness & Event System

> **Status: DRAFT — review-gate passed, awaiting owner approval before implementation.** Produced by
> a 3-expert roundtable (game design / AI-behavior systems / calm-tech UX) + two code audits
> (signal-vs-event driving; full signal & daily-life inventory), then **adversarially reviewed by the
> same three experts** (2× CHANGES-NEEDED + 1× PASS) — all findings folded in (see Expert Review Gate
> at the end). This formalizes how big events relate to real work.

## Problem (owner-reported)

Big team events feel **disconnected and decorative**: a "Deploy Check" banner fires on a random
timer while the actually-working agents don't react ("看起來沒有驅動任何一件事情"). The owner's
intuition: events should be real "sudden situations" connected to real work, where an agent that
*knows it has work* can be pulled into a team moment — without ever hiding real status. The owner
explicitly warned **not to casually cut/converge** (it may break the tool's intent), to **protect
entertainment/liveliness**, to **consider real-usage trigger frequency**, and that **"maybe there's
an unexpected answer."**

## Audited ground truth (do not re-litigate — verified against code)

1. **Liveliness is ~92% the organic per-agent layer** (`behaviorEngine` weights + per-agent
   `doSchedule`: typing/coffee/wander/nap/chat) — ~230 behavior changes / 30 min vs ~19 big events
   (~12:1). Cutting big events barely changes raw on-screen motion.
2. **Reality only lights 1–2 agents.** `PreToolUse`/`PostToolUse` fire constantly (~60–300/30 min)
   but animate only the 1–2 agents Claude actually uses (usually `dev`). The other 6 get **zero**
   real signal. `SubagentStart` (the only multi-role real signal) is occasional-to-rare. Team-wide
   real signals essentially never happen.
3. **Big events are the only coordinated team moment** — the sole mechanic that pulls the idle
   majority into a shared scene so it reads as a *team*, not 8 independent fidget loops.
4. **The real→team bridge already exists but is starved/flat:** `doSchedule` already feeds global
   `mood` into `getNextBehavior` for all 8 agents (`AgentCharacter.jsx:934`); `moodToWeather` already
   drives the sky. The middle tier is a load-bearing wall nobody leans on.
5. **Two-plane separation is real:** `applyExternalStatus` (`store.js:738-750`) ALWAYS writes the
   truth `status` field; the `inGroup ? prev : new` guard blocks only behavior/expression/bubble.
   `inGroupEvent` is the ONLY flag that silences the organic `doSchedule` loop.
6. **Organic chatter is generic & honest:** the "廢話" pools (`bubbles.typing/thinking/done/chat…`
   in locales) are personality flavor ("hmm…", "almost done!", "lunch plans?", "3rd cup!") — they
   assert **no specific real work outcome**. Real work-specific lines (`dev-edit`, `dev-done`,
   `dev-error`) come from a **separate** real-signal path (`contextBubble.js generateContextBubble`)
   for tracked agents. The two are already architecturally separate.
7. **Blast radius is tiny + isolated:** changes touch `moodEngine`, `behaviorEngine`,
   `AgentCharacter`, `officeLife` schedulers/`pickParticipants`, and 2 transient `store` fields. The
   92% organic substrate, mood/weather, feed, helper-huddle, and growth are untouched.

## Core principle (the unexpected answer)

**Don't build outward (more set-pieces) — build the middle.** Liveliness is already solved; the
big-event layer's real job is **team narrative**, not motion. The missing piece is a **derived
team-affect layer** that honestly ripples the 1–2 lit desks' real activity to the idle majority
**without fabricating any per-agent work**. Honesty is a property of the **claim**, conditioned on
**tracked vs untracked** — not of randomness.

## The honesty model (the rule everything obeys)

- **TRACKED agent** = has a live real signal (the 1–2 Claude is using). Its pixels are *evidence*.
- **UNTRACKED agent** = no real signal (the idle majority). Its pixels are *ambient*, not evidence —
  there is no truth to misrepresent.
- **WORK-CLAIM** = an animation/bubble asserting a specific real task outcome/coordination
  ("deployed", "review happening", "breakthrough").
- **AMBIENT-LIFE** = presence/mood/social/world flavor, claiming nothing about the codebase.

**Hard rules (apply to every layer & event):**
- **R1 — Truth supremacy:** never overwrite, freeze, pause, or visually contradict a TRACKED
  agent's real status. (Enforced by code: `status` is written outside the `inGroup` guard,
  `store.js:746`.) **L2 scalars (`teamPulse`, `focusAnchor`) apply to UNTRACKED agents only** — a
  TRACKED agent's behavior/facing/expression are driven solely by its real-signal path and are never
  touched by L2. *(Review fix: `teamPulse` flows through `getNextBehavior`, which runs for all 8
  agents, so the untracked-only scope must be enforced at the call site, not assumed.)*
- **R2 — No unfounded work-claims:** a WORK-CLAIM may only render when a matching real signal fired
  within a bounded recency window **`WORK_CLAIM_SIGNAL_WINDOW` (~60–120 s, jittered)** — on *any*
  agent. The durable `dailyDoneLedger`/`dailyBlockedLedger` are used only for **counts/dedup, never
  to extend recency** (else a claim outlives its truth — a deploy-success 35 min after the deploy is
  decorative dishonesty). No in-window signal → the claim does not exist.
- **R3 — Reserved live tier (dominance invariant):** TRACKED desks get a reserved "live" signifier
  ambient agents can never show; ambient choreography **routes around their tiles (a keep-out radius,
  not merely no-overlap)**. The live signifier must remain **perceptually dominant over any L2
  lean-in/perk-up composite** — i.e. the maximum ambient "focus" posture an untracked agent can reach
  is strictly and measurably below a tracked agent's live signifier on the same salience axis. "Who
  is actually working?" must be answerable in < 1 s at all times. *(Review fix: defends the
  superposition of teamPulse + focusAnchor + standby posture, not each scalar in isolation.)*
- **R4 — One active set-piece (mutex)** with real-seeded > social/world priority; a real signal
  preempts an ambient scene. Mood-edge triggers are edge-debounced (one fire per transition + per
  event cooldown) so an oscillating intense↔smooth session can't ratchet repeated fires.

The one-line test for any feature: *"If I deleted the event/overlay layer entirely, would the
remaining status display still be 100% true and complete?"* It must always be **yes**.

## Layer model

| Layer | What | Driven by | Honesty | Touched? |
|---|---|---|---|---|
| **L0 — Organic personality** | per-agent micro-behaviors + generic chatter | `behaviorEngine`/`doSchedule` timers | generic, no work-claim → honest | **kept; only frequency-modulated by L2** |
| **L1 — Truth** | per-agent real status (1–2 lit desks) + real-context bubbles | `applyExternalStatus` hooks | authoritative; never faked/frozen | unchanged |
| **L2 — Derived team-affect** *(the missing middle)* | room "leans in" + orients to real work | aggregate of L1 (mood + 2 new scalars) | derived from real signal only; modulates theater params, never `status` | **NEW (enrich existing)** |
| **L3 — Set-pieces** | coordinated events | framework below | honest per category | **re-pointed, not deleted** |

### L2 mechanics (two transient scalars + one idea) — the heart of the change

**Derivation (single chokepoint):** both scalars are computed inside `moodEngine.updateStoreMood`
(it already runs on every `pushEventBatch` and owns the event window) and pushed to the store via a
new no-op-guarded setter `setTeamSignals({teamPulse, focusAnchor})`. **Not** in `applyExternalStatus`
(wrong layer — it can't see the moodEngine window). Both are transient/non-persisted (the persist
whitelist `store.js:59-85` drops unknown fields automatically). `focusAnchor` derivation must
normalize a `slug~role` composite id (`lastIndexOf('~')` slice) so it matches a roster agentId.

- **`teamPulse` (0–1):** real-signal density over `moodEngine`'s existing event window. Threaded as a
  **new 5th param** into `getNextBehavior(id, status, hour, mood, teamPulse)` (read for free from the
  existing `getState()` in `doSchedule`, `AgentCharacter.jsx:~934` — zero new subscriptions). It (a)
  scales the mood-blend factor at **`behaviorEngine.js:166`** (`*0.7 + mm*0.3` → pulse-scaled), AND
  (b) adds a pulse nudge toward `work`/away-from `away`+`social` **even when `mood==='normal'`** (the
  `mm`-undefined path) — otherwise the effect silently no-ops in the common case. **Applies to
  UNTRACKED agents only** (R1): a tracked agent's blend is its real-signal path, untouched.
  *Honest:* renders **how hard the real session is working** as ambient tone; no one claims the work.
- **`focusAnchor` (agentId | null):** the currently-hottest real desk. **New store action
  `setAgentFacing(id, dir)`** (idle-only, guarded `if (agent.isMoving || agent.inGroupEvent ||
  agent.facing===dir) return`) — because today `facing` is written ONLY as a walk side-effect
  (`setAgentTarget`/`advanceAgentWaypoint`); there is no stationary-facing path. In `doSchedule`'s
  **desk/low-commitment (no-walk) branch** (`AgentCharacter.jsx:~963-971`, NOT the walk-leg at
  `:835`), when `focusAnchor && focusAnchor!==id && agent untracked`, set facing via
  `calcFacing(agentPos, agents[focusAnchor].position)`. The room **turns toward where the real work
  is.** *Honest:* orientation is not a work-claim — but see R3 dominance invariant (composite must
  not read as working). **Stale guard:** before writing, bail if `agents[focusAnchor]` is missing or
  `status==='idle'` (TTL expiry / multi-session eviction can leave a dangling anchor).
- **Standby Roster:** idle agents are honest *specialists on standby* — when a real signal of **their
  domain** appears, they "perk up" (QA leans in on a test/QA signal; Ops watches on a deploy signal).
  *Honest:* reacting to a cue ≠ claiming the work. Turns "6 dead desks" into "a team watching its
  domains." (MVP: posture/orient only, bounded by the R3 dominance invariant; richer per-role tells later.)

## Event Decision Framework (classifies EVERY event — existing & future)

For any event, ask in order:

```
Q1. Does it assert — or by its framing IMPLY — a specific REAL work outcome / coordination?
      (Implication counts: a "toast"=win, a "retro"=failure imply an outcome even in social form.)
      YES → WORK-CLAIM event.  (eureka, deploy-success, review-debate, dev-arch-disagree, ops-dev-deploy-check)
            Rule: fires ONLY when a matching real signal fired within WORK_CLAIM_SIGNAL_WINDOW (R2).
                  No matching signal → ineligible (a SOCIAL/WORLD event is drawn instead).
            (An un-themed version of the same animation stays SOCIAL; only the outcome-implying framing is gated.)
      NO  → continue.
Q2. Is it the team's own social interaction (no outcome claim)?
      YES → SOCIAL event.  (tea-break, standup, group-meeting, pm-all-meeting, group-stretch)
            Honest for untracked agents. Recruits untracked only; tracked → reluctant participant.
            Fires on the suppressed-random floor; may be EARNED by teamPulse/mood thresholds.
      NO  → 
Q3. It is WORLD / WHIMSY flavor (claims nothing about anyone's work).
            → WORLD event.  (dog-visit, boss-visit, ac-broken, food-delivery, coffee-spill)
            Always honest. Recruits untracked; tracked → reluctant. Fires on the suppressed floor.
```

Cross-cutting on every category: **R1–R4** above. A **future** new event simply answers Q1/Q2/Q3 →
auto-classified → inherits its tier's triggering + honesty handling. (This is the extensibility the
owner asked for: "以後有新的這類型事件要怎麼處理".)

### Full classification of current events

| Event | Category | Handling change |
|---|---|---|
| tea-break, standup, group-meeting, pm-all-meeting, group-stretch | **SOCIAL** | keep; recruit untracked only; suppressed floor + earnable by mood-edge |
| dog-visit, boss-visit, ac-broken, food-delivery, coffee-spill | **WORLD** | keep; recruit untracked only; suppressed floor |
| **eureka** | WORK-CLAIM | gate: a tracked agent's `blocked`→`done` transition within the window (solo-dev reachable ✓) |
| **deploy-success** | WORK-CLAIM | gate: `ext['ops']?.status==='done'` in-window OR `dailyDoneLedger.counts.ops` incremented in-window (also seeds single-agent if Ops role active) |
| **ops-dev-deploy-check** | WORK-CLAIM | gate: same Ops-`done`/deploy signal as deploy-success (the pre-check variant) |
| **dev-arch-disagree** | WORK-CLAIM | gate: `dailyBlockedLedger` increment OR mood `frustrated`/`stuck` (block-streak proxy; solo-dev reachable ✓) |
| **review-debate** | WORK-CLAIM | gate: QA `working`/`done` ledger activity + a Dev signal in-window. NOTE: a "review subagent" is NOT distinguishable on the wire from any SubagentStart, so the gate is the QA-activity proxy, not a subagent-type match |
| time-of-day (lunch-nap, drowsiness, auto tea, Friday meeting) | SOCIAL/WORLD (clock-real) | keep as-is (honest: real time) |

### Organic chatter ("廢話") — explicitly preserved

L0 generic chatter is **kept** (honest generic flavor, audit §6). L2's `teamPulse` shifts its
**content mix** toward focus-flavored generic lines ("heads down", "in the zone") rather than
**reducing volume** — same honest "the room leaned in" signal without a liveliness dip at the moment
the owner is most engaged (review fix: cutting bubbles during a hot session trades charm for realism
at the worst time). Behavior (coffee/wander) frequency may drop with `teamPulse`; bubble volume stays
roughly flat. Real work-specific bubbles continue to come from the real-signal `contextBubble` path
for tracked agents. **Light guard:** outcome-flavored generic lines (e.g. "ship it") are fine on
untracked agents as banter — UNLESS combined with focus-posture + facing a real deploy desk during a
real deploy (then it starts to imply coordination); the R3 dominance invariant bounds that composite.

## Pull-while-working — the "reluctant participant" (honest tension)

Do **not** freeze a TRACKED agent into a set-piece (it would hide one of the only real desks). When a
set-piece fires and an agent is genuinely working, it becomes a **reluctant participant**: stays at
its desk, visibly torn — a small glance/lean toward the group + an "⏳ in a sec" tell — but still
working; its true status stays primary. **Tension via contrast, not capture.** Guardrails (review fixes):
- **Bubble priority:** real-context bubbles (`contextBubble.js`) ALWAYS preempt/displace the "⏳"
  social tell; the tell renders only in gaps between real bubbles (never delays/hides the truth channel).
- **Sub-dominant tell:** the torn signifier must stay below the working read on the R3 salience axis;
  the lean must NOT reorient the body off its desk-work axis enough to lose the "heads-down" read.
- **Join-late guard:** "join late" fires only if the scene has ≥ a few seconds of life left; otherwise
  it degrades to a brief solo catch-up tell (walks over, scene gone, small shrug) — never snapping into
  a dissolving group (which reads as a missed beat, not a payoff).
*(Optional later: a true overlay-pull that keeps `status` writing underneath with instant preemptive
snap-back, allowed ONLY when the agent's real signal is calm/idle-between-bursts and never when `blocked`.)*

## Cadence (calm-tech, anti-thrash)

Set-pieces fire from **three sources**, all under the single `activeEvent` mutex:
1. **Real-seeded** (highest payoff, rare): real deploy→celebration, real block-streak→debate,
   `SubagentStart`→standup themed to `activeWorkflow`. Rarity is a feature — these *land*.
2. **Mood-edge / teamPulse threshold** (medium): on a transition into intense/frustrated/smooth,
   probabilistically fire the matching SOCIAL/WORK event (edge-triggered, once per transition).
3. **Bounded random floor** (SOCIAL/WORLD only): the existing daily/rare timers, **scaled down (not
   muted) when a live session is active** so the active-session coordinated-scene rate lands at the
   ~1/6–10 min target — NOT zero. *(Review fix: a hard `skip tick` would make working feel QUIETER
   than idle/demo — the opposite of the owner's goal. Scale tick-probability toward the target band
   instead.)* Returns to full rate when the office is genuinely idle/demo.

Targets: coordinated social scene ~1 / 6–10 min during active work (floor scaled to hit this band,
verified by AC-7); real salient layer fires **instantly, always, no rate-limit** (rare ⇒ can't be
noisy); jitter all timers ±40%; quiet sessions stay **honestly calm** (ambient slows/dims rather than
manufacturing excitement). On the FIRST real signal of a session, the L0→L2 transition should be
perceptible (the room visibly "wakes up" / orients).

## Implementation plan (phased, reversible)

- **Phase 1 — L2 middle tier (the core win, low-coupling but NOT trivial):** the `teamPulse` *read*
  path is free (existing `getState()` in `doSchedule`, zero new subscriptions), but the *write* side
  is real work (review fix — fold these into Phase 1 or they leak to Phase 2):
  (a) two transient store fields + `setTeamSignals({teamPulse, focusAnchor})` setter;
  (b) derive both in `moodEngine.updateStoreMood` (normalize `slug~role`); reset to `0`/`null` when
      the window empties AND in `clearExternalStatus`'s empty-ext branch (`store.js:925-927`);
  (c) new `setAgentFacing(id, dir)` store action (idle-only guarded) — no stationary-facing path
      exists today;
  (d) add `teamPulse` param to `getNextBehavior`; pulse-scale the blend at `behaviorEngine.js:166`
      AND add a `normal`-mood nudge; apply to UNTRACKED agents only;
  (e) call `setAgentFacing(calcFacing(agentPos, anchorPos))` in `doSchedule`'s no-walk desk branch
      (`AgentCharacter.jsx:~963-971`), untracked-only, with the stale-anchor bail.
  *AC: AC-4 + AC-5 + AC-1 (below).*
- **Phase 2 — Event taxonomy + honesty gating:** tag each `officeEvents` entry with its category;
  gate the 5 WORK-CLAIM events behind matching real signals; restrict SOCIAL/WORLD `pickParticipants`
  to untracked agents; add the suppression-when-live floor + mutex priority. *AC: no WORK-CLAIM
  renders without a backing real signal (test); a tracked agent is never recruited as a full
  participant; random events suppressed while session live.*
- **Phase 3 — Reluctant participant:** when a set-piece fires with a tracked agent in-scope, render
  the reluctant-participant treatment instead of pulling it. *AC: tracked agent keeps live status +
  position; shows the torn tell; releases/joins-late on real-signal quiet.*
- **Standby Roster richness** and the **optional overlay-pull**: deferred to a later cut.

### File touch points
`store.js` (2 transient fields + `setTeamSignals` + `setAgentFacing` actions; reset in
`clearExternalStatus` empty-ext branch `:925-927`) · `moodEngine.js` (`updateStoreMood` derives
teamPulse + focusAnchor, `slug~role` normalize) · `behaviorEngine.js:166` (teamPulse param +
pulse-scaled blend + normal-mood nudge) · `AgentCharacter.jsx` (`~963-971` no-walk desk branch
facing-bias; reluctant-participant render branch) · `officeLife.js`
(`pickParticipants` tracked-exclusion + category gating; schedulers suppression/priority) ·
`config/officeEvents.json` (per-event `category` + `requiresSignal`) · `constants.js` (cadence).

## Failure-mode guards

- **TTL flips status mid-event** (working/blocked TTL 5 min → idle while `inGroupEvent` persists):
  reluctant-participant reads live `status`; if it goes idle honestly, the tell clears. No snapshot
  needed for Phase 3 (no freeze); the optional overlay-pull (deferred) would snapshot `eventCtx`.
- **`focusAnchor` stale pointer:** the anchor agent's status can TTL-expire to idle, or a dynamic
  `slug~role` agent can be evicted (`store.js:828-829`), while `focusAnchor` still names it →
  consumers MUST bail if `agents[focusAnchor]` is missing or `status==='idle'`; `updateStoreMood`
  recomputes/clears it each pass (null when no live non-idle external status exists).
- **Transient-field leak on session end:** `updateStoreMood` is NOT called by `clearExternalStatus`,
  so reset `teamPulse:0`/`focusAnchor:null` in `clearExternalStatus`'s empty-ext branch too (else the
  anchor stays pinned in an idle office).
- **Racing signals / mutex starvation:** real-seeded > mood-edge > random; ambient never preempts a
  real-seeded scene; a real signal preempts ambient. Random floor can never block a real event.
- **Drained floor / thrash:** SOCIAL/WORLD recruit untracked only + cap participants; per-agent and
  per-event cooldowns; mood-edge events edge-debounced (one fire per transition + cooldown, so
  intense↔smooth oscillation can't ratchet); ±40% jitter.
- **`done` TTL = 10 s:** count-based triggers read durable `dailyDoneLedger.counts`, not live status.

## Acceptance criteria (measurable)

- **AC-1 (status truth):** across a scripted session, every agent's `status` is written only by
  `applyExternalStatus`/`clearExternalStatus`; no event/L2 path mutates `status` (test). Also: a
  TRACKED agent's behavior/facing/expression are byte-identical with L2 on vs off.
- **AC-2 (no unfounded work-claims):** each of the 5 WORK-CLAIM events renders ONLY when its named
  store-field signal (see table) fired within `WORK_CLAIM_SIGNAL_WINDOW`; it does NOT fire when that
  signal is older than the window, nor from the durable ledger alone (test per event, using the
  concrete fields — `review-debate` uses the QA-activity proxy, not a subagent-type match).
- **AC-3 (live readability — the core-value guard):** while ≥1 agent is tracked: (a) its live
  signifier's salience metric exceeds the max ambient/L2/reluctant signifier on the same axis by a
  fixed margin; (b) no ambient/event participant tile enters a defined keep-out radius around a
  tracked tile (route-around, not just no-overlap); (c) a synthetic "find the working desk" check
  resolves to the single tracked tile in < 1 s. All three measured.
- **AC-4 (team reflects reality, untracked-only):** with a live single-agent session, the fraction of
  IDLE agents whose discrete `facing` equals `calcFacing(agentPos, anchorPos)` exceeds 0.25 + margin
  (4-way baseline); casual-behavior frequency correlates negatively with `teamPulse`; and the TRACKED
  agent's facing/behavior is unaffected. (Requires the new `setAgentFacing` path — Phase 1.)
- **AC-5 (liveliness preserved):** organic per-agent behavior rate + generic chatter VOLUME during a
  quiet session within ±10% of today (no liveliness regression; chatter content may shift, volume not cut).
- **AC-6 (calm/no-thrash):** no set-piece faster than the cadence caps; mood-edge events edge-debounced;
  reduced-motion honored; feed entries tagged `'event'`/`'hook'`/`'inferred'` (never `'organic'`).
- **AC-7 (alive-when-working):** during a live active session, the mean coordinated-scene interval
  falls within the 6–10 min target band — i.e. the suppressed floor does NOT make working quieter
  than idle/demo (measured over a scripted session).

## Out of scope / non-goals

- No fabricated per-agent work; no freezing tracked agents; no full-bleed event banner (demote to a
  feed line + gather animation). No new ingestion plumbing beyond reusing existing signals (test-fail
  specificity, workflow phase-enum — deferred until the wire carries them). Helper-huddle (sub-agent
  supervision) is left as-is and not repurposed.

## Verification method

`preview_screenshot` is broken in this environment → behavioral/honesty ACs verified by store-driven
unit/integration tests + `getBoundingClientRect`/orientation measurement via `preview_eval`, plus the
owner's visual confirmation. No "looks fine" without a measured number or a test.

## Expert Review Gate (adversarial, 2026-06-04)

The spec was reviewed by the same three lenses against the real code. Verdicts + resolution:

- **AI/systems — CHANGES-NEEDED → resolved:** `focusAnchor` facing-bias hook didn't exist (no
  stationary-facing write path) → added `setAgentFacing` (idle-only); blend line corrected `:163`→`:166`
  + `teamPulse` param + `normal`-mood nudge; derivation moved to `moodEngine.updateStoreMood` +
  `setTeamSignals` (not `applyExternalStatus`); `slug~role` normalization; stale-anchor + reset guards;
  AC-2 per-event concrete store fields (review-debate = QA-activity proxy, no subagent-type on wire);
  AC-4 4-way baseline; Phase 1 scope corrected (setter + setAgentFacing + reset wiring included).
- **Calm-tech UX — CHANGES-NEEDED → resolved:** L2 scoped UNTRACKED-only (R1) so `teamPulse` never
  touches the tracked agent's blend; R3 dominance invariant + keep-out radius added (composite lean-in
  must not read as working); bounded `WORK_CLAIM_SIGNAL_WINDOW` (R2, ledger for counts only);
  reluctant bubble preemption + sub-dominant tell; AC-3 strengthened to a falsifiable core-value guard.
- **Game design — PASS + blocker reconciled:** random floor scaled-not-muted to the 6–10 min target
  (AC-7) so working isn't quieter than idle; WORK-CLAIM seeds broadened to solo-dev-reachable signals;
  Q1 implication tiebreaker (toast/retro); reluctant join-late guard; chatter content-shift-not-volume;
  cold-start L0→L2 ramp note.

All findings folded in. Spec is implementation-ready pending owner approval.
