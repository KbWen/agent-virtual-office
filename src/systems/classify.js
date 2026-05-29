/**
 * #A1 — Pure classifier for AI agent signals (task / status / mood).
 *
 * Layered waterfall (panel-discussion consensus):
 *   Tier 0: Built-in registry — Claude Code canonical tools + all known status/mood values
 *   Tier 3: Verb heuristic   — W3C Activity Streams 2.0 vocabulary (Read/Create/Update/Delete/Search/...)
 *   Tier 4: MCP namespace     — `mcp__<server>__<tool>` → family=external, subFamily=<server>
 *   Tier 5: Unknown           — preserves the raw string under family='unknown' (curiosity tier)
 *
 * Output shape (every classify* function returns this; no nulls, no exceptions):
 *   {
 *     tier:        0 | 3 | 4 | 5,
 *     family:      string,      // semantic family (see FAMILIES below)
 *     subFamily?:  string,      // refinement (e.g., MCP server name)
 *     severity:    'low' | 'medium' | 'high',
 *     visualLabel: string,      // short label for UI chip (≤ 16 chars typical)
 *     a11yLabel:   string,      // sr-only friendly natural language
 *     raw:         string,      // original input as received (preserves casing)
 *   }
 *
 * Why pure + side-effect-free:
 *   - Trivially testable without store / DOM / network.
 *   - Future #A2 wires this into store.STATUS_BEHAVIOR_MAP etc. as a pure consumer.
 *   - #A3 layers an `unknownLog` *outside* this module (this stays pure).
 *
 * Standards alignment (panel decision):
 *   - Verb taxonomy borrows from W3C Activity Streams 2.0 Activity Vocabulary
 *     (Create/Read/Update/Delete/View/Listen/Move/Search/Authenticate/...).
 *   - MCP namespace recognition follows the MCP spec format `mcp__<server>__<tool>`.
 *   - Attribute names track toward OpenTelemetry GenAI semantic conventions
 *     (gen_ai.tool.name, gen_ai.operation.name) — adopted formally in #B1.
 */

// ─── Family vocabulary (used everywhere downstream) ─────────────────────────
// Drawn from W3C Activity Streams 2.0 + practical needs of AI agent observation.
// Keep this list small enough to memorize; subFamily handles refinement.
export const FAMILIES = Object.freeze({
  READ:        'read',         // Read, View, List, Get, Fetch (introspection)
  SEARCH:      'search',       // Grep, Glob, Find, Query, Search
  CREATE:      'create',       // Write, Create, Add, Insert, New
  UPDATE:      'update',       // Edit, Update, Modify, Replace, Patch
  DELETE:      'delete',       // Delete, Remove, Erase, Drop
  EXECUTE:     'execute',      // Bash, Run, Exec, Spawn (side-effecting compute)
  AUTH:        'auth',         // Authenticate, Login, Token, Sign, Authorize
  COMMUNICATE: 'communicate',  // Send, Post, Message, Notify, Announce
  NAVIGATE:    'navigate',     // Navigate, Open, Go, Fetch (URL/route)
  DISPATCH:    'dispatch',     // Task tool, Subagent dispatch, Delegate
  PLAN:        'plan',         // ExitPlanMode, /plan workflow
  MEMORY:      'memory',       // Auto-memory load/save, Compact, Persist
  EXTERNAL:    'external',     // MCP-namespaced tools (subFamily = server)
  SYSTEM:      'system',       // Internal AI plumbing (compact, reset, restore)
  COGNITION:   'cognition',    // Extended thinking, reasoning (no tool call)
  GATE:        'gate',         // Awaiting permission, blocked on user input
  // Status families
  IDLE:        'idle',
  WORK:        'work',
  BLOCKED:     'blocked',
  SUCCESS:     'success',
  // Mood families (mirror weather output for downstream)
  CLEAR:       'clear',
  CLOUDY:      'cloudy',
  RAIN:        'rain',
  THUNDERSTORM:'thunderstorm',
  // Catch-all
  UNKNOWN:     'unknown',
})

// ─── Tier 0: Built-in task registry ────────────────────────────────────────
// Claude Code's canonical tools as of 2026. These are the 80% high-frequency
// cases that deserve explicit visuals (per Game Designer's "don't over-categorize"
// rule — these are the well-known ones, everything else falls to Tier 3+).
const BUILTIN_TASKS = Object.freeze({
  Bash:         { family: FAMILIES.EXECUTE,    severity: 'medium', visualLabel: 'Bash',      a11yLabel: 'Running shell command' },
  Read:         { family: FAMILIES.READ,       severity: 'low',    visualLabel: 'Read',      a11yLabel: 'Reading file' },
  Edit:         { family: FAMILIES.UPDATE,     severity: 'medium', visualLabel: 'Edit',      a11yLabel: 'Editing file' },
  Write:        { family: FAMILIES.CREATE,     severity: 'medium', visualLabel: 'Write',     a11yLabel: 'Writing file' },
  Grep:         { family: FAMILIES.SEARCH,     severity: 'low',    visualLabel: 'Grep',      a11yLabel: 'Searching content' },
  Glob:         { family: FAMILIES.SEARCH,     severity: 'low',    visualLabel: 'Glob',      a11yLabel: 'Searching files by pattern' },
  Task:         { family: FAMILIES.DISPATCH,   severity: 'high',   visualLabel: 'Task',      a11yLabel: 'Dispatching sub-agent' },
  WebFetch:     { family: FAMILIES.NAVIGATE,   severity: 'medium', visualLabel: 'WebFetch',  a11yLabel: 'Fetching web resource' },
  WebSearch:    { family: FAMILIES.SEARCH,     severity: 'low',    visualLabel: 'WebSearch', a11yLabel: 'Searching the web' },
  NotebookEdit: { family: FAMILIES.UPDATE,     severity: 'medium', visualLabel: 'Notebook',  a11yLabel: 'Editing notebook' },
  ExitPlanMode: { family: FAMILIES.PLAN,       severity: 'low',    visualLabel: 'Plan',      a11yLabel: 'Exiting plan mode' },
  // Forward-looking (these aren't current Claude Code tools but the classifier
  // should recognize them if they appear, e.g. via MCP-style introductions):
  TodoWrite:    { family: FAMILIES.UPDATE,     severity: 'low',    visualLabel: 'Todos',     a11yLabel: 'Updating task list' },
  TodoRead:     { family: FAMILIES.READ,       severity: 'low',    visualLabel: 'Todos',     a11yLabel: 'Reading task list' },
})

// ─── Tier 3: Verb-prefix heuristic ──────────────────────────────────────────
// Word-boundary regex per verb, ordered by specificity so 'read' matches 'readFile'
// but NOT 'redo'. Each entry: [regex, family, severity, label hint].
// Casing-insensitive but anchored at start.
const VERB_HEURISTICS = [
  // Auth must come BEFORE more generic verbs (some auth verbs start with 'create'
  // e.g. createSession would otherwise misroute).
  [/^(authenticate|authorize|login|signin|sign_in|token|oauth)/i, FAMILIES.AUTH,        'medium', 'Auth'],
  // Read family — careful: anchor + boundary to avoid 'redo', 'reactor', etc.
  [/^(read|view|list|get|fetch|describe|inspect|show|find|tail|head|cat)(?:[A-Z_]|$)/i, FAMILIES.READ, 'low', 'Read'],
  // Search family
  [/^(search|query|grep|glob|scan|locate|match)(?:[A-Z_]|$)/i, FAMILIES.SEARCH,      'low',    'Search'],
  // Create family — must exclude 'cremate' / 'credential' / 'crew' false positives;
  // 'create' has clear word boundary in practice. Includes 'write' (Tier 0 Write
  // belongs to CREATE family — writeFile mirrors that).
  [/^(create|add|insert|new|make|build|generate|init|write)(?:[A-Z_]|$)/i, FAMILIES.CREATE, 'medium', 'Create'],
  // Update family — includes 'put' (HTTP PUT = idempotent update).
  [/^(update|edit|modify|patch|replace|set|change|rename|move|merge|apply|put)(?:[A-Z_]|$)/i, FAMILIES.UPDATE, 'medium', 'Update'],
  // Delete family — exclude 'delegate', 'declare'.
  [/^(delete|remove|erase|drop|destroy|purge|unlink|cancel)(?:[A-Z_]|$)/i, FAMILIES.DELETE, 'high', 'Delete'],
  // Execute family — Bash already in Tier 0; this catches Run/Exec patterns.
  [/^(exec|execute|run|spawn|invoke|start|launch)(?:[A-Z_]|$)/i, FAMILIES.EXECUTE,  'medium', 'Execute'],
  // Communicate family
  [/^(send|post|publish|broadcast|notify|message|emit|announce)(?:[A-Z_]|$)/i, FAMILIES.COMMUNICATE, 'low', 'Send'],
  // Navigate family
  [/^(navigate|open|goto|visit|browse)(?:[A-Z_]|$)/i, FAMILIES.NAVIGATE,             'medium', 'Navigate'],
  // Dispatch family (subagent / delegation patterns)
  [/^(dispatch|delegate|assign|schedule|enqueue)(?:[A-Z_]|$)/i, FAMILIES.DISPATCH,   'high',   'Dispatch'],
  // Memory family
  [/^(remember|recall|persist|save|load|snapshot|checkpoint|compact)(?:[A-Z_]|$)/i, FAMILIES.MEMORY, 'low', 'Memory'],
]

// ─── Tier 4: MCP namespace recognition ──────────────────────────────────────
// Format per MCP spec: `mcp__<server>__<tool>`. Server names can theoretically
// contain underscores in real-world implementations (e.g. `mcp__atlassian-eu__create`),
// so we split on the first two `__` only and treat everything after as the tool.
// If the format is malformed (no double-underscore separator), fall through.
const MCP_PREFIX = 'mcp__'

function parseMcp(task) {
  if (typeof task !== 'string' || !task.startsWith(MCP_PREFIX)) return null
  const rest = task.slice(MCP_PREFIX.length)
  const sepIdx = rest.indexOf('__')
  if (sepIdx <= 0) return null // malformed: 'mcp__' or 'mcp__notool'
  const server = rest.slice(0, sepIdx)
  const tool = rest.slice(sepIdx + 2)
  if (!server || !tool) return null
  return { server, tool }
}

// ─── classifyTask — the main classifier ─────────────────────────────────────
export function classifyTask(task) {
  // Defensive: never throw, always return a stable shape.
  if (typeof task !== 'string' || task.length === 0) {
    return {
      tier: 5,
      family: FAMILIES.UNKNOWN,
      severity: 'low',
      visualLabel: '?',
      a11yLabel: 'Unrecognized tool',
      raw: typeof task === 'string' ? task : String(task),
    }
  }

  // Tier 0: Built-in registry hit
  if (BUILTIN_TASKS[task]) {
    const def = BUILTIN_TASKS[task]
    return { tier: 0, ...def, raw: task }
  }

  // Tier 4: MCP namespace (checked BEFORE verb heuristics because verb
  // heuristics would otherwise match the server name).
  const mcp = parseMcp(task)
  if (mcp) {
    // Sub-classify the tool name within the MCP namespace using the same verb
    // heuristics. This gives MCP tools meaningful severity / labels rather than
    // a flat 'external'.
    const inner = classifyVerb(mcp.tool)
    return {
      tier: 4,
      family: FAMILIES.EXTERNAL,
      subFamily: mcp.server,
      severity: inner?.severity ?? 'medium',
      visualLabel: `${mcp.server}::${inner?.visualLabel?.toLowerCase() ?? mcp.tool}`,
      a11yLabel: `External ${mcp.server} tool: ${mcp.tool}`,
      raw: task,
    }
  }

  // Tier 3: Verb-prefix heuristic
  const verbHit = classifyVerb(task)
  if (verbHit) {
    return {
      tier: 3,
      family: verbHit.family,
      severity: verbHit.severity,
      visualLabel: verbHit.visualLabel,
      a11yLabel: `${verbHit.visualLabel} operation: ${task}`,
      raw: task,
    }
  }

  // Tier 5: Unknown — preserve raw, mark family=unknown
  return {
    tier: 5,
    family: FAMILIES.UNKNOWN,
    severity: 'low',
    visualLabel: task.length > 16 ? task.slice(0, 14) + '…' : task,
    a11yLabel: `Unrecognized tool: ${task}`,
    raw: task,
  }
}

// Internal helper: runs verb heuristics and returns matching family/severity/label.
function classifyVerb(name) {
  if (typeof name !== 'string') return null
  for (const [regex, family, severity, visualLabel] of VERB_HEURISTICS) {
    if (regex.test(name)) return { family, severity, visualLabel }
  }
  return null
}

// ─── classifyStatus ─────────────────────────────────────────────────────────
// Statuses are a small enum so Tier 0 covers everything. The 'thinking' /
// 'compacting' / 'awaiting-approval' values are forward-looking (not currently
// emitted by Claude Code hooks but anticipated per panel discussion).
const STATUS_TABLE = Object.freeze({
  idle:                { family: FAMILIES.IDLE,      severity: 'low',    visualLabel: 'Idle',     a11yLabel: 'Idle' },
  working:             { family: FAMILIES.WORK,      severity: 'medium', visualLabel: 'Working',  a11yLabel: 'Working' },
  blocked:             { family: FAMILIES.BLOCKED,   severity: 'high',   visualLabel: 'Blocked',  a11yLabel: 'Blocked' },
  done:                { family: FAMILIES.SUCCESS,   severity: 'low',    visualLabel: 'Done',     a11yLabel: 'Completed' },
  // Forward-looking (Pixel Agents' admitted gap — we anticipate these)
  thinking:            { family: FAMILIES.COGNITION, severity: 'low',    visualLabel: 'Thinking', a11yLabel: 'Extended thinking' },
  compacting:          { family: FAMILIES.MEMORY,    severity: 'low',    visualLabel: 'Compact',  a11yLabel: 'Compacting context' },
  'awaiting-approval': { family: FAMILIES.GATE,      severity: 'high',   visualLabel: 'Approval', a11yLabel: 'Awaiting user approval' },
})

export function classifyStatus(status) {
  if (typeof status !== 'string' || status.length === 0) {
    return {
      tier: 5,
      family: FAMILIES.UNKNOWN,
      severity: 'low',
      visualLabel: '?',
      a11yLabel: 'Unrecognized status',
      raw: typeof status === 'string' ? status : String(status),
    }
  }
  if (STATUS_TABLE[status]) {
    return { tier: 0, ...STATUS_TABLE[status], raw: status }
  }
  return {
    tier: 5,
    family: FAMILIES.UNKNOWN,
    severity: 'low',
    visualLabel: status.length > 16 ? status.slice(0, 14) + '…' : status,
    a11yLabel: `Unrecognized status: ${status}`,
    raw: status,
  }
}

// ─── classifyMood ───────────────────────────────────────────────────────────
// Mirrors moodToWeather (kept in TopDownFurniture.jsx for #14), wrapped in the
// classifier shape. Downstream #A2 will replace direct moodToWeather imports
// with `classifyMood(mood).family` reads.
const MOOD_TABLE = Object.freeze({
  // ↓ mirror of moodToWeather (#14)
  normal:     { family: FAMILIES.CLEAR,        severity: 'low',    visualLabel: 'Clear',        a11yLabel: 'Normal atmosphere' },
  smooth:     { family: FAMILIES.CLEAR,        severity: 'low',    visualLabel: 'Clear',        a11yLabel: 'Smooth flow' },
  intense:    { family: FAMILIES.CLEAR,        severity: 'low',    visualLabel: 'Clear',        a11yLabel: 'Intense collaboration' },
  idle:       { family: FAMILIES.CLEAR,        severity: 'low',    visualLabel: 'Clear',        a11yLabel: 'Idle atmosphere' },
  rushing:    { family: FAMILIES.CLOUDY,       severity: 'medium', visualLabel: 'Cloudy',       a11yLabel: 'Rushing pace' },
  frustrated: { family: FAMILIES.RAIN,         severity: 'medium', visualLabel: 'Rain',         a11yLabel: 'Frustrated mood — raining' },
  stuck:      { family: FAMILIES.THUNDERSTORM, severity: 'high',   visualLabel: 'Thunderstorm', a11yLabel: 'Stuck on loop — thunderstorm' },
})

// ─── familyToBehavior — #A2 wiring helper ──────────────────────────────────
// Maps the abstract `family` field to a concrete animation name that
// `AgentCharacter.jsx` already implements. This is the bridge between the
// standards-aligned classifier (W3C/MCP-shaped) and the existing animation
// library (whose `case` statements were authored for specific Claude Code
// tools, not abstract families). The returned strings MUST match an existing
// `case` in AgentCharacter.jsx — adding a new family here without adding the
// matching animation would silently render nothing.
//
// Backward-compat by construction: for every Tier 0 built-in task the result
// matches the legacy STATUS_BEHAVIOR_MAP entry exactly:
//   Bash  (execute) → 'typing'         ✓ matches store.js:239
//   Read  (read)    → 'reading-screen' ✓ matches store.js:239
//   Grep  (search)  → 'research'       ✓ matches store.js:239
//   Glob  (search)  → 'research'       ✓ matches store.js:239
// So #A2 replaces the static fallback `|| 'typing'` with a smarter fallback
// that gives MCP / verb-classified tools meaningful animations, while
// known tools keep their exact prior behavior.
export function familyToBehavior(family) {
  switch (family) {
    case FAMILIES.READ:        return 'reading-screen'
    case FAMILIES.SEARCH:      return 'research'
    case FAMILIES.CREATE:      return 'writing-notes'
    case FAMILIES.UPDATE:      return 'writing-notes'
    case FAMILIES.DELETE:      return 'typing'
    case FAMILIES.EXECUTE:     return 'typing'
    case FAMILIES.AUTH:        return 'shield-verify'
    case FAMILIES.COMMUNICATE: return 'chat'
    case FAMILIES.NAVIGATE:    return 'typing'
    case FAMILIES.DISPATCH:    return 'gantt-chart'
    case FAMILIES.PLAN:        return 'gantt-chart'
    case FAMILIES.MEMORY:      return 'writing-notes'
    case FAMILIES.SYSTEM:      return 'writing-notes'
    case FAMILIES.COGNITION:   return 'reading-screen'
    case FAMILIES.EXTERNAL:    return 'typing'
    // Status families don't map to behaviors (they map to expressions —
    // STATUS_BEHAVIOR_MAP handles those). Fall through to default.
    default:                   return 'typing'
  }
}

export function classifyMood(mood) {
  if (typeof mood !== 'string' || mood.length === 0) {
    return {
      tier: 5,
      family: FAMILIES.CLEAR, // Unknown mood defaults to clear (no scary weather)
      severity: 'low',
      visualLabel: 'Clear',
      a11yLabel: 'Unknown mood — defaulting to clear',
      raw: typeof mood === 'string' ? mood : String(mood),
    }
  }
  if (MOOD_TABLE[mood]) {
    return { tier: 0, ...MOOD_TABLE[mood], raw: mood }
  }
  return {
    tier: 5,
    family: FAMILIES.CLEAR, // Conservative default — no false-positive weather
    severity: 'low',
    visualLabel: 'Clear',
    a11yLabel: `Unrecognized mood (${mood}) — defaulting to clear`,
    raw: mood,
  }
}
