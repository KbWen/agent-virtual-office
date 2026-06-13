---
doc_state: snapshot
title: Semgrep Baseline Triage
date: 2026-06-11
scope: full-repo SAST baseline at the moment the ERROR-severity gate turned blocking (#126)
---

# Semgrep Baseline Triage — 2026-06-11

Snapshot of all Semgrep findings (`semgrep --config auto`, semgrep 1.123.0, 1059 rules /
404 files, run 27347603762) at the moment CI switched from report-only to **blocking on
ERROR severity**. 20 code findings across 13 rule×file groups. Dispositions below; the
two ERROR-severity findings were resolved in the same PR that flipped the gate.

| Sev | Rule | Location | Disposition |
|---|---|---|---|
| ERROR | `yaml.github-actions.security.run-shell-injection` | `.github/workflows/sim-soak.yml:33` | **FIXED** — dispatch input routed through `env: SOAK_MINUTES`, quoted in `run:` |
| ERROR | `javascript.lang.security.audit.spawn-shell-true` | `scripts/sim-soak.mjs:42` | **SUPPRESSED (scoped nosemgrep + justification)** — `shell:true` needed for the npx `.cmd` shim on Windows; `PORT` is a parseInt-validated module-level int, no external string reaches the template |
| WARN | `generic.nginx.security.possible-h2c-smuggling` | `docs/deployment/nginx.conf:55-57` | Accepted — sample config; the Upgrade headers exist for the SSE/WebSocket path; deployment doc, not shipped runtime |
| WARN | `javascript...path-join-resolve-traversal` | `public/hooks/generic-llm-bridge.js:33` | Accepted — `--watch` is the local operator's own CLI arg resolving a directory they choose; no remote input |
| WARN | `problem-based-packs.insecure-transport...http-request` | `public/hooks/generic-llm-bridge.js:88-99` | Accepted by design — bridge POSTs to `localhost` only; the office is a zero-backend local tool (README/FAQ contract) |
| WARN | `problem-based-packs.insecure-transport...using-http-server` | `public/hooks/generic-llm-bridge.js:99` | Same as above (localhost transport) |
| WARN | `javascript...path-join-resolve-traversal` | `public/hooks/generic-llm-bridge.js:257,263,268` | Accepted — joins are over the operator-chosen watch dir + `fs.watch` filenames within it |
| WARN | `javascript.lang.security.insecure-object-assign` | `public/hooks/office-status-hook.js:1059` | Accepted — merge sources are the hook's own parsed status file + literals, not request data |
| WARN | `javascript...prototype-pollution-loop` | `src/i18n.js:66,73` | Accepted — loop walks dot-keys over the BUNDLED translation tables; keys are compile-time literals |
| WARN | `javascript.express.security.cors-misconfiguration` | `vite.config.js:164,280` | Accepted by design — header is set only when the operator opts in via `OFFICE_API_ALLOWED_ORIGINS` allowlist (LAN viewing) |
| INFO | `javascript...unsafe-formatstring` | `src/components/AgentCharacter.jsx:1139` | Accepted — `console.error` diagnostic with internal agent id |

## Gate semantics going forward

- `security.yml` runs the full scan report-only (annotations), then `--severity ERROR
  --error` as a **blocking** pass.
- A new ERROR finding (in code OR from registry drift in `--config auto`) fails CI by
  design — triage it (fix / scoped `nosemgrep` with one-line justification) rather than
  loosening the gate.
- WARNING/INFO dispositions above are point-in-time; re-triage when touching the file.
