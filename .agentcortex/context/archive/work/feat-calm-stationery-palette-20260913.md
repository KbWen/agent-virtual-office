# Work Log overflow: feat/calm-stationery-palette (compacted 2026-09-13)

## Phase Summary

Compaction overflow of the active log `.agentcortex/context/work/feat-calm-stationery-palette.md` (handoff §6). Full, verbatim detail of the sections below; the active log keeps one-line deltas.

---

### (verbatim) Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-13 | handoff packet identified as the task; stale 09-02 experiment log ignored (branch gone, NOT FOR MERGE) |
| plan | done | 2026-09-13 | spec `docs/specs/calm-stationery-palette.md` frozen as DSoT |
| implement | done | 2026-09-13 | paused mid-phase for owner visual review; resumed on owner's blend selection |
| review | done | 2026-09-13 | self-review of diff vs DSoT + pixel parity vs owner-approved render |
| test | done | 2026-09-13 | vitest, build, bundle-budget, render-smoke, hermetic capture matrix |
| bootstrap (reclassified) | done | 2026-09-13 | quick-win -> feature: owner added design-token + rules scope before the ship commit |
| plan (round 2) | done | 2026-09-13 | officePalette tokens + rules guard + docs; soak/smoke simulation |
| implement (round 2) | done | 2026-09-13 | tokens + rules test + wiring + docs; pixel-identical |
| review (round 2) | done (NOT READY → fixes → PASS) | 2026-09-13 | fresh-context acx-reviewer: 1 HIGH, 4 MEDIUM, 3 LOW closed; re-review PASS with 5 LOW, also fixed |
| test (round 2) | done | 2026-09-13 | vitest, build, budget, render + panel smoke, soak ×2, capture parity |
| handoff | done | 2026-09-13 | Resume written below |
| ship | pending | - | - |

---

### (verbatim) Phase Summary

**bootstrap** — `quick-win`: two components in one module, clear scope, no API/data-flow change.
The packet is treated as design input, not authority: its instructions were re-checked against
source and measured before use.

**plan** — Target files: `src/components/PixelOffice.jsx` (static fills at the zone-floor, wall,
door-cut, grid and team-sign lines only), `src/components/AgentInspector.jsx` (presentation only).
Steps: (1) hermetic BEFORE captures from unmodified `main`; (2) scene fills; (3) signs;
(4) inspector; (5) AFTER captures in the same states; measure door/edge legibility, inspector bounds,
zh-TW rows, Escape/keyboard close; (6) vitest, build, bundle-budget, validate. Risk: the packet's wall
token measures 1.03:1 against the Research/Meeting floors, so doors cut through those walls may stop
reading. Mitigation: look at it, and apply the smallest measured darkening only if needed. Rollback:
revert this branch's hunks in the two files (no data, config or migration). AC coverage: spec
AC1–AC8 map to steps 2–6.

**implement** — The pure-stationery packet values were built first and captured. Self-review caught
readable signs printing over the sprint board and under the Developer tag (fixed in-spec). The owner
then asked to see the screens before any change ("怕改了更醜"), so implement paused. Render-only
candidates were shown (DOM overrides, no source change): two warm blends and a tinted-header card.
The owner asked for a comfortable, pretty blend and chose "warm oak" (floor `#D6C29C`, wall
`#806E5A`) plus the light role-tint header. Spec updated to that selection and re-frozen.

**review** — Diff touches only the two planned files. No coordinate, status colour, role colour,
i18n key, store read or handler changed. The implementation is pixel-matched to the render the owner
approved: 0.005% of pixels differ on the office (blinking server-rack LEDs) and 0.016% on the working
card (timestamp). The blocked card differs by 0.88% because the candidate capture caught one extra
activity row. That was inspected visually, and it is not a design difference.

**test** — See `## Test Gate Results` / `## Evidence`.

**bootstrap (reclassified)** — After the owner asked to commit + PR, and before the ship closure was committed, the owner added scope: "記得要模擬+測試看有沒有改壞喔，然後設計檔不要寫死，畢竟是開源repo，要讓大家好看、好修改、且有規則". Pulling the palette into a shared token module with an enforced rules test, and wiring and documenting it, exceeds the quick-win hard-block threshold (diff > 200 lines). Reclassified to `feature`. The uncommitted ship closure was withdrawn (SSoT, ship-history archive, INDEX.jsonl restored to HEAD; spec back to frozen; log back to `work/`). Feature commit `0ce9c46` stays.

**plan (round 2)** — Confidence: 90%. Target files: NEW `src/systems/officePalette.js` (pure, no React; scene-shell tokens: background, outer frame, five zone floors, wall face/edge, door post, corridor tint, grid opacity, team-sign ink/accent/opacity/font; inspector card tokens: paper/ink/muted/line, header tint opacity, corner px, font, type scale), NEW `tests/officePalette.test.js`, `src/components/PixelOffice.jsx` + `src/components/AgentInspector.jsx` (replace literals with tokens — pixel-identical), `docs/ARCHITECTURE.md` (contributor section: where tokens live, the rules, how to verify), spec update. Rules to enforce, each failing with a message that says what to fix: (R1) every status ring ≥ 1.2:1 on the main floor; (R2) wall face ≥ 1.5:1 against every room floor it borders; (R3) inspector text ≥ 4.5:1 on paper, including ink over the header tint for every role colour in `src/config/characters.json`; (R4) the inspector never uses a status colour as a text fill; (R5) the scene shell and card hexes appear only in the palette module, never as literals in the components, so a door cut cannot drift from its room floor. Steps: (1) module + test, with the test proven red against a deliberately bad token; (2) wire components; (3) pixel-parity capture vs the owner-approved AFTER set; (4) vitest, build, bundle-budget, render-smoke, panel smoke, 1-min hermetic sim-soak; (5) fresh-context review; (6) handoff; (7) ship. Risk: tokenizing ~25 literals could shift a colour → pixel-parity diff must be ~0. Rollback: revert the round-2 commit; `0ce9c46` stands alone. AC coverage: spec AC1–AC11.

**implement (round 2)** — New `src/systems/officePalette.js` (`RULES`, `SCENE`, `SIGNS`, `CARD` + WCAG helpers, modelled on `theme.js`). `PixelOffice.jsx`: 33 shell/sign literals → tokens (door openings now reference the same `SCENE.floors.*` token as their room). `AgentInspector.jsx`: 8 local constants and 10 font sizes → `CARD`. New `tests/officePalette.test.js`: R1–R5 as reusable violation functions, each asserted to fail on a real past value (old floor `#C8A878`, rejected wall `#A39C89`, status colour as text, tint 0.9), and R4/R5 mutation-proven red on the real source (restored after). `docs/ARCHITECTURE.md` §Office palette; spec contract §4 + AC10/AC11. Pixel parity against the owner-approved AFTER set: 16/18 shots at 0–0.05% (animated LEDs, timestamps). The 2 "working dev" shots at 2.2% were inspected with diff maps: one extra activity row logged during capture made the card taller, and the styling is identical.

⚡ ACX

---

### (verbatim) Decisions

#### D-1: status text goes to ink; the dot and emoji keep the status colour

- **Decision**: render the inspector status line in `ink`, keeping `STATUS_COLORS` on the dot.
- **Reason**: measured — every status colour fails 4.5:1 as text even on white (working 2.17, done 2.42, awaiting 3.02), and paper lowers each further.
- **Alternatives**: keep coloured text (fails AC3); darken status colours (forbidden — semantic colours are invariants).
- **Impact**: status semantics unchanged; the attention cue is carried by the dot, emoji and scene ring.
- → local

#### D-2: keep the existing `bubble-shadow` filter on the inspector

- **Decision**: do not remove the existing filter; add nothing.
- **Reason**: paper vs floor is 1.33:1 and the outline vs floor 1.36:1, so a flat card can dissolve into the room; the filter is shared with bubbles, which keeps the two surfaces coherent.
- **Alternatives**: remove it to match the flat reference card exactly.
- **Impact**: visual only.
- → local

#### D-3: owner-selected warm blend over the packet's pure stationery values

- **Decision**: floor `#D6C29C`, wall `#806E5A`, inspector header as a 16% role-colour tint (no side marker).
- **Reason**: the owner reviewed BEFORE / pure-stationery / blend A / blend B renders and asked for a comfortable, pretty blend; picked A + tinted header.
- **Alternatives**: pure stationery (paler, cooler, wall vanishes vs Research), blend B (lighter), keep current.
- **Impact**: rings still gain contrast on every status (working 1.04→1.25, blocked 1.75→2.26); name ink over the tint ≥ 8.4:1.
- → local

---

### (verbatim) Drift Log

- Spec unfreeze (round 2): `docs/specs/calm-stationery-palette.md` edited while frozen for the owner-requested token/rules scope and the review fixes; dated amendment block added at the top, then re-frozen. Frontmatter classification quick-win → feature to match the reclassification.
- Reclassification: quick-win -> feature — owner added token-module + enforced-rules + simulation scope before the ship commit; projected diff exceeds the quick-win 200-line hard-block (state_machine.md §Scope Escalation).
- Ship withdrawn before commit: a `Gate: ship` PASS receipt and ship closure writes (SSoT, ship-history archive, INDEX.jsonl chain entry, archive move) had been made but not committed when the owner expanded scope. All were restored to HEAD and the receipt removed, so the recorded progression stays legal. The withdrawn content is saved outside the repo for reuse at the real ship.
- 2026-09-13 ~02:45Z: owner, mid-implement: "記得修改前要先給我看畫面喔，我怕改了更醜". This supersedes the packet's "no return review loop / no visual sign-off pending" claim. (Resolved: owner chose blend A + tinted header, then asked to commit + PR.) Implement was PAUSED with uncommitted edits in the two target files; BEFORE/AFTER sheets (`.pet-shots/calm/compare-*.png`) sent for an owner go/no-go. No commit or push until the owner decides.
- Deviation inside frozen spec: PLANNING/REVIEW take ink colour but keep their original 0.4 opacity and monospace font. At the readable 0.75, PLANNING printed over the sprint board and REVIEW touched the Researcher tag. ENGINEERING lost its letter-spacing, which had widened it under the Developer tag. Measured sign/tag overlap: before 0.9px, after 2.7px at 1280 (occlusion order unchanged: tag on top).
- Spec unfreeze: `docs/specs/calm-stationery-palette.md` moved frozen→draft→frozen in-session. The trigger was the owner's explicit selection of blend A + tinted header, a requirement change made by the owner. Tokens, contract §2/§3 and AC5/AC7/AC9 updated.
- Ship closure: the first work-log finalisation script aborted on a mismatched anchor AFTER the archive move and INDEX append had run; edits were re-applied to the archived file. INDEX entry content was unaffected.
- Harness self-corrections: the first close-button selector matched the wrong element (Escape/Enter falsely reported broken on baseline), and the workflow banner covered a top-clamped inspector. Both fixed before any AFTER capture was trusted.

---

### (verbatim) Review Feedback

Fresh-context review (diff + spec only), round 2 — `Verdict: NOT READY`. Value parity confirmed: no regression; every token equals the committed literal. Findings, all re-derived before fixing:
- F1 HIGH — R4/R5 had no known-bad case ("provably fails" false for 2 of 5). FIXED: violation functions over source text, with verbatim pre-change fixtures, an alias case and a near-miss hex case.
- F2 MED — R4 regex `[^>]*` cut at `=>` and missed aliases. FIXED: brace-aware tag scanner (self-tested); STATUS_COLORS allowed only inside the dot `<circle>`.
- F3 MED — R1 measured the solid colour, but rings render at 40–55% opacity (working 1.13 rendered). VERIFIED (1.01 old → 1.13 new rendered). FIXED by restating R1 as a status-hue floor guard with the limit written into the code, spec and docs, rather than fitting a rendered threshold to today's numbers.
- F4 MED — close ✕ (mutedInk) over the role tint measured 3.96–4.38. VERIFIED. Resolution: ✕ ruled an icon (WCAG 1.4.11, 3:1) to keep the owner-approved look; enforced as `RULES.minIconContrast`.
- F5 MED — frozen spec edited with no amendment note. FIXED: dated amendment block + Drift Log entry; frontmatter classification → feature.
- F6 LOW — "cannot drift" overclaimed. FIXED: R5 also fails any literal fill on a room-shell rect; wording softened.
- F7 LOW — ✕ shrank 12→10 and was tied to the name size. FIXED: `CARD.type.close` + transparent 18-unit hit target (no pixel change). Visual size stays at the owner-approved 10.
- F8 LOW — docs said the emoji keeps STATUS_COLORS. FIXED wording.

Re-review — `Verdict: PASS` (all F1–F8 verified closed). Five LOW leftovers, all fixed anyway:
- N1 — the ring-opacity range was wrong: effort rings peak at 70–100% and pulse down to 40% of peak. Reworded to "below full opacity, 50% peak at base effort".
- N2 — `fill={'#…'}` escaped the shell check. Now any quoted fill or a string literal in a JSX expression fails, with a bite case.
- N3 — an `as`-renamed import or a raw status hex on `<text>`/`<tspan>` escaped R4. Both are now violations, with bite cases. This also correctly double-flags the pre-change line, where `'#888'` equals idle's colour.
- N4 — the icon rule had no failing case of its own. Now asserted by message.
- N5 — Drift Log round-2 unfreeze entry: already present (written after the reviewer's read); verified.

---

### (verbatim) Test Gate Results

Round 2 (final tree):
- `npx vitest run` → 126 files / 2422 passed / 0 failed (+14 `tests/officePalette.test.js`); rules mutation-proven red on the real source (R4 status text, R5 literal) and via verbatim historical fixtures for every rule.
- `npm run build` PASS; `bundle-budget` PASS 498871 bytes (+0.48% vs baseline, limit +10%).
- `npm run smoke` render-smoke PASS (4 viewports, 0 pageerrors, 0 console errors); `npm run smoke:panel` PASS.
- `npm run soak:spawn -- --minutes 1` → ISOLATED, PASS, 235 samples, 0 invariant violations (run twice: before and after the review fixes).
- Hermetic capture (18 shots): 0 page errors; Escape closes; focused close + Enter closes. Pixel parity vs the owner-approved set is ≤0.1% on every shot where the activity log matched. Three shots were 2.2–2.8%: each diff map shows one extra activity row logged during capture, with identical styling.

Round 1:
- `npx vitest run` → 125 files / 2408 passed / 0 failed (same count as `main`; no new test: presentation-only change, no logic or data path — evidence is the capture matrix below).
- `npm run build` PASS; `node scripts/bundle-budget.mjs` PASS 497586 bytes (+104 vs `main` 497482; +0.22% vs baseline, limit +10%).
- `npm run smoke` → render-smoke PASS, 4 viewports, 0 pageerrors, 0 console errors.
- `bash .agentcortex/bin/validate.sh` → `pass=115 warn=4 fail=0 skip=5`, integrity check passed (first run FAILed: new spec lacked `## Domain Decisions`; added, re-run clean).

---

