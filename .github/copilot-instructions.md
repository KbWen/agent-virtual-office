# Copilot Repository Instructions

Use `AGENTS.md` as the shared source of truth for this repository's agent behavior. Keep this file short because Copilot code review reads only the early portion of custom instruction files.

## Always Apply

- Follow `AGENTS.md ## Review guidelines` for PR review priorities.
- Prefer focused, file/line-specific findings over broad style suggestions.
- Treat correctness, security, missing tests, governance-bypass, and stale spec/backlog/SSoT metadata as higher priority than formatting.
- Do not duplicate or reinterpret Agentic OS workflow rules here; refer to `AGENTS.md` and `.agent/workflows/*.md`.
- For governance files, verify that updates preserve canonical paths and include appropriate evidence.

## Useful Paths

- Shared agent contract: `AGENTS.md`
- Claude adapter: `CLAUDE.md`
- Gemini adapter: `GEMINI.md`
- Governance workflows: `.agent/workflows/*.md`
- Guard tests: `tests/guard/`
- Contributor interaction guide: `docs/ai-contributors.md`
