# R3 — final review packet: Classic / Pixel appearance (ship now, art in batches)

Branch `claude/pixel-character-refresh`, rebased-equivalent on origin/main 48e0e23 (0 behind).
Prepared 2026-11-09. The owner asked to ship the current work and batch the remaining art later,
so this packet replaces the original "R3 after Phase 3" point with "R3 for the delivered scope".

## What ships

| Area | Behaviour | Evidence |
|---|---|---|
| Appearance switch | Classic (default) / Pixel in the full footer; atomic preload of all 24 Pixel files; failure keeps the current pack with an error cue | live-checks.json 20/20, switch-error.jpg |
| Pixel employees | 8 original masters, measured sole pivots, display scale 7/8; world geometry shared with Classic | R1-classic-vs-pixel-desks.jpg, pixel-scene.jpg |
| Seated at desk (R1 option C) | Back view, chair over the legs, only while working/planning/thinking; idle/done/blocked/awaiting-approval stand and face the viewer | R1-classic-seated-backview.jpg, R1-pixel-seated-backview.jpg |
| Signature action poses | One pose per role. Work-claiming poses (typing, board, magnifier, deploy, shield, notes) only while really working; coffee/book anytime; a working agent's own desk pose faces the viewer instead of the back | honesty-poses-idle-desks.jpg, honesty-poses-working-desks.jpg, action-poses-in-scene.jpg |
| Transparent edges | Gemini candidates' grey rim removed by a deterministic, re-runnable recipe; sources untouched | residue-cleanup-before-A-B.jpg, pixel-v1/PROVENANCE.md |
| Visitor routes | Boss/dog walk through the shared navigation model (no desk/wall crossing), constant speed, correct depth | ../2026-11-08-visitor-routes/*.mp4, 0 violations both appearances |

Pose share (150 s live, 4 working + 4 idle, Pixel): front standing 43%, seated back 28%,
action 9%, walking 17% — the front standing pose stays the most common.

## What does NOT ship (follow-up AVO-207, art-gated batches)

- Walk/gait frames. Res + Arch right-facing walk: 7 of 8 frames delivered by Gemini as
  white-background JPEG raw outputs (arch-walk-side-3 pending after a quota stop). They need
  conversion to 512px alpha PNG with a recorded recipe and a scene recording (R2) before import.
  Until then every role walks with its front master (current behaviour).
- Optional desk-back upgrade (hands on keyboard) — brief exists, not run.
- Larger boss (AVO-202 draft scope, owner WIP backlog).

## Verification (clean worktree at 119df58, no owner WIP)

- `npm run build` PASS. Bundle budget re-based: origin/main already 535604 B (+7.88% over the July
  baseline); this branch adds 11.7 KB (+2.2%) -> 547333 B.
- `npx vitest run`: 3093 pass / 2 fail. Both reproduce on origin/main (`tar` exit 128 on Windows;
  antigravityWatcher timing flake passes on re-run). CI on Linux is the authority.
- Independent reviews: 3 x PASS (dff03b2, f618de0..0ad62cb, ee51faa); all findings fixed or recorded.

## Risks and rollback

- Presentation only; no store migration. Users choose Classic (default) to return to the old look;
  code rollback = revert the PR.
- Owner's uncommitted furniture WIP is NOT in this PR and is untouched. Re-check the bundle budget
  when it lands (it adds ~10 KB, within the re-based headroom).

## Owner decisions recorded

R1 option C seating (2026-11-08) · back view only while working (2026-11-08) · import back views and
action poses (2026-11-08/09) · transparent edges (2026-11-09) · pose honesty delegated to Claude
(2026-11-09, decision D-2) · ship now, art in batches (2026-11-09).
