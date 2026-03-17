#!/bin/bash
# Agent Virtual Office — Claude Code Hook
#
# Writes ~/.claude/office-status.json when skills/tools execute.
# The office polls /api/status (served by vite middleware) to pick up changes.
#
# Hook events handled:
#   PreToolUse    → detect tool type → map to agent role → status: working
#   PostToolUse   → same tool → status: done (brief)
#   SubagentStart → skill name → map to agent role → status: working
#   SubagentStop  → skill name → status: done
#
# Install: copy to .claude/hooks/ and add to .claude/settings.json
# Or just add the hooks config pointing to this file's location.

set -e
INPUT=$(cat)
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

STATUS_FILE="$HOME/.claude/office-status.json"
SEQ=$(date +%s%N)

# Map tool names to office roles
tool_to_role() {
  case "$1" in
    Edit|Write|NotebookEdit)  echo "dev" ;;
    Bash)                      echo "ops" ;;
    Read|Glob|Grep)           echo "res" ;;
    Agent)                     echo "pm" ;;
    WebFetch|WebSearch)       echo "res" ;;
    *)                         echo "dev" ;;
  esac
}

# Map skill/agent names to office roles
skill_to_role() {
  local name="$1"
  case "$name" in
    *plan*|*spec*|*bootstrap*|*decide*)  echo "pm" ;;
    *review*|*test*|*lint*|*classify*)   echo "qa" ;;
    *implement*|*code*|*fix*|*debug*)    echo "dev" ;;
    *ship*|*deploy*|*handoff*|*retro*)   echo "ops" ;;
    *research*|*explore*|*search*)       echo "res" ;;
    *architect*|*design*|*brainstorm*)   echo "arch" ;;
    *security*|*gate*|*audit*|*comply*)  echo "gate" ;;
    *)                                    echo "dev" ;;
  esac
}

# Map event to status
case "$EVENT" in
  PreToolUse)
    ROLE=$(tool_to_role "$TOOL")
    TASK="$TOOL"
    STATUS="working"
    ;;
  PostToolUse)
    ROLE=$(tool_to_role "$TOOL")
    TASK="$TOOL"
    STATUS="done"
    ;;
  SubagentStart)
    ROLE=$(skill_to_role "$AGENT_TYPE")
    TASK="$AGENT_TYPE"
    STATUS="working"
    ;;
  SubagentStop)
    ROLE=$(skill_to_role "$AGENT_TYPE")
    TASK="$AGENT_TYPE"
    STATUS="done"
    ;;
  *)
    exit 0
    ;;
esac

# Read existing status to merge (keep other agents' states)
EXISTING="[]"
if [ -f "$STATUS_FILE" ]; then
  EXISTING=$(jq -r '.agents // []' "$STATUS_FILE" 2>/dev/null || echo "[]")
fi

# Update: replace agent with same role, or add new
NEW_AGENTS=$(echo "$EXISTING" | jq --arg role "$ROLE" --arg task "$TASK" --arg status "$STATUS" '
  [.[] | select(.role != $role)] + [{"role": $role, "task": $task, "status": $status, "label": null}]
')

# If done, remove after writing (so it shows briefly then clears)
if [ "$STATUS" = "done" ]; then
  # Keep done agents for 5s by not removing immediately
  # The office's TTL system handles cleanup
  true
fi

# Count active (non-done) agents
ACTIVE_COUNT=$(echo "$NEW_AGENTS" | jq '[.[] | select(.status != "done")] | length')

# Derive workflow name from skill if available
WORKFLOW=""
if [ -n "$AGENT_TYPE" ]; then
  WORKFLOW="$AGENT_TYPE"
fi

# Write status file atomically
TMPFILE="${STATUS_FILE}.tmp"
jq -n \
  --arg seq "$SEQ" \
  --arg source "claude-cli" \
  --argjson agents "$NEW_AGENTS" \
  --argjson count "$ACTIVE_COUNT" \
  --arg workflow "$WORKFLOW" \
  '{
    _seq: $seq,
    type: "office-status",
    agents: $agents,
    activeCount: $count,
    workflow: (if $workflow == "" then null else $workflow end),
    source: $source
  }' > "$TMPFILE" && mv "$TMPFILE" "$STATUS_FILE"

exit 0
