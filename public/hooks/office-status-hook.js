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

const HOOK_VERSION = '1.0.0'

const fs = require('fs')
const path = require('path')
const os = require('os')

let _seqN = Math.floor(Math.random() * 10000)
function nextSeq() { return `${Date.now()}.${_seqN = (_seqN + 1) % 10000}` }

// ─── Bilingual labels ───
function detectHookLang() {
  try {
    const langFile = path.join(os.homedir(), '.claude', 'office-lang')
    const lang = fs.readFileSync(langFile, 'utf-8').trim()
    if (lang === 'en' || lang === 'zh-TW') return lang
  } catch {}
  return 'en' // default: English (matches browser-side i18n default)
}

const LANG = detectHookLang()

// Read hook event from stdin
let input = ''
process.stdin.setEncoding('utf-8')
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input)
    processEvent(event)
  } catch (e) {
    process.stderr.write('[office-hook] ' + (e.message || e) + '\n')
    process.exit(0)
  }
})

// Derive a session slug from the current git branch (or CWD basename as fallback).
// Each worktree writes to its own file so sessions don't overwrite each other.
function getSessionSlug() {
  // Short hash of CWD for project disambiguation (two repos on the same branch name
  // would otherwise write to the same file and overwrite each other).
  const cwdHash = require('crypto').createHash('md5').update(process.cwd()).digest('hex').slice(0, 4)
  try {
    // Read .git/HEAD directly — avoids spawning a git process on every hook invocation
    // (git rev-parse adds ~10-30ms latency per Claude Code tool call).
    const gitEntry = path.join(process.cwd(), '.git')
    let headContent = null
    if (fs.existsSync(gitEntry)) {
      const stat = fs.statSync(gitEntry)
      if (stat.isFile()) {
        // Worktree: .git is a file "gitdir: <path>"
        const ref = fs.readFileSync(gitEntry, 'utf-8').trim()
        const m = ref.match(/^gitdir:\s*(.+)$/)
        // Resolve relative to the worktree root (.git file's dir), not process.cwd()
        if (m) headContent = fs.readFileSync(path.resolve(path.dirname(gitEntry), m[1], 'HEAD'), 'utf-8').trim()
      } else {
        headContent = fs.readFileSync(path.join(gitEntry, 'HEAD'), 'utf-8').trim()
      }
    }
    if (headContent) {
      const refMatch = headContent.match(/^ref:\s+refs\/heads\/(.+)$/)
      const branch = refMatch ? refMatch[1] : null  // null = detached HEAD → fall through
      if (branch) {
        const slug = branch.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || 'default'
        return `${slug}-${cwdHash}`
      }
    }
  } catch {}
  const cwdSlug = path.basename(process.cwd())
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'default'
  return `${cwdSlug}-${cwdHash}`
}

const SESSION_SLUG = getSessionSlug()
const STATUS_FILE = path.join(os.homedir(), '.claude', `office-status-${SESSION_SLUG}.json`)

// ─── Role mapping ───

function toolToRole(tool) {
  const map = {
    Edit: 'dev', Write: 'dev', NotebookEdit: 'dev',
    Bash: 'ops',
    Read: 'res', Glob: 'res', Grep: 'res',
    Agent: 'pm', TodoWrite: 'pm',
    WebFetch: 'res', WebSearch: 'res',
    EnterPlanMode: 'arch', ExitPlanMode: 'arch',
    AskUserQuestion: 'gate',
  }
  return map[tool] || 'dev'
}

function skillToRoleExtended(name) {
  if (!name) return 'dev'
  if (/design|ui|ux|style|visual|brand/i.test(name)) return 'designer'
  return skillToRole(name)
}

// Smart file routing — override tool-based role for Edit/Write/Read based on file type
function fileToRole(filePath) {
  if (!filePath) return null
  const f = filePath.replace(/\\/g, '/').toLowerCase()
  const base = path.basename(f)

  // Test files → qa
  if (/\.(test|spec)\.(js|ts|jsx|tsx|py|rb|go|java|cjs|mjs)$/.test(base)) return 'qa'
  if (/\/(tests?|__tests?|specs?)\//i.test(f)) return 'qa'

  // CI/CD and infra → ops
  if (/^dockerfile/i.test(base)) return 'ops'
  if (/docker-compose/i.test(base)) return 'ops'
  if (/\/(\.github|\.gitlab|\.circleci|\.buildkite|\.drone)\//i.test(f)) return 'ops'
  if (/\.(ya?ml|toml)$/.test(base) && !/^package/.test(base)) return 'ops'

  // Docs / notes → res
  if (/\.(md|mdx|txt|rst|adoc)$/.test(base)) return 'res'
  if (/\/(docs?|wiki|notes?)\//i.test(f)) return 'res'

  // Architecture / ADR → arch
  if (/\/(adr|architecture)\//i.test(f)) return 'arch'
  if (/\.(puml|drawio)$/.test(base)) return 'arch'

  // Design / UI → designer
  if (/\.(css|scss|less|sass)$/.test(base)) return 'designer'
  if (/\.(svg|figma|sketch|xd|ai)$/.test(base)) return 'designer'
  if (/\/(design|ui|ux|styles?|themes?|assets?)\//i.test(f)) return 'designer'
  if (/\.(png|jpe?g|gif|webp|ico)$/.test(base)) return 'designer'

  return null  // null = fall through to tool-based mapping
}

// Extract full file path from tool_input (for routing, not display)
function extractFilePath(tool, toolInput) {
  if (!toolInput || !['Edit', 'Write', 'Read'].includes(tool)) return null
  try {
    const input = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput
    return input.file_path || input.path || null
  } catch { return null }
}

function skillToRole(name) {
  if (!name) return 'dev'
  const n = name.toLowerCase()

  // ── Specific compound patterns first (before generic keyword catch-alls) ──
  // CEO / exec review → gate (approval/policy authority)
  if (/ceo|exec|stakeholder|board/i.test(n)) return 'gate'
  // Engineering / architecture review → arch
  if (/eng.?review|arch.?review|plan.eng|technical.review|adr/i.test(n)) return 'arch'
  // Design / UI review → designer
  if (/design.?review|ui.?review|ux.?review|visual.?review/i.test(n)) return 'designer'
  // Security / compliance review → gate
  if (/security.?review|compliance.?review|pentest|vuln/i.test(n)) return 'gate'
  // Product / spec / intake → pm
  if (/product.?review|spec.?intake|prd|roadmap.?review/i.test(n)) return 'pm'

  // ── Generic keyword fallbacks ──
  if (/plan|spec|bootstrap|decide|intake|priorit|backlog/i.test(n)) return 'pm'
  if (/review|test|lint|classify|qa|quality/i.test(n)) return 'qa'
  if (/implement|code|fix|debug|build|feature/i.test(n)) return 'dev'
  if (/ship|deploy|handoff|retro|release|infra/i.test(n)) return 'ops'
  if (/research|explore|search|analyz|investigat/i.test(n)) return 'res'
  if (/architect|brainstorm|diagram|schema|rfc/i.test(n)) return 'arch'
  if (/security|gate|audit|comply|guard|permission/i.test(n)) return 'gate'
  if (/design|ui|ux|style|visual|brand|figma/i.test(n)) return 'designer'
  return 'dev'
}

// ─── Context extraction — pull the meaningful bit from tool_input ───

function shortFile(filePath) {
  if (!filePath) return null
  // Normalize backslashes so path.basename works on Linux with Windows-style paths
  return path.basename(filePath.replace(/\\/g, '/'))
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
      case 'TodoWrite':
        return input.todos?.length ? (LANG === 'zh-TW' ? `${input.todos.length} 個任務` : `${input.todos.length} tasks`) : null
      case 'EnterPlanMode':
      case 'ExitPlanMode':
        return null
      case 'AskUserQuestion':
        return input.questions?.[0]?.question?.slice(0, 25) || null
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
    const doneLabels = LANG === 'en'
      ? [`✅${ctx} done`, `✅${ctx} ready`, `✅ Done!`, `✅ Next`]
      : [`✅${ctx} 好了`, `✅${ctx} 搞定`, `✅ 完成！`, `✅ 下一個`]
    return context ? doneLabels[Math.floor(Math.random() * 2)] : pick(doneLabels)
  }

  if (context) {
    const labels = {
      Edit:   LANG === 'en' ? `✏️ Edit ${context}`   : `✏️ 改 ${context}`,
      Write:  LANG === 'en' ? `📝 Write ${context}`  : `📝 寫 ${context}`,
      Read:   LANG === 'en' ? `📖 Read ${context}`   : `📖 讀 ${context}`,
      Bash:   `⚡ ${context}`,
      Grep:   LANG === 'en' ? `🔎 Search ${context}` : `🔎 搜 ${context}`,
      Glob:   LANG === 'en' ? `🔍 Find ${context}`   : `🔍 找 ${context}`,
      Agent:  `📋 ${context}`,
      TodoWrite:  `📋 ${context}`,
      AskUserQuestion: LANG === 'en' ? `🚪 Ask: ${context}` : `🚪 確認：${context}`,
      WebFetch: `🌐 ${context}`,
      WebSearch: `🌐 ${context}`,
    }
    return labels[tool] || `💻 ${context}`
  }

  const fallback = LANG === 'en' ? {
    Edit:         ['✏️ Editing code', '✏️ Making changes'],
    Write:        ['📝 Writing file', '📝 Generating'],
    Read:         ['📖 Reading docs', '📖 Researching'],
    Glob:         ['🔍 Finding files', '🔍 Searching around'],
    Grep:         ['🔎 Searching code', '🔎 Looking for clues'],
    Bash:         ['⚡ Running command', '⚡ Terminal time'],
    Agent:        ['📋 Delegating task', '📋 Teamwork'],
    WebFetch:     ['🌐 Fetching data', '🌐 Browsing'],
    WebSearch:    ['🌐 Searching', '🌐 Looking it up'],
    NotebookEdit: ['📓 Editing notebook', '📓 Experimenting'],
    TodoWrite:    ['📋 Organizing tasks', '📋 Planning'],
    EnterPlanMode:['🏗️ Planning', '🏗️ Thinking it through'],
    ExitPlanMode: ['🏗️ Plan ready!', '🏗️ Got it figured out'],
    AskUserQuestion: ['🚪 Asking user', '🚪 Quick check'],
  } : {
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
    TodoWrite:    ['📋 整理任務中', '📋 排工作'],
    EnterPlanMode:['🏗️ 規劃架構中', '🏗️ 想想怎麼做'],
    ExitPlanMode: ['🏗️ 架構定案！', '🏗️ 計劃好了'],
    AskUserQuestion: ['🚪 問問看', '🚪 確認一下'],
  }
  return pick(fallback[tool] || (LANG === 'en' ? ['💻 Working', '💻 Busy'] : ['💻 處理中', '💻 忙著呢']))
}

function skillLabel(skill, isDone) {
  if (isDone) return pick(LANG === 'en'
    ? ['✅ Report done', '✅ Task complete', '✅ Wrapping up!']
    : ['✅ 報告完畢', '✅ 任務結束', '✅ 收工！'])

  if (LANG === 'en') {
    if (/plan/i.test(skill))                return '📊 Planning'
    if (/spec|bootstrap/i.test(skill))      return '📋 Writing spec'
    if (/review/i.test(skill))              return '🧐 Reviewing'
    if (/test/i.test(skill))                return '🧪 Testing'
    if (/implement|code/i.test(skill))      return '⌨️ Coding'
    if (/fix|debug/i.test(skill))           return '🔧 Debugging'
    if (/ship|deploy/i.test(skill))         return '🚀 Deploying'
    if (/research|explore/i.test(skill))    return '🔬 Researching'
    if (/architect|design/i.test(skill))    return '🏗️ Designing'
    if (/security|audit/i.test(skill))      return '🛡️ Security check'
    return `💼 ${skill}`
  }

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

// ─── Skill context — persist skill→role across tool calls within a subagent ───
// When SubagentStart fires (e.g. /review), we save the skill's role to a temp file.
// PreToolUse/PostToolUse events within that subagent (same agent_id) read the file
// and use the skill's role instead of the tool/file-based role, keeping the right
// character active throughout the skill (e.g. QA stays working during /review).

function sanitizeId(id) {
  if (typeof id !== 'string') return 'unknown'
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'unknown'
}

function skillContextPath(agentId) {
  return path.join(os.homedir(), '.claude', `office-skill-${sanitizeId(agentId)}.json`)
}

function saveSkillContext(agentId, role, skillName) {
  try {
    const p = skillContextPath(agentId)
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const json = JSON.stringify({ role, skillName })
    const tmp = p + '.tmp.' + process.pid + '.' + (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
    try {
      fs.writeFileSync(tmp, json)
      fs.renameSync(tmp, p)
    } catch {
      try { fs.writeFileSync(p, json) } catch {}
      try { fs.unlinkSync(tmp) } catch {}
    }
  } catch {}
}

function readSkillContext(agentId) {
  if (!agentId) return null
  try {
    return JSON.parse(fs.readFileSync(skillContextPath(agentId), 'utf-8'))
  } catch { return null }
}

function clearSkillContext(agentId) {
  try { fs.unlinkSync(skillContextPath(agentId)) } catch {}
}

// ─── Main ───

function processEvent(event) {
  const hookEvent = event.hook_event_name
  const tool = event.tool_name || ''
  const agentType = event.agent_type || ''
  const toolInput = event.tool_input || null
  const agentId = event.agent_id || null

  let role, task, status, label, hint = null
  let clearWorkflow = false

  switch (hookEvent) {
    case 'UserPromptSubmit': {
      // New user message — PM enters planning mode.
      // Also clears _stopped so subsequent PreToolUse/PostToolUse proceed normally.
      role = 'pm'
      task = 'thinking'
      status = 'working'
      clearWorkflow = true  // reset subagent workflow on each new turn
      label = pick(LANG === 'en'
        ? ['🤔 Thinking...', '📊 Got it, planning', '💡 Good question...', '🧠 Analyzing']
        : ['🤔 想一下...', '📊 收到，規劃中', '💡 好問題...', '🧠 分析中'])
      break
    }
    case 'PreToolUse': {
      // Suppress if Stop fired and no new UserPromptSubmit has fired yet.
      // Use a 30s window (not a strict boolean) so a failed write can't permanently
      // wedge the guard — it self-heals once 30s have elapsed since _seq was written.
      try {
        const cur = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
        const seq = parseInt(cur._seq, 10)
        if (cur._stopped && !Number.isNaN(seq) && Date.now() - seq < 30_000) return
      } catch {}
      const fullPath = extractFilePath(tool, toolInput)
      // If inside a subagent with skill context, prefer the skill's role
      const skillCtx = readSkillContext(agentId)
      role = skillCtx ? skillCtx.role : (fileToRole(fullPath) || toolToRole(tool))
      task = tool
      status = 'working'
      const ctx = extractContext(tool, toolInput)
      label = toolLabel(tool, ctx, false)
      break
    }
    case 'PostToolUse': {
      // Suppress straggler PostToolUse events that arrive after Stop.
      // Use a 30s window (not a strict boolean) — same rationale as PreToolUse.
      try {
        const cur = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
        const seq = parseInt(cur._seq, 10)
        if (cur._stopped && !Number.isNaN(seq) && Date.now() - seq < 30_000) return
      } catch {}
      const fullPath = extractFilePath(tool, toolInput)
      const skillCtx = readSkillContext(agentId)
      role = skillCtx ? skillCtx.role : (fileToRole(fullPath) || toolToRole(tool))
      task = tool
      // Detect errors from tool result
      let toolResult = event.tool_result || ''
      if (typeof toolResult === 'object') toolResult = JSON.stringify(toolResult)
      const isError = event.is_error || (typeof toolResult === 'string' && /^(Error:|Exit code [1-9]|ENOENT|EPERM|EACCES|Command failed|fatal:)/im.test(toolResult.slice(0, 300)))
      status = isError ? 'blocked' : 'done'
      hint = isError ? 'error' : null
      const ctx = extractContext(tool, toolInput)
      label = isError ? (LANG === 'zh-TW' ? `❌ ${ctx || tool} 失敗` : `❌ ${ctx || tool} failed`) : toolLabel(tool, ctx, true)
      break
    }
    case 'SubagentStart': {
      role = skillToRoleExtended(agentType)
      task = agentType
      status = 'working'
      label = skillLabel(agentType, false)
      // Persist skill context so tool calls within this subagent stay on the right role
      if (agentId) saveSkillContext(agentId, role, agentType)
      break
    }
    case 'SubagentStop': {
      role = skillToRoleExtended(agentType)
      task = agentType
      status = 'done'
      label = skillLabel(agentType, true)
      clearWorkflow = true  // subagent workflow ends; reset so it doesn't stick forever
      if (agentId) clearSkillContext(agentId)
      break
    }
    case 'Stop': {
      // Claude's turn is over — mark all current agents as done.
      // _stopped: true prevents straggler PostToolUse events from overwriting this idle state.
      try {
        const VALID_HOOK_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
        const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
        const doneAgents = (Array.isArray(data.agents) ? data.agents : [])
          .filter(a => a && typeof a === 'object' && VALID_HOOK_ROLES.includes(a.role))
          .map(a => ({
            role: a.role,
            task: typeof a.task === 'string' ? a.task.slice(0, 200) : null,
            status: 'done',
            label: pick(LANG === 'en'
              ? ['✅ All done', '✅ Round complete', '✅ Over to you']
              : ['✅ 搞定了', '✅ 這輪結束', '✅ 交給你了']),
            hint: null,
          }))
        const output = {
          _seq: nextSeq(),
          _stopped: true,
          _cwd: process.cwd(),
          type: 'office-status',
          agents: doneAgents,
          activeCount: 0,
          workflow: data.workflow || null,
          source: 'claude-cli',
        }
        const dir = path.dirname(STATUS_FILE)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const json = JSON.stringify(output, null, 2)
        const tmp = STATUS_FILE + '.tmp.' + process.pid + '.' + (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
        try {
          fs.writeFileSync(tmp, json)
          fs.renameSync(tmp, STATUS_FILE)
        } catch {
          // Rename failed (EBUSY / file locked) — write directly as fallback
          try { fs.writeFileSync(STATUS_FILE, json) } catch {}
          try { fs.unlinkSync(tmp) } catch {}
        }
      } catch {
        // File doesn't exist yet (first-ever Stop) or is invalid — write a clean "idle" state
        // so the office always receives a response rather than silently getting nothing.
        const output = {
          type: 'office-status',
          agents: [],
          activeCount: 0,
          workflow: null,
          source: 'claude-cli',
          _cwd: process.cwd(),
          _seq: nextSeq(),
          _stopped: true,
        }
        const dir = path.dirname(STATUS_FILE)
        try {
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          const json = JSON.stringify(output, null, 2)
          const tmp = STATUS_FILE + '.tmp.' + process.pid + '.' + (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
          try {
            fs.writeFileSync(tmp, json)
            fs.renameSync(tmp, STATUS_FILE)
          } catch {
            try { fs.writeFileSync(STATUS_FILE, json) } catch {}
            try { fs.unlinkSync(tmp) } catch {}
          }
        } catch {}
      }
      return  // no further processing needed
    }
    default:
      return
  }

  // Read existing status to merge (keep other agents' states + workflow)
  const VALID_MERGE_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
  let existing = []
  let existingWorkflow = null
  try {
    const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
    existing = Array.isArray(data.agents)
      ? data.agents
          .filter(a => a && typeof a === 'object' && VALID_MERGE_ROLES.includes(a.role))
          .map(a => ({
            role: a.role,
            status: typeof a.status === 'string' ? a.status : 'working',
            task: typeof a.task === 'string' ? a.task.slice(0, 200) : null,
            label: typeof a.label === 'string' ? a.label.slice(0, 200) : null,
            hint: typeof a.hint === 'string' ? a.hint.slice(0, 200) : null,
          }))
      : []
    existingWorkflow = typeof data.workflow === 'string' ? data.workflow.slice(0, 200) : null
  } catch {}

  // Replace agent with same role, or add new
  const newAgents = [
    ...existing.filter(a => a.role !== role),
    {
      role,
      task: typeof task === 'string' ? task.slice(0, 200) : null,
      status,
      label: typeof label === 'string' ? label.slice(0, 200) : null,
      hint: typeof hint === 'string' ? hint.slice(0, 200) : null,
    },
  ]

  const activeCount = newAgents.filter(a => a.status === 'working' || a.status === 'blocked').length

  const output = {
    _seq: nextSeq(),
    _cwd: process.cwd(),
    type: 'office-status',
    agents: newAgents,
    activeCount,
    workflow: clearWorkflow ? null : ((agentType && agentType.slice(0, 200)) || existingWorkflow),
    source: 'claude-cli',
  }

  // Write with retry (Windows file locking can cause EBUSY on rename)
  const dir = path.dirname(STATUS_FILE)
  const json = JSON.stringify(output, null, 2)
  const tmp = STATUS_FILE + '.tmp.' + process.pid + '.' + (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(tmp, json)
    fs.renameSync(tmp, STATUS_FILE)
  } catch {
    // Rename failed (EBUSY / file locked) — write directly as fallback
    try { fs.writeFileSync(STATUS_FILE, json) } catch {}
    try { fs.unlinkSync(tmp) } catch {}
  }
}

// Export helpers for testing (CommonJS — this file runs as a Node.js hook)
if (typeof module !== 'undefined') {
  module.exports = { HOOK_VERSION, toolToRole, skillToRole, shortFile, shortCommand, extractContext,
    skillContextPath, saveSkillContext, readSkillContext, clearSkillContext }
}
