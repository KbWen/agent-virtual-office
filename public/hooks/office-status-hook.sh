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

# Fun labels per tool — what the character would actually say at the office
# Each tool has multiple options; one is picked randomly
tool_label() {
  local tool="$1"
  local status="$2"
  case "$tool" in
    Edit)
      local opts=("✏️ 改 code 中..." "✏️ 手起刀落" "✏️ 重構大師" "✏️ 下刀了" "✏️ 寫寫改改")
      ;;
    Write)
      local opts=("📝 生成中..." "📝 從零開始" "📝 新檔案！" "📝 啪啪啪打字")
      ;;
    Read)
      local opts=("📖 翻資料中" "📖 看看這個" "📖 研究研究" "📖 嗯嗯..." "📖 讀原始碼")
      ;;
    Glob)
      local opts=("🔍 找檔案" "🔍 在哪裡..." "🔍 翻箱倒櫃" "🔍 應該在這附近")
      ;;
    Grep)
      local opts=("🔎 搜！" "🔎 ctrl+F 狂按" "🔎 線索在哪" "🔎 翻遍每個角落")
      ;;
    Bash)
      local opts=("⚡ 跑指令" "⚡ 按下 Enter" "⚡ 終端機出動" "⚡ 執行中..." "⚡ 大紅按鈕！")
      ;;
    Agent)
      local opts=("📋 派任務" "📋 開子代理" "📋 分工合作" "📋 你去你去" "📋 交給專家")
      ;;
    WebFetch|WebSearch)
      local opts=("🌐 查資料" "🌐 上網看看" "🌐 Google 一下" "🌐 找答案中")
      ;;
    NotebookEdit)
      local opts=("📓 改 notebook" "📓 跑 cell 中" "📓 實驗中...")
      ;;
    *)
      local opts=("💻 處理中..." "💻 嗯嗯嗯" "💻 忙著呢")
      ;;
  esac

  # done status gets different labels
  if [ "$status" = "done" ]; then
    local done_opts=("✅ 好了" "✅ 搞定" "✅ 完成！" "✅ 下一個" "✅ easy~")
    local idx=$((RANDOM % ${#done_opts[@]}))
    echo "${done_opts[$idx]}"
    return
  fi

  local idx=$((RANDOM % ${#opts[@]}))
  echo "${opts[$idx]}"
}

# Fun labels for skill/subagent events
skill_label() {
  local skill="$1"
  local status="$2"

  if [ "$status" = "done" ]; then
    local done_opts=("✅ 報告完畢" "✅ 任務結束" "✅ 收工！" "✅ 完美落地")
    local idx=$((RANDOM % ${#done_opts[@]}))
    echo "${done_opts[$idx]}"
    return
  fi

  case "$skill" in
    *plan*)
      local opts=("📊 排計畫中" "📊 想想怎麼做" "📊 先規劃" "📊 來開會");;
    *spec*|*bootstrap*)
      local opts=("📋 寫規格" "📋 起手式" "📋 從頭開始");;
    *review*)
      local opts=("🧐 來 review" "🧐 讓我看看" "🧐 挑毛病中" "🧐 這裡不對吧");;
    *test*)
      local opts=("🧪 跑測試" "🧪 測一下" "🧪 紅燈綠燈" "🧪 希望不要爆");;
    *implement*|*code*)
      local opts=("⌨️ 開工！" "⌨️ 寫 code 中" "⌨️ 鍵盤起飛" "⌨️ 全力開發");;
    *fix*|*debug*)
      local opts=("🔧 修 bug" "🔧 找問題" "🔧 debug 中" "🔧 應該是這裡");;
    *ship*|*deploy*)
      local opts=("🚀 要部署了" "🚀 準備上線" "🚀 3..2..1.." "🚀 按按鈕！");;
    *research*|*explore*)
      local opts=("🔬 研究中" "🔬 探索未知" "🔬 深入調查" "🔬 查論文中");;
    *architect*|*design*)
      local opts=("🏗️ 畫架構" "🏗️ Eureka!" "🏗️ 白板時間" "🏗️ 想通了！");;
    *security*|*audit*)
      local opts=("🛡️ 安全檢查" "🛡️ 掃描中" "🛡️ 不准過！" "🛡️ 看看有沒有洞");;
    *)
      local opts=("💼 處理中" "💼 交給我" "💼 沒問題");;
  esac

  local idx=$((RANDOM % ${#opts[@]}))
  echo "${opts[$idx]}"
}

# Map event to status
case "$EVENT" in
  PreToolUse)
    ROLE=$(tool_to_role "$TOOL")
    TASK="$TOOL"
    STATUS="working"
    LABEL=$(tool_label "$TOOL" "$STATUS")
    ;;
  PostToolUse)
    ROLE=$(tool_to_role "$TOOL")
    TASK="$TOOL"
    STATUS="done"
    LABEL=$(tool_label "$TOOL" "$STATUS")
    ;;
  SubagentStart)
    ROLE=$(skill_to_role "$AGENT_TYPE")
    TASK="$AGENT_TYPE"
    STATUS="working"
    LABEL=$(skill_label "$AGENT_TYPE" "$STATUS")
    ;;
  SubagentStop)
    ROLE=$(skill_to_role "$AGENT_TYPE")
    TASK="$AGENT_TYPE"
    STATUS="done"
    LABEL=$(skill_label "$AGENT_TYPE" "$STATUS")
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
NEW_AGENTS=$(echo "$EXISTING" | jq --arg role "$ROLE" --arg task "$TASK" --arg status "$STATUS" --arg label "$LABEL" '
  [.[] | select(.role != $role)] + [{"role": $role, "task": $task, "status": $status, "label": $label}]
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
