# ADR-002 — Multi-Worktree Session Design

**Status:** Accepted
**Date:** 2026-04-02
**Branch:** `fix/agent-inspector-hooks-crash`

---

## Context

Claude Code allows multiple worktrees to run in parallel (e.g., `main`, `feat/xyz`, `fix/abc`). All of them write hook events to the same `~/.claude/` directory. The virtual office needs to distinguish events from *this* project vs. other projects, and show one representative character per active session.

---

## Decision

### 1. Session slug naming

Each session writes to a separate file: `~/.claude/office-status-{slug}.json`

The slug is derived from the current git branch at hook invocation time:
```
git rev-parse --abbrev-ref HEAD  →  "feat/my-feature"
slug = "feat-my-feature"         →  replace /[^a-z0-9]/g with "-", lowercase
```

The bare file `office-status.json` is preserved as a legacy fallback for old hooks.

### 2. Project isolation via `_cwd`

Every session file written by the hook includes the project root:
```json
{ "_cwd": "/Users/x/projects/my-app", ... }
```

The GET `/api/status` handler filters:
- If `_cwd` is set and does not resolve to `process.cwd()` → **skip** (other project)
- If `_cwd` is absent and filename is NOT `office-status.json` → **skip** (slugged file from old hookless run)
- If `_cwd` is absent and filename IS `office-status.json` → **allow** (legacy fallback)

### 3. One representative per session

When multiple worktrees are active, the GET handler picks one representative character per slug:
- Priority: `blocked` > `working` (never show `done` or `idle` as representative)
- Representatives are displayed as overflow characters in the lobby

### 4. Agent ID for worktree agents

Overflow characters use the agentId format `{slug}~{role}` (e.g., `feat-my-feature~dev`). The UI strips the prefix for style/name lookups and shows the branch slug as a badge.

### 5. Deduplication within 2 seconds

Old user-level hooks (without `_cwd`) may write `office-status.json` at the same time as the new slugged file. The GET handler deduplicates: if the same `_seq` arrives within 2 seconds with the same role/status, it is collapsed to one entry.

---

## Consequences

- **Pro:** Multiple worktrees for the same project each get a visible character in the lobby; different projects are fully isolated.
- **Pro:** Old hooks (no `_cwd`) continue to work as the `office-status.json` fallback.
- **Con:** Slugged files accumulate in `~/.claude/` — they expire after 5 minutes of inactivity (TTL enforced by GET handler).
- **Con:** Branch renames during a session will result in a new slug and a brief duplicate until the old file expires.

---

## Alternatives Considered

| Option | Rejected reason |
|--------|----------------|
| Single `office-status.json` with a `sessions[]` array | Race conditions when two worktrees write simultaneously without atomic locks |
| WebSocket push from hooks | Requires persistent process; contradicts "no backend" principle |
| Polling `git worktree list` from the server | Shell dependency; too slow for sub-second status updates |
