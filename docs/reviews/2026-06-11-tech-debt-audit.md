---
status: review
title: Technical Debt Audit
date: 2026-06-11
scope: post-optimization technical debt scan
---

# Technical Debt Audit

## Summary

The project is in a healthy post-optimization state: build, smoke, package smoke, dependency audit, bundle budget, framework validator, and the full Vitest suite pass. Remaining debt is mostly maintainability and developer-experience debt, not a known correctness failure.

## Evidence

- `npm run build` PASS: production bundle built successfully.
- `npm run prepublishOnly` PASS after local remediation: build plus 83 files / 1905 tests.
- `npx vitest run tests/bridgeHtmlSafety.test.js tests/serverTransportE2E.test.js` PASS: 21 tests.
- `npm run smoke` PASS after local remediation: 4 viewport matrix (`2048x1024`, `1280x800`, `1024x768`, `390x844`), no SVG vertical clipping, visible top/bottom scene anchors, 0 page errors, 0 console errors.
- `npm run smoke:pack` PASS: npm pack install, setup idempotency, hook test, quick-start boot.
- `bridge-smoke` PASS: `/bridge.html` rendered 8 agent cards, `Dev Blocked` preset logged, 0 browser errors.
- `office-status-matrix` PASS: bridge `Dev Blocked` reached the main office across 4 viewports, full-scene anchors remained visible, 0 browser errors.
- Codex Browser check PASS: local production server opened at `http://127.0.0.1:54295/`; accessibility snapshot showed top and bottom office anchors in viewport.
- `node scripts/bundle-budget.mjs` PASS: 454,867 bytes, +1.07% vs 450,069 byte baseline, under +10% cap.
- `npm audit --audit-level=high` PASS: 0 vulnerabilities.
- `.agentcortex/bin/validate.ps1` PASS: 107 pass / 3 warn / 0 fail / 3 skip.

## Findings

### TD-1: Publish guard has an implicit build precondition

`package.json` uses `prepublishOnly: npm test`, but `tests/serverTransportE2E.test.js` requires `dist/index.html`. CI builds before testing, but local publication guard does not encode that order. A first audit run exposed the precondition; after `npm run build`, the full suite passed.

Action: GitHub issue #120. Implemented locally in this session by making `prepublishOnly` run build before test.

### TD-2: Several high-blast-radius files remain

Largest files by line count:

- `public/hooks/office-status-hook.js` ~1376 lines.
- `src/components/AgentCharacter.jsx` ~1344 lines.
- `src/systems/store.js` ~1295 lines.
- `src/components/PixelOffice.jsx` ~1180 lines.
- `src/inference/inferStatus.js` ~895 lines.
- `src/systems/officeLife.js` ~796 lines.

These are well-tested, so broad refactor is not recommended. The debt is future-change risk: small feature work can easily touch movement, rendering, transport, and persistence at once.

Action: GitHub issue #121.

### TD-3: Runtime mirror for `normalizePost.mjs`

`src/utils/normalizePost.mjs` intentionally mirrors canonical JS constants/sanitizers for bare Node runtime compatibility. Drift guards are strong, but future transport field changes still require touching two sources.

Action: GitHub issue #122.

### TD-4: Bridge page uses manual `innerHTML` escaping

`public/bridge.html` previously used `innerHTML`; current dynamic values were escaped via a local helper, so this was not recorded as an active exploit. It was still a brittle integration surface because future bridge edits could interpolate raw values.

Action: GitHub issue #123. Implemented locally in this session by moving the bridge UI script to `public/bridge-ui.js`, using DOM construction/text nodes, and removing inline handlers so the page stays compatible with the existing CSP.

### TD-5: Silent catch blocks need classification

The codebase intentionally has many `catch {}` paths in hooks, localStorage persistence, cleanup, and best-effort IO. Many are correct for crash-proof hooks and optional browser capabilities, but the project would benefit from an inventory separating expected no-op from production-observable failure paths.

Action: GitHub issue #124.

### TD-6: Dependency maintenance needs a scheduled lane

`npm outdated` shows patch/minor wanted updates and major latest-version gaps. Current tests and audit are green, so this is scheduled maintenance rather than urgent remediation.

Action: GitHub issue #125.

### TD-7: Semgrep is still report-only

`.github/workflows/security.yml` runs Semgrep without failing CI. This was appropriate for initial rollout, but the baseline should eventually be triaged so new serious findings block.

Action: GitHub issue #126.

### TD-8: `docs/ARCHITECTURE.md` still has model drift

`docs/specs/engineering-audit-remediation.md` records a deferred full redraw of the architecture overview. The stale banner is already present, but the canonical overview should eventually match the current runtime/classifier/store spine.

Action: GitHub issue #127.

### TD-9: Audit routing actions need canonical merge/rejection

This audit snapshot contains routing actions by design. They should not stay pending forever; the lasting bits need to be merged into canonical backlog/domain docs or explicitly rejected.

Action: GitHub issue #128.

### TD-10: Render smoke missed viewport-fit regressions

The previous render smoke proved the SVG rendered many descendants, but did not prove the office viewport itself fit within the available app pane. A width-driven SVG could therefore pass tests while clipping the entrance and lower lounge/research areas in wide browser windows.

Action: Implemented locally in this session by making full-office mode fit the complete 800x560 scene with SVG `meet`, and by expanding `render-smoke` to a multi-viewport matrix with vertical clipping and visible top/bottom anchor checks.

## Non-Issues / Accepted Trade-offs

- AVO-144 free-movement pass-through remains deferred by ADR-004; do not reopen without owner-visible evidence matching ADR re-open conditions.
- `Semgrep` is report-only in `.github/workflows/security.yml`; this is a policy hardening opportunity but not a current failing gate because `npm audit` and TruffleHog are enforced.
- `docs/architecture/ui-rendering.log.md` still records owner visual confirmation needs for pixel dominance; this is a visual authority constraint, not a code correctness failure.
- Dependency freshness has minor wanted updates and major latest-version gaps (`vite`, `vitest`, `@vitejs/plugin-react`), but audit/build/test are green. Treat major upgrades as scheduled maintenance, not urgent remediation.

## Suggested Priority

1. #120 prepublish/build-test contract: small, high developer-experience leverage. Implemented locally in this session.
2. #123 bridge rendering hardening: small, bounded integration hardening. Implemented locally in this session.
3. #124 silent catch classification: improves observability without changing behavior. Implemented locally in this session.
4. #128 resolve routing actions: keeps audit findings from becoming stale. Implemented locally in this session.
5. #126 Semgrep baseline triage: security hardening once current findings are reviewed.
6. #125 dependency maintenance lane: scheduled upgrade work, not urgent.
7. TD-10 viewport-fit smoke hardening: implemented locally after the wide-screen clipping regression was reproduced.
8. #122 normalizePost runtime mirror: medium refactor only when transport fields change again.
9. #121 monolith extraction map: implemented locally as a refactor guard, not a broad refactor.
10. #127 architecture overview refresh: implemented locally in this session.

## routing_actions

```yaml
routing_actions:
  - finding: "Publish guard has implicit build-before-test precondition"
    target_doc: "docs/specs/_product-backlog.md"
    status: merged
    owner: "codex-app"
    note: "Backlog row #120 marks the contract Done; implementation shipped in local commit 0a1aa93."
  - finding: "High-blast-radius runtime/rendering files need extraction map before opportunistic refactor"
    target_doc: "docs/architecture/monolith-extraction-map.md"
    status: merged
    owner: "codex-app"
    note: "Office runtime log links the extraction map and records the reversible-refactor constraint."
  - finding: "Bridge integration dynamic rendering should avoid manual innerHTML escaping"
    target_doc: "docs/architecture/hook-integration.log.md"
    status: merged
    owner: "codex-app"
    note: "Hook integration log records the bridge-ui.js split and no-inline-handler constraint."
  - finding: "Silent catch blocks need observability classification"
    target_doc: "docs/architecture/silent-catch-policy.md"
    status: merged
    owner: "codex-app"
    note: "Office runtime log links the policy and records the catch-classification review gate."
```
