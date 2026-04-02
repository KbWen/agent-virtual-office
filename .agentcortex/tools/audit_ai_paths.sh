#!/usr/bin/env bash
set -euo pipefail

echo "=== AgentCortex Path Audit: $(pwd) ==="
echo

echo "== [Codex] Check repo root AGENTS.md =="
if [ -f "AGENTS.md" ]; then
  echo "OK: ./AGENTS.md"
else
  echo "MISSING: ./AGENTS.md  (Create one at repo root)"
fi

echo
echo "== [Codex] Check SKILL.md location (must be under .agents/skills/) =="
all_skill=$(find . -type f -name "SKILL.md" 2>/dev/null || true)
if [ -z "$all_skill" ]; then
  echo "No SKILL.md found (ok if you don't use Codex skills yet)"
else
  bad_skill=$(echo "$all_skill" | grep -vE '(^|/)\.agents/skills/' || true)
  if [ -n "$bad_skill" ]; then
    echo "SKILL.md found outside .agents/skills/:"
    echo "$bad_skill" | sed 's/^/  - /'
  else
    echo "OK: all SKILL.md under .agents/skills/"
  fi
fi

echo
echo "== [Codex+Antigravity] Check dual-path compatibility (.agent/skills <-> .agents/skills) =="
if [ ! -d ".agents/skills" ]; then
  echo "Missing .agents/skills/"
elif [ ! -d ".agent/skills" ]; then
  echo "Missing .agent/skills/"
else
  missing_agent_link=0
  missing_codex_entry=0
  for codex_skill in .agents/skills/*; do
    [ -e "$codex_skill" ] || continue
    skill_name="$(basename "$codex_skill")"
    if [ ! -e ".agent/skills/$skill_name" ]; then
      echo "Missing .agent/skills/$skill_name (for Antigravity compatibility)"
      missing_agent_link=1
    fi
  done
  for agent_skill in .agent/skills/*; do
    [ -e "$agent_skill" ] || continue
    skill_name="$(basename "$agent_skill")"
    if [ ! -e ".agents/skills/$skill_name" ]; then
      echo "Missing .agents/skills/$skill_name (for Codex compatibility)"
      missing_codex_entry=1
    fi
  done
  if [ "$missing_agent_link" -eq 0 ] && [ "$missing_codex_entry" -eq 0 ]; then
    echo "OK: .agent/skills and .agents/skills entries are aligned"
  fi
fi

echo
echo "== [Antigravity] Check workspace rules/workflows (.agent/*) =="
[ -d ".agent/rules" ] && echo "OK: ./.agent/rules/" || echo "MISSING: ./.agent/rules/"
[ -d ".agent/workflows" ] && echo "OK: ./.agent/workflows/" || echo "MISSING: ./.agent/workflows/"

echo
echo "== [AgentCortex] Check canonical namespace =="
for path in "agentcortex/bin" "agentcortex/tools"; do
  if [ -d "$path" ]; then
    echo "OK: ./$path"
  else
    echo "MISSING: ./$path"
  fi
done

echo
echo "Done."