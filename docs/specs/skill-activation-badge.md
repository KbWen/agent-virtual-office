---
title: AVO-104 Skill Activation Badge (transient skill bubble — honest version)
status: shipped
created: 2026-06-13
signal_tier: none
backlog: AVO-104
issue: 30
depends_on: AVO-131
---

# AVO-104 — Skill Activation Badge

## Intent

Make Claude *skill* activation visible per-agent so the office shows **which agent is running which skill** (/review, /plan, /implement, /test, /ship, /research). Today skill phase is surfaced only *globally* (the `activeWorkflow` green scene banner + the AgentInspector "Workflow" row); you can't tell at a glance that *this* agent just entered /review. This is honest status-visibility — the product's #1 value.

This spec is the §4.4 Design Source of Truth (procedural UI; no Figma artifact). Design authored by a 4-lens game-design panel (cozy/life-sim · systemic/immersive-sim · game-feel/juice · calm-tech/HCI), run 2026-06-13. Owner-selected **Option B (honest version)**.

## Panel decision (why Option B)

Three placement options were weighed: (A) new transient over-head badge, (B) route through the existing transient speech-bubble system, (C) inspector-only. Votes: 2×B, 1×A, 1×C. Convergent, non-vote findings (all four lenses agreed):

1. **Honesty:** `SubagentStart` is an instantaneous EVENT, not a duration. A persisting badge that implies "skill still active" would be a 2nd status channel that can contradict the canonical status ring. The honest representation is a *transient event* that announces the skill once and then expires.
2. **No new over-head element:** AVO-131 deliberately removed the persistent above-head tool pill; the codebase also removed a redundant corner status glyph. Adding a 4th independently-timed over-head channel reverses that. Reuse the existing system.
3. **Skill = phase axis, strictly below status:** it must yield to blocked/done and MUST NEVER suppress the AVO-110 over-head blocked-reason glyph.
4. The durable record stays in the inspector / `activeWorkflow`; the bubble is only the transient "living office chatter" moment.

**Chosen:** Option B — on `SubagentStart`, the agent emits a short skill speech-bubble ("🧐 Reviewing") through the existing bubble channel, governed by the existing concurrency cap, priority, rotation, and reduced-motion handling.

## Scope

**IN:**
1. **Honest `skill` signal across the trust boundary.** The hook (`office-status-hook.js` + dist mirror) stamps an explicit, optional `skill: <agentType>` (raw skill name) on the agent status object at `SubagentStart`. `inferStatus.js` passes it through, capped/sanitized exactly like `task`/`workflow` (untrusted input). It reaches `externalStatus[id].skill` and the per-agent `update` object in `applyExternalStatus`.
2. **Client-side skill bubble.** `generateContextBubble` gains a skill branch: when `update.skill` is present (and status is working, i.e. an activation), return a localized skill bubble via a new pure `skillBubbleText(skill, t)` helper + i18n map (icon + 1-word label) mirroring the hook's `skillLabel`. The bubble then competes for a slot in `selectVisibleBubbles` at `working` priority (tier 2) and auto-expires on the existing bubble timer.
3. **i18n** (`en.json` + `zh-TW.json`): a `skillBubbles` map keyed by normalized skill family (plan/spec/review/test/implement/ship/research/architect/security + generic fallback), matching the hook's existing emoji+label vocabulary.
4. **Tests** for `skillBubbleText` (mapping + fallback) and the `generateContextBubble` skill branch (fires on working+skill; does NOT fire/override on blocked/done; honest gating).

**KEEP / OUT (non-goals):**
- No new over-head SVG element; no change to the AVO-110 blocked-reason glyph, status ring, name pill, or `BUBBLE_VISIBLE_CAP`/priority constants.
- Skill bubble MUST NOT raise priority above `working`; blocked/done always outrank it (cap honesty preserved).
- No persistence: a skill bubble is one transient message per activation; a new skill replaces the agent's prior bubble (no stacking, no queue).
- The global `activeWorkflow` banner + inspector row are unchanged (they remain the durable record).
- No new store flag; `skill` is optional → absent = byte-identical prior behavior.

## Design (concrete)

### Trust-boundary field
- Hook `SubagentStart`: status object already sets `task=agentType`, `label=skillLabel(...)`, `workflowOverride=agentType`. ADD `skill: agentType`. `SubagentStop`/`Stop` paths leave `skill` unset (the activation is the event; expiry is handled by the bubble timer, not by a persisted skill state).
- `inferStatus.js`: where per-agent fields are projected (alongside `task`/`workflow`), add `skill: capStr(raw.skill)`. Capping bounds untrusted length, consistent with the existing capped fields.
- `store.applyExternalStatus`: ensure `skill` is included in the `ext[id]` object and in the `u`/`update` passed to `generateContextBubble` (the update already carries status/task/label/hint).

### Bubble text (client i18n, locale-correct)
- New pure helper `skillBubbleText(skill, t)` in `contextBubble.js`: normalize the raw skill name to a family via a small regex map (same buckets as the hook's `skillLabel`: `/plan/`, `/spec|bootstrap/`, `/review/`, `/test/`, `/implement|code/`, `/fix|debug/`, `/ship|deploy/`, `/research|explore/`, `/architect|design/`, `/security|audit/`), look up `t('skillBubbles.<family>')`, fallback `t('skillBubbles.generic')` with the raw name. Icon is part of the i18n string (📊🧐🧪⌨️🚀🛡️🔬🏗️🔧💼), so it stays in the text channel (a11y: the bubble is real text, not an icon-only SVG).
- `generateContextBubble`: insert the skill branch AFTER the error/blocked + done branches and BEFORE the role×action branch, gated on `skill && status !== 'blocked' && status !== 'done'`. So a real block/done update never gets a skill bubble (honesty: skill is a working-phase announcement only).

### Reuse (no new mechanics)
- Concurrency/priority/rotation: entirely via existing `selectVisibleBubbles` (status `working` → tier 2). Expiry: existing `clearBubble` scheduled timer. Reduced-motion: the bubble renders via the existing `BehaviorBubble` path, which already honors reduced-motion — no new animation added.

## Acceptance Criteria

1. On a real `SubagentStart` for an agent, that agent shows a localized skill bubble (e.g. en "🧐 Reviewing" / zh-TW "🧐 Review 中") sourced from the i18n `skillBubbles` map.
2. The skill bubble competes at `working` priority — a concurrently blocked/done agent's bubble always outranks it; with >`BUBBLE_VISIBLE_CAP` skills firing, only the cap shows, surplus handled by existing rotation (no stacking/new clock).
3. The skill bubble does NOT render for a `blocked` or `done` update, and does NOT suppress or alter the AVO-110 over-head blocked-reason glyph, the status ring, or the name pill.
4. `skill` is sanitized/capped at the `inferStatus` trust boundary (untrusted-length input bounded).
5. With no `skill` field present, behavior is byte-identical to before (additive/optional).
6. `skillBubbleText` unit tests pin family mapping (each bucket) + generic fallback; `generateContextBubble` tests pin the working-skill-fires / blocked-done-does-not gating.
7. Locale-correct: switching language re-derives the bubble text on the client (not the hook-time language).
8. Full suite green; vite build clean; render-smoke PASS; hook public/ + dist/ mirrors updated in sync.

## Risks & Rollback

- Risk — dishonest persistence: mitigated by working-tier priority + auto-expire + no over-head element; the bubble is an event, the inspector/activeWorkflow is the state.
- Risk — trust boundary: `skill` capped/sanitized in `inferStatus` like `task`/`workflow`.
- Risk — dist/public hook drift: both mirrors edited + a grep check that they match for the skill field.
- Rollback: revert the implement commit; `skill` optional → its absence restores prior behavior with no migration.
