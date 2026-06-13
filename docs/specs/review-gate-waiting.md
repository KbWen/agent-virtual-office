---
title: AVO-107 Gate "waiting" in-tray (honest reframe of review-gate queue)
status: shipped
created: 2026-06-13
signal_tier: none
backlog: AVO-107
issue: 112
depends_on: AVO-105
---

# AVO-107 — Gate "waiting" in-tray

## Intent

Make "an agent is waiting on a human/approval" **physically legible at the Gatekeeper's desk** — the office-native home for approval-gating — so the scene shows *where* waiting work piles up, complementing AVO-105's handoff arrows (arrow = work arrives at the gate; this = work still waiting after it lands). Chill + ambient, honest, REDUCE-not-add.

This spec is the §4.4 DSoT. Design decided by a 4-lens office/management-sim game panel (office-sim · cozy · calm-tech honesty skeptic · multi-agent-studio), 2026-06-13, owner-selected the **honest reframe**.

## Honest reframe (why this is NOT a "review queue")

The only per-agent "waiting" signal AVO owns is `status === 'awaiting-approval'`, which `idleGapInfer.js` **infers** from `blocked` + no update for 90s (a heuristic "probably sitting at a human/permission prompt", NOT a confirmed "submitted for review" hook event). Therefore (panel-unanimous honesty guards):

- **No "queue / tickets / N jobs" framing** — that over-claims a review-submission semantic the signal doesn't prove.
- Copy = the EXISTING **"waiting on you"** string (`chat.teamBlocked`, en + zh-TW) — never "blocked", "in review", or "overdue".
- **Inferred-origin styling** (soft / hollow, not urgent red), consistent with the AVO-125 monitor-glow honesty precedent.
- **Per-agent type glyph is NOT honestly knowable** (no per-agent phase). At most ONE global phase glyph from `activeWorkflow` (review/ship), omitted when `activeWorkflow` is null. No per-ticket type.
- The value over the existing roster "waiting on you" text + AVO-110 badge is **spatial legibility at the gate** (the scene has no gate-waiting indicator today) — not a redundant counter.

## Scope

**IN:**
- A small in-scene **in-tray / paper-stack overlay** anchored at the Gatekeeper desk (`WAYPOINTS.gate = {x:100,y:80}`), offset so it never overlaps the sprite (pure overlay — R1: never relocates an agent).
- Driven SOLELY by the live count of agents with `status === 'awaiting-approval'`. Show iff count ≥ 1; **fully unmounted (not opacity:0) when count is 0**.
- Aggregate: up to **3** visual sheets regardless of N; the true N shown as a small count only when N > 1. Never one-marker-per-agent.
- Optional single global phase glyph (review/ship) derived from `activeWorkflow` via the existing `classifyWorkflow` (omitted when null).
- **Click / keyboard** the tray → reveal the exact waiting agents (name + "waiting ~Ns" + an "inferred" honesty tag) via a small popover (reuse ActivityFeed/inspector styling; no new chrome family).
- en + zh-TW; `role="button"` + `aria-label`; instant clear when an agent leaves `awaiting-approval`.

**Honesty / safety:**
- Render strictly from the live filtered set each tick — a status flip removes the sheet the SAME frame (no decay/lingering = no phantom queue).
- Pure derivation in a testable helper (count + glyph), no render-side fabrication.

**NON-GOALS:**
- No per-agent review/test/ship type lanes (fabrication — no per-agent phase).
- No queue/ticket/backlog metric language; no $/time aggregates.
- No new status; no new store flag; no movement of agents.
- Not driven by `activeWorkflow` membership or the `review-debate` social event (transient / not a waiting signal).

## Design (concrete)

- **Pure helper** `src/systems/reviewGate.js` (no React): `gateWaiting(agents, activeWorkflow)` → `{ count, names: [...], phaseGlyph: 'review'|'ship'|null }` where count = agents with `status==='awaiting-approval'`, phaseGlyph from `classifyWorkflow(activeWorkflow)` restricted to review/ship else null. Unit-tested.
- **Overlay** `GateWaitingTray` in `PixelOffice.jsx` (sibling to FlyingDocuments / EventJuice; pointer-events only on the tray hit-area): renders nothing when count 0; else a small wooden in-tray + up to 3 slightly-askew sheets + `×N` count when N>1 + optional phase glyph; soft/inferred tint. One-shot 150ms settle on appear; reduced-motion → instant/static. Anchored near {100,80} with a small offset clear of the gate sprite.
- **Reveal**: click/Enter opens a compact popover listing waiting agent names + "waiting ~Ns · inferred"; reuse existing popover/feed styling.
- **i18n**: reuse `chat.teamBlocked` ("Waiting on you" / "等待你"); add `aria.gateWaiting` + an "inferred" tag key in en + zh-TW.

## Acceptance Criteria

1. Tray appears only when ≥1 agent has `status==='awaiting-approval'`; fully absent (unmounted) at 0; clears instantly when the last waiter resolves.
2. N waiters aggregate into ≤3 sheets + a true count; never one-marker-per-agent; never covers the Gatekeeper sprite (pure overlay, no agent relocation — R1).
3. Copy is "waiting on you" (en + zh-TW); never "queue/blocked/review/overdue"; inferred-origin styling distinct from confirmed-signal chrome.
4. Per-agent type lanes/glyphs are NOT rendered; at most one global phase glyph from `activeWorkflow` (omitted when null).
5. Click/keyboard reveals exact waiting agents with an "inferred" tag; `role="button"` + `aria-label`; reduced-motion removes the settle animation (state still visible/static).
6. Pure `gateWaiting` helper unit-tested (count from awaiting-approval only; phaseGlyph review/ship/null; ignores non-waiting statuses + null workflow).
7. Full suite + build + render-smoke green; no new per-frame work when idle (0 waiters → no nodes).

## Risks & Rollback

- Risk — over-claim (inferred signal read as a hard review queue): mitigated by "waiting on you" copy, inferred styling, no per-type glyph, instant clear, inspector "inferred" tag.
- Risk — redundancy with roster/AVO-110: mitigated by being the SPATIAL gate indicator (no scene equivalent today) + reusing the same `awaiting-approval` set (no contradiction).
- Risk — clutter/guilt pile: cap 3 sheets, warm not red, invisible at rest, no loop.
- Rollback: additive overlay gated on a real status; revert the implement commit → no data/store migration.
