---
status: shipped
title: Clickable Office Objects
source: external
source_doc: docs/specs/_product-backlog.md#7
created: 2026-05-16
primary_domain: none
secondary_domains: []
---

# Clickable Office Objects

## Goal

Three office objects are user-clickable to trigger immediate office life events: coffee machine → agents walk to lounge, whiteboard → eureka moment, red deploy button → deploy celebration.

## Discovery Note

All three clickable objects were fully implemented in commit `5b79616` (v0.10 office vitality) **before** this spec was written. This document serves as a closure record — no new code is required.

## Implemented State (verified 2026-05-16)

| Object | Location in PixelOffice.jsx | Event triggered | Visual affordance |
|--------|----------------------------|-----------------|-------------------|
| Coffee machine | line 825–827 | `tea-break` — 2-3 agents walk to lounge area and chat | `cursor: pointer` |
| Whiteboard | line 795–797 | `eureka` — arch agent walks to whiteboard with surprise expression | `cursor: pointer` |
| Red deploy button | line 386 (inside `PersonalDesk` ops branch) | `deploy-success` — ops presses button, others react | `cursor: pointer` |

## Event Semantics

- **`tea-break`** (officeLife.js:56): picks 2-3 available agents, sends them to coffee area spots `{x:80,y:475}`, `{x:110,y:485}`, `{x:140,y:470}` with `drink-coffee` / `chat` behavior.
- **`eureka`** (officeLife.js:143): targets `arch` specifically, sends to `WAYPOINTS.whiteboard` with `whiteboard` behavior + surprised expression.
- **`deploy-success`** (officeLife.js:187): targets `ops` with `deploy-button` behavior; other agents react with celebration after delay.

## Mechanism

All three use `triggerInteractiveEvent(useOfficeStore, eventId)` defined in `PixelOffice.jsx`, which calls `officeLife.handleInteractiveEvent(store, eventId)` with debounce protection.

## Non-goals

- No new events or behaviors — existing events cover the backlog requirement.
- No keyboard / ARIA changes beyond what shipped in v0.9 (#32).

## File Relationship

INDEPENDENT
