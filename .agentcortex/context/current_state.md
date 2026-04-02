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
- **Last Updated**: 2026-04-02
- **Update Sequence**: 2
- **ADR Index**:
  - `.agentcortex/adr/ADR-001-vnext-self-managed-architecture.md`
- **Active Backlog**: `docs/specs/_product-backlog.md`
  - 15 features across 5 themes: 辦公室生命感、資訊密度、互動性、整合延伸、視覺升級
  - **Done (branch `fix/agent-inspector-hooks-crash`, 2026-04-02)**:
    - #10 smart file routing (fileToRole in hook)
    - #11 multi-worktree (session slug files, 1-per-session merge)
    - #12 webhook endpoint (/api/event, 11 events + custom)
    - Designer character (pink female, design corner, poetic bubbles)
    - Skill-aware hooks: Stop/UserPromptSubmit/subagent skill context
    - Compound skill routing (eng_review→arch, ceo-review→gate, etc.)
    - Review P0/P1 fixes (event validation, project scoping, dead cache)
    - AgentCortex upgraded to v5.4.0
  - **Remaining P1**: #1 角色成長系統, #5 Inspector 資訊加強, #7 可點擊辦公室物件
  - **Branch status**: `fix/agent-inspector-hooks-crash` pushed, ready to PR → main
- **Spec Index**:
  - [maintenance] docs/specs/engineering-audit-remediation.md [Draft]
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

### fix-agent-inspector-hooks-crash-2026-04-02

- Feature shipped: Designer character, multi-worktree support, skill-aware hooks (Stop/UserPromptSubmit/skill context), smart file routing, webhook endpoint, compound skill routing, review P0/P1 fixes, AgentCortex v5.4.0 upgrade.
- Tests: Pass (98/98 vitest, no console errors)
