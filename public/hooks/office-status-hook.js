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

// Monotonic _seq: plain integer, matches server.mjs / vite.config.js canonical form.
// Monotonic within a process run; two runs in the same ms can produce equal values,
// which is acceptable — staleness is checked against a 300s window, not 1ms precision.
let _seqLast = 0
function nextSeq() {
  const now = Date.now()
  _seqLast = now > _seqLast ? now : _seqLast + 1
  return String(_seqLast)
}

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
        const slug = branch.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 28).replace(/^-+|-+$/g, '') || 'default'
        return `${slug}-${cwdHash}`
      }
    }
  } catch {}
  const cwdSlug = (path.basename(process.cwd())
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 28)
    .replace(/^-+|-+$/g, '')) || 'default'
  return `${cwdSlug}-${cwdHash}`
}

const SESSION_SLUG = getSessionSlug()
const STATUS_FILE = path.join(os.homedir(), '.claude', `office-status-${SESSION_SLUG}.json`)

// ─── Shared role list — single source for Stop handler and merge logic ───
const VALID_HOOK_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']

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

// AVO-126: a Bash bubble must read like office life, never like a terminal. Map the
// command to a friendly noun (no raw command, no filesystem path EVER) so the working
// ("⚡ tests"), done ("✅ tests done") and error ("❌ tests failed") frames all stay
// in-character. Unknown commands fall back to a generic noun, never the raw string.
function bashVibeLabel(cmd, lang = LANG) {
  const zh = lang === 'zh-TW'
  const fallback = zh ? '指令' : 'a command'
  if (!cmd || typeof cmd !== 'string') return fallback
  // Split the command into sub-commands on &&, ||, ;, |, and newlines, then classify each.
  // The Claude Code harness often wraps a command as `cd "<dir>" && <real cmd>` or
  // `bash -c "<real cmd>"`, so the meaningful program is rarely the WHOLE string and not
  // always the LAST segment. Scan every segment and return the FIRST meaningful office
  // noun, skipping trivial glue (cd/echo/sleep/pwd). Never returns a raw command or path.
  const classifySeg = (segRaw) => {
    let s = segRaw
    // Strip surrounding quotes + shell-wrapper prefixes (bash -c, sh -c, pwsh -Command, eval), iteratively.
    for (let i = 0; i < 3; i++) {
      s = s.replace(/^(['"])([\s\S]*)\1$/, '$2').trim()
      s = s.replace(/^(?:eval|bash|sh|zsh|dash|ksh|pwsh|powershell|cmd(?:\.exe)?)\b(?:\s+(?:-{1,2}[a-z]+|\/[a-z]+))*\s+/i, '').trim()
    }
    const prog = s.toLowerCase()
    if (!prog) return null
    // Program-anchored checks MUST run first so that compound commands like
    // 'git checkout build-fix' or 'git commit -m "add test"' match 'git' (^git anchor)
    // rather than the unanchored 'build'/'test' keyword checks below.
    // Invariant: no case below may match before a more-specific ^anchor case above it.
    if (/^git\b/.test(prog)) return 'git'
    if (/^(curl|wget|http|ping|ssh|scp|rsync)\b/.test(prog)) return zh ? '連線' : 'a fetch'
    if (/^(docker|kubectl|helm|terraform|pm2|systemctl|nginx|serve)\b/.test(prog)) return zh ? '部署' : 'ops'
    if (/^(python|python3|node|deno|bun|go|cargo|ruby|php|java|dotnet)\b/.test(prog)) return zh ? '程式' : 'a script'
    if (/^(ls|dir|find|cat|head|tail|grep|rg|less|more|tree|stat|wc|file)\b/.test(prog)) return zh ? '檔案' : 'files'
    if (/^(mkdir|rm|mv|cp|touch|chmod|chown|ln|tar|zip|unzip)\b/.test(prog)) return zh ? '檔案' : 'files'
    // Unanchored keyword checks — only reached when the program is not one of the above
    if (/(vitest|jest|pytest|mocha|\btest\b)/.test(prog)) return zh ? '測試' : 'tests'
    if (/(npm run build|vite build|\btsc\b|webpack|rollup|\bcompile\b|\bmake\b|\bbuild\b)/.test(prog)) return zh ? '建置' : 'the build'
    if (/(npm i\b|npm ci\b|npm install|yarn add|pnpm i\b|pnpm add|pip install|\binstall\b)/.test(prog)) return zh ? '套件' : 'deps'
    if (/(npm run|npm start|yarn |pnpm |npx )/.test(prog)) return zh ? '腳本' : 'a script'
    return null  // trivial glue (cd/echo/sleep/pwd/which) or unknown — skip
  }
  for (const seg of cmd.split(/&&|\|\||;|\n|\|/).map(s => s.trim()).filter(Boolean)) {
    const m = classifySeg(seg)
    if (m) return m
  }
  return fallback
}

// AVO-110 / #29: derive a language-neutral blocked-reason from ONLY the signals the hook
// can honestly observe. This is the honesty firewall — a specific reason is returned ONLY
// when the evidence proves it; every ambiguous case falls back to 'blocked-unknown' (the
// load-bearing default, mirroring the office pet's hide-on-blocker guarantee). It NEVER
// guesses: the documented trap is that bashVibeLabel returns the FIRST segment's noun while
// is_error is one boolean for the WHOLE compound command (wrong-segment attribution), so
// compound commands are refused outright.
//   - SAME-EVENT ANCHOR: only the TRUSTED explicit `is_error === true` unlocks a specific
//     reason; the first-line heuristic path (is_error undefined) → unknown.
//   - RUNNER-PRESENT: a launch failure (ENOENT/command not found/…) means the program never
//     ran, so "blocked on the test run" would over-claim → unknown.
//   - CD-GLUE: strip exactly ONE leading `cd "<path>" && ` wrapper (the Claude Code harness
//     shape); cd cannot be the failing program, so this is honest.
//   - SINGLE-SEGMENT GUARD: any remaining shell operator (&&,||,;,|,newline,&) → unknown.
//   - ANCHORED ALLOWLIST: ^-anchored program match only; the overloaded bare
//     \binstall\b/\bbuild\b/\bmake\b keywords are intentionally DROPPED.
function deriveBlockedReason({ isErrorExplicit, command, toolResultFirstLine } = {}) {
  const UNKNOWN = 'blocked-unknown'
  if (isErrorExplicit !== true) return UNKNOWN
  if (typeof command !== 'string' || !command.trim()) return UNKNOWN
  const firstLine = typeof toolResultFirstLine === 'string' ? toolResultFirstLine.trim() : ''
  // errno tokens anchored at start (avoid mid-prose false positives); the "command/…: not
  // found" launch phrase may appear after the program name (`vitest: command not found`).
  if (/^(ENOENT|EACCES|EPERM|No such file)/i.test(firstLine) || /(command not found|: not found)\b/i.test(firstLine))
    return UNKNOWN
  // Strip ONE leading glue-only `cd "<path>" && ` prefix, then guard against any operator.
  const cmd = command.trim().replace(/^cd\s+(?:"[^"]*"|'[^']*'|\S+)\s+&&\s+/, '')
  if (/&&|\|\||;|\||\n|&/.test(cmd)) return UNKNOWN
  const c = cmd.trim().toLowerCase()
  if (/^(vitest|jest|pytest|mocha|npm (run )?test|yarn test|pnpm test)(?=$|\s)/.test(c)) return 'test-run-failed'
  if (/^(npm run build|vite build|tsc|webpack|rollup)(?=$|\s)/.test(c)) return 'build-failed'
  if (/^(npm (i|ci|install)|yarn add|pnpm (i|add)|pip install)(?=$|\s)/.test(c)) return 'deps-failed'
  return UNKNOWN
}

// AVO-110 EPHEMERAL gate (single source for both the fresh-write and the carry-forward sites):
// a reasonCode is retained ONLY while the agent is blocked. A non-blocked status (done/idle/…)
// returns null so no stale reason survives — even when another agent's event rebuilds this record.
function pickReason(status, reasonCode) {
  return status === 'blocked' && typeof reasonCode === 'string' ? reasonCode : null
}

function extractContext(tool, toolInput, lang = LANG) {
  if (!toolInput) return null
  try {
    const input = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput
    switch (tool) {
      case 'Edit':
      case 'Write':
      case 'Read':
        return shortFile(input.file_path || input.path)
      case 'Bash':
        // AVO-126: never surface a raw shell command/path in a bubble — use an office-vibe noun.
        return bashVibeLabel(input.command || input.cmd, lang)
      case 'Grep': {
        // Strip leading path components from the pattern so absolute paths don't leak into
        // bubbles: "/home/user/src/**/*.js" → "*.js"; "useLocale" stays "useLocale"
        const pat = input.pattern ? path.basename(input.pattern.replace(/\\/g, '/')).slice(0, 20) : null
        return pat ? `"${pat}"` : null
      }
      case 'Glob': {
        // Basename-ize glob patterns — an absolute path like /home/user/src/**/*.test.js
        // is reduced to *.test.js so the bubble never leaks a filesystem path.
        const gPat = input.pattern || null
        if (!gPat) return null
        // If the pattern contains a slash, extract only the final path component / glob segment
        const gBase = gPat.replace(/\\/g, '/').split('/').pop() || gPat
        return gBase.slice(0, 30)
      }
      case 'Agent': {
        // Strip leading absolute path components from descriptions so a long description
        // like "/home/user/proj: review the auth module" becomes "review the auth module".
        const desc = input.description || input.prompt?.slice(0, 40) || null
        if (!desc) return null
        // Remove any leading path segment (starts with / or drive letter + colon)
        const stripped = desc.replace(/^(?:[A-Za-z]:)?\/[^\s:]*[:\s]+/, '').trim()
        return stripped.slice(0, 30)
      }
      case 'WebFetch':
        // Use only the hostname (no path) to avoid leaking absolute URLs into bubbles
        return input.query || (input.url ? (() => { try { return new URL(input.url).hostname.slice(0, 25) } catch { return input.url.replace(/^https?:\/\//, '').split('/')[0].slice(0, 25) } })() : null)
      case 'WebSearch':
        return input.query || input.url?.replace(/^https?:\/\//, '').slice(0, 25) || null
      case 'TodoWrite':
        return input.todos?.length ? (lang === 'zh-TW' ? `${input.todos.length} 個任務` : `${input.todos.length} tasks`) : null
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
    // When context is present: use only the two context-bearing variants (indices 0 and 1)
    // so the context string is always visible in the bubble.
    // When context is absent: pick from all four labels (indices 0-3 are generic anyway).
    // The "* 2" multiplier on random was dead code that made labels 2 and 3 unreachable
    // when context was present — removed in favour of this explicit two-array pattern.
    if (context) {
      return pick(LANG === 'en'
        ? [`✅${ctx} done`, `✅${ctx} ready`]
        : [`✅${ctx} 好了`, `✅${ctx} 搞定`])
    }
    return pick(LANG === 'en'
      ? ['✅ Done!', '✅ Next', '✅ All good', '✅ Complete']
      : ['✅ 完成！', '✅ 下一個', '✅ 搞定了', '✅ OK'])
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

// SubagentStop: should the workflow banner this stop pairs with be cleared?
// - Known owner (existingWorkflowAgentId set): clear ONLY on an exact agent_id match, so a
//   straggler stop for a finished subagent can't clobber a new same-type subagent's banner.
// - Orphaned banner (existingWorkflowAgentId null — a SubagentStart set the workflow without
//   an agent_id, so _workflowAgentId never got populated): an id match is impossible, so
//   clear when the stopping subagent's type matches the workflow string OR when no type is
//   supplied. An orphaned banner is already un-ownable; clearing it beats leaking it. (The
//   Stop handler is the hard backstop — `workflow: null` — but clearing here avoids a
//   mid-turn stuck banner.)
function shouldClearWorkflowOnSubagentStop(existingWorkflowAgentId, agentId, existingWorkflow, agentType) {
  if (existingWorkflowAgentId) return existingWorkflowAgentId === agentId
  const type = (agentType || '').slice(0, 200)
  return type === '' || existingWorkflow === type
}

// Should this event's output carry the Stop idle signal (_stopped:true) forward?
// The carry-forward protects Stop's idle state from being erased by a PostToolUse that wins a
// last-writer race with Stop. But `_stopped:true` (turn over / office idle) is mutually
// exclusive with `activeCount >= 1` (an agent is actively working/blocked): emitting both is a
// self-contradictory state. A straggler PreToolUse that slips past the 30s entry guard asserts
// a working agent (activeCount 1) while recheckStopped is still true — the old unconditional
// carry produced `{_stopped:true, activeCount:1, working}`. Gating on activeCount===0 keeps the
// race protection for winding-down `done` events (which leave 0 active) yet clears the idle
// signal whenever the event genuinely asserts activity. UserPromptSubmit never carries it (it
// is the event that legitimately ends the stopped state).
function shouldCarryStoppedSignal(recheckStopped, hookEvent, activeCount) {
  return Boolean(recheckStopped) && hookEvent !== 'UserPromptSubmit' && activeCount === 0
}

// AVO-101: Claude Code carries `permission_mode` on every tool event. In plan mode it is
// 'plan' — the agent is architecting an approach with read-only tools before touching code.
// Surface that as a distinct 'planning' status (→ gantt-chart animation) instead of the
// generic 'working', so plan mode is visible in the office. Any other mode stays 'working'.
function statusForPreToolUse(permissionMode) {
  return permissionMode === 'plan' ? 'planning' : 'working'
}

// AVO-108: token usage isn't in the hook payload, but `transcript_path` points to a JSONL
// whose last assistant message carries `usage`. Read ONLY the file tail (64 KB) so cost is
// O(tail), not O(transcript) — a 3.6 MB transcript reads in <1 ms. Returns the current
// context size (input + cache_creation + cache_read) and the last response's output tokens,
// or null on any failure (never throws — the hook must stay fast and crash-proof).
function readLatestTokenUsage(transcriptPath, tailBytes = 65536) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null
  try {
    const size = fs.statSync(transcriptPath).size
    const start = Math.max(0, size - tailBytes)
    const fd = fs.openSync(transcriptPath, 'r')
    let buf
    try {
      buf = Buffer.alloc(size - start)
      fs.readSync(fd, buf, 0, buf.length, start)
    } finally { fs.closeSync(fd) }
    let usage = null, model = null
    for (const line of buf.toString('utf-8').split('\n')) {
      if (!line.trim()) continue
      let o; try { o = JSON.parse(line) } catch { continue }
      const m = o && o.message
      if (m && m.usage && typeof m.usage === 'object') { usage = m.usage; model = m.model || model }
    }
    if (!usage) return null
    const ctx = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0)
    return { ctx, out: usage.output_tokens || 0, model: model || null }
  } catch { return null }
}

// AVO-102: the model's effort level for this turn (low|medium|high|xhigh|max), carried on
// tool-context events. Returns the level string, or null when absent/unrecognized.
const HOOK_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']
function effortLevel(event) {
  const lvl = event && event.effort && event.effort.level
  return HOOK_EFFORT_LEVELS.includes(lvl) ? lvl : null
}

// ─── Helper-huddle: subagent helper list ops ───
// Produces a stable 4-char hex hash of a string, using the existing crypto module.
// Stability contract: same agentId → same hash across calls within a process run.
function helperHash(str) {
  if (!str) return (Math.random().toString(16) + '0000').slice(2, 6)
  try {
    return require('crypto').createHash('md5').update(str).digest('hex').slice(0, 4)
  } catch {
    // Fallback: simple djb2 truncated to 4 hex chars (no crypto dep required)
    let h = 5381
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
    return ((h >>> 0).toString(16) + '0000').slice(0, 4)
  }
}

// Returns a new helpers array with one helper appended for the given subagent.
// De-duplicates by id: if a helper with the same id already exists, it is replaced
// in-place (preserving position) rather than appended — prevents duplicate entries
// when SubagentStart re-fires for the same agent_id.
// Capped at 64 entries (oldest first-in is evicted when the cap is exceeded).
function helperAdd(helpers, role, agentId, agentType) {
  try {
    const safeHelpers = Array.isArray(helpers) ? helpers : []
    const id = role + '#' + helperHash(agentId || agentType || String(safeHelpers.length))
    const record = {
      id,
      parentRole: typeof role === 'string' ? role : 'dev',
      label: typeof agentType === 'string' ? agentType.slice(0, 200) : '',
    }
    // De-duplicate: replace existing record with same id rather than appending a second copy.
    const existingIdx = safeHelpers.findIndex(h => h && h.id === id)
    let next
    if (existingIdx !== -1) {
      next = [...safeHelpers.slice(0, existingIdx), record, ...safeHelpers.slice(existingIdx + 1)]
    } else {
      next = [...safeHelpers, record]
    }
    return next.length > 64 ? next.slice(next.length - 64) : next
  } catch { return Array.isArray(helpers) ? helpers : [] }
}

// Returns a new helpers array with the matching helper removed.
// Matches by id (role + '#' + hash(agentId)). When agentId is missing, removes the
// oldest helper for that role (best-effort, per contract).
function helperRemove(helpers, role, agentId) {
  try {
    const safeHelpers = Array.isArray(helpers) ? helpers : []
    if (!safeHelpers.length) return safeHelpers
    if (agentId) {
      // Known agent_id: remove exact match; if no match found, return unchanged.
      const targetId = role + '#' + helperHash(agentId)
      const idx = safeHelpers.findIndex(h => h && h.id === targetId)
      if (idx !== -1) return [...safeHelpers.slice(0, idx), ...safeHelpers.slice(idx + 1)]
      return safeHelpers
    }
    // No agent_id: best-effort — remove oldest helper for this role
    const idx = safeHelpers.findIndex(h => h && h.parentRole === role)
    if (idx !== -1) return [...safeHelpers.slice(0, idx), ...safeHelpers.slice(idx + 1)]
    return safeHelpers
  } catch { return Array.isArray(helpers) ? helpers : [] }
}

// ─── Main ───

function processEvent(event) {
  const hookEvent = event.hook_event_name
  const tool = event.tool_name || ''
  const agentType = event.agent_type || ''
  const toolInput = event.tool_input || null
  const agentId = event.agent_id || null
  // AVO-108: cheap tail-read of the transcript for token usage. null when unavailable; the
  // store keeps its last value on null (presence semantics) so the chip never flickers.
  const tokens = readLatestTokenUsage(event.transcript_path)
  // AVO-102: effort level for this turn (drives the thinking aura). null when absent.
  const effort = effortLevel(event)

  let role, task, status, label, hint = null
  let reasonCode = null  // AVO-110: language-neutral blocked-reason; stamped only on a trusted error
  let activeFile = null  // AVO-106: full path of the file this agent is on (Edit/Write/Read); null otherwise
  let clearWorkflow = false
  let workflowOverride = null  // only SubagentStart sets this; PreToolUse/PostToolUse must not clobber workflow
  let capturedPromptId = null  // PreToolUse captures current _promptId for straggler detection
  let newPromptId = null       // UserPromptSubmit sets a fresh _promptId each turn
  // Helper-huddle: 'add' or 'remove' or null; resolved after merge-read using existingHelpers.
  let helperAction = null  // { op: 'add'|'remove', role, agentId, agentType }

  switch (hookEvent) {
    case 'UserPromptSubmit': {
      // New user message — PM enters planning mode.
      // Writes a fresh _promptId so PostToolUse straggler detection (re-check below) can
      // distinguish old-turn stragglers from legitimate new-turn tool calls.
      role = 'pm'
      task = 'thinking'
      status = 'working'
      clearWorkflow = true  // reset subagent workflow on each new turn
      newPromptId = nextSeq()  // unique turn token; advances when user submits a new prompt
      label = pick(LANG === 'en'
        ? ['🤔 Thinking...', '📊 Got it, planning', '💡 Good question...', '🧠 Analyzing']
        : ['🤔 想一下...', '📊 收到，規劃中', '💡 好問題...', '🧠 分析中'])
      break
    }
    case 'PreToolUse': {
      // Suppress if Stop fired and no new UserPromptSubmit has fired yet.
      // Use a 30s window so a failed write can't permanently wedge the guard.
      // _stoppedAt is a dedicated timestamp written by Stop; fall back to _seq for
      // files written before this field was added. Future _seq (monotonic counter
      // overshoot) cannot wedge the guard because we use _stoppedAt preferentially.
      // Also capture _promptId at entry — PreToolUse writes it as _preToolPromptId so
      // a later PostToolUse straggler can detect if UserPromptSubmit fired between them.
      try {
        const cur = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
        const stoppedAt = typeof cur._stoppedAt === 'number' ? cur._stoppedAt : parseInt(cur._seq, 10)
        if (cur._stopped && Number.isFinite(stoppedAt) && Date.now() - stoppedAt < 30_000) return
        capturedPromptId = cur._promptId || null
      } catch {}
      // Synthesize OUTSIDE the try so ENOENT (file absent on fresh install — no prior Stop
      // has run yet) does not kill the synthesis path. Without this, the catch swallows the
      // missing-file exception AND capturedPromptId stays null, leaving the PostToolUse
      // straggler gate structurally dead for the entire first turn.
      if (capturedPromptId === null) capturedPromptId = `__t:${nextSeq()}`
      const fullPath = extractFilePath(tool, toolInput)
      activeFile = fullPath  // AVO-106: the file this agent is now on (null for non-file tools)
      // If inside a subagent with skill context, prefer the skill's role
      const skillCtx = readSkillContext(agentId)
      role = skillCtx ? skillCtx.role : (fileToRole(fullPath) || toolToRole(tool))
      task = tool
      status = statusForPreToolUse(event.permission_mode)  // AVO-101: plan mode → 'planning'
      const ctx = extractContext(tool, toolInput)
      label = toolLabel(tool, ctx, false)
      break
    }
    case 'PostToolUse': {
      // Suppress straggler PostToolUse events that arrive after Stop.
      // Same _stoppedAt guard as PreToolUse — see comment above.
      try {
        const cur = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
        const stoppedAt = typeof cur._stoppedAt === 'number' ? cur._stoppedAt : parseInt(cur._seq, 10)
        if (cur._stopped && Number.isFinite(stoppedAt) && Date.now() - stoppedAt < 30_000) return
      } catch {}
      const fullPath = extractFilePath(tool, toolInput)
      activeFile = fullPath  // AVO-106: file this agent just touched (null for non-file tools)
      const skillCtx = readSkillContext(agentId)
      role = skillCtx ? skillCtx.role : (fileToRole(fullPath) || toolToRole(tool))
      task = tool
      // Detect errors from tool result
      let toolResult = event.tool_result || ''
      if (typeof toolResult === 'object') toolResult = JSON.stringify(toolResult)
      // Trust event.is_error as primary source of truth.
      // Apply the heuristic ONLY when is_error is undefined (older hook payloads that omit the field).
      // Test only the FIRST line of output so "Error:" or "fatal:" appearing in body prose does not
      // fire a false positive (e.g. a successful grep result that mentions an error keyword).
      // Word-boundary anchors (\b) prevent substring matches like "ENOENT means…" in prose.
      const isError = event.is_error !== undefined
        ? Boolean(event.is_error)
        : (typeof toolResult === 'string' && /^(Error:|Exit code [1-9]|ENOENT\b|EPERM\b|EACCES\b|Command failed|fatal:)/.test(toolResult.split('\n')[0]))
      status = isError ? 'blocked' : 'done'
      hint = isError ? 'error' : null
      const ctx = extractContext(tool, toolInput)
      label = isError ? (LANG === 'zh-TW' ? `❌ ${ctx || tool} 失敗` : `❌ ${ctx || tool} failed`) : toolLabel(tool, ctx, true)
      // AVO-110: on a block, derive the language-neutral reason from the SAME event. A blocked
      // agent always carries a reasonCode (at minimum 'blocked-unknown' — the honest floor);
      // a non-error (done) leaves it null. The trusted explicit boolean (event.is_error===true)
      // is what unlocks a SPECIFIC reason; the heuristic path resolves to blocked-unknown.
      if (isError) {
        let bashCmd = null
        if (tool === 'Bash') {
          try {
            const ti = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput
            bashCmd = (ti && (ti.command || ti.cmd)) || null
          } catch {}
        }
        reasonCode = deriveBlockedReason({
          isErrorExplicit: event.is_error === true,
          command: bashCmd,
          toolResultFirstLine: typeof toolResult === 'string' ? toolResult.split('\n')[0] : '',
        })
      }
      break
    }
    case 'SubagentStart': {
      role = skillToRoleExtended(agentType)
      task = agentType
      status = 'working'
      label = skillLabel(agentType, false)
      workflowOverride = agentType  // set workflow to the subagent type on start
      // Persist skill context so tool calls within this subagent stay on the right role
      if (agentId) saveSkillContext(agentId, role, agentType)
      helperAction = { op: 'add', role, agentId, agentType }
      break
    }
    case 'SubagentStop': {
      // Guard against stale SubagentStop stragglers (same _stopped check as PreToolUse).
      // clearSkillContext runs on the suppressed path too — turn is already over so the
      // context file is safe to remove regardless. The key fix is that the status write
      // (which would erase done-agents from Stop) must not happen on the suppressed path.
      try {
        const cur = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
        const stoppedAt = typeof cur._stoppedAt === 'number' ? cur._stoppedAt : parseInt(cur._seq, 10)
        if (cur._stopped && Number.isFinite(stoppedAt) && Date.now() - stoppedAt < 30_000) {
          if (agentId) clearSkillContext(agentId)
          return
        }
      } catch {}
      role = skillToRoleExtended(agentType)
      task = agentType
      status = 'done'
      label = skillLabel(agentType, true)
      clearWorkflow = true  // subagent workflow ends; reset so it doesn't stick forever
      if (agentId) clearSkillContext(agentId)
      helperAction = { op: 'remove', role, agentId, agentType }
      break
    }
    case 'Stop': {
      // Claude's turn is over — mark all current agents as done.
      // _stopped: true prevents straggler PostToolUse events from overwriting this idle state.
      try {
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
          _stoppedAt: Date.now(),
          _cwd: process.cwd(),
          type: 'office-status',
          agents: doneAgents,
          activeCount: 0,
          // A workflow banner is ONLY ever set by SubagentStart, so any workflow still
          // present when the turn ends must be cleared — it can never legitimately outlive a
          // Stop. The previous `_workflowAgentId ? null : workflow` guard leaked a banner
          // FOREVER when a SubagentStart set a workflow without an agent_id (_workflowAgentId
          // stays null), then a SubagentStop with a different/absent agent_type failed to
          // match it (see shouldClearWorkflowOnSubagentStop). Unconditional null is the
          // correct terminal state; nothing downstream needs a workflow to survive Stop.
          workflow: null,
          // Preserve R45/R46 identity fields so a SubagentStop arriving after Stop still
          // uses the precise _workflowAgentId match rather than falling back to type-string.
          _workflowAgentId: typeof data._workflowAgentId === 'string' ? data._workflowAgentId : null,
          _workflowPromptId: typeof data._workflowPromptId === 'string' ? data._workflowPromptId : null,
          source: 'claude-cli',
          _promptId: data._promptId || null,
          _preToolPromptId: data._preToolPromptId || null,
          helpers: [],  // turn over — clear all helpers
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
          _stoppedAt: Date.now(),
          helpers: [],  // turn over — clear all helpers
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
  let existing = []
  let existingWorkflow = null
  let existingWorkflowAgentId = null
  let existingWorkflowPromptId = null
  let existingPromptId = null
  let existingPreToolPromptId = null
  let existingStopped = false
  let existingStoppedAt = null
  let existingHelpers = []
  try {
    const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
    existing = Array.isArray(data.agents)
      ? data.agents
          .filter(a => a && typeof a === 'object' && VALID_HOOK_ROLES.includes(a.role))
          .map(a => ({
            role: a.role,
            status: typeof a.status === 'string' ? a.status : 'working',
            task: typeof a.task === 'string' ? a.task.slice(0, 200) : null,
            label: typeof a.label === 'string' ? a.label.slice(0, 200) : null,
            hint: typeof a.hint === 'string' ? a.hint.slice(0, 200) : null,
            // AVO-110: carry a still-blocked agent's reason forward so another agent's event
            // can't stale-clear it (EPHEMERAL cross-agent path); non-blocked → no reason.
            reasonCode: pickReason(a.status, a.reasonCode),
            // AVO-106: carry the OTHER agents' last-known file forward (only this event's role is
            // replaced below). Recency is enforced downstream by activeFileAt + the huddle window.
            activeFile: typeof a.activeFile === 'string' ? a.activeFile.slice(0, 200) : null,
          }))
      : []
    existingWorkflow = typeof data.workflow === 'string' ? data.workflow.slice(0, 200) : null
    existingWorkflowAgentId = typeof data._workflowAgentId === 'string' ? data._workflowAgentId : null
    existingWorkflowPromptId = typeof data._workflowPromptId === 'string' ? data._workflowPromptId : null
    existingPromptId = data._promptId || null
    existingPreToolPromptId = data._preToolPromptId || null
    existingStopped = Boolean(data._stopped)
    existingStoppedAt = typeof data._stoppedAt === 'number' ? data._stoppedAt : null
    existingHelpers = Array.isArray(data.helpers) ? data.helpers.filter(h => h && typeof h.id === 'string') : []
  } catch {}

  // Detect stale workflow from a previous turn. Two conditions that independently indicate
  // the workflow no longer belongs to the current turn:
  // 1. _workflowPromptId !== _promptId: the workflow was set in a different turn (the normal
  //    mismatch case — SubagentStop suppressed + UPS ran and advanced _promptId).
  // 2. existingStopped && existingWorkflowAgentId: the prior turn ended (_stopped=true is still
  //    set) but UPS never successfully landed to advance _promptId. _workflowPromptId equals
  //    _promptId (both stale) so the normal mismatch can't fire — but _stopped is unambiguous
  //    evidence that the workflow belongs to a completed turn.
  // SubagentStart is excluded from both: it sets workflowOverride and must always install
  // its own workflow regardless of existing state.
  const workflowTurnMismatch = hookEvent !== 'SubagentStart' && !!(
    (existingWorkflowAgentId && existingWorkflowPromptId && existingPromptId &&
     existingWorkflowPromptId !== existingPromptId) ||
    // Dropped-UPS case: workflow belongs to a completed turn. Gate on 30s window so a
    // stale _stopped from a prior session (>30s old) doesn't wipe the new session's
    // workflow on PreToolUse events that arrive before the new SubagentStart.
    (existingWorkflowAgentId && existingStopped &&
     (existingStoppedAt == null || Date.now() - existingStoppedAt < 30_000))
  )

  // Replace agent with same role, or add new
  const newAgents = [
    ...existing.filter(a => a.role !== role),
    {
      role,
      task: typeof task === 'string' ? task.slice(0, 200) : null,
      status,
      label: typeof label === 'string' ? label.slice(0, 200) : null,
      hint: typeof hint === 'string' ? hint.slice(0, 200) : null,
      // AVO-110: a blocked agent carries its reason; any other status clears it (EPHEMERAL).
      reasonCode: pickReason(status, reasonCode),
      // AVO-106: the file this agent is on (Edit/Write/Read); null for non-file tools / events.
      activeFile: typeof activeFile === 'string' ? activeFile.slice(0, 200) : null,
    },
  ]

  const activeCount = newAgents.filter(a => a.status === 'working' || a.status === 'blocked').length

  // Re-check _stopped: if Stop ran DURING our processing window (after the entry guard passed),
  // abort rather than overwriting the idle state with stale working/done data.
  // UserPromptSubmit is the ONLY exempt event: it is the event that legitimately clears
  // _stopped, and suppressing it would prevent the office from showing the PM re-entering
  // planning on rapid back-to-back prompts.
  // SubagentStart is NOT exempt: if _stopped is still true when SubagentStart fires, UPS
  // has not yet run for the new turn, meaning this SubagentStart is a straggler from the
  // old turn. Once UPS clears _stopped, any SubagentStart for the new turn passes normally.
  // recheckStopped/recheckStoppedAt: sourced from the re-check guard's fresh file read,
  // not the earlier merge read. The carry-through must use these values so a UPS that
  // fires between the merge read and the re-check guard clears _stopped before it reaches
  // the carry-through — using the stale merge-read value would re-assert _stopped:true
  // after UPS already cleared it, freezing subsequent events for up to 30s.
  let recheckStopped = existingStopped
  let recheckStoppedAt = existingStoppedAt

  if (hookEvent !== 'UserPromptSubmit') {
    try {
      const latest = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
      // Update recheck fields from the freshest read (single consistent snapshot for guard + carry-through).
      recheckStopped = Boolean(latest._stopped)
      recheckStoppedAt = typeof latest._stoppedAt === 'number' ? latest._stoppedAt : null
      const stoppedAt = recheckStoppedAt ?? parseInt(latest._seq, 10)
      if (latest._stopped && Number.isFinite(stoppedAt) && Date.now() - stoppedAt < 30_000) return
      // SubagentStart with _stopped is unconditionally a straggler — no time limit.
      // A legitimate new-turn SubagentStart is always preceded by a UPS that clears _stopped.
      // Without this, a straggler SubagentStart arriving >30s after Stop reinstalls a phantom
      // workflow banner AND drops _stopped, re-enabling further straggler PostToolUse events.
      if (latest._stopped && hookEvent === 'SubagentStart') return
      // PostToolUse straggler detection: PreToolUse captures _promptId as _preToolPromptId.
      // If UserPromptSubmit advanced _promptId after our PreToolUse, _promptId !== _preToolPromptId
      // → new turn started in our window → abort so we don't clobber the fresh PM state.
      if (hookEvent === 'PostToolUse'
          && latest._promptId && latest._preToolPromptId
          && latest._promptId !== latest._preToolPromptId) return
      // Fresh-install guard: if both tokens are synthesized (__t: prefix) AND the session
      // is stopped, no UPS has ever run — there is no legitimate new turn, so any PostToolUse
      // arriving after the 30s window is unconditionally a straggler. The normal mismatch
      // gate above is structurally inert when tokens are equal (no UPS advanced _promptId).
      if (hookEvent === 'PostToolUse' && latest._stopped
          && typeof latest._promptId === 'string' && latest._promptId.startsWith('__t:')
          && typeof latest._preToolPromptId === 'string' && latest._preToolPromptId.startsWith('__t:')) return
    } catch (err) {
      // Only abort on rename-contention codes (EBUSY/EPERM = Stop's atomic rename in flight).
      // ENOENT = first-ever write; EACCES/EMFILE/other = persistent FS error — proceed
      // optimistically so we don't permanently drop events for unrelated FS problems.
      if (err.code === 'EBUSY' || err.code === 'EPERM') return
    }
  }

  // SubagentStop straggler guard: only clear workflow if it still belongs to this subagent.
  // Type-string comparison (R39) can't distinguish same-type subagents running back-to-back:
  // a straggler SubagentStop for a completed /review would clear the workflow of a new /review
  // that's currently running. Use _workflowAgentId (the agent_id that set the workflow) for
  // precise identity matching so same-type subagent overlap can't clobber each other.
  const effectiveClearWorkflow = workflowTurnMismatch || (
    (hookEvent === 'SubagentStop' && clearWorkflow)
      ? shouldClearWorkflowOnSubagentStop(existingWorkflowAgentId, agentId, existingWorkflow, agentType)
      : clearWorkflow
  )

  // Derive the workflow owner fields for the output.
  // workflowOverride (SubagentStart) sets all three; effectiveClearWorkflow (UPS/SubagentStop/
  // turn-mismatch) clears all three; otherwise preserve existing values unchanged.
  const outWorkflow = effectiveClearWorkflow ? null
    : (workflowOverride ? workflowOverride.slice(0, 200) : existingWorkflow)
  // Never inherit a prior agent's id when setting a new workflow: each SubagentStart owns
  // its own workflow independently, so if agentId is absent fall back to null rather than
  // the prior agent's id (which would make SubagentStop's identity check permanently fail).
  const outWorkflowAgentId = effectiveClearWorkflow ? null
    : (workflowOverride ? (agentId || null) : existingWorkflowAgentId)
  // _workflowPromptId records the _promptId current when the workflow was set so future
  // PreToolUse/PostToolUse can detect a stale workflow from a now-dead turn.
  const outWorkflowPromptId = effectiveClearWorkflow ? null
    : (workflowOverride ? existingPromptId : existingWorkflowPromptId)

  // Compute outHelpers: apply add/remove action on top of carried-over existingHelpers.
  // Helpers are NOT roster agents — never filtered through VALID_HOOK_ROLES.
  let outHelpers
  try {
    if (helperAction && helperAction.op === 'add') {
      outHelpers = helperAdd(existingHelpers, helperAction.role, helperAction.agentId, helperAction.agentType)
    } else if (helperAction && helperAction.op === 'remove') {
      outHelpers = helperRemove(existingHelpers, helperAction.role, helperAction.agentId)
    } else {
      outHelpers = existingHelpers
    }
  } catch { outHelpers = existingHelpers }

  const output = {
    _seq: nextSeq(),
    _cwd: process.cwd(),
    type: 'office-status',
    agents: newAgents,
    activeCount,
    workflow: outWorkflow,
    _workflowAgentId: outWorkflowAgentId,
    _workflowPromptId: outWorkflowPromptId,
    source: 'claude-cli',
    helpers: outHelpers,
    // AVO-108: session token usage (context size + last output). Omitted when null so the
    // store keeps its last value (presence semantics) — Stop and failed reads don't blank it.
    ...(tokens ? { tokens } : {}),
    // AVO-102: effort level for the thinking aura. Presence semantics like tokens.
    ...(effort ? { effort } : {}),
    // Carry _stopped/_stoppedAt forward when they are set: a non-UPS event has no
    // authority to clear Stop's idle signal. Without this, a PostToolUse that wins a
    // last-writer-wins race with Stop erases _stopped=true, re-opening the straggler
    // window for subsequent events. UserPromptSubmit is the only event that legitimately
    // clears _stopped — it does so by omitting these keys from its own output.
    // Use recheckStopped (from the re-check guard's fresh read) not existingStopped (stale
    // merge read) so a UPS that fires between the two reads is reflected here. Fall back to
    // Date.now() when _stoppedAt is absent: a missing timestamp causes _seq to be used as a
    // proxy, and a newly-written _seq ≈ now restarts the 30s window on every write.
    ...(shouldCarryStoppedSignal(recheckStopped, hookEvent, activeCount)
      ? { _stopped: true, _stoppedAt: recheckStoppedAt ?? Date.now() }
      : {}),
    // Turn-boundary fields for straggler detection:
    // _promptId advances on each UserPromptSubmit; _preToolPromptId is set by PreToolUse
    // to the _promptId at entry so PostToolUse can detect if a new turn started.
    // On fresh install (both existingPromptId and newPromptId are null), seed _promptId with
    // capturedPromptId so _promptId and _preToolPromptId form a matched pair. Without this,
    // _preToolPromptId = "__t:..." while _promptId = null — the PostToolUse gate requires
    // BOTH non-null, so with only _preToolPromptId set the gate is still structurally dead.
    _promptId: newPromptId || existingPromptId || (hookEvent === 'PreToolUse' ? capturedPromptId : null),
    _preToolPromptId: hookEvent === 'PreToolUse'
      ? (capturedPromptId !== null ? capturedPromptId : existingPromptId)
      : existingPreToolPromptId,
  }

  // Write with retry (Windows file locking can cause EBUSY on rename).
  // UserPromptSubmit AND PreToolUse retry harder (3 attempts): both write turn-boundary
  // tokens (_promptId / _preToolPromptId) that the PostToolUse straggler gate depends on.
  // A dropped PreToolUse write leaves _preToolPromptId stale, causing the next PostToolUse
  // to see a false mismatch and abort as a straggler even though it belongs to this turn.
  const dir = path.dirname(STATUS_FILE)
  const json = JSON.stringify(output, null, 2)
  const tmp = STATUS_FILE + '.tmp.' + process.pid + '.' + (Math.random().toString(36).slice(2) + '000000').slice(0, 6)
  const writeAttempts = (hookEvent === 'UserPromptSubmit' || hookEvent === 'PreToolUse') ? 3 : 1
  let writeOk = false
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    for (let i = 0; i < writeAttempts && !writeOk; i++) {
      // Re-check _stopped before each retry (not the first attempt — that's already covered
      // by the re-check guard above). If Stop fired during the first attempt's contention,
      // a successful second write would clobber Stop's idle state with stale working data.
      if (i > 0 && hookEvent !== 'UserPromptSubmit') {
        try {
          const latest = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'))
          const sAt = typeof latest._stoppedAt === 'number' ? latest._stoppedAt : parseInt(latest._seq, 10)
          if (latest._stopped && Number.isFinite(sAt) && Date.now() - sAt < 30_000) {
            try { fs.unlinkSync(tmp) } catch {}
            return
          }
          // New turn started between our first write attempt and this retry — abort so we
          // don't overwrite UPS's fresh PM-planning state with old-turn working data.
          if (hookEvent === 'PreToolUse' && capturedPromptId && latest._promptId
              && latest._promptId !== capturedPromptId) {
            try { fs.unlinkSync(tmp) } catch {}
            return
          }
        } catch (err) {
          if (err.code === 'EBUSY' || err.code === 'EPERM') { try { fs.unlinkSync(tmp) } catch {}; return }
        }
      }
      try { fs.writeFileSync(tmp, json); fs.renameSync(tmp, STATUS_FILE); writeOk = true } catch {}
      if (!writeOk) { try { fs.writeFileSync(STATUS_FILE, json); writeOk = true } catch {} }
    }
    try { fs.unlinkSync(tmp) } catch {}  // clean up tmp; ENOENT (already renamed) is swallowed
  } catch {}
}

// Export helpers for testing (CommonJS — this file runs as a Node.js hook)
if (typeof module !== 'undefined') {
  module.exports = { HOOK_VERSION, VALID_HOOK_ROLES, toolToRole, fileToRole, skillToRole,
    shortFile, shortCommand, bashVibeLabel, deriveBlockedReason, pickReason, extractContext, sanitizeId,
    skillContextPath, saveSkillContext, readSkillContext, clearSkillContext,
    shouldClearWorkflowOnSubagentStop, shouldCarryStoppedSignal, statusForPreToolUse,
    readLatestTokenUsage, effortLevel,
    helperHash, helperAdd, helperRemove }
}
