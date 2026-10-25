# Work Log: office marketing assets
## Header
- Branch: `codex/office-marketing-assets`
- Classification: `quick-win`
- Classified by: `Codex`
- Frozen: `2026-10-24`
- Created Date: `2026-10-24`
- Owner: `codex-media`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `f09c12094843425e0cbbeeb0c97efcfc5c5d04c1`
- Checkpoint SHA: `e1eb0053c84207c2a8cfc17c610e04a7dd4e30e5`
- Recommended Skills: `verification-before-completion`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `156`

## Session Info
- Agent: Codex; Session: codex-20261024-media; Platform: Codex App.
- User asks for more pure marketing artwork and actual GIF demos after README cleanup. Lower-tier implementation preference persists; Luna agents handle artwork/recording/docs, primary reviews and publishes.
- Context read: SSoT156, source mainf09c120, prior screenshot provenance and release archive. Engineering/security/routing/bootstrap/plan/ship cached; quick-win avoids full governance reload.
- Reuse existing managed worktree; original main and unrelated AVO202-205 planning remain intact.
- Read plan: shipped cozy interaction spec/design, media/image/CUA instructions and existing README assets. No runtime or dependency changes.

## Task Description
Create a bounded media pack for shipped AVO206: two promotional illustrations, actual paper-star and postcard interaction GIFs, and compact README media references. This is documentation/asset work, not a new product feature. Sequence bootstrap -> plan -> implement -> ship; no new feature specification or handoff needed.

## Phase Sequence
| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-10-24 | Existing static screenshots and legacy poke GIF inventoried |
| plan | done | 2026-10-24 | Bounded illustration and real-GIF pack |
| implement | done | 2026-10-24 | Two reviewed posters/two actual GIFs and compact media references |
| ship | done | 2026-10-24 | Media delivery archived; external CI/merge verified by PR |

## Phase Summary
- ship: reviewed promotional artwork/real GIF media pack archived; sourcee1eb005 and all provenance retained; exact-head CI/merge authoritative in PR. ⚡ ACX
- implement:8asset/docs files;2AI-generated posters and2real UI GIFs, primary visual/frame reviewPASS; unchanged hero/setup/runtime/dependencies. ⚡ ACX
- plan: two artwork/two real GIF assets, compact references and actual-frame validation. Confidence:90%. ⚡ ACX
- bootstrap: quick-win assets/docs; no new behavior, honest promotional/artifact distinction. Confidence:90%. ⚡ ACX

## Gate Evidence
- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-10-24T15:02:36.758275+00:00
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-10-24T15:03:07.036058+00:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-10-24T15:32:05.517478+00:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-10-24T15:38:02.440647+00:00

## Plan
Target Files: docs/assets/marketing/{office-wide.png,office-square.png,paper-star.gif,postcard.gif,README.md,generation-prompts.json}, README.md, README.zh-TW.md and required ship metadata.
1. Luna uses built-in imagegen with actual scene style reference for two clear promotional illustrations; label as artwork. Save exact prompts and generated source paths.
2. Luna prepares encoding and primary records actual star long-press plus card opening/sticker UI through CUA; assemble captured frames as GIF without fabricated scene state. Preserve raw frames and timing.
3. Primary views posters and GIF contact sheets/animation; checks spelling, frame changes, durations, byte budgets and source/runtime equivalence.
4. Replace selected duplicate/static gallery slots with GIFs and add one media-kit link in each README. Keep technical suffix unchanged.
5. Archive Work Log, guarded SSoT/audit update, exact-head CI and PR merge; sync normal main with original planning hashes preserved.
Spec: docs/specs/cozy-interactions.md remains shipped; asset-only extension needs no new feature spec. Asset budgets: preferably<2MB perGIF and<3MB perposter; total ideally<8MB. Rollback: scoped revert only. Confidence:90%.

## External References
- docs/specs/cozy-interactions.md; docs/design/cozy-interactions.md; docs/reviews/2026-10-24-v1.6.13-docs-capture.md.
- Built-in imagegen skill and tool; CUA screenshot/input APIs; Pillow/ffmpeg available for GIF encoding only.
- Existing README images and known source-render proof; no external library/API changes.

## Known Risk
- Promotional artwork must be labeled illustration, never a literal screenshot or unshipped UI claim.
- GIFs must show actual UI interaction with no synthetic statuses/DOM-store writes; preserve optional/off-default semantics.
- Capture pipeline may be frame-rate limited; visually inspect animation, durations and compression before claiming quality.
- Rollback: revert scoped assets/README diff; retain source captures and ignored/untracked files; never reset/clean.
- Original real project launch must remain correctly scoped, no fake heartbeat or global settings.

## Decisions
none

## Conflict Resolution
- User-authorized lower-tier delegation applies; primary alone owns governance log, integration and publication.
- Media encoding preserves genuine captured frames; imagegen only for promotional artwork, not fake footage.

## Skill Notes
### plan
- Checklist: bound media formats, truthful source labels and README footprint.
- Checklist: plan actual input/capture verification and frame/size checks.
- Constraint: no runtime, dependency, status or global integration edits.
### implement
- Checklist: verify illustration text/style and actual GIF frame content/timing.
- Checklist: validate README paths, preserved technical suffix and bounded asset sizes.
- Constraint: no generated frames presented as real UI; preserve source inputs.
### ship
- Checklist: verify exact changed scope and final metadata after archival.
- Checklist: all exact-head CI before merge; preserve normal project planning.
- Constraint: no tag/version churn for documentation assets.

## Drift Log
- SSoT156 matches bootstrap; additive media-delivery history only. Existing shipped cozy spec is referenced, not reopened; no new domain behavior or architecture to consolidate.
- Capture scope clarified: final star GIF demonstrates a1500ms long press only; short/medium attempts are retained as rejected diagnostics, not claimed as final footage. Current three-duration app behavior is unchanged.
- Child CUA browser provider unavailable; primary performed native UI recording while Luna handled scripts/GIF encoding and media text. No Playwright/CDP fallback or synthetic app-state changes.
- Reusable capture lesson: use actual visible tab, refresh AX after screenshots and let native press settle before concurrent recording; reject hidden-tab target/coordinate failures and explicitly list all-white screenshot artifacts removed from final GIF. Preserve raw frames/timestamps.
- develop-web-game was inspected for capture options but is not applied: this task records existing SVG behavior and does not implement a game/runtime or add canvas/testing hooks.
- Initial imagegen skill path lookup used r0 and failed; canonical r1/.system/imagegen was located and read before any generation.

## Review Feedback
- Primary PASS: both poster compositions/text viewed; actual-frame contact sheets show long-press flatten/cheeks/glints/recovery and card open/Cat/close. Media kit explicitly separates illustrations from UI footage and labels long-press/edited pacing/no-download. Absolute README image URLs preserve external-render compatibility.

## Security Findings
none

## Red Team Findings
none

## Design Reference
- Existing shipped scene; promotional illustrations are separate from UI screenshots, no UI design change.

## Observability
- Existing runtime diagnostics unchanged; capture/encoding failures must remain explicit.

## Resume
- State: MEDIA_DELIVERY_VERIFIED; sourcee1eb005.
- Completed: two built-in imagegen illustrations, real star long-press GIF and edited card Cat/close GIF, compact bilingual README gallery and media-kit/prompt archive; independent pixel/frame and file checksPASS.
- Next: consult the media PR for exact-head CI and actual merge disposition; external publication is not inferred from this pre-merge archive.
- Context: original normal project main retained; no runtime, dependency, version or global integration changes. Raw frames and capture failures remain in original project output/playwright/2026-10-24-media; encoding/capture lesson in Drift Log.

## Test Gate Results
none

## Evidence
- Final post-archive media-verificationPASS and governance97PASS/4WARN/0FAIL/6SKIP; SSoT157,10inline history entries and hash-chain/archive capsPASS. This terminal entry records the final run only.
- Final implement verification:115PASS/4WARN/0FAIL/5SKIP; media verification and text integrityPASS. Demonstration: python output/office-marketing/verify_media.py ->4validated assets with animated frame diversity, README links/suffixPASS, unchanged runtime. This terminal entry records that run only.
- GIF metrics: star280x155/7frames/6120ms/128550bytes; postcard545x500/6frames/8000ms/446695bytes; distinct rendered states verified, loops0, each<2MiB. Card is an edited6-state sequence selected from29real capture frames; no generated UI frames.
- Demonstration: media verification checks4asset formats/dimensions/hashes/byte limits and real animated frame diversity; README hero/QuickStart suffix unchanged; all new local links and exact poster prompts present; runtime/package diff empty.
- Posters generated with built-in image_gen, independently viewed: wide1729x910/1860091bytes and square1254x1254/2024618bytes; title/taglines correct,8illustrated roles.
- Long-press recording: actual normal page,1500ms input;9valid rawframes,2all-white capture artifacts explicitly omitted;7encodedframes,6.12s,128550bytes; contact sheet independently proves flatten/cheeks/sparkle/recovery.
- Production app baseline build535204bytes; source mainf09c120, actual hook build/verify status only.
- Existing new JPG scenes/card and legacy office-poke.gif found; no new marketing posters or star/card GIFs yet.
- ADR existence gate passes (ADRs exist; no_covering_adr is nonblocking for quick-win).
