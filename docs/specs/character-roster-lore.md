---
status: shipped
title: Character Roster Lore & Interconnected Storylines
feature: character-roster-lore
created: 2026-10-02
last_updated: 2026-10-02
primary_domain: ui-rendering
secondary_domains: [game-feel]
adr: docs/adr/ADR-007-dialogue-channel-separation-and-honesty-gate.md
signal_tier: T1
---

# Character Roster Lore & Interconnected Storylines

> Design authority: this document + `docs/CHARACTER_LORE.md` + **ADR-007**.
> Complements `docs/specs/dialogue-interaction-layer.md`.

## Goal

Provide a comprehensive, emotionally resonant, and verifiable lore foundation for all 8 agent roles in the Agent Virtual Office (PM, Arch, Dev, QA, Ops, Res, Gate, Designer).
Enhance user immersion and emotional connection ("生活感") by revealing that individual agent dialogue bubbles and gossip lines weave together into 4 interconnected office narrative arcs.

## Scope & Deliverables

1. `docs/CHARACTER_LORE.md`:
   - 8 in-depth character profiles (life philosophies, hobbies, unique desk objects, habits, quirks).
   - 4 interconnected narrative threads:
     - The Breakroom Emergency Ration Mystery (PM x Ops x QA x Dev).
     - The Midnight Whiteboard Galaxy & Topology (Res x Arch).
     - The Rubber Duck & Bonsai Pruning Zen (Dev x QA x Gate).
     - The Film Darkroom Pixel Golden Ratio (Designer x Dev x Gate).
   - Dialogue Mosaic Table mapping corresponding dialogue lines to shared life moments.
2. `scripts/capture-office-lore-preview.mjs` & `docs/assets/office-lore-preview.png`:
   - Automated, reproducible Playwright screenshot harness capturing the office layout, desks, and lively characters.

## Acceptance Criteria

- **AC-1**: 100% alignment with `src/config/characters.json` role definitions and traits.
- **AC-2**: 100% alignment with `src/locales/zh-TW.json` and `src/locales/en.json` dialogue pools.
- **AC-3 (ADR-007)**: Strict adherence to voice-only bubble separation (no false completion status).
- **AC-4**: High-resolution, unoccluded visual preview asset generated in `docs/assets/office-lore-preview.png`.

## Domain Decisions

- [DECISION] Lore and dialogue connections are purely interpretive and ambient; no persistent relationship memory is introduced into runtime state (ADR-007 D1/D2 compliance).
- [DECISION] Screenshot harness runs headlessly using production server build and is safely reproducible without leaving dangling processes.
