---
title: AVO-189 Reachable RAF Watchdog Diagnostic
status: frozen
classification: quick-win
primary_domain: ci-infra
---

# AVO-189 Reachable RAF Watchdog Diagnostic

## Problem

The lost-chain counter reaches 1 immediately before diagnostic evaluation, while every delivered frame resets it to 0. Requiring 2 makes the existing counter and dev warning structurally unreachable for recovered chains.

## Contract

- A focused restart with no pending RAF handle is recorded on its first reachable lost-chain count.
- Pending frames remain excluded because they represent host throttling, not a proven lost chain.
- Unfocused documents remain excluded to avoid background noise.
- RAF timing, restart behavior, frame delivery, and reset semantics remain unchanged.

## Acceptance Criteria

1. Count 0 remains false.
2. Count 1 is true only when there is no pending frame and the document is focused.
3. Pending and unfocused cases remain false at higher counts.
4. The focused assertion fails on the pre-fix `>= 2` baseline.

## Domain Decisions

- [DECISION] Record the first proven focused lost-chain restart; do not redesign the counter or widen the diagnostic beyond existing noise guards.

## Non-goals

- No watchdog interval, RAF restart, console message, UI diagnostic, or counter-reset redesign.
