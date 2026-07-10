---
description: Workflow for review
---
# /review

Conduct strict review of current changes.

## Phase Verification

**Phase Verification** (per bootstrap §2b): Read `Current Phase` from Work Log header. Verify transition to `review` is legal. If illegal, STOP. Otherwise update `Current Phase: review`. If a new commit was created since the last `Checkpoint SHA`, SHOULD refresh it.

## Work Log Compaction Check

Before review, check the active Work Log size. If it exceeds compaction thresholds (see `.agent/config.yaml` §worklog), compact per `/handoff` §6 BEFORE proceeding. This prevents bloated logs from inflating token costs during the review phase.

## Spec Drift Advisory

If the active Work Log references a `docs/specs/<feature>.md` file, run the advisory spec drift linter before the Burden of Proof table:

```sh
python .agentcortex/tools/lint_spec_drift.py --worklog .agentcortex/context/work/<worklog-key>.md --base <Diff Base SHA> --head HEAD
```

Use the immutable `Diff Base SHA` from the Work Log header (full implemented diff, not just recent commits — AC-4). **Legacy fallback** (logs lacking `Diff Base SHA`): use `Checkpoint SHA` with a one-time WARN; never silently reinterpret it as the diff base.

This check is advisory and non-blocking. Warnings can inform review questions, but they do NOT change the review verdict rules; AC proof still comes from the Burden of Proof Protocol below.

## Skill-Aware Review (Pre-Check)

Apply the Phase-Entry Skill-Loading Protocol (shared-contracts.md §Phase-Entry Skill Loading) for all skills listing `/review` in their phases. Read `Recommended Skills` from the active Work Log before selecting which skill guidance to apply in this phase. Then apply each skill's **"During /review:"** checklist items as additional review criteria. Explicitly state: "Reviewing with [skill-name] checklist applied."

This ensures domain-specific review criteria (API conventions, frontend patterns, DB safety, auth compliance) are enforced — not just generic code review.

## Adversarial Reviewer Freshness Invariant

> Codifies Global Lesson `[Category: audit-method][Severity: HIGH][Trigger: multi-agent-roundtable-same-vendor]` (current_state.md, ref: 4faa557a).

When `/review` dispatches a sub-agent for adversarial review (e.g., `acx-reviewer`, code-review skill, red-team scan), the sub-agent **MUST be a fresh Task() instance** with no carryover from the `/implement` context.

- ❌ **Prohibited**: reusing the implementing agent's session, memory, or transcript for review.
- ❌ **Prohibited**: passing implementation rationale as review context ("here's why I made these choices, please review").
- ✅ **Required**: spawn the reviewer with ONLY the diff + spec/AC + relevant standards. The reviewer must derive correctness independently.

**Why**: Same-context review is confirmation bias by construction. The reviewer ratifies the implementer's choices instead of independently testing them.

**Cross-vendor caveat**: even fresh same-vendor sub-agents share training-data blind spots (Lesson 4faa557a). For `architecture-change` and trust-boundary work, the review MUST add at least one external signal: WebFetch of authoritative published sources, `/ask-openrouter` to a different vendor, OR human review. Single-vendor adversarial roundtables are theatre for these classifications.

**IF `doc-lookup` is active during review:**
- For each framework API call in the diff, verify it matches official documentation:
  - Method signatures, parameter order, return types are correct
  - No deprecated APIs used without explicit migration plan
  - Config values are valid per official docs (not invented)
- If `/implement` left `// TODO: verify against official docs` caveat comments, resolve them NOW via WebFetch
- Check that `package.json` / `pubspec.yaml` / `requirements.txt` pinned version matches the doc version that was consulted
- Flag any framework API usage that lacks a `Ref:` trace in the Work Log

## Minimum Checks

Apply the **5-Axis Quality Standard** across ALL changed files (block on any axis with critical/high severity miss):

| Axis | Key Questions | Severity if Missed |
|---|---|---|
| **Correctness** | Does it do what it claims? Edge cases handled? Error paths covered? | Critical |
| **Security** | Input validation? Auth checks? Injection vectors? Secrets exposure? | Critical |
| **Performance** | N+1 queries? Unbounded loops? Missing pagination? Memory leaks? | High |
| **Readability** | Clear naming? Reasonable function length? Comments where non-obvious? | Medium |
| **Architecture** | Right abstraction level? Consistent with existing patterns? Coupling minimized? | Medium |

**Sizing guideline**: Review effectiveness drops sharply above ~100 changed lines. If a diff exceeds 100 lines, flag for splitting into smaller reviewable units.

**Governance-doc diffs** (advisory): verify Deletion-First compliance (a deletion cited in the change, or a 1-line net-add justification in the Work Log) and that any NEW MUST/NEVER/gate declares its signal tier — per `engineering_guardrails.md §13`.

**Feedback categorization**: Blocking (correctness/security/stability) → must fix before merge. Non-blocking → advisory. Question → needs design context.

**Common rationalizations to reject**: "It works, that's good enough" / "Tests pass, so it's good" / "AI-generated is probably fine" / "We'll clean it up later". All four are review-bypassing patterns; the review IS the quality gate.
  - See also: `engineering_guardrails.md §4.5` Anti-Rationalization Rule — evidence citation required before verdict, not after.

Plus:

- Logic correctness
- Compatibility risks
- Violation of `.agent/rules/engineering_guardrails.md`
- Scope enforcement: MUST skip any file with `status: frozen` or `Finalized` metadata. Review scope is limited to current task's changed files only.
- External dependency discipline: if dependency manifests changed or repo-external APIs/platform features were used, verify `## External References` cites official sources and that implementation matches them.
- Known risk traceability: if `## Known Risk` is populated, confirm each listed mitigation is actually present in the code or evidence.
- Work Log visibility: active Work Logs remain local-only (gitignored) and are NOT mirrored into the repo for review. Review evidence lives in the PR description and the Work Log itself; `/ship` enforces the full completion gate before any SSoT update.
- ACX shim enforcement: if the phase being reviewed has a corresponding `.claude/agents/acx-<phase>.md` shim AND the implementation dispatched subagents, verify that `subagent_type` used the correct `acx-*` shim name. Subagents spawned without the shim will NOT receive native skill injection — flag as **MEDIUM** defect requiring a follow-up fix in the calling workflow.

## Error Observability Compliance (§5.2a)

For each `catch` / error-handling block in the changed files, verify:

1. **Logging call exists** (syntax check — per §5.2)
2. **Logger is production-observable** (semantic check — per §5.2a): the log call must NOT be a debug-only API (`debugPrint`, `print`, `console.log` in debug-only mode, or any tree-shaken / release-stripped API). It must use the project's production logger.
3. **Error context is actionable**: the log message includes enough context to diagnose the issue (not just `"error occurred"` — include the error type, relevant identifiers, and operation that failed).

If the project has no identifiable production logging strategy (no logger framework, no crash reporter integration), flag:
> *"⚠️ No production-observable error sink identified in this project. Errors in catch blocks may be invisible in release builds. Resolve before `/ship`."*

**Scope**: Application/service code only. Test files and CLI dev tools are exempt.

## Design Compliance Check (UI Tasks — Mandatory)

> Ref: `engineering_guardrails.md` §4.4 — Design-First Rule

For any task that modified user-visible UI, the reviewer MUST:

1. **Design Link Verification**: Confirm `## Design Reference` exists in the Work Log with a valid `Link:`. Missing link on a UI task → **Review verdict = Not Ready**. Route back to `/plan`.
2. **1:1 Fidelity Audit** — compare implementation against DSoT (Stitch, Figma, Pencil, etc.):
   - Layout structure (component hierarchy, positioning, flow)
   - Spacing & sizing (margins, padding, dimensions)
   - Typography (font family, size, weight, line-height)
   - Colors & theming (exact values, dark/light variants if specified)
   - Interactive states (hover, focus, disabled, loading, error, empty)
   - Responsive behavior (if specified in the design)
3. **Deviation Severity**:
   - **HIGH**: Structural deviation (wrong component, missing element, incorrect layout flow) → Review verdict = **Not Ready**. MUST fix.
   - **MEDIUM**: Metric deviation (spacing off by >2px, wrong font weight, color mismatch) → Must fix or obtain explicit design-owner approval recorded in Work Log.
   - **LOW**: Minor polish (sub-pixel rounding, platform-specific rendering) → Informational.

### Design Compliance Verdict

Append to the review output:

```
## Design Compliance
| Element | DSoT Reference | Implementation | Verdict |
|---------|---------------|----------------|---------|
| [component/screen] | [DSoT link § section] | [file:line] | ✅ Match / ⚠️ Deviation / ✗ Missing |
```

Any `✗ Missing` or unresolved HIGH `⚠️ Deviation` → cannot proceed to `/test`.

**Exempt**: Backend-only tasks, CLI tools, infrastructure, non-visual config changes, `tiny-fix`.

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

## Burden of Proof Protocol (ALL non-tiny-fix classifications)

> **Core principle**: Every claim of correctness starts as **UNPROVEN**. The reviewer must cite concrete evidence to flip it to PASS. This inverts the default from "find problems to fail" to "find evidence to pass", eliminating confirmation bias.

### For feature / architecture-change (Spec-Based)

Cross-reference implementation against EVERY AC in the referenced `docs/specs/<feature>.md`:

1. List all ACs. Each starts as `✗ UNPROVEN`.
2. For each AC, the reviewer MUST provide **specific evidence**:
   - Code evidence: `file:line` reference proving the AC is implemented
   - Test evidence: test name or test output proving the AC is verified
   - Output evidence: terminal output or screenshot proving the AC works
3. Evidence provided → flip to `✅ PROVEN (evidence: <citation>)`.
4. Evidence insufficient or missing → remains `✗ UNPROVEN`.
5. Partial evidence → `⚠️ PARTIAL (evidence: <citation>, gap: <what's missing>)`.

**Gate rule**: Any AC remaining `✗ UNPROVEN` → STOP. Cannot proceed to `/test` until resolved or explicitly deferred via `[NEEDS_HUMAN]` with user acknowledgment.

### For quick-win / hotfix (Behavioral)

These classifications have no formal spec, but the burden of proof still applies:

1. Extract the task's expected behavioral change from Work Log `## Task Description`.
2. The reviewer MUST cite evidence that the change works:
   - Before/after behavior comparison with `file:line` or output reference
   - Root cause addressed (for hotfix): cite the specific fix location
3. No evidence → `✗ UNPROVEN` → cannot proceed.

### Evidence Output Format

```
## Burden of Proof
| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| AC-1 | [description] | ✅ PROVEN | `src/foo.dart:42` implements X; `test/foo_test.dart:15` verifies |
| AC-2 | [description] | ✗ UNPROVEN | No test covers edge case Y |
| AC-3 | [description] | ⚠️ PARTIAL | `src/bar.dart:10` implements, but no test — [NEEDS_HUMAN] |
```

After completing the table, emit the Gate Receipt for Work Log `## Gate Evidence`. The verdict is **conditional** — PASS only when all AC rows are either `✅ PROVEN` or explicitly tagged `[NEEDS_HUMAN]`:
- **If zero `✗ UNPROVEN` rows remain** (or all UNPROVEN are `[NEEDS_HUMAN]`):
  ```
  - Gate: review | Verdict: PASS | Classification: <classification> | Timestamp: <ISO>
  ```
- **If any `✗ UNPROVEN` row exists without `[NEEDS_HUMAN]` tag**: the review is incomplete. The receipt MUST be `NOT READY`, not `PASS`. Proceed through the `## Reverse Transition` block below instead of writing a PASS receipt.

The Burden of Proof table stays in the review output for human readability; the receipt goes to Gate Evidence for CI validation.

## Self-Check Protocol (Auto — Before Presenting Results)

AI MUST verify its own review before outputting:

1. **Scope check**: List every file changed. Any file NOT in the original plan? Flag it.
2. **Regression check**: For each changed function/export, state: "Callers: [list]. Breaking change: yes/no."
3. **Proof completeness check**: Verify the Burden of Proof table has zero `✗ UNPROVEN` rows (or all UNPROVEN rows are explicitly tagged `[NEEDS_HUMAN]`). If any UNPROVEN row lacks a tag, the review is incomplete — do NOT present as ready.

## Output Format

Apply the shared `Phase Output Compression` contract from `shared-contracts.md §Phase Output Compression → /review`.

**Chat response leads with the Burden of Proof table. Everything else is terse.**

Required chat content (in this order):
1. **Burden of Proof table** (mandatory — see §Burden of Proof Protocol). Table only; no prose preamble.
2. **Issues** — 1 line per issue: `<severity>: <file:line> — <1-line>`. If none: `Issues: none`.
3. **Security** — 1 line. If none: `Security: clean`. Findings detail goes to Work Log.
4. **Red Team** — 1 line (only if triggered). Findings detail goes to Work Log.
5. **External Refs** — `verified | missing | stale` with count.
6. **Verdict** — `Ready to commit: yes | no`. If `no`, 1-line reason.

Compression rules:
- Do not reprint the full task description, plan, or AC prose — they are in the Work Log.
- Do NOT include "Fix suggestions" in chat unless the user asks. Write them to Work Log `## Review Feedback` instead.
- Delta-only: state what changed since `/implement`, not what the whole branch does.
- If zero issues: one line (`Issues: none`) is sufficient. No "residual risk commentary" paragraph.

## Domain Decisions Tag Validation (AC-10, feature / architecture-change)

If the referenced spec contains a `## Domain Decisions` section, validate each entry:

1. Every entry MUST begin with one of: `[DECISION]`, `[TRADEOFF]`, or `[CONSTRAINT]`.
2. Any entry missing a valid tag = **review warning** (not hard block). Output: `"⚠️ Domain Decisions entry missing valid tag: '<entry prefix>'. Must be [DECISION], [TRADEOFF], or [CONSTRAINT]."`
3. Count total entries. If > 10: **review warning**: `"⚠️ Domain Decisions has N entries (max 10). Prune before /ship to keep knowledge consolidation tractable."`
4. If `## Domain Decisions` section is absent from a `feature` or `architecture-change` spec: output advisory: `"Domain Decisions section not found in spec. Knowledge consolidation will be skipped at /ship. Consider adding key decisions before proceeding."`

`tiny-fix`, `quick-win`, and `hotfix` are EXEMPT from this check.

## Backlog Finding Registration

If the review produces actionable findings that are NOT immediately fixed in this session, log them in `docs/specs/_product-backlog.md` via `/spec-intake` (or directly if the backlog already exists):
- Set `Kind: review-finding`
- Set `Labels` to the affected domain (e.g., `api`, `auth`, `infra`)
- Set `Priority` based on severity: CRITICAL/HIGH → P0 or P1; MEDIUM → P1 or P2; LOW → P2 or `—`

This ensures review findings enter the planning loop rather than being lost in the Work Log.

## Phase Summary Update

After review is complete, append one line to `## Phase Summary` in the Work Log:
```
- review: [1-line summary — verdict, security findings count, spec compliance status]
```

## Reverse Transition (Not Ready Verdict)

If verdict = **Not Ready**, the agent MUST execute the reverse transition before closing the review session:

1. Update Work Log `Current Phase: implement` (do NOT leave it as `review`).
2. Append to `## Phase Summary`: `- review: Not Ready — [blocking issues list] — routed back to implement`.
3. Record the reverse edge in `## Gate Evidence`: `- Gate: review | Verdict: NOT READY | Transition: REVIEWED→IMPLEMENTING | Timestamp: <ISO>`.
4. State clearly to the user: "Route back to `/implement` to address: [list of blocking issues by severity]."

This ensures the state machine correctly records the remediation loop. Leaving `Current Phase: review` on a Not Ready verdict creates a phantom REVIEWED state that blocks future phase-progression validation.

## Optional: Cloud Adversarial Review (Claude Code CLI only)

When running inside Claude Code CLI and the change is high-stakes (auth, data migration, public API, security-sensitive logic), the user MAY invoke `/ultrareview` to dispatch a fleet of bug-hunting agents in Anthropic's cloud against the current branch or a PR. This is **opt-in and Claude-CLI-only** — not part of the cross-platform `/review` contract.

- Trigger: user types `/ultrareview` (no args = current branch) or `/ultrareview <PR#>`.
- Findings land back in the CLI / Desktop automatically.
- Receipts: paste returned findings (or summary) into Work Log `## External References` as `External Review: ultrareview run-<id> — <verdict>`. Do NOT count this toward the Burden of Proof table unless the user confirms the verdict applies to current head.
- Cost: billed against the user's Claude account; agent MUST NOT auto-trigger.

Reference: <https://code.claude.com/docs/en/ultrareview>.

## Heading-Scoped Read Note

For token budgeting and future automation, `/review` entry reads only:
- `Skill-Aware Review (Pre-Check)`
- `Minimum Checks`
- `Design Compliance Check`
- `Burden of Proof Protocol`
- `Security Scan`
- `Red Team Scan`
- `Self-Check Protocol`

Read `Output Format`, `Domain Decisions Tag Validation`, and `Phase Summary Update` only when preparing the final review output.
