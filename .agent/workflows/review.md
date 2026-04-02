---
description: Workflow for review
---
# /review

Conduct strict review of current changes.

## Phase Verification

**Phase Verification** (per bootstrap §2b): Read `Current Phase` from Work Log header. Verify transition to `review` is legal. If illegal, STOP. Otherwise update `Current Phase: review`. If a new commit was created since the last `Checkpoint SHA`, SHOULD refresh it.

## Skill-Aware Review (Pre-Check)

IF the active Work Log contains a `Recommended Skills` entry AND those skills list `/review` in their `phases:` metadata:
1. Read `## Skill Notes` first for the current phase.
2. Apply the cache-hit / cache-miss rules from `.agent/config.yaml §skill_cache_policy`. Only on a cache miss may you re-read the full `SKILL.md` and refresh `## Skill Notes`.
4. Apply each skill's **"During /review:"** checklist items as additional review criteria.
5. Explicitly state: "Reviewing with [skill-name] checklist applied."

This ensures domain-specific review criteria (API conventions, frontend patterns, DB safety, auth compliance) are enforced — not just generic code review.

**IF `doc-lookup` is active during review:**
- For each framework API call in the diff, verify it matches official documentation:
  - Method signatures, parameter order, return types are correct
  - No deprecated APIs used without explicit migration plan
  - Config values are valid per official docs (not invented)
- If `/implement` left `// TODO: verify against official docs` caveat comments, resolve them NOW via WebFetch
- Check that `package.json` / `pubspec.yaml` / `requirements.txt` pinned version matches the doc version that was consulted
- Flag any framework API usage that lacks a `Ref:` trace in the Work Log

## Minimum Checks

- Logic correctness
- Compatibility risks
- Violation of `.agent/rules/engineering_guardrails.md`
- Scope enforcement: MUST skip any file with `status: frozen` or `Finalized` metadata. Review scope is limited to current task's changed files only.
- External dependency discipline: if dependency manifests changed or repo-external APIs/platform features were used, verify `## External References` cites official sources and that implementation matches them.
- Known risk traceability: if `## Known Risk` is populated, confirm each listed mitigation is actually present in the code or evidence.
- PR-visible evidence contract: active Work Logs remain local-only. In framework/upstream repos, refresh a tracked review mirror at `.agentcortex/context/review/<worklog-key>.md` before opening or updating a PR so `agentcortex-verify.yml` can inspect the current evidence. Downstream repos may leave this path absent unless they opt into PR-visible evidence checks.
- Review mirror scope: `.agentcortex/context/review/<worklog-key>.md` may reflect an in-progress PR. CI validates legal phase progression up to the current checkpoint; `/ship` still enforces the full completion gate before SSoT updates.

## Security Scan (MANDATORY — Auto-Enforced)

Execute `.agent/rules/security_guardrails.md` §1–§4 against all changed files:

1. **Always-On Checks** (every review): Broken Access Control (A01), Cryptographic Failures (A02), Injection (A03), Secret Detection (§3).
2. **Context Checks** (when relevant code touched): A04–A10 per trigger rules in security_guardrails.md §2.
3. **Dependency Check** (§4): If any dependency manifest changed, flag new dependencies.
4. **External References Check**: if dependency manifests changed or new external integrations appear, an empty / `none` `## External References` section is a review warning and MUST be surfaced explicitly.

### Security Verdict

- Any **CRITICAL/HIGH** finding → Review verdict = **Not Ready**. MUST fix before proceeding.
- **MEDIUM** findings → Flag in review output. Proceed allowed with user acknowledgment.
- **LOW** findings → Informational only.
- Output findings using format defined in security_guardrails.md §5.

## Red Team Scan (Auto-Triggered — Classification-Based)

After completing the Security Scan above, AI MUST check the task classification from the active Work Log and apply the Red Team skill if applicable.

**Auto-Trigger Logic**:
1. Read `Classification:` from `.agentcortex/context/work/<worklog-key>.md`.
2. Apply the auto-trigger matrix defined in `.agents/skills/red-team-adversarial/SKILL.md` §When to Use.
3. Execute the corresponding mode from that skill file.

### Red Team Verdict (separate from Security Verdict)

- **CRITICAL** Red Team finding → Review verdict = **Not Ready**. MUST fix before proceeding.
- **HIGH** Red Team finding → Does NOT block. MUST record risk decision in Work Log `## Red Team Findings` section. Recommend using `/decide` to document accept/defer rationale.
- **MEDIUM / LOW** Red Team finding → Advisory only.

Output findings using the Red Team Report format defined in the skill file.

## Self-Check Protocol (Auto — Before Presenting Results)

AI MUST verify its own review before outputting:

1. **Scope check**: List every file changed. Any file NOT in the original plan? Flag it.
2. **Regression check**: For each changed function/export, state: "Callers: [list]. Breaking change: yes/no."
3. **Evidence check**: Every claim MUST have a `file:line` reference. No narrative-only assertions.

## Output Format

- Issues found (with severity)
- Security findings (per §5 format above)
- Red Team findings (if triggered — per Red Team Report format)
- External References verdict (verified / missing / stale)
- Fix suggestions
- Ready to commit? (Yes/No — blocked if unresolved CRITICAL/HIGH security findings OR CRITICAL Red Team findings)

## Spec Compliance Check (MANDATORY for feature / architecture-change)

- Cross-reference implementation against EVERY AC in the referenced `docs/specs/<feature>.md`.
- For each AC, mark: ✅ Met / ⚠️ Partially Met (explain) / ❌ Not Met.
- If any AC is ❌: STOP. Cannot proceed to `/test` until resolved.
- `tiny-fix`, `quick-win`, and `hotfix` are EXEMPT from this check.

## Domain Decisions Tag Validation (AC-10, feature / architecture-change)

If the referenced spec contains a `## Domain Decisions` section, validate each entry:

1. Every entry MUST begin with one of: `[DECISION]`, `[TRADEOFF]`, or `[CONSTRAINT]`.
2. Any entry missing a valid tag = **review warning** (not hard block). Output: `"⚠️ Domain Decisions entry missing valid tag: '<entry prefix>'. Must be [DECISION], [TRADEOFF], or [CONSTRAINT]."`
3. Count total entries. If > 10: **review warning**: `"⚠️ Domain Decisions has N entries (max 10). Prune before /ship to keep knowledge consolidation tractable."`
4. If `## Domain Decisions` section is absent from a `feature` or `architecture-change` spec: output advisory: `"Domain Decisions section not found in spec. Knowledge consolidation will be skipped at /ship. Consider adding key decisions before proceeding."`

`tiny-fix`, `quick-win`, and `hotfix` are EXEMPT from this check.

## Phase Summary Update

After review is complete, append one line to `## Phase Summary` in the Work Log:
```
- review: [1-line summary — verdict, security findings count, spec compliance status]
```

## Heading-Scoped Read Note

For token budgeting and future automation, `/review` entry reads only:
- `Skill-Aware Review (Pre-Check)`
- `Minimum Checks`
- `Security Scan`
- `Red Team Scan`
- `Self-Check Protocol`

Read `Output Format` and `Spec Compliance Check` only when preparing the final review output.
