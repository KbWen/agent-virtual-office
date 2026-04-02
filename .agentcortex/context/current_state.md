# Project Current State (vNext)

- **Project Intent**: Build a self-managed Agent OS for Codex Web / Codex App / Google Antigravity to reduce human procedural burden and continuously lower token costs.
- **Core Guardrails**:
  - Correctness first: No claim of completion without evidence.
  - Small & reversible: Prioritize small, reversible changes; avoid unauthorized refactoring.
  - Document-first: Core logic or structural changes require a Spec/ADR first.
  - Handoff gate: Non-`tiny-fix` tasks must produce a traceable handoff summary.
- **System Map**:
  - Global SSoT: `.agentcortex/context/current_state.md`
  - Task Isolation: `.agentcortex/context/work/<worklog-key>.md`
  - Active Work Log Path: derive <worklog-key> from the raw branch name using filesystem-safe normalization before any gate checks.
  - Workflows & Policies: `.agent/workflows/*.md`, `.agent/rules/*.md`
- **Last Updated**: 2026-03-30T04:10:00Z
- **Update Sequence**: 14
- **ADR Index**:
  - `.agentcortex/adr/ADR-001-vnext-self-managed-architecture.md`
  - `docs/adr/ADR-002-three-platform-low-token-trigger-governance.md`
- **Active Backlog**: none
  - When a multi-feature product spec is decomposed, the backlog path is recorded here (e.g., `docs/specs/_product-backlog.md`). Bootstrap reads this to detect ongoing product work.
- **Spec Index** (framework template specs at `.agentcortex/specs/`; project specs go to `docs/specs/`):
  - `[template-import-cleanup] .agentcortex/specs/template-import-cleanup.md [Frozen] [Updated: 2026-03-06]`
  - `[red-team-skill] .agentcortex/specs/red-team-skill.md [Frozen] [Updated: 2026-03-18]`
  - `[governance-hardening-batch] docs/specs/governance-hardening-batch.md [Draft] [Updated: 2026-03-25]`
  - `[doc-lifecycle-governance] docs/specs/doc-lifecycle-governance.md [Shipped] [Updated: 2026-03-29]`
  - `[document-governance-downstream-hardening] docs/specs/document-governance-downstream-hardening.md [Shipped] [Updated: 2026-03-30]`
  - `[document-governance-authority-hardening] docs/specs/document-governance-authority-hardening.md [Shipped] [Updated: 2026-03-30]`
  - `[document-governance-external-intake-hardening] docs/specs/document-governance-external-intake-hardening.md [Shipped] [Updated: 2026-03-30]`
  - `[document-governance-final-polish-hardening] docs/specs/document-governance-final-polish-hardening.md [Shipped] [Updated: 2026-03-30]`
  - When reading specs: only open files tagged with the current task's module.
- **Canonical Commands**:
  - `/spec-intake`: Import external specs (from other LLMs, documents, or natural language). Handles large product specs via decomposition. Runs before `/bootstrap`.
  - `/bootstrap`: Task initialization & classification freeze.
  - `/plan`: Define target files, steps, risks, and rollback.
  - `/implement`: Execute implementation only when `IMPLEMENTABLE`.
  - `/review`: Check AC alignment & scope creep.
  - `/test`: Report test coverage via Test Skeleton.
  - `/handoff`: Output resumable state summary (mandatory for non-tiny-fix).
  - `/decide`: Record key decisions with reasoning to prevent cross-session re-derivation.
  - `/test-classify`: Auto-select test depth and evidence format based on task classification.
  - `/ship`: Consolidate evidence and update/archive state.
  - `ask-openrouter`: [OPTIONAL] External model delegation (natural language or `/or-*` commands). See `.agent/workflows/ask-openrouter.md`.
  - `codex-cli`: [OPTIONAL] Codex CLI delegation. See `.agent/workflows/codex-cli.md`.
- **References**:
  - `AGENTS.md`
  - `.agent/rules/engineering_guardrails.md`
  - `.agent/rules/state_machine.md`
  - `.agentcortex/docs/CODEX_PLATFORM_GUIDE.md`
  - `.agentcortex/docs/guides/token-governance.md` *(manual-only — do NOT auto-read during bootstrap or phase entry)*
  - `.agentcortex/docs/guides/context-budget.md` *(manual-only — do NOT auto-read during bootstrap or phase entry)*

> [!NOTE]
> This file is the Single Source of Truth for global project context only.
> Do not store per-task progress here; write progress to `.agentcortex/context/work/<worklog-key>.md`.

## Global Lessons (AI Error Pattern Registry)
>
> Structured format:
> `- [Category: <tag>][Severity: <HIGH|MEDIUM|LOW>][Trigger: <normalized-trigger>] <lesson>`
>
> `/implement` reviews active HIGH-severity lessons before code changes. `/retro` may append new structured entries via guarded write.

- [Category: global-memory][Severity: MEDIUM][Trigger: archive-handoff] Branch-local lessons are lost after archival. Use the Global Lessons registry for repeatable patterns that should survive work log rotation.
- [Category: format-safety][Severity: HIGH][Trigger: apply-patch-line-numbers] Do not copy line numbers from view tools into edits; they corrupt file patches.
- [Category: path-safety][Severity: HIGH][Trigger: bulk-rename] Validate for accidental double-prefix replacements like `agentcortex/agentcortex/...` immediately after bulk path rewrites.
- [Category: wrapper-validation][Severity: MEDIUM][Trigger: wrapper-validation] Wrapper checks should assert behaviorally equivalent path construction, not only one literal path string.
- [Category: shell-portability][Severity: MEDIUM][Trigger: cross-platform-validation] Cross-platform validation entrypoints should prefer portable `grep`-style checks over environment-specific `rg` assumptions.
- [Category: worklog-contract][Severity: HIGH][Trigger: branch-normalization] Resolve filesystem-safe work log keys from raw branch names before gate checks; missing active logs are recoverable, but missing evidence is not.
- [Category: patch-fallback][Severity: LOW][Trigger: apply-patch-instability] When `apply_patch` is unstable on this Windows workspace, use tightly scoped whole-file rewrites only for new or text-only files, then immediately re-verify with `git diff --check`.
- [Category: detector-validation][Severity: MEDIUM][Trigger: integrity-baseline] Validate new integrity checks against real repo bytes before baselining, or pure-LF files may be misclassified as mixed EOL.
- [Category: shell-dependency][Severity: HIGH][Trigger: validation-runtime-dependency] Cross-platform validation entrypoints must not add new hard runtime dependencies unless the migration path is documented.
- [Category: path-separation][Severity: HIGH][Trigger: framework-path-migration] Downstream-facing artifacts such as specs and ADRs must stay in project-visible `docs/` paths, not hidden framework directories.
- [Category: review-process][Severity: LOW][Trigger: multi-role-review] Different reviewer personas catch different failure classes; multi-role review is useful for high-risk template changes.
- [Category: guard-placement][Severity: HIGH][Trigger: write-path-guard] Place guardrail rules where all relevant classifications read them, not only in documents that some tiers skip.

## Ship History
>
> Older entries have been compacted to reduce context size. See `.agentcortex/context/archive/ship_history_archive.md`.

### Ship-feat-doc-lifecycle-governance-2026-03-29

- Feature shipped: addressed 6 Keeva field report defects — introduced Domain Doc two-layer architecture (L1 Synthesis + L2 Decision Log), knowledge consolidation in /ship, document taxonomy (7 types), fast-path safety predicates, SSoT heartbeat (Update Sequence), shipped spec lifecycle, and structured extraction protocol (## Domain Decisions). 14 files changed, 573 insertions, 2 deletions. Knowledge Consolidation dogfood: docs/architecture/document-governance.{md,log.md} created.
- Tests: Pass (validate.sh 44/44, 13 structural tests, adversarial 4/4)

### Ship-feat-doc-lifecycle-governance-2026-03-30

- Feature shipped: hardened downstream document-governance adoption by adding bounded retrofit/advisory workflow wording, validator-backed checks for primary_domain and review routing_actions, and a follow-up Layer 2 decision-log entry without redesigning the routing model.
- Tests: Pass

### Ship-feat-doc-lifecycle-governance-authority-2026-03-30

- Feature shipped: hardened document-governance authority boundaries by requiring status: living for bootstrap L1 reads, preserving workflow contracts in the L1 synthesis doc, and making /ship primary_domain skip paths explicitly justify against spec frontmatter.
- Tests: Pass

### Ship-feat-doc-lifecycle-governance-external-intake-2026-03-30

- Feature shipped: hardened external spec intake by forcing architecture specs and PRDs through /spec-intake, adding L1 conflict checks for external assumptions, protecting legacy domain-doc warnings from unsafe frontmatter edits, and preserving bootstrap-time primary_domain accountability through ship.
- Tests: Pass

### Ship-feat-doc-lifecycle-governance-final-polish-2026-03-30

- Feature shipped: finalized document-governance hardening by making external-spec intake trigger on substantial background material, requiring the fuller L1 frontmatter contract (`status: living` + `domain:`), and giving explicit acceptable `/ship` skip examples.
- Tests: Pass
