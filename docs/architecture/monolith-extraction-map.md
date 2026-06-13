---
status: living
title: Monolith Extraction Map
created: 2026-06-11
source_issue: 121
---

# Monolith Extraction Map

This is a refactor guard, not a refactor request. The current large files are stable and well-tested; extract only when adjacent product work already needs the seam.

## Rules

- Do not change runtime behavior in the first extraction PR for a seam.
- Move pure helpers before moving React stateful logic.
- Add or extend tests before moving code, then verify before and after the move.
- Keep rollback simple: a seam extraction must be revertible as one commit.

## Candidate Seams

| File | First safe seam | Test guard | Rollback |
|---|---|---|---|
| `src/components/AgentCharacter.jsx` | behavior-watchdog and visual-state pure helpers | `tests/behaviorWatchdog.test.js`, `tests/walkFrame.test.js`, focused AgentCharacter SSR tests | Move helper back into component, no data migration |
| `src/components/PixelOffice.jsx` | static scene constants and decorative furniture groups | `npm run smoke` viewport matrix, `tests/officeViewBox.test.js`, screenshot/manual visual check | Inline the extracted scene module |
| `src/systems/store.js` | persistence/localStorage helpers and ledger day-reset helpers | `tests/storePersistence.test.js`, `tests/storeBlockedLedger.test.js`, `tests/store.test.js` | Restore helper functions in store file |
| `public/hooks/office-status-hook.js` | parser/role routing helpers and bounded write helpers | `tests/hookRuntimeContract.test.js`, `tests/officeStatusHook.test.js`, `tests/hookWriteLock.test.js` | Re-inline helper module; keep emitted payload byte-equivalent |
| `src/inference/inferStatus.js` | message-source adapters (`BroadcastChannel`, globals, file polling) | `tests/inferStatusPolling.test.js`, `tests/applyExternalStatusIdentity.test.js`, transport E2E | Re-inline adapter functions |
| `src/systems/officeLife.js` | pure event eligibility and participant selection helpers | `tests/officeLife.test.js`, `tests/eventHonestyGate.test.js`, `tests/gatherTargetsOnFloor.test.js` | Re-inline pure helpers |

## Required Review Questions

- Did this extraction cross a rendering, movement, or external-status boundary?
- Does the diff preserve the same exported contract and payload fields?
- Did the test run include both the seam-specific test and one live render/status smoke?
- Can the extraction be reverted without touching data files or user settings?

## Deferred

Do not split movement or per-frame render loops just to reduce line count. Those areas need owner-visible evidence and geometry tests before structural changes.
