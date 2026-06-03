---
status: frozen
title: Subagent Helper Huddle
source: external
source_doc: design roundtable (werpkchie) + owner requirements
created: 2026-06-03
primary_domain: none
secondary_domains: []
---

# Subagent Helper Huddle

When a role-character dispatches subagents (Task tool), show **ephemeral helper sprites clustered at
that role's desk**, distinct from worktree clones (which are full-size peers in the entrance hallway).
Answers the owner's "I dispatched N agents, show me N people" mental model — with a cozy office body,
not a dashboard number.

## Goal
Make in-session subagent fan-out visible & charming, gracefully handling HIGH volume (Claude can fire
10+ subagents instantly), with NO character overlap, and a glance-readable "heavy load" cue.

## Acceptance Criteria
1. **Separate path** — helpers live in a dedicated store `helpers` slice, NOT the `agents` map. They do
   NOT flow through the worktree dynamic-agent eviction/overflow placement, and do NOT carry a name tag,
   status ring, bubble, or session badge (regression guard against AVO-128 / overflow).
2. **Desk-anchored placement** — up to **N=3** visible helper sprites at small fixed offsets around the
   PARENT role's HOME_POSITIONS anchor, **clamped toward the role's open side** so they never overlap an
   adjacent desk or the parent sprite. Reuse the lightweight planner/worker/checker sprites at ~0.7 scale.
3. **High-volume (10+) → no pile-up** — visible count HARD-CAPPED at 3; the remainder collapses to a
   single faint **"+N"** glyph. Spawning 12 helpers renders 3 sprites + "+9", never 12 bodies, never overlap.
4. **Heavy-load cue (#2)** — when a role has ≥ HEAVY_HELPER_THRESHOLD (e.g. 4) active helpers, the PARENT
   shows a subtle "swamped" indicator (small 💦 / stacked-task glyph) so "this agent is slammed" reads at
   a glance, distinct from ordinary working.
5. **Ephemeral + self-heal** — a helper is added on SubagentStart, removed on SubagentStop, and a TTL
   safety expiry (mirroring the working-window) despawns a helper whose Stop was missed, so the desk
   never accumulates stale helpers.
6. **No overlap, ever (#4)** — helpers clamp to the open side + cap at 3; two adjacent roles both
   huddling must not collide (offset away from each other). Worktree clones stay in the hallway as-is.

## Non-goals
- Pixel-level taste (fade/scale/fan-out timing, exact +N styling, cozy-vs-cramped) → human visual session.
- A structural DAG/minimap view of the subagent tree (that is AVO-118, separate).

## Constraints
- Reuse existing lightweight sprites — zero new art.
- MUST NOT regress the hook→status→render pipeline, worktree clones, or AVO-128 name reveal.
- Headless verification: structural/DOM + unit tests + store-driven render checks (real subagent hook
  events can't be live-tested this session due to Claude Code in-session hook caching).

## Data Contract
Status payload gains `helpers: [{ id: 'role#hash', parentRole: <role>, label: <agentType>, ts: <seq> }]`.
Hook SubagentStart appends; SubagentStop filters by id; Stop clears all. Server passes `helpers` through
(like mood/tokens/effort). Store ingests into a `helpers` slice keyed by id with an `expiresAt`.

## File Relationship
INDEPENDENT (new slice + component; reuses overflow-free placement)

## Affected Files
- public/hooks/office-status-hook.js — emit/remove helper records (SubagentStart/Stop/Stop)
- src/server/scanSessions.mjs + vite.config.js + server.mjs — pass `helpers` through the merge
- src/inference/inferStatus.js (or store) — ingest `helpers` into the store slice
- src/systems/store.js — `helpers` slice + add/remove/TTL actions
- src/systems/movementSystem.js — HELPER_OFFSETS (per-role open-side anchors)
- src/components/ (new) HelperHuddle.jsx + wire into PixelOffice/AgentCharacter — capped render + heavy cue
- tests — hook emission, store slice/TTL, placement cap/+N/no-overlap, no name/ring/bubble
