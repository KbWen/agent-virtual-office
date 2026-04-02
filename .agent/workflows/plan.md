---
name: plan
description: Outputs actionable plan & enforces quality gates. Transitions state to IMPLEMENTABLE.
tasks:
  - plan
---

# /plan

> Canonical state & transitions: `Ref: .agent/rules/state_machine.md`

NO CODING YET. Planning phase ONLY.

## Gate Engine (Turn 1 — Antigravity Hard Path)

Before producing ANY plan content, output the Minimal Gate Block:

```yaml
gate: plan
classification: <from Work Log>
branch: <current branch>
checks:
  worklog_exists: yes|no
  spec_exists: yes|no|na
  state_ok: yes|no
verdict: pass|fail
missing: []
```

- If `verdict: fail` → output ONLY the gate block with populated `missing` list. STOP.
- Evaluate `worklog_exists` only after resolving the active Work Log path for the current `<worklog-key>`.
- If the active Work Log is missing but recoverable, create or recover it, warn the user, and continue. Only unresolved Work Log lookup failures should set `verdict: fail`.
- **Phase Verification** (per bootstrap §2b): Read `Current Phase` from Work Log header. Verify transition to `plan` is legal. If illegal, STOP. Otherwise update `Current Phase: plan`.
- If classification is `feature` or `architecture-change`:
  - Output: "Gate passed. Awaiting your confirmation to proceed with planning."
  - STOP. Do not produce any plan content until user replies affirmatively.
- If classification is `quick-win` or `hotfix`:
  - Proceed directly to plan output (no handshake needed).

## Gate Evidence Receipt

After outputting the gate block, append a compact gate receipt to the Work Log under `## Gate Evidence`:

```markdown
- Gate: plan | Verdict: pass | Classification: <tier> | At: <ISO-timestamp>
```

If `verdict: fail`, the receipt records the failure and missing items. This makes gate progression auditable by `validate` without requiring a runtime hard blocker.

## Pre-Conditions (Existing)

- **Spec Gate**: If task classification is `feature` or `architecture-change`:
  - MUST have a corresponding `docs/specs/<feature>.md` with `status: draft` or `status: frozen`.
  - If no spec exists: STOP. Output: "⚠️ No specification found. Run `/spec` first."
- `tiny-fix`, `quick-win`, and `hotfix` are EXEMPT from this gate.

## External References Gate

If the plan depends on a repo-external library, external API, package manager change, or unfamiliar platform capability:

1. Run `/research` first or verify equivalent official references already exist in the active Work Log.
2. Record them in `## External References` using authoritative sources only.
3. If the section is empty or `none`, planning MUST flag the gap and stop before `/implement`.

## Skill-Aware Planning (Auto-Enforced)

IF the active Work Log contains a `Recommended Skills` entry AND those skills list `/plan` in their `phases:` metadata:
1. Read `## Skill Notes` first for the current phase.
2. Apply the cache-hit / cache-miss rules from `.agent/config.yaml §skill_cache_policy`. Only on a cache miss may you re-read the full `SKILL.md` and refresh `## Skill Notes`.
3. Explicitly state: "Applying [skill-name] strategy for planning."
4. Apply planning-specific constraints from those skills when shaping steps, verification, and rollback.

**IF `writing-plans` is active:**
- Use the skill's plan structure as the default plan skeleton.
- Keep every step independently verifiable and revertible.

**IF `database-design` is active:**
- Include migration safety, rollback shape, and schema verification in the plan.

**IF `auth-security` is active:**
- Include auth/permission risk checks and security verification in the plan.

## Expected Output Format

1. Target Files
2. Execution Steps (2-10 min granularity)
   - Steps MUST be **Functionally Atomic** (a single logical unit of change, e.g., "Implement Data Schema").
   - Each step MUST have a 1-line verification method (e.g., test command, logic check, or grep).
3. Risks & Rollback Strategy
4. Acceptance Criteria Coverage
5. Non-goals

## Quality Gates (ALL MUST PASS)

- Every AC MUST map to at least 1 step.
- Step granularity: Module/File/Function level.
- MUST identify at least 1 Risk + viable Rollback.
- List ONLY files being modified (Prevent scope creep).
- MUST explicitly cite documentation (e.g., `Ref: docs/specs/auth.md`).
- **Frozen Spec Pre-Check**: Cross-reference target files against Spec Index entries tagged `[Frozen]`. If any target file falls under a Frozen Spec, warn immediately: "⚠️ [file] is governed by Frozen Spec [spec-name]. Unfreeze required before proceeding. Approve? (yes/no)"

## Spec Feedback Loop

- If planning reveals that the Spec's AC, constraints, or boundaries need adjustment:
  1. STOP planning.
  2. Surface: "⚠️ Spec adjustment needed: [reason]. Returning to `/spec`."
  3. Apply §4.2 Unfreeze protocol if spec is frozen.
  4. Update `docs/specs/<feature>.md`, then resume `/plan`.
- The Plan MUST NOT contradict the Spec. If there's a conflict, Spec wins.

## Work Log Update (Mandatory)

After plan is approved, AI MUST append to the current Work Log:

```markdown
## Risks (from /plan)
- [Risk 1]: [brief description + mitigation]
- [Risk 2]: ...
- [Risk 3]: ...

## External References
- [Official doc / API / package release note] | [why it is needed]
```

This block persists across sessions. On resume, /bootstrap reads it immediately.

## Token Budget Checkpoint

- Plan MUST include `Mode: Normal` or `Mode: Fast Lane`.
- If task is small but output balloons, MUST switch to `Fast Lane` using summarization next turn.
- Detailed rules: `Ref: .agentcortex/docs/guides/token-governance.md`.

## Phase Summary Update

After plan is approved, append one line to `## Phase Summary` in the Work Log:
```
- plan: [1-line summary — key decisions, target files count, mode Normal/Fast Lane]
```

## State Transition

- Upon passing gates, state transitions from `PLANNED` to `IMPLEMENTABLE`.
- Automatically offer `/test-skeleton` in the same turn.
