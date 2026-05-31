# Work Log — fix/install-docs-and-cli-hoist

- **Branch**: fix/install-docs-and-cli-hoist
- **Classification**: quick-win
- **Classified by**: Claude Opus 4.8 (1M)
- **Frozen**: yes
- **Created Date**: 2026-05-31
- **Owner**: luvseldom@gmail.com
- **Guardrails Mode**: quick-win (Bootstrap → Plan → Implement → Evidence → Ship)
- **Current Phase**: Ship (complete — merged 37c039b)
- **Checkpoint SHA**: 37c039b
- **Recommended Skills**: verification-before-completion

## Session Info
- Model: Claude Opus 4.8 (1M context), claude-opus-4-8[1m]
- Timestamp: 2026-05-31
- Platform: win32

## Drift Log
none

## Task Description
User reported install/usage friction. Audit found: (A) zh-TW README points at unpublished `npx agent-virtual-office` (404) and declares Node>=18 (actual >=22); (B) bin/cli.js vite-presence check misses hoisted node_modules → redundant npm install on every start when installed as an npm/global dep; plus EN README stale test count (925→1025) and wrong architecture-tree paths. zh-TW README is far behind EN.

## Phase Sequence
Bootstrap → Plan → Implement → Evidence → Ship

## Phase Summary
- Bootstrap/Audit: reproduced clean tarball install + dev start + build + 1025 tests; confirmed findings A/B and doc drift.
- Implement: cli.js hoist-safe launch + EN README fixes + zh-TW full parity rewrite.
- Review: 2 independent reviewers + direct checks → cli.js SAFE (0 defects), READMEs ACCURATE (0 issues).
- Ship: PR #23 squash-merged to main (37c039b); CI Node 20+22 green; SSoT seq→27 via guarded write.

## Gate Evidence
- gate: plan | verdict: pass | classification: quick-win | 2026-05-31 | scope: 2 README docs + bin/cli.js hoist fix
- gate: ship | verdict: pass | classification: quick-win | 2026-05-31 | evidence: 1025/1025 vitest, build clean 882ms, cli.js hoist fix live-verified in fresh hoisted install, server.mjs serve smoke (health/index/POST all 200)

## External References
- Claude Code hooks payload spec (prior session)

## Known Risk
zh-TW full rewrite is large; risk of translation drift from EN source. Mitigate by mirroring EN section-for-section.

## Conflict Resolution
none

## Skill Notes
none

## Evidence
- **cli.js hoist fix verified live**: fresh tarball install into clean dir → vite hoisted to top-level node_modules (nested under pkg = NO). Running `bin/cli.js` started Vite in 575ms with NO "Installing dependencies..." reinstall (the bug). `node --check bin/cli.js` OK; `--help` works.
- **EN README**: test count 925→1025; architecture tree corrected (`normalizePost.js`→src/utils, `platformDetect.js`→src/systems, added workflowHandoff.js/utils//App.jsx).
- **zh-TW README** brought to EN parity: Node badge >=18→>=22 (grep=1), working `npx github:` form added (grep=2), Designer role added (grep=2), invalid `qa:testing` example fixed to `qa:blocked`, added Option3 serve / Option4 Docker / Webhook / GitHub Actions / Hook install / Multi-worktree / Troubleshooting / Tech Stack / Architecture sections.
- **Regression**: 1025/1025 vitest pass; `npm run build` clean 891ms; `git diff --check` clean.
- Files changed: README.md, README.zh-TW.md, bin/cli.js. Removed stray agent-virtual-office-1.0.0.tgz artifact.
