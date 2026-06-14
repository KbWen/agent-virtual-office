---
title: AVO-115 Shareable end-of-day office card (cozy postcard)
status: draft
created: 2026-06-14
signal_tier: none
backlog: AVO-115
issue: 31
primary_domain: ui-rendering
secondary_domains: [office-runtime]
depends_on: none
---

# AVO-115 — Shareable end-of-day office card

## Intent

Give people a one-click, screenshot-worthy artifact they actually *want* to share
(Reddit / chat / socials) — a small **cozy pixel-art postcard (明信片)** of today's
office. The whole point is charm and want-to-share, NOT reporting. It reuses the
office's existing pixel art and the daily ledgers that already exist; rendering is
100% client-side (canvas → PNG), opt-in, and local-only (no upload).

This spec is the §4.4 Design Source of Truth — the layout is code-defined here
(see **## Card Layout (DSoT wireframe)**).

## Hard aesthetic guardrail (owner steer, non-negotiable)

The card MUST read as a **cozy / cute / chill postcard with lots of breathing room**.
It MUST NOT look like:
- a game **power-level chart (戰力圖)**,
- a **sports-player stats card**,
- a **metrics dashboard**.

Therefore: **NO number grids, NO bars, NO gauges, NO rankings, NO per-agent score
table.** The day's **weather/mood is the dominant visual**; at most **1–2 gentle
numbers** woven into prose, never a stat block. This is the same anti-pattern that
got AVO-120 (leaderboard) panel-closed — do not reintroduce it through the card.

## Scope

**IN:**
- A new opt-in **Share** action (in the ⚙ settings menu / an opt-in surface — NOT the
  default glance layer, NOT the resting control bar).
- A pure render function that draws the postcard to an offscreen/standard
  `HTMLCanvasElement` (or `OffscreenCanvas` when available) and exports a PNG.
- **Download** the PNG; additionally use **Web Share API** / clipboard image write
  **only when available** (feature-detected, graceful fallback to download).
- en + zh-TW copy for every string on the card and the Share control.
- Honest **empty/slow-day** rendering (a quiet cozy card, never fabricated activity).
- A cozy **highlight caption** DERIVED from honest signals we already own (done count
  + mood/weather), e.g. "A smooth day — wrapped up 7 things ☀️" / "A heads-down day".
  NO event counting (see honesty note below).

> **Honesty note (why no event tally):** the only frontend `eureka`/`deploy-success`
> signals are office *theater* (officeLife.js, probabilistically fired) and *demo
> clicks* (whiteboard / deploy-button in PixelOffice). Real CI `deploy-success` arrives
> via `/api/event` → `applyExternalStatus` as an agent *status* change and never becomes
> an `activeEvent`. So counting `activeEvent` events would fabricate activity — the same
> anti-pattern that closed AVO-120. v1 therefore derives the highlight from the honest
> done/mood signals instead of counting events. (Owner decision 2026-06-14, Option C.)

**Data sources (reuse, no new counters):**
- `dailyDoneLedger.counts` → today's total done (summed) — the one gentle number.
- `dailyBlockedLedger.counts` → today's blocked total — shown gently and ONLY if > 0,
  framed honestly (e.g. "weathered N snags"), never as a "loss"/red score.
- `mood` (live, store.js:1229) → `moodToWeather()` → the hero sky/weather of the card.
- Highlight caption is a pure function of (doneTotal, mood); omitted/quiet on an empty day.

**Persistence + surface:**
- No new persisted state — the card reads existing ledgers + live `mood` at render time.
- Share control lives in the ⚙ menu (like pet-skin / theme pickers), labelled in
  en + zh-TW, keyboard-reachable.

**DROPPED / deferred (with rationale):**
- `dailyEventLedger` / event counting — dropped (honesty: the only available signal is
  theater + demo clicks, not real agent work). Highlight is derived from done+mood.
- Per-agent breakdown / MVP table — violates the aesthetic guardrail (stats card). The
  only salvaged kernel is the single derived highlight line.
- Remote upload / hosted share links — out of scope; local-only by design.
- Animated/GIF card — v1 is a still PNG; revisit only if there is real demand.
- Composed multi-panel "story" cards — v1 is one postcard.

## Card Layout (DSoT wireframe)

One portrait-ish postcard, generous margins, 3 calm zones. Target ~1080×1350 (or a
2× pixel-art-friendly size); exact px set in /plan.

```
┌───────────────────────────────────────────┐
│                                             │  ← top margin (breathing room)
│        ☀️  weather/mood HERO sky            │  ZONE 1 (dominant): the day's
│      (soft pixel gradient + 1 weather)      │  weather as a calm pixel sky;
│                                             │  small mood word, e.g. "smooth"
│   ┌─────────────────────────────────┐       │
│   │  tiny pixel-office snapshot strip │      │  ZONE 2: a small charming office
│   │  (a few desks / agents, ambient)  │      │  vignette — art, not a chart
│   └─────────────────────────────────┘       │
│                                             │
│   "A smooth day — wrapped up 7 things        │  ZONE 3: ONE warm derived caption
│    under a clear sky."  ☀️                    │  (done+mood), the 1 gentle number
│                                             │  woven in. Empty day → "A quiet day."
│                                             │
│   2026-06-14 · Agent Virtual Office         │  footer: date + source metadata
└───────────────────────────────────────────┘
```

Empty/slow day variant: ZONE 3 prose becomes e.g. "A quiet day at the office." with
no fabricated counts; ZONE 1/2 still render the real (calm) weather + scene.

## Acceptance Criteria (verifiable)

- **AC-1** Clicking Share generates and downloads a PNG with **no server-side
  rendering** (pure client canvas). Verify: unit test calls the render fn and asserts a
  non-empty PNG blob/dataURL; manual: file downloads and opens.
- **AC-2** All card + control strings render in **en and zh-TW with no clipped text**.
  Verify: canvas text-measurement is not available in the vitest env (no jsdom/canvas),
  so this is verified LIVE via headless Playwright (scripts/daily-card-shot.mjs) — both
  locales rendered; `wrapText` (word-wrap + zh-TW char-wrap fallback) keeps copy inside
  the card box (visually confirmed, multi-line caption wraps cleanly).
- **AC-3** **Empty/slow day renders honestly** — zero done/blocked/events produces the
  quiet-day variant with NO fabricated numbers. Verify: unit test with empty ledgers
  asserts the prose contains no count and no highlight line.
- **AC-4** Card embeds the **date + source label** ("Agent Virtual Office") so a shared
  image is unambiguous. Verify: render output includes today's dayKey + product name.
- **AC-5** **Reuses existing ledgers; zero new activity counters.** Verify: grep shows
  done/blocked totals derive from `dailyDoneLedger`/`dailyBlockedLedger` and the card
  adds NO new store counter (no `dailyEventLedger`); store.js is not in the diff.
- **AC-6** **Cozy-postcard aesthetic, not a stats card** — the rendered card contains no
  bar/gauge/grid/ranking primitives and ≤ 2 numeric tokens total. Verify: a render-time
  assertion / test counts numeric glyph runs in the drawn text model ≤ 2; design review
  against the wireframe.
- **AC-7** Web Share / clipboard image is **feature-detected**; absence falls back to
  download with no error. Verify: test stubs missing `navigator.share`/clipboard and
  asserts download path still resolves.
- **AC-8** Share control is **opt-in** — not present in the default glance layer or the
  resting control bar (lives in ⚙). Verify: rendered conditionally inside `{showSettings
  && …}` (ControlPanel.jsx). Confirmed LIVE (scripts/daily-card-shot.mjs):
  share-in-default-bar=false, share-in-gear-menu=true. (Default-view snapshot test needs
  jsdom, unavailable in vitest — the live DOM check is the verification mechanism.)

## Non-goals

- No remote upload, hosted links, or accounts.
- No per-agent stats/leaderboard/MVP table (only the single derived highlight line).
- No animation/GIF in v1.
- No event counting / new store counter (dropped for honesty — see honesty note).
- No change to the live office rendering, the store, or existing ledgers' semantics.

## Constraints

- Status-visibility law unaffected: the card is a separate artifact; it must not alter
  or occlude the live office UI.
- Honesty: every number/word on the card must be backed by real ledger data; empty
  states stay empty. No invented "MVP", no inflated counts.
- Reduced-motion / a11y: the Share control needs an accessible name; PNG generation must
  not depend on animations.
- Bundle: canvas render code is lazy-loadable; keep it off the critical glance path.
- Reuse the existing dayKey-reset + `validatePersisted*` ledger pattern for the new
  event tally — do not invent a parallel persistence mechanism.

## Data Contract

No new store slice. The card is a pure function of a small data bag gathered at click
time from existing state:

```
renderDailyCard({
  dayKey: string,         // getLocalDayKey()
  doneTotal: number,      // sum(dailyDoneLedger.counts)
  blockedTotal: number,   // sum(dailyBlockedLedger.counts)
  mood: string,           // store.mood
  weather: string,        // moodToWeather(mood)
  locale: 'en' | 'zh-TW',
}) -> Promise<Blob>   // PNG

// internal pure helpers (vitest-testable, no canvas):
buildCardModel(input) -> { hero, sceneMood, captionKey, doneText|null, blockedText|null, footer, numericTokenCount }
//   captionKey derived from (doneTotal, mood); empty-day → quiet variant, no number.
```

## Domain Decisions

- [CONSTRAINT] The card is a cozy pixel-art postcard, never a stats/power-level/sports
  card: no bars/gauges/grids/rankings, weather/mood is the hero, ≤ 2 numbers total.
  (Owner hard steer; same anti-pattern that closed AVO-120.)
- [DECISION] Rendering is 100% client-side canvas → PNG, local-only (no upload), so the
  feature carries zero backend/privacy surface.
- [DECISION] No event counting: the only frontend eureka/deploy signals are office
  theater + demo clicks, and real CI deploys arrive as agent status (not activeEvent),
  so counting them would fabricate activity. The highlight is derived purely from the
  honest done+mood signals instead. (Owner Option C, 2026-06-14.)
- [TRADEOFF] Highlight is a single derived caption (done+mood), not a per-agent recap or
  literal event count — accepted to protect both honesty and the cozy aesthetic.
- [CONSTRAINT] Share is opt-in (⚙ menu), never in the default glance layer or resting
  bar, preserving the REDUCE-not-add discipline.

## File Relationship

INDEPENDENT — does not extend or replace any existing spec. Reuses (does not modify)
the ledgers specified implicitly by the store; reuses `moodToWeather` from the weather
system (docs/specs/weather-system.md, shipped). Salvages the single-highlight kernel
from the panel-closed AVO-120.
