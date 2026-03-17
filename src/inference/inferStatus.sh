#!/bin/bash
# Read AgentCortex's current_state.md and infer office status
# Completely read-only — does not write anything

STATE="docs/context/current_state.md"

# Check if we're in an AgentCortex project
if [ -d ".agent/workflows" ]; then
  MODE="agentcortex"
elif ls ./**/skill* ./**/workflow* >/dev/null 2>&1; then
  MODE="lightweight"
else
  MODE="demo"
fi

if [ ! -f "$STATE" ]; then
  echo "{\"mode\":\"$MODE\",\"phase\":null,\"active\":null,\"command\":null}"
  exit 0
fi

PHASE=$(grep -oP '(?i)current\s*phase[:\s]*\K\w+' "$STATE" 2>/dev/null)
ACTIVE=$(grep -oP '(?i)active\s*workflow[s]?[:\s]*\K[/\w]+' "$STATE" 2>/dev/null)

# command → agent mapping
case "$ACTIVE" in
  /bootstrap|/plan|/spec) AGENT="pm" ;;
  /brainstorm|/decide)    AGENT="arch" ;;
  /implement)             AGENT="dev" ;;
  /test|/review|/test-classify) AGENT="qa" ;;
  /ship|/handoff|/retro)  AGENT="ops" ;;
  /research)              AGENT="res" ;;
  *)                      AGENT="none" ;;
esac

echo "{\"mode\":\"$MODE\",\"phase\":\"$PHASE\",\"active\":\"$AGENT\",\"command\":\"$ACTIVE\"}"
