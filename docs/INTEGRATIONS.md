# Integrations & Status API

Everything needed to wire a real tool into the office. The office has **no backend of its own** to configure — any tool that can send an HTTP request (or write a status file) can drive it.

- [Status API](#status-api) — push live agent status
- [Webhook events](#webhook-events) — fire one-shot moments (deploys, merges, incidents)
- [Claude Code hook](#claude-code-hook) — one-click automatic routing
- [Codex CLI](#codex-cli-status-bridge) · [Codex App](#codex-app-bridge) · [Gemini CLI](#gemini-cli)
- [Multi-worktree](#multi-worktree-support) · [Platform matrix](#platform-integration-matrix)

> Deploying the office on a server (Docker, Nginx, PM2, TLS, `OFFICE_API_TOKEN`)? See **[deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md)**.

---

## Status API

Any tool can push real-time status to the office via HTTP `POST /api/status`:

```bash
# Simple: set agent statuses directly
curl -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"working","qa":"blocked","workflow":"Sprint 42"}'

# Full format: explicit agent list
curl -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{
    "type": "office-status",
    "agents": [
      {"role":"dev","task":"implement-auth","status":"working","label":"Coding auth module..."}
    ],
    "workflow": "Build Feature"
  }'
```

**Supported roles:** `pm` · `arch` · `dev` · `qa` · `ops` · `res` · `gate` · `designer`
**Supported statuses:** `idle` · `working` · `blocked` · `done` · `planning` · `awaiting-approval`

---

## Webhook Events

CI/CD pipelines and external tools can push one-shot events via `POST /api/event`:

```bash
# Trigger a deploy-success celebration
curl -X POST http://localhost:5174/api/event \
  -H "Content-Type: application/json" \
  -d '{"event":"deploy-success"}'

# Mark a character as blocked with a label
curl -X POST http://localhost:5174/api/event \
  -H "Content-Type: application/json" \
  -d '{"event":"custom","role":"dev","status":"blocked","label":"Waiting on API keys"}'
```

**Supported events:** `pr-merged` · `pr-opened` · `pr-reviewed` · `review-approved` · `test-passed` · `test-failed` · `build-success` · `build-failed` · `deploy-start` · `deploy-success` · `deploy-failed` · `release` · `release-cut` · `rollback` · `incident-start` · `incident-resolved` · `custom`

Named events use predefined agents — `role` and `status` are only needed for `custom` events (validated; invalid values return HTTP 400).

### GitHub Actions example

Add a step to any workflow to light up the office on CI events:

```yaml
# .github/workflows/deploy.yml
- name: Notify office — deploy started
  run: |
    curl -fsS -X POST ${{ vars.OFFICE_URL }}/api/event \
      -H "Content-Type: application/json" \
      -H "X-Office-Token: ${{ secrets.OFFICE_API_TOKEN }}" \
      -d '{"event":"deploy-start"}'

- name: Deploy
  run: npm run deploy

- name: Notify office — deploy result
  if: always()
  run: |
    EVENT=$([[ "${{ job.status }}" == "success" ]] && echo "deploy-success" || echo "deploy-failed")
    curl -fsS -X POST ${{ vars.OFFICE_URL }}/api/event \
      -H "Content-Type: application/json" \
      -H "X-Office-Token: ${{ secrets.OFFICE_API_TOKEN }}" \
      -d "{\"event\":\"$EVENT\"}"
```

Set `OFFICE_URL` (e.g. `http://office.internal:5174`) as a repository variable and `OFFICE_API_TOKEN` as a secret. For self-hosted runners on the same LAN the server is reachable without any extra tunneling. `-fsS` (fail on HTTP errors, silent otherwise but still print errors) replaces a bare `-s`, so a `403`/`401`/etc. fails the step loudly instead of the workflow silently reporting success with nothing delivered.

**Note on `OFFICE_ALLOWED_HOSTS`**: this example already sends a matching `X-Office-Token`, and a request with a *valid* token is exempt from the Host-header check (see [DEPLOYMENT.md](deployment/DEPLOYMENT.md#environment-variables)) — a DNS-rebinding browser can send any `Host` it likes, but it cannot know your token, so proof of the token is proof this isn't one. That means `OFFICE_URL`'s hostname does **not** need to be added to `OFFICE_ALLOWED_HOSTS` for this specific call. It still would need to be, though, for any *unauthenticated* request to that same hostname (e.g. hitting `/api/health` from a monitoring job without a token) or if you drop `OFFICE_API_TOKEN` from the workflow.

---

## Claude Code Hook

The one-click setup copies the hook to `~/.claude/office-status-hook.js` and registers it in `~/.claude/settings.json` for all 11 Claude events automatically (idempotent — safe to re-run):

```bash
# If you cloned the repo:
node bin/cli.js setup

# Straight from the public GitHub repo (no clone, no npm publish needed):
npx github:KbWen/agent-virtual-office setup
```

If a previously installed AVO Claude hook has the legacy version marker but no stable hook ID,
setup refuses to replace it by default. For that known legacy copy only, pass its exact SHA-256:
`npx github:KbWen/agent-virtual-office setup --migrate-legacy-claude=<64-character-sha256>`. The installer
also checks the anchored AVO hook header and version before accepting the nominated digest, and
backs up and verifies the exact old bytes as `~/.claude/office-status-hook.js.avo-claude-backup`.
This option cannot authorize replacement of an unrecognized or edited non-AVO script.

**Manual install** (if you prefer):

```bash
# from a clone:
cp public/hooks/office-status-hook.js ~/.claude/office-status-hook.js
```

The npm registry's identically named package belongs to a different project:
[`shahwaiz90/virtual-office`](https://github.com/shahwaiz90/virtual-office). The commands above use
this repository's GitHub distribution, which is the supported way to run Agent Virtual Office.

Register it in `~/.claude/settings.json` (the hook reads events from stdin, no arguments needed):

```json
{
  "hooks": {
    "PreToolUse":       [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "PostToolUse":      [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "PostToolUseFailure": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "SubagentStart":    [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "SubagentStop":     [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "PermissionDenied": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "StopFailure":      [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "PermissionRequest": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "SessionEnd":       [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }]
  }
}
```

The setup also registers `PostToolUseFailure`, `PermissionRequest`, and `SessionEnd`. The
coverage table below distinguishes states supported by real lifecycle evidence from events
that are intentionally ignored or remain unavailable.

The hook auto-detects the current git branch slug, writes `~/.claude/office-status-{slug}.json`, and the office filters by the directory it was launched in so sessions from other projects never appear. Set `OFFICE_PROJECT_ROOT` to match against a different project root (e.g. a multi-worktree setup).

---

### Claude lifecycle coverage and limits

| Evidence | Office behavior | Limits |
|---|---|---|
| `UserPromptSubmit` | Shows PM as working with a thinking label | Prompt content is discarded; this event alone does not signal planning mode. |
| Tool start/completion/failure, subagent start/stop | Shows working, callback completion, reported failure, or subagent workflow for the attributable role | `planning` comes from tool events with `permission_mode: "plan"`. Tool completion is not overall task success. |
| `PermissionRequest` | Shows awaiting approval for a reliably attributed tool role; makes no approval decision | Unattributed requests do not assign a role. `AskUserQuestion` is not treated as an approval request. |
| `PermissionDenied` | Shows blocked only when Claude reports auto-mode denial | It does not infer a human denial from other events. |
| `Stop` / documented `StopFailure` | Ends a turn, or marks supported API rate-limit/authentication failures blocked | `Stop` is turn-end, not task success. Unknown error details stay unknown; raw error text is not published. |
| `SessionEnd` | Clears that source's active state without counting completion | Interrupt/cancel paths without a reliable lifecycle callback remain unobservable. |
| Notifications, idle/compaction, unknown or malformed events | No new office state | Generic `idle_prompt`, compaction, and informational notifications do not prove work, success, or approval. Thinking remains an existing inference from elapsed time. |

Claude's `SubagentStart` / `SubagentStop` callbacks can show workflow huddles, but sessions using
the same branch and working directory are not fully independent in the office: the latest verified
session owns that lane, and a handoff drops the prior owner's helpers and neutralizes its stale
roles. Codex native hooks write a separate status file per root-thread session (keyed by a session
hash); child events do not become roles or huddles. Other producers also keep separate files, which
the office merges into one representative per active session. These boundaries mean the office
does not claim complete multi-agent visibility across providers.

### Codex CLI status bridge

#### Native Codex lifecycle hooks

From the project root, install the native Codex hooks with:

```bash
npx github:KbWen/agent-virtual-office setup --platform codex
# Remove only the exact owned entries and unchanged hook scripts:
npx github:KbWen/agent-virtual-office uninstall --platform codex
```

This project-local setup merges six core events (`UserPromptSubmit`, `PreToolUse`,
`PermissionRequest`, `PostToolUse`, `Stop`, and `SessionEnd`) into `.codex/hooks.json` and
copies the adapter plus its helper into `.codex/hooks/`. It preserves unrelated hook groups,
Codex settings, and the existing `notify` configuration. It does not change trust records or
global configuration.

**Desktop app:** run setup from each target project's root, then open or reload a desktop chat
for that project. When the **Review hook** dialog appears, expand each of the six entries and
verify its command points to this project's `.codex/hooks/office-status-codex-hook.js` and its
registration is in `.codex/hooks.json`. Select the intended six entries and choose **Allow
selected items**. The hooks do not run until the normal review/trust flow is complete and the
session is new or reloaded.

This installer affects only the project where it runs. Another project needs its own setup and
review when prompted. Codex remembers approval for unchanged hook definitions by their hashes;
new or changed definitions require review. That hash behavior does not promise that approvals
are isolated by project, so do not assume that approving one project's definitions approves a
different project's commands. CLI users can inspect and approve hooks with `/hooks`; that is a
CLI flow, not the desktop review dialog. See [Codex's hook documentation](https://learn.chatgpt.com/docs/hooks).

Native hooks are optional. If you choose **Not now**, they stay inactive; the office UI remains
available, but it will not automatically observe Codex events through these hooks. Other
integrations and explicit status reports continue to work. Hook-free alternatives include the
[manual bridge UI](http://localhost:5174/bridge.html), a `POST /api/status` from an existing
workflow ([Status API](#status-api)), or an explicit call to the
[normalized status helper](#explicit-normalized-status-helper). These report the state supplied
by the user or workflow; they are not automatic observation of real Codex tool events and do not
provide full hook lifecycle coverage. A configured file watcher can observe file changes, but
that is not proof that Codex ran a tool. The office can still open and show its quiet ambient
scenes while native lifecycle state is unavailable; those scenes are decoration, not work evidence.

The approved command runs the project's local Node.js adapter and helper. The adapter reads the
native event input, keeps only fixed sanitized status metadata, and writes a status file under
`~/.claude/office-status-codex-hook-<digest>.json`; it does not retain raw prompts, tool arguments, or
outputs and does not execute commands from the event payload. The office serves status through
its HTTP API, so who can reach that metadata depends on server binding and LAN configuration. The
GitHub dev launcher binds to all interfaces by default; use `--no-host` for
localhost-only access. Direct `npm run dev` uses Vite's localhost default unless `--host` is set.
Production `serve` binds to `127.0.0.1` by default; `--host` opts into LAN. `OFFICE_API_TOKEN`
protects API writes, not status reads or SSE. Do not expose `--host` to a network where active
status should remain private.

Approval is still a local code-execution trust decision. Review both copied scripts and the exact
command before allowing them. Codex remembers hashes of hook definitions; that approval does not
hash the referenced script contents or dependencies. A source or dependency change can therefore
change local behavior even if the hook definition is unchanged. New or changed definitions go
through Codex's normal review flow; this setup does not bypass trust controls.

Native PostToolUse is callback evidence only; it does not claim business-task success. Child-agent
events are not registered as office roles.

| Native evidence | Office behavior | Deliberate limits |
|---|---|---|
| `UserPromptSubmit` | Opens the root session as planning or working | Prompt text is discarded; a thinking label is inferred from elapsed time, not a native callback. |
| `PreToolUse` / `PostToolUse` | Shows a fixed generic/tool-role label as working | PostToolUse is not task success; unknown tools use a generic label. |
| `PermissionRequest` | Shows awaiting approval for the attributed tool role | The hook does not return a decision. |
| `Stop` / `SessionEnd` | Stop returns the observed agent to idle; SessionEnd clears it without completion | Stop is not whole-task success. |
| `Interrupt` | If an Interrupt payload is supplied, returns the observed agent to idle | Interrupt is not registered, so this setup does not normally receive it. Cancellation without a delivered callback remains unobservable. |
| Child-agent events, notifications, unknown events | No new office state | Child events do not finish or invent a parent role. |

Only fixed safe metadata reaches the status file. Prompts, arguments, patches, output, transcript
content, and raw session IDs are not stored. An office status represents one root thread per
Codex session; this adapter does not report child agents as separate roles or workflow huddles.

#### Explicit normalized status helper

Codex CLI can use the same file-backed runtime path as Claude by writing a normalized `office-status` payload with the helper script:

```bash
node public/hooks/office-status-codex.js '{"dev":"working","workflow":"Build Feature"}'

# Full payload also works
node public/hooks/office-status-codex.js '{
  "type": "office-status",
  "source": "codex-cli",
  "agents": [
    {"role":"dev","task":"Edit","status":"working","label":"Implementing auth"}
  ],
  "workflow": "Build Feature"
}'
```

The helper writes `~/.claude/office-status-codex-{slug}.json` — its own filename namespace, separate from the Claude Code hook's `office-status-{slug}.json` — so the office picks it up through the existing `/api/status` polling path without the two writers ever colliding on the same file. This is the recommended Codex CLI producer path for task runners, shell wrappers, or external automations.

**Running both in the same checkout**: because each writer now has its own file, Claude Code and Codex CLI active in the same checkout at the same time are seen as **two separate sessions** by the office's multi-session merge, which shows only one representative (most-urgent) agent per session. A multi-role Claude turn and a multi-role Codex turn each collapse to a single visible agent, so a real active role on either side can be hidden from the merged view. This is a visibility tradeoff, not data loss — each source's own status file stays intact and un-clobbered, which is an improvement over the previous behavior (a shared file where one source could silently overwrite the other's state entirely).

## Codex App Bridge

If Codex App can run or embed browser JavaScript, use the built-in bridge:

```html
<script src="http://localhost:5174/bridge.js"></script>
<script>
  officeBridge.send({
    source: 'codex-app',
    workflow: 'Reviewing PR',
    dev: 'working',
  })
</script>
```

You can also open [bridge.html](http://localhost:5174/bridge.html) and send `codex-app` updates through the UI.

The native project-local Codex hook setup above observes supported CLI lifecycle events when
the project is trusted and the session reloads. It does not bypass trust, and its availability
in a desktop host depends on that host's native hook support. When native delivery is unavailable,
`bridge.js` / `bridge.html` remains a manual route.

## Gemini CLI

Gemini CLI doesn't have a built-in hook system like Claude Code. Use `curl` in a wrapper script:

```bash
# In your Gemini CLI workflow, push status updates:
curl -s -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"working","workflow":"Gemini Session"}'

# When done:
curl -s -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"done"}'
```

Or use the generic LLM bridge for file-watching mode:

```bash
node node_modules/agent-virtual-office/public/hooks/generic-llm-bridge.js --port=5174
```

This watches for file changes and automatically updates the office.

---

## Multi-Worktree Support

Running multiple worktrees in parallel? Each worktree's agent appears as a separate character in the lobby:

```bash
# Worktree 1: main project
git worktree add ../feat-auth feat/auth
cd ../feat-auth && npx github:KbWen/agent-virtual-office --port=5175

# Worktree 2: current project (different port, same office view)
# Both worktrees share the same ~/.claude/ directory but are isolated by branch slug
```

Open `http://localhost:5174?session=feat-auth` to see the characters from a specific session. The office shows one representative per active worktree.

---

## Platform Integration Matrix

| Platform | How to integrate |
|----------|-----------------|
| **Claude Code** | Install the hook (above) — automatic per-tool routing |
| **Gemini CLI** | `curl POST /api/status` from shell hooks |
| **Codex CLI** | `node public/hooks/office-status-codex.js ...` or `curl POST /api/status` |
| **Any CI/CD** | `curl POST /api/event` for one-shot events |
| **Codex App** | `bridge.js` / `bridge.html` host bridge (host-side emitter required for automatic events) |
| **Browser** | `postMessage` or `BroadcastChannel('agent-office')` |

---

## Health check

`GET /api/health` returns `{ ok: true, uptime: <seconds> }`.
