---
title: CSP compatibility — bundled weather keyframes
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [0cd0920]
primary_files: [src/index.css, src/components/PixelOffice.jsx, src/components/TopDownFurniture.jsx]
test_file: tests/weatherSystem.test.js
---

# CSP compatibility (#27)

## Problem

The #14 weather system injected `@keyframes weather-raindrop-fall` /
`weather-cloud-drift` / `weather-lightning-flash` via an inline
`<style>` tag inside `PixelOffice`. Strict corporate CSPs deny
`style-src 'self'` without `'unsafe-inline'`, which silently drops the
inline keyframes block and leaves rain/clouds/lightning frozen — the
office "weather" turns into static SVG geometry. Users on hardened
intranets reported it as a layout bug.

## Solution

Move the three `@keyframes` declarations from the runtime-injected
`WeatherKeyframes` React component into `src/index.css`, where Vite
bundles them into the production stylesheet that ships via
`<link rel="stylesheet">` — the path covered by `style-src 'self'`. The
inline `<style>` component is deleted; `TopDownFurniture` continues to
reference the same animation-name strings, so no markup-side change is
needed. Production JS now contains **zero `@keyframes` declarations**;
verified by grep on the built bundle. The CSS bundle grows ~0.3 KB raw.
README troubleshooting gained a CSP section recommending
`style-src 'self' 'unsafe-inline'` for general compatibility and
documenting the advanced nonce-based path for the strictest environments.

## Files

- `src/index.css` — three `@keyframes` blocks with a comment explaining
  the CSP rationale and photosensitivity caps.
- `src/components/PixelOffice.jsx` — removed the `WeatherKeyframes`
  component and its single-shot inline `<style>` mount.
- `src/components/TopDownFurniture.jsx` — minor adjustments to keep
  animation references consistent post-move.
- `README.md` — Troubleshooting CSP subsection.
- Tests: existing `tests/weatherSystem.test.js` continues to cover the
  mapping and overlay — the move is structurally invisible to JS.

## Key decisions

- **Bundled CSS, not nonce injection**: a nonce path would solve it but
  requires server-side coordination per deploy. Static bundling works
  for every host (S3, Nginx, Vite dev) with no infra changes.
- **Delete the inline component entirely**: keeping it as a fallback
  would double-define keyframes and risk CSP violation under the very
  policies we are trying to support.
- **Comment the photosensitivity caps in CSS too**: the constraints
  (lightning ≤0.35 opacity, <3 Hz flash) belong with the keyframes, not
  only in the spec — future edits to the CSS see the rule inline.
- **README guidance, not auto-detection**: detecting CSP from JS is
  unreliable; document the recommendation and let admins choose.

## Acceptance criteria (Done)

- [x] Production JS bundle contains zero `@keyframes`
- [x] Weather animations render under `style-src 'self'` (no
      `'unsafe-inline'`)
- [x] No visual regression vs. pre-move build
- [x] Lightning still capped 0.35 / <3 Hz
- [x] README Troubleshooting documents CSP guidance

## Rollback

`git revert 0cd0920` — restores the inline `<style>` and re-introduces
the CSP violation under strict policies. Visual behavior is identical
on permissive CSPs. Blast radius: weather rendering only.

## References

- Commit: `0cd0920 feat(#27): move weather keyframes to bundled CSS for
  strict CSP compatibility`
- CHANGELOG v1.1.0 → "#27 CSP compatibility"
- Backlog row: `_shipped-log.md` #27
- Related: [[weather-system]] (the #14 feature whose keyframes moved)
