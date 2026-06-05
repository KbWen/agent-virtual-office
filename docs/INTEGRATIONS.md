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
**Supported statuses:** `idle` · `working` · `blocked` · `done`

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
    curl -s -X POST ${{ vars.OFFICE_URL }}/api/event \
      -H "Content-Type: application/json" \
      -H "X-Office-Token: ${{ secrets.OFFICE_API_TOKEN }}" \
      -d '{"event":"deploy-start"}'

- name: Deploy
  run: npm run deploy

- name: Notify office — deploy result
  if: always()
  run: |
    EVENT=$([[ "${{ job.status }}" == "success" ]] && echo "deploy-success" || echo "deploy-failed")
    curl -s -X POST ${{ vars.OFFICE_URL }}/api/event \
      -H "Content-Type: application/json" \
      -H "X-Office-Token: ${{ secrets.OFFICE_API_TOKEN }}" \
      -d "{\"event\":\"$EVENT\"}"
```

Set `OFFICE_URL` (e.g. `http://office.internal:5174`) as a repository variable and `OFFICE_API_TOKEN` as a secret. For self-hosted runners on the same LAN the server is reachable without any extra tunneling.

---

## Claude Code Hook

The one-click setup copies the hook to `~/.claude/office-status-hook.js` and registers it in `~/.claude/settings.json` for all 6 events automatically (idempotent — safe to re-run):

```bash
# If you cloned the repo:
node bin/cli.js setup

# Straight from the public GitHub repo (no clone, no npm publish needed):
npx github:KbWen/agent-virtual-office setup

# Once published to npm:
npx agent-virtual-office setup
```

**Manual install** (if you prefer):

```bash
# from a clone:
cp public/hooks/office-status-hook.js ~/.claude/office-status-hook.js
# or, if installed from npm:
cp node_modules/agent-virtual-office/public/hooks/office-status-hook.js ~/.claude/office-status-hook.js
```

Register it in `~/.claude/settings.json` (the hook reads events from stdin, no arguments needed):

```json
{
  "hooks": {
    "PreToolUse":       [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "PostToolUse":      [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "SubagentStart":    [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "SubagentStop":     [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }]
  }
}
```

The hook auto-detects the current git branch slug, writes `~/.claude/office-status-{slug}.json`, and the office filters by `process.cwd()` so sessions from other projects never appear.

---

## Codex CLI Status Bridge

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

The helper writes `~/.claude/office-status-{slug}.json`, so the office picks it up through the existing `/api/status` polling path. This is the recommended Codex CLI producer path for task runners, shell wrappers, or external automations.

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

Limitation: this project does not receive automatic host-level tool events from the Codex desktop app by itself. Full parity requires a host-side emitter. When the host cannot emit events directly, `bridge.js` / `bridge.html` is the supported Codex App route.

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
cd ../feat-auth && npx agent-virtual-office --port=5175

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
