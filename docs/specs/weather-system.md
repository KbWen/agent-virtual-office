---
title: Weather system
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [678e7e0, 6a171d6, 16754b3, 0cd0920]
primary_files: [src/components/TopDownFurniture.jsx, src/components/PixelOffice.jsx, src/index.css]
test_file: tests/weatherSystem.test.js
---

# Weather system (#14, closes #15)

## Problem

Window panes were static decoration regardless of team state. With the
mood engine already classifying team-wide feeling (smooth / rushing /
frustrated / stuck / intense / normal / idle), the ambient setting could
mirror it without adding new signal load. Separately, #15 白板手寫動畫 was
listed Pending in backlog but `WhiteboardAnimation` at
`PixelOffice.jsx:146` already implemented it (eureka → 3000ms
stroke-dashoffset animation) — needed closure documentation.

## Solution

Pure `moodToWeather(mood)` mapping in `TopDownFurniture.jsx`:
`stuck → thunderstorm`, `frustrated → rain`, `rushing → cloudy`, all
others → `clear`. `WeatherOverlay` renders inside each `WallWindow`
under the cross muntins, clipped to the pane via a per-instance
`clipPath` (id keyed by `x-y` so 12 windows don't share masks). Rain is
5 `<line>` drops with staggered delay; clouds are 2 drifting ellipses;
thunderstorm overlays a single rect flashing at capped 0.35 opacity
twice per 5s cycle — well below 3 Hz photosensitivity threshold.
`reducedMotion` renders the same DOM but drops every `animation` style
prop. PixelOffice subscribes `mood` (primitive enum, no `useShallow`)
once and passes the resolved weather to all WallWindow call-sites; the
React.memo prop comparison still gates re-renders because weather is a
string.

#15 closure: confirmed pre-existing — same pattern as #7 closure.

## Files

- `src/components/TopDownFurniture.jsx` — `moodToWeather()`, `WeatherOverlay`,
  WallWindow weather/reducedMotion props.
- `src/components/PixelOffice.jsx` — mood + reducedMotion subscriptions,
  `WeatherKeyframes` component (later moved to CSS in #27).
- `src/index.css` — `@keyframes weather-raindrop-fall` / `weather-cloud-drift`
  / `weather-lightning-flash` (moved from inline `<style>` in 0cd0920 for
  strict CSP compatibility).
- `tests/weatherSystem.test.js` + `tests/weatherDriveChain.test.js` +
  `tests/weatherRealWorld.test.js` — mood mapping, full hook→mood→weather
  drive chain, raindrop daytime visibility regressions.

## Key decisions

- **Pure mapping function**: `moodToWeather` is testable in isolation and
  defaults to `clear` for unrecognized inputs — backward-compat with
  WallWindow callers that don't pass weather is automatic.
- **Photosensitivity cap**: lightning opacity 0.35, twice-per-5s — design
  brief explicitly traded "more dramatic storm" for seizure safety.
- **Keyframes in bundled CSS (#27)**: original inline `<style>` violated
  strict `style-src 'self'` CSP. 0cd0920 moved them to `src/index.css` so
  production JS contains zero `@keyframes`; CSS bundle +0.3 KB.
- **#15 closure pattern**: same as #7 (clickable objects) — mark Done with
  evidence pointer to the pre-existing implementation, no new code.

## Acceptance criteria (Done)

- [x] All 7 mood enum values map deterministically
- [x] reducedMotion drops all `animation` props
- [x] Lightning capped at 0.35 opacity / <3 Hz
- [x] CSP-safe (zero `@keyframes` in production JS)
- [x] #15 closure-documented in backlog and CHANGELOG

## Rollback

`git revert 0cd0920 16754b3 6a171d6 678e7e0` — removes WeatherOverlay,
mapping, CSS keyframes, all tests. WallWindow falls back to its
pre-weather signature (props ignored, no visual change). Blast radius:
all 12 window instances + mood subscription in PixelOffice.

## References

- Commits: `678e7e0 feat(#14)`, `6a171d6 test`, `16754b3 fix raindrop`,
  `0cd0920 feat(#27) CSP`
- CHANGELOG v1.1.0 → "#14 天氣系統", "#27 CSP compatibility"
- Backlog rows: `_shipped-log.md` #14, #15, #27
- Related: [[classifier-foundation]] (mood vocabulary parity)
