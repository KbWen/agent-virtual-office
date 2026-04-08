---
status: shipped
title: Agent Inspector Info Enhancement
source: external
source_doc: docs/specs/_product-backlog.md#5
created: 2026-04-08
primary_domain: none
secondary_domains: []
---

# Agent Inspector Info Enhancement

## Goal

Improve the selected-agent inspector so it exposes the most useful live context already available in the office state: today's completion count, current team mood, and the active workflow name. This should help a user understand "what this agent has done today" and "what the room is currently optimizing for" without leaving the inspector.

## Acceptance Criteria

1. When an agent is selected, the inspector shows a "today done" value for that selected agent.
2. When an agent is selected, the inspector shows the current mood indicator.
3. When an agent is selected, the inspector shows the current `activeWorkflow` name when one exists.
4. The new inspector rows reuse existing office state instead of introducing a new backend endpoint or a new persisted storage contract.
5. The "today done" value is derived from same-day completion activity already known to the client, scoped to the selected agent rather than the whole team.
6. If mood or active workflow is unavailable, the inspector degrades gracefully by hiding that row or showing a safe fallback label rather than rendering broken text.
7. Existing inspector content remains intact: status badge, current behavior, external task label, and recent activities still render as before.

## Non-goals

- Do not add the wall-mounted workflow banner feature from backlog item #9.
- Do not add the sprint progress board from backlog item #4.
- Do not change office event generation, webhook payload shape, or the persistence format of the store.
- Do not redesign the inspector into a larger panel or a separate screen.

## Constraints

- The implementation should build on `AgentInspector.jsx`, which already reads `ext` and `activityLog`.
- The implementation must stay compatible with the existing UI/state contract described in `docs/specs/engineering-audit-remediation.md`, especially the agent status, mood, and activity surfaces.
- The inspector must remain clamped to the current SVG viewport and should grow only enough to fit the extra rows.
- Labels should be localizable through the existing i18n layer or have a clear fallback path if a translation key is not added yet.

## API / Data Contract

- Read-only client state inputs:
  - `activityLog` for recent activity and completion history
  - `mood` for the current team-wide mood
  - `activeWorkflow` for the currently broadcast workflow name
- No new external API or webhook field is required for this feature.
- If a helper is introduced for the "today done" count, it should remain an internal UI derivation over existing client state.

## File Relationship

INDEPENDENT
