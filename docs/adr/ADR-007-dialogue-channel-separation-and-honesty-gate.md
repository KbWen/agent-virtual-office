---
title: "ADR-007 — Dialogue channel separation + dialogue honesty gate"
date: 2026-06-15
status: accepted
applies_to:
  - "src/systems/roleArchetype.js"
  - "src/systems/behaviorEngine.js"
  - "src/systems/officeLife.js"
  - "src/systems/contextBubble.js"
  - "src/components/AgentCharacter.jsx"
  - "src/components/BehaviorBubble.jsx"
  - "src/locales/*.json"
lifecycle:
  owner: KbWen
  review_cadence: on-event
  review_trigger: "any change to how agent status vs voice is rendered, any new inter-agent dialogue/interaction mechanic, or any proposal to add per-pair relationship/affinity memory"
  supersedes: null
  superseded_by: null
---

# ADR-007: Dialogue channel separation + dialogue honesty gate

- **Status**: Accepted (2026-06-15)
- **Context**: The owner's next product direction is the dialogue/text layer (台詞、文字): distinct
  per-role voices, meaningful + interleaved inter-agent interaction, a range from silence/murmur to
  deeper exchange, and work-status lines that read "更直觀好懂". A 9-agent expert panel + game-reference
  research (cozy-sim, colony-sim, character-writing, honesty, systems, game-feel, HUD lenses; full
  design in the session design record) converged on three architectural decisions that cross multiple
  modules and are hard to reverse once content + rendering are built on them. Two tensions forced the
  decisions: (a) the overhead bubble is scarce real estate that work-status text and dialogue compete
  for; (b) real AI agents have no knowable conversations/relationships — "meaningful deep inter-agent
  interaction" taken literally would fabricate state, the same failure class that killed AVO-120
  (leaderboard), the eureka cascade, and drag-to-move (ADR-005).

## Decision

### D1 — Channel separation (bubble = voice; status = symbol + ring)

The overhead **speech bubble is reserved for VOICE** (dialogue, murmur, banter, poke quips). Work
**STATUS rides non-text channels**: the colored status **ring** (already shipped) + a **work-type
SYMBOL chip** (≤7 glyphs, mapped to the `classify.js` families, mostly reusing existing
`BehaviorIndicator` glyphs) placed on the body/shoulder + posture/expression. **Exact tool/file
detail goes to the click inspector** — consistent with the shipped AVO-131 decision (tool string is
inspector-only). Three channels use three distinct **shapes** in three distinct **zones** so they are
never confused (The Sims' 80-year comic convention: thought-cloud vs pointed speech-balloon).

**`blocked` is the licensed exception**: it seizes the bubble (+ the existing `BlockedReasonBadge`
debuff chip + red ring) because it is the message worth interrupting for. Nothing else may double the
voice + status channels.

### D2 — Open-ended / non-conclusive content rule

Dialogue/banter content **gestures at topic DIRECTIONS and never resolves** — it leaves the viewer
imagination space. Conclusive lines ("fine, I'll fix it" / "done!" / "we decided X") are banned
because they both (a) close off imagination (not chill) and (b) assert a fabricated outcome (not
honest) — so non-conclusive is chill **and** honest at once. Enforced by a **lint rule** that bans
terminal-decision verbs (`fixed`/`done`/`decided`/`solved`/`了`/`搞定`/`決定`…) inside dialogue/topic
pools (T1 machine-enforced, per `engineering_guardrails.md §13`). NOTE: most conclusive lines are
actually **status leaking into the voice channel** — D1 already says they belong on the ring/symbol,
not the bubble.

### D3 — Inter-agent dialogue honesty gate (G1–G10)

Any inter-agent interaction (banter) MUST pass all of:
- **G1 Deletion test** — delete the whole dialogue layer and the status display is still 100% true.
- **G2 No work-claim without an in-window real signal** — outcome/coordination-implying lines route
  through the existing `eventEligible`/`WORK_CLAIM_GATES` discipline.
- **G3 Shared-artifact rule** — name a file/PR as *shared* only when `findSharedFilePair` proves it
  (byte-identical path, both live, in-window).
- **G4 No relationship/affinity memory, ever** — no store field/counter/tag encoding a standing
  relationship between agents. **(REJECTED outright — this is AVO-120's leaderboard in social
  clothing.)**
- **G5 Ambient legibility** — ambient banter is visually distinguishable from gated work-claim scenes
  (not a "transcript").
- **G6 Untracked-only + R1 supremacy** — banter recruits only non-working agents; a genuinely-working
  (tracked) agent is NEVER relocated/frozen/given fabricated words (R1: set-pieces never relocate a
  working agent).
- **G7 No cross-process awareness claim** — a line may imply B reacted to A's specific work only when
  G2+G3 hold; agents are often different vendors in different processes.
- **G8 Zero persistence** — interaction state is transient (like `pairLink`/`teamPulse`), never
  persisted, never accreted.
- **G9 Mutex + cadence** — one `activeEvent` mutex, global cooldown, real-seeded > ambient priority.
- **G10 Feed honesty** — feed lines tagged `event`/`hook`/`inferred`, never relationship-logged.

Banter is **bubble-only** (writes no position/status), **real-seeded** (blocked/done/co-edit edges),
**opportunistic on existing proximity** (never causes new walking — the owner's recurring pain),
2–3 turns, cooled/rare.

## Alternatives Considered

1. **Keep mixing status + voice in one bubble** (status quo). Rejected: the overhead bubble can't
   carry both; ONI shipped this (status icons + social bubbles in one zone, no shape distinction) and
   players documented confusion. The bubble-cap then spends its budget suppressing status chatter.
2. **No inter-agent dialogue at all** (the maximally-safe honest position; what the honesty auditor's
   threat model defends). Rejected as the *default* but retained as the *fallback*: the gated,
   real-seeded, bubble-only banter (D3) is honest enough to ship, and the owner's "alive office" want
   is real. If banter fails to earn its place live (clutter > charm), it is killed back to this
   position (do/refine/kill, no "Deferred").
3. **Full conversational dialogue with relationship memory** (agents who "know" each other, recurring
   duos/rivalries). Rejected outright (G4): fabricates relationships no real signal supports.
4. **Make work-status text smaller but keep it in the bubble.** Rejected: a smaller status line still
   occupies the voice channel and still asserts a chatty vibe; moving status to symbol+ring (D1) is
   cleaner, more legible, and more honest.

## Consequences

**Positive**
- Status is glanceable (ring + ≤7 symbols, co-presented + hover-taught) and the bubble has room for
  voice — resolves the real-estate competition.
- Non-conclusive content is simultaneously chill and honest; the lint guard makes "no fabricated
  outcome" machine-enforced, not aspirational.
- The honesty gate keeps a charming feature from becoming a "lying toy"; "deep interaction" is
  redirected to the one provable signal (`findSharedFilePair` co-edit huddle).

**Negative / costs**
- A ≤7-symbol vocabulary is a small learning curve (validate 10px legibility before building it — DF's
  60-icon and ONI's undocumented-symbol failures are the cautionary precedents; kill the vocabulary if
  it fails the pixel-legibility bar).
- Banter is net-additive on a screen the owner repeatedly calms — it must EARN its place behind a flag,
  judged live against a quieter baseline, and be killed if it doesn't pay (the Slice-1-REDUCTION-first
  sequencing exists precisely so banter is judged against quiet, not noise).
- More rendering branches (shape/zone enforcement) in `AgentCharacter`/`BehaviorBubble`.

## Compliance / re-open

- Implementation is sliced: Slice 1 (quiet-the-worker REDUCTION) is the unconditional commit; channel
  symbols, voices, banter, and stale-decay are staged hypotheses each with kill-criteria. See
  `docs/specs/dialogue-interaction-layer.md` (to be written) for the AC + kill-criteria.
- **Re-open G4 (relationship memory)** only if agents gain a real, observable inter-agent protocol
  (e.g. one agent invokes another as a recorded subagent edge) AND the memory encodes only that real
  edge, never sentiment — recorded as a superseding ADR.
