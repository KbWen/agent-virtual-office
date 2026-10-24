---
title: "Optional Cozy Interactions — Candidate Inventory"
type: feature-inventory
doc_state: concept
date: 2026-10-23
selection: owner-selected-all-C1-C5-2026-10-23
runtime_implementation: implemented-pending-rendered-acceptance-AVO-206
---

# Optional Cozy Interactions

## Intent and Boundaries

The owner requested additional cute, playful, soothing interactions that do not affect the small core product, selected all C1-C5 and authorized advancement on 2026-10-23. This inventory records that selection; the canonical implementation contract is `docs/specs/cozy-interactions.md` (AVO-206). AVO-202 through AVO-205 remain separate plans. Actual rendered acceptance is pending.

All candidates use an actual, deliberate user gesture as the backing event. They produce short, neutral object feedback; they never fabricate work success, need, emotional dependence or progress. They must follow ADR-007/008 and the current protected scene surfaces.

## Existing Capabilities — Extend Rather Than Duplicate

- Clicking an agent already opens its inspector and produces an in-place poke bob / short real-status quip (`AgentCharacter.jsx:1510-1569`, `pokeReaction.js`). Keep that established click behavior.
- Clicking the office pet already produces a cosmetic heart with no mode/state change (`OfficePet.jsx:98-100`, `:175-201`). Real blockers and approval waits dominate pet visibility.
- The coffee corner already has user-triggered feedback and a busy refusal; do not add another coffee event or make genuinely working agents take a break.
- Optional ambient audio and shareable daily cards already exist. New sounds require explicit opt-in; postcard decoration must not alter the card's source-backed counts/status.

## Candidate Inventory

| ID | Concept and interaction | Visible result | Existing/new surface | Effort / recommendation |
|---|---|---|---|---|
| C1 | Tap an existing perimeter plant | Leaves sway once and return to the exact initial position, about 700ms | Existing decoration; no new floor object | Small; recommended first |
| C2 | Upgrade the current click-to-pet reaction | Cat gives a brief ear twitch/blink; dog a short tail wag; vacuum a small brush spin, then return to the current genuine mode | Extend existing cosmetic heart interaction | Small-medium; recommended first |
| C3 | An idle agent acknowledges a normal click with a small wave | A short hand wave, about 800ms; existing inspector still opens | Extend current poke/pose system; no new gesture or dialogue channel | Small after AVO-203 pose foundation; recommended first |
| C4 | Open a small optional desk-toy tray and press a paper star | Star compresses and springs back once; one toy, no score or collection | On-demand tray inside existing Settings, not a new persistent toolbar button or world obstacle | Medium; optional second batch |
| C5 | Add a decorative sticker while previewing the existing daily postcard | Choose one existing pet/plant motif, preview it and optionally export locally | Extend postcard preview only | Medium; optional second batch |

No AVO IDs are allocated yet. C1-C5 are local option identifiers and are not commitments to ship all five.

## C1 — Plant Sway Concept

Use one existing plant instance as the initial trial. The pot, hit origin and collision footprint never move. Only a small leaf group rotates a few degrees and settles; repeated clicks replace the current effect rather than stacking more leaves/particles. There is no watering schedule, growth state, health meter, withering or guilt. The plant never implies a team mood.

Scope candidate: `TopDownFurniture.jsx` Plant, one local transient-state wrapper at its existing scene call site, and a focused interaction/cleanup test. First verify that its pointer target can be reached without covering an agent, overlay or another object. If the narrow-room target cannot be made usable without overlap, provide this interaction in the optional toy tray instead of expanding an invisible hit box across coworkers. Preserve the existing six-plant count and decoration-density rules.

## C2 — Pet Reaction Upgrade Concept

Keep the current click and heart. Add one species-appropriate, non-conclusive acknowledgement pose; do not add a feeding inventory, friendship score, treats, experience, passive rewards or a new pet mood. The real-signal base mode and position remain unchanged. A blocker/approval wait immediately cancels the cosmetic overlay; it cannot resurrect or cheer up a hidden pet.

Scope candidate: `OfficePet.jsx` and the existing pet sprite renderer. Keep the current motion grammar, signal precedence and count selectors. Static reduced-motion feedback can use a brief outline/heart change rather than motion. Do not create an extra wander or chase route: this proposal deliberately avoids more movement risk while AVO-202 is unresolved.

## C3 — Idle Wave Concept

Only an idle character can add the small wave to the current poke acknowledgement. A genuine working/planning/blocked/approval signal keeps the current state-appropriate interaction; it must not be replaced by a cheerful animation. A status transition during a wave cancels the wave immediately. Agent click still opens the inspector, keyboard activation remains equivalent, and a second click never creates duplicate event handlers or bubbles.

Scope candidate: the existing poke-to-render path and procedural pose helper planned in AVO-203. No position, facing target, work task, bubble pool or scheduler change. Implement after the pose foundation rather than adding a second independent arm-animation mechanism.

## C4 — Single Desk Toy Concept

Use a single paper-star toy in a compact, explicitly opened tray. Press/release performs one tactile compression; release always returns to its original shape. Escape/close/unmount stops the effect. No physics engine, simulated floor object, wandering actor, leaderboard, timing challenge, reward, unlock or randomized loot.

Use an existing paper/office visual language. Before implementation, create a small inspectable design with normal/pressed/released/reduced-motion and keyboard states. A mouse press, touch tap and Space/Enter must all work. The tray cannot cover the attention banner, agent inspector or core pause/settings controls; skip a screen placement that cannot meet that constraint.

## C5 — Postcard Sticker Concept

Extend the current local postcard flow with a small, explicitly decorative preview choice. The default card remains unchanged until a user chooses a sticker. A sticker never changes source-backed counts, day/weather labels, agent status or the generated caption. The preview must clearly distinguish decoration from actual office events. Reuse existing motifs where technically available; do not claim a new art asset exists.

Scope candidate: the daily-card preview/render path only, separate from scene movement/state. Keep export local; no automatic sharing, upload or permission request. The sticker must not cover the source-backed text. Persist only a deliberately selected cosmetic preference, if the owner chooses persistence; no behavioral tracking.

## Shared Interaction Rules and Acceptance

| Requirement | Acceptance evidence |
|---|---|
| Explicit initiation | No reaction fires from page age, random timers or passive presence; real user pointer/keyboard gesture triggers it |
| Pure presentation | Before/after task/status/position/target/workflow/event/counter snapshots are identical, except existing intentional inspector selection |
| Bounded lifetime | Typically <=1s for scene reactions; repeated clicks replace one effect; no unbounded nodes/timers/listeners |
| Honest precedence | Blocked/approval signals remain visible and preempt incompatible pet/agent reactions immediately |
| Quiet by default | Sound disabled until a separate explicit sound choice; no automatic playback on reload; no notifications |
| Accessible | Pointer and keyboard parity, visible focus, reduced-motion alternative, no hover-only or long-press-only control |
| Spatial safety | No new route, collision footprint, furniture, scene scale or label cap; pointer targets cannot intercept core controls |
| Optional and removable | Removing/disabling the module restores the same work visualization and stored agent state |
| Actual visual proof | Verify desktop/narrow mode, light/dark, repeated clicks and cancellation; owner sees the rendered interaction before acceptance |

Sound, if selected later, is a brief acknowledgement of the actual user action and stays separate from work-derived ambient sound. No background toy loop, fake coffee-work audio or misleading completion chime is introduced.

## Suggested Batches and Dependencies

1. Start with C1 and C2: visible charm with no new floor traffic or permanent controls. Trial one plant and one pet type before multiplying variants.
2. Add C3 after AVO-203 makes arm poses reusable and real-status precedence is pinned.
3. Choose C4 or C5 only if the owner wants an explicit little play surface or share-card decoration. Neither is needed for the first three.

Keep these optional candidates separate from the correctness/readability implementation sequence. They must not delay AVO-202 visitor repairs or weaken any AVO-204 verification gate. Existing AVO-199/201/200 plans and the approved manifest remain unchanged.

## Selection Gate

Suggested selection: C1+C2 first, C3 after the pose work, with C4/C5 left unselected until wanted. Owner selection is pending; no new individual feature spec, frozen design, backlog commitment or implementation was generated by this inventory.
