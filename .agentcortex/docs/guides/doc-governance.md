---
name: Document Lifecycle Governance
description: Taxonomy, naming axiom, and creation gate for governance documents
status: living
authority: extracted from AGENTS.md (2026-05-07) to keep AGENTS.md within token budget
---

# Document Lifecycle Governance

## Document Taxonomy

| Type | Path | Status | Owner Workflow |
|---|---|---|---|
| Domain Doc (L1 Synthesis) | `docs/architecture/<domain>.md` | `living` | `/govern-docs` |
| Domain Doc (L2 Decision Log) | `docs/architecture/<domain>.log.md` | `living` | `/ship` |
| Feature Spec | `docs/specs/<feature>.md` | `draft→frozen→shipped` | `/spec`, `/ship` |
| ADR | `docs/adr/ADR-NNN-<name>.md` | `accepted` | `/adr` |
| Product Backlog | `docs/specs/_product-backlog.md` | `living` | `/spec-intake` |
| Guide | `docs/guides/<topic>.md` | `living` | varies |

## Naming Axiom

**One topic, one canonical file.** Before creating any new `.md` file in `docs/`, AI MUST verify no existing file covers the same domain (`ls docs/<subdir>/`). If a canonical file exists, write a pointer, not a copy. Duplicating content across documents is a governance violation.

## Document Creation Gate

Before creating any new governance document, AI MUST answer three questions:

1. Does this topic already have a canonical home? (check `docs/` structure)
2. Can a reader 6 months from now guess this file's location from its name alone?
3. Can this be a section in an existing file rather than a new standalone file?

If the answer to #3 is yes → add a section, do not create a new file.

## Override Layer (`AGENTS.override.md`) — soft-launch

Per-machine or per-fork overrides MUST live in a sibling override file rather than mutating canonical governance docs. This mirrors the Codex `AGENTS.override.md` precedence pattern (<https://developers.openai.com/codex/guides/agents-md>).

**Precedence chain** (later layers override earlier):

1. `AGENTS.md` (this file — canonical, committed)
2. Project root `AGENTS.override.md` (committed only if the project intends the override to apply to all collaborators; otherwise gitignored)
3. `~/.agentcortex/AGENTS.override.md` (per-user, never committed)

**Rules**:

- Override files MAY refine, narrow, or disable specific directives. They MUST NOT relax the gate sequence in `## Delivery Gates` or the No-Bypass Rule in `## Core Directives` — those are framework invariants.
- Each override directive MUST cite the section it overrides: `> Overrides: AGENTS.md §<section> — <reason>`.
- Agents SHOULD read override files at session start when present, in the precedence order above. Missing override files are not an error.

**Status**: soft-launch. Documented but not yet runtime-enforced. Treat absence of an override file as the default; the rule activates the moment one is created.
