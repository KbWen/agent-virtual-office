# ADR-001: vNext Self-Managed AI Architecture

## Context

The project needs a scalable, self-regulating AI development environment that works across Google Antigravity, Codex Web, and Codex App. Previous architectures relied too much on human memory and conversation history, leading to context loss and inefficiency.

## Decision

We implement the "vNext" architecture, characterized by:

1. **Self-Managed Agent lifecycle**: AI classifies tasks and applies "Lazy Governance" gates automatically.
2. **Parallel-Safe State**: Separation of Read-Only global state (`current_state.md`) and Write-Isolated task state (`docs/context/work/`).
3. **Handoff as a Hard Gate**: Mandatory context reconstruction for all tasks except `tiny-fix`.
4. **Token Optimization**: Fast-paths for small fixes and minimized state documentation.

## Classification Escalation Rules

- Change to public API/Signature -> `behavior-change`
- Multiple modules involved -> `feature`
- New directories -> `feature`
- System boundary changes -> `architecture-change`

## Mandatory Gates

- `tiny-fix`: Classify + Inline Plan + Evidence
- `behavior-change`: Bootstrap + Spec + Plan + Review + Regression + Handoff
- `feature`: Bootstrap + Spec + Plan + Review + Test + Handoff
- `architecture-change`: Bootstrap + ADR + Spec + Plan + Migration + Handoff
- `hotfix`: Systematic Debug + Evidence + Retro + Handoff

## Consequences

- AI handles governance overhead autonomously.
- Token consumption is optimized based on task risk.
- Cross-agent collaboration is safer due to explicit task logs.

