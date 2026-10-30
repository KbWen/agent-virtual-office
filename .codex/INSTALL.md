# Agentic OS Installer (Codex)

Goal: Enable Codex (Web / App) to quickly load the workflow-first behavior of Agentic OS.

## Prerequisites

- **Git for Windows** (required on Windows — use the [official installer](https://git-scm.com/download/win) which includes Git Bash; standalone Git without Git Bash will not work)
- **Git** (required on Linux/macOS)
- **Bash** (required on all platforms — included in Git for Windows; also available via WSL on Windows)
- **Python 3.9+** (recommended — enables full validation; not required for core functionality)

## 1) Installation (Run from your target project's root directory)

**Linux / macOS / Git Bash:**
```bash
git clone https://github.com/KbWen/agentic-os.git
./agentic-os/installers/deploy_brain.sh .
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/KbWen/agentic-os.git
powershell -ExecutionPolicy Bypass -File .\agentic-os\installers\deploy_brain.ps1 .
```

**Windows (CMD):**
```cmd
git clone https://github.com/KbWen/agentic-os.git
.\agentic-os\installers\deploy_brain.cmd .
```

> If you already have the framework deployed, update directly:
> - Bash: `./installers/deploy_brain.sh .`
> - Windows (PowerShell): `powershell -ExecutionPolicy Bypass -File .\installers\deploy_brain.ps1 .`
> - Windows (CMD): `.\installers\deploy_brain.cmd .`

## 2) Verification

**Linux / macOS / Git Bash:**
```bash
.agentcortex/bin/validate.sh

# Without Python (skip Python-dependent checks)
.agentcortex/bin/validate.sh --no-python
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File .\.agentcortex\bin\validate.ps1

# Without Python
powershell -ExecutionPolicy Bypass -File .\.agentcortex\bin\validate.ps1 -NoPython
```

### Optional: local SSoT guard hook

> **Note**: Git hook templates are not deployed by default. If you need a
> pre-commit guard for SSoT writes, use `guard_context_write.py` directly
> or create your own `.githooks/pre-commit` script that checks for a
> recent guard receipt before allowing staged changes to `current_state.md`.
> This is advisory only — it does not block commits.

## 3) Opening Commands — Pick Your Entry Point

### Agent Virtual Office native Codex hooks

The npm registry's identically named package belongs to a different project
([`shahwaiz90/virtual-office`](https://github.com/shahwaiz90/virtual-office)). Use this repository's
GitHub source distribution from the Agent Virtual Office project root:

```bash
npx github:KbWen/agent-virtual-office setup --platform codex
```

This installs project-local hooks for prompt, tool, permission, turn-stop, and session-end events
under `.codex/hooks.json`, together with the two local adapter scripts. Codex must trust the
project through its normal user flow, and the session must be new or reloaded before the hooks
are available. In the desktop app, open or reload a chat for this project. When **Review hook**
appears, expand all six entries, verify they point to this project's `.codex/hooks.json` and
`.codex/hooks/office-status-codex-hook.js`, select the intended entries, and choose **Allow
selected items**. Until approval and reload, the hooks do not run.

Native hooks are optional. **Not now** leaves automatic Codex lifecycle observation inactive,
while the office UI and other integrations remain available. Manual updates or file-watcher
signals reflect supplied statuses or observed file changes; they do not prove Codex tool activity. For manual updates, use the
[bridge UI, Status API, or status helper](../docs/INTEGRATIONS.md#native-codex-lifecycle-hooks).
The approved hook runs local Node.js code and writes sanitized metadata to local status files; it
does not store raw prompts, arguments, or outputs or execute event-payload commands. The office
serves that metadata through its HTTP API, whose network reach depends on server binding and LAN
configuration. The GitHub dev launcher binds all interfaces by default; use
`--no-host` for localhost. Direct `npm run dev` uses Vite's localhost default unless `--host` is set.
Production `serve` binds to localhost by default, and `--host` opts into LAN. `OFFICE_API_TOKEN`
protects writes, not status reads or SSE; do not expose private status to an untrusted network.
Approval is a trust decision: review the adapter/helper and dependencies. Codex hashes hook
definitions, not the referenced script contents, so source changes may alter behavior even when
the definition is unchanged.

Setup applies only to the current project. Repeat setup and review for each project when prompted.
Unchanged hook definitions are remembered by their hashes; new or changed definitions require
review. Hash-based approval does not promise project-isolated trust. CLI users can inspect hooks
with `/hooks`; this is separate from the desktop review flow. The installer does not edit global
Codex settings, trust records, or `notify`.
Remove only unchanged owned files and exact owned hook entries with
`npx github:KbWen/agent-virtual-office uninstall --platform codex`. See [`docs/INTEGRATIONS.md`](../docs/INTEGRATIONS.md)
for observed states and lifecycle limits.

The right first command depends on your starting point. **Always start with this preamble**:

```text
Read and follow AGENTS.md first — it is the canonical governance for this repo.
DO NOT claim completion without the evidence required for the task's classification
(feature/hotfix: /review + /test required; quick-win/tiny-fix: diff + verification sufficient).
```

Then add ONE of the three openers below:

### A. Brand-new project, multi-feature idea

> Use when you have a product idea with several features and no code yet.

```text
This is a brand-new project. My initial idea is:
[1–2 paragraphs describing the product and its features]

Please run /spec-intake to decompose this into a feature inventory.
After I pick the first feature, run /bootstrap → /app-init to establish
the tech stack ADR, then /plan and /implement.
```

**Why /spec-intake first**: a multi-feature raw idea must be decomposed into
`docs/specs/_product-backlog.md` before any single feature is bootstrapped,
otherwise classification and Work Log scope will be wrong.

### B. Existing repository — adopting Agentic OS for the first time

> Use when the framework was just deployed into a repo that already has code.

```text
This repo already has code but Agentic OS was just deployed.
Please run /audit (read-only) to map the existing codebase,
then /app-init to record the tech stack ADR,
then /spec-intake when I'm ready to add features.
```

### C. Single, well-scoped task on an established project

> Use when the project already has an ADR and you have one concrete task.

```text
Please run /bootstrap to classify and start this task.
[Then describe the task — single feature, bug, or quick-win.]
```

### D. Continue multi-feature work from an existing backlog

> Use when one or more features have already shipped and you want to pick up the next item from the backlog.

```text
Please read docs/specs/_product-backlog.md and run /spec-intake §8a
to continue with the next pending feature.
```

**Why different from C**: `/bootstrap` on an established project will surface the backlog as a side-effect, but `/spec-intake §8a` is the explicit continuation path — it reads the backlog index, skips decomposition, and feeds the next feature directly into bootstrap. This prevents re-classifying already-decomposed features.

> **Not sure which one?** Default to A for raw ideas, C for concrete single tasks, D when you have a running backlog.
> The AI's Intent Router will also auto-detect multi-feature input and
> route to /spec-intake, but explicit beats inferred.
