---
title: Desktop notifications for sustained-blocked agents
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [2f7d693]
primary_files: [src/inference/desktopNotifier.js, src/components/ControlPanel.jsx, src/components/PixelOffice.jsx]
test_file: tests/desktopNotifier.test.js
---

# Desktop notifications (#8)

## Problem

`blocked` is the single status worth interrupting the user for — it means
an agent is stuck on a permission prompt or an external dependency. But
the office tab is usually buried behind editors and terminals, so the
status bar chip is invisible exactly when it matters. The team needs an
OS-level nudge that respects browser permission gates and does not spam
when the user is already watching.

## Solution

`startDesktopNotifier(store)` runs a 5s polling loop. Each tick walks
`store.getState().agents`, stamps a per-agent `blockedSince` timestamp
when an agent first enters `blocked`, and clears it on transition out.
When an agent has been blocked ≥30s AND `document.hidden` is true AND
`Notification.permission === 'granted'`, the loop fires one Notification
with `tag: office-blocked-<agentId>` so the OS collapses repeats.
Per-episode dedupe is keyed by the `blockedSince` timestamp itself — a
`blocked → working → blocked` cycle counts as two episodes. Permission
is requested via a separate `requestNotificationPermission()` exposed on
ControlPanel's 🔔 button so the browser sees a user gesture; auto-call
on mount would auto-reject in Chrome/Firefox/Safari.

## Files

- `src/inference/desktopNotifier.js` — module-scope dedupe maps,
  `tick()`, `startDesktopNotifier()`, `requestNotificationPermission()`,
  `_resetDesktopNotifierState()` test helper.
- `src/components/PixelOffice.jsx` — `useEffect` starts the notifier and
  returns the stop function for cleanup on unmount.
- `src/components/ControlPanel.jsx` — 🔔 button wired to permission
  request, label + sr-only mirror via `notify.*` i18n keys.
- `src/locales/{en,zh-TW}.json` — `notify.blockedTitle`,
  `notify.blockedBody` with `{0}` agent-name placeholder.
- `tests/desktopNotifier.test.js` — episode dedupe, transition-out
  reset, permission/visibility short-circuits, jsdom safety.

## Key decisions

- **5s poll, not subscribe**: status transitions are bursty; a coarse
  poll smooths CPU and aligns with the 30s threshold's granularity.
- **Per-episode dedupe via `blockedSince` timestamp**: simpler than
  tracking notification IDs; a re-block naturally gets a new timestamp.
- **User-gesture permission request**: modern browsers reject
  auto-prompts. ControlPanel's button is the only entry point.
- **`document.hidden` gate**: no notifications while the office is the
  active tab — the chip is already visible.
- **jsdom + SSR safety**: every `Notification` / `window` / `document`
  access is `typeof`-guarded; the module becomes a no-op when missing.

## Acceptance criteria (Done)

- [x] Notification fires exactly once per blocked episode
- [x] No fire when tab is visible
- [x] No fire when permission is `default` or `denied`
- [x] Tag-collapse prevents stacked OS notifications per agent
- [x] Stop function clears the interval cleanly on unmount
- [x] i18n + sr-only parity with the rest of ControlPanel

## Rollback

`git revert 2f7d693` — removes the notifier module, the 🔔 button, the
PixelOffice subscription, and the i18n keys. Blast radius: ControlPanel
header layout (one button removed), no behavior change elsewhere.

## References

- Commit: `2f7d693 feat(#8): desktop notifications for sustained-blocked agents`
- CHANGELOG v1.1.0 → "#8 桌面通知 (desktop notifications)"
- Backlog row: `_shipped-log.md` #8
- Related: [[idle-gap-inference]] (sister inference module, shares
  PixelOffice useEffect pattern)
