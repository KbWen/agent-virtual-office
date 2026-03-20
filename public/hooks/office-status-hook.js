#!/usr/bin/env node
/**
 * Agent Virtual Office — Claude Code Hook (Node.js)
 *
 * Writes ~/.claude/office-status.json when skills/tools execute.
 * The office polls /api/status to pick up changes and show them as
 * character speech bubbles in the pixel-art office.
 *
 * Labels are designed to feel like office life while clearly showing
 * what step is happening: "✏️ 改 App.jsx", "⚡ npm test", "📖 讀 store.js"
 *
 * No dependencies — just Node.js (which you already have).
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// Read hook event from stdin
let input = ''
process.stdin.setEncoding('utf-8')
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input)
    processEvent(event)
  } catch {
    process.exit(0)
  }
})

const STATUS_FILE = path.join(os.homedir(), '.claude', 'office-status.json')

// ─── Role mapping ───

function toolToRole(tool) {
  const map = {
    Edit: 'dev', Write: 'dev', NotebookEdit: 'dev',
    Bash: 'ops',
    Read: 'res', Glob: 'res', Grep: 'res',
    Agent: 'pm',
    WebFetch: 'res', WebSearch: 'res',
  }
  return map[tool] || 'dev'
}

function skillToRole(name) {
  if (!name) return 'dev'
  if (/plan|spec|bootstrap|decide/i.test(name)) return 'pm'
  if (/review|test|lint|classify/i.test(name)) return 'qa'
  if (/implement|code|fix|debug/i.test(name)) return 'dev'
  if (/ship|deploy|handoff|retro/i.test(name)) return 'ops'
  if (/research|explore|search/i.test(name)) return 'res'
  if (/architect|design|brainstorm/i.test(name)) return 'arch'
  if (/security|gate|audit|comply/i.test(name)) return 'gate'
  return 'dev'
}

// ─── Context extraction — pull the meaningful bit from tool_input ───

function shortFile(filePath) {
  if (!filePath) return null
  // "C:\Users\x\project\src\App.jsx" → "App.jsx"
  return path.basename(filePath)
}

function shortCommand(cmd) {
  if (!cmd) return null
  // "cd /some/path && npm run test" → "npm run test"
  // "git status" → "git status"
  const parts = cmd.split('&&').map(s => s.trim())
  const last = parts[parts.length - 1]
  // Truncate long commands
  return last.length > 30 ? last.slice(0, 27) + '...' : last
}

function extractContext(tool, toolInput) {
  if (!toolInput) return null
  try {
    const input = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput
    switch (tool) {
      case 'Edit':
      case 'Write':
      case 'Read':
        return shortFile(input.file_path || input.path)
      case 'Bash':
        return shortCommand(input.command || input.cmd)
      case 'Grep':
        return input.pattern ? `"${input.pattern.slice(0, 20)}"` : null
      case 'Glob':
        return input.pattern ? input.pattern : null
      case 'Agent':
        return input.description || input.prompt?.slice(0, 20) || null
      case 'WebFetch':
      case 'WebSearch':
        return input.query || input.url?.replace(/^https?:\/\//, '').slice(0, 25) || null
      default:
        return null
    }
  } catch {
    return null
  }
}

// ─── Labels — office vibe + clear step indication ───

function toolLabel(tool, context, isDone) {
  if (isDone) {
    const ctx = context ? ` ${context}` : ''
    const doneLabels = [`✅${ctx} 好了`, `✅${ctx} 搞定`, `✅ 完成！`, `✅ 下一個`]
    return context ? doneLabels[Math.floor(Math.random() * 2)] : pick(doneLabels)
  }

  // With context: show what's actually happening
  if (context) {
    switch (tool) {
      case 'Edit':   return `✏️ 改 ${context}`
      case 'Write':  return `📝 寫 ${context}`
      case 'Read':   return `📖 讀 ${context}`
      case 'Bash':   return `⚡ ${context}`
      case 'Grep':   return `🔎 搜 ${context}`
      case 'Glob':   return `🔍 找 ${context}`
      case 'Agent':  return `📋 ${context}`
      case 'WebFetch':
      case 'WebSearch': return `🌐 ${context}`
      default:       return `💻 ${context}`
    }
  }

  // No context: generic but still fun
  const fallback = {
    Edit:         ['✏️ 改 code 中', '✏️ 下刀了'],
    Write:        ['📝 寫新檔案', '📝 生成中'],
    Read:         ['📖 翻資料中', '📖 研究研究'],
    Glob:         ['🔍 找檔案中', '🔍 翻箱倒櫃'],
    Grep:         ['🔎 搜原始碼', '🔎 找線索中'],
    Bash:         ['⚡ 跑指令中', '⚡ 終端機出動'],
    Agent:        ['📋 派子任務', '📋 分工合作'],
    WebFetch:     ['🌐 查資料中', '🌐 上網看看'],
    WebSearch:    ['🌐 搜尋中', '🌐 找答案中'],
    NotebookEdit: ['📓 改 notebook', '📓 跑實驗中'],
  }
  return pick(fallback[tool] || ['💻 處理中', '💻 忙著呢'])
}

function skillLabel(skill, isDone) {
  if (isDone) return pick(['✅ 報告完畢', '✅ 任務結束', '✅ 收工！'])

  // Show the skill name in a human way
  if (/plan/i.test(skill))                return '📊 規劃中'
  if (/spec|bootstrap/i.test(skill))      return '📋 寫規格中'
  if (/review/i.test(skill))              return '🧐 Review 中'
  if (/test/i.test(skill))                return '🧪 跑測試中'
  if (/implement|code/i.test(skill))      return '⌨️ 開發中'
  if (/fix|debug/i.test(skill))           return '🔧 修 bug 中'
  if (/ship|deploy/i.test(skill))         return '🚀 部署中'
  if (/research|explore/i.test(skill))    return '🔬 研究中'
  if (/architect|design/i.test(skill))    return '🏗️ 設計架構中'
  if (/security|audit/i.test(skill))      return '🛡️ 安全檢查中'
  return `💼 ${skill}`
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ─── Main ───

function processEvent(event) {
  const hookEvent = event.hook_event_name
  const tool = event.tool_name || ''
  const agentType = event.agent_type || ''
  const toolInput = event.tool_input || null

  let role, task, status, label, hint = null

  switch (hookEvent) {
    case 'PreToolUse': {
      role = toolToRole(tool)
      task = tool
      status = 'working'
      const ctx = extractContext(tool, toolInput)
      label = toolLabel(tool, ctx, false)
      break
    }
    case 'PostToolUse': {
      role = toolToRole(tool)
      task = tool
      // Detect errors from tool result
      const toolResult = event.tool_result || ''
      const isError = event.is_error || (typeof toolResult === 'string' && /^(Error:|Exit code [1-9]|ENOENT|EPERM|EACCES|Command failed|fatal:)/im.test(toolResult.slice(0, 300)))
      status = isError ? 'blocked' : 'done'
      hint = isError ? 'error' : null
      const ctx = extractContext(tool, toolInput)
      label = isError ? `❌ ${ctx || tool} failed` : toolLabel(tool, ctx, true)
      break
    }
    case 'SubagentStart':
      role = skillToRole(agentType)
      task = agentType
      status = 'working'
      label = skillLabel(agentType, false)
      break
    case 'SubagentStop':
      role = skillToRole(agentType)
      task = agentType
      status = 'done'
      label = skillLabel(agentType, true)
      break
    default:
      return
  }

  // Read existing status to merge (keep other agents' states)
  let existing = []
  try {
    const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
    existing = data.agents || []
  } catch {}

  // Replace agent with same role, or add new
  const newAgents = [
    ...existing.filter(a => a.role !== role),
    { role, task, status, label, hint },
  ]

  const activeCount = newAgents.filter(a => a.status !== 'done').length

  const output = {
    _seq: String(Date.now()),
    type: 'office-status',
    agents: newAgents,
    activeCount,
    workflow: agentType || null,
    source: 'claude-cli',
  }

  // Write atomically
  const dir = path.dirname(STATUS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = STATUS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(output, null, 2))
  fs.renameSync(tmp, STATUS_FILE)
}

// Export helpers for testing (CommonJS — this file runs as a Node.js hook)
if (typeof module !== 'undefined') {
  module.exports = { toolToRole, skillToRole, shortFile, shortCommand, extractContext }
}
