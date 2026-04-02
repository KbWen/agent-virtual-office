# AgentCortex Project Architecture & Workflow Overview (v3.5.4)

## 1. Directory Structure

```text
.
├── .agent/                 # Agent Intelligence (Rules & Workflows)
│   ├── rules/              # Guardrails (The Constitution)
│   │   └── engineering_guardrails.md
│   └── workflows/          # Standardized Slash Commands (/plan, /ship, etc.)
│       ├── bootstrap.md    # Task initialization
│       ├── plan.md         # Implementation planning
│       ├── implement.md    # Execution logic
│       ├── handoff.md      # Cross-turn state management
│       ├── ask-openrouter.md # Optional External AI Delegation
│       └── codex-cli.md    # Optional Codex CLI Delegation
├── .agents/skills/         # Professional Skill Modules (Codex compatible)
├── .github/                # Issues & PR Templates
├── docs/                   # Documentation & Context SSoT
│   ├── adr/                # Architecture Decision Records
│   ├── context/            # Memory & State Layer
│   │   ├── current_state.md # Single Source of Truth (SSoT)
│   │   └── work/           # Active Task Work Logs (Isolation)
│   ├── guides/             # User & Model Guides
│   └── specs/              # Verifiable Product Specifications
├── tools/                  # Audit & Validation Scripts
├── AGENTS.md               # Global directives (Loaded every turn)
├── CHANGELOG.md            # Version history
├── README.md               # English Overview
└── README_zh-TW.md         # Traditional Chinese Overview
```

## 2. Core Governance Philosophy

- **Zero-Bloat, Zero-Token**: minimize metadata updates and unnecessary file reads.
- **Fail-Fast Delegation**: §8.2 protocol ensures cost-tier checks happen before I/O checks.
- **SSoT Isolation**: All changes start in a `work/` log and only sync to `current_state.md` during `/ship`.
- **Mirror Language**: Automatic response language targeting based on user input.

## 3. The Standard Workflow Lifecycle

1. **`/bootstrap`**: AI reads `current_state.md`, classifies task (tiny, quick, feature, etc.), and initializes a `work/<worklog-key>.md` log.
2. **`/plan`**: Proposes a change list, risks, and verification plan. AI must wait for approval.
3. **`/implement`**: Executes code changes safely based on the plan.
4. **`/test`**: Verifies logic with clear evidence (test logs or behavior diffs).
5. **`/handoff`**: Summarizes the context for the next AI session to ensure continuity.
6. **`/ship`**: Finalizes the task, updates `current_state.md`, and marks logs for archival.

## 4. External AI Delegation (Accelerators)

- **`ask-openrouter`**: For complex design, review, or high-tier reasoning via natural language.
- **`codex-cli`**: For precise filesystem edits and lexical workspace scans.
- **Safety**: Both follow "Junior Tool" protocol—AI must review their output before applying.
