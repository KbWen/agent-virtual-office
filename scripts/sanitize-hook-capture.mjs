#!/usr/bin/env node
/**
 * sanitize-hook-capture.mjs  (AVO-153 / AC-2)
 *
 * Converts ~/.claude/office-hook-capture.jsonl into shape-preserving fixture
 * files at tests/fixtures/hook-events/<event>-<tool|generic>.json.
 *
 * Sanitization rules:
 *   - Keeps structure, key names, and types EXACTLY.
 *   - Keeps enum-ish short identifiers verbatim:
 *       hook_event_name, tool_name, permission_mode, source, booleans,
 *       role-ish values that appear in VALID_HOOK_ROLES.
 *   - Numbers → representative literal (42 for positive integers, 0 for zero).
 *   - Free-text strings (commands, prompts, file paths, session IDs, CWDs,
 *     transcript paths, agent IDs, tool_use IDs) → typed placeholder:
 *       path-like  → "/redacted/path.js"
 *       non-empty  → "redacted-text"
 *       empty ""   → ""   (preserve empty vs non-empty distinction)
 *   - null / booleans preserved verbatim.
 *   - Arrays: each element sanitized recursively.
 *   - Objects: each value sanitized recursively.
 *
 * Deduplication: one file per (hook_event_name, tool_name|generic) shape.
 * The first occurrence wins.
 *
 * Usage:
 *   node scripts/sanitize-hook-capture.mjs
 *   node scripts/sanitize-hook-capture.mjs --input ~/.claude/office-hook-capture.jsonl
 *
 * Output:
 *   tests/fixtures/hook-events/<event>-<tool|generic>.json  (one per shape)
 *   tests/fixtures/hook-events/README.md
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const inputFlag = args.indexOf('--input')
const RAW_PATH = inputFlag !== -1
  ? args[inputFlag + 1]
  : path.join(os.homedir(), '.claude', 'office-hook-capture.jsonl')

const OUT_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'hook-events')

// ── Enum-ish allow-list (preserved verbatim) ─────────────────────────────────
const HOOK_EVENT_NAMES = new Set([
  'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop', 'StopFailure',
  'SubagentStart', 'SubagentStop', 'PermissionDenied',
])
const TOOL_NAMES = new Set([
  'Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'Agent', 'TodoWrite',
  'WebFetch', 'WebSearch', 'NotebookEdit', 'EnterPlanMode', 'ExitPlanMode',
  'AskUserQuestion', 'Task',
  // AVO-154: newly observed tool_names from extended capture
  'PowerShell', 'Skill', 'ToolSearch',
])
const PERMISSION_MODES = new Set(['bypassPermissions', 'plan', 'default', 'auto'])
const SOURCE_VALUES = new Set(['claude-cli', 'office-hook', 'idle-gap-infer'])
const VALID_HOOK_ROLES = new Set(['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer'])
const EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])

// Keys whose values are always enum-ish (never free-text)
const ENUM_KEYS = new Set([
  'hook_event_name', 'tool_name', 'permission_mode', 'source',
  'role', 'parentRole', 'status', 'hint',
])

// Keys whose values are always free-text paths or IDs (always redacted)
const ALWAYS_REDACT_PATH_KEYS = new Set([
  'cwd', 'transcript_path', 'session_id', 'agent_id', 'tool_use_id',
  'file_path', 'path', 'command', 'cmd', 'prompt', 'description',
  'url', 'query', 'pattern',
])

// ── Sanitize a single value ──────────────────────────────────────────────────
function isPathLike(s) {
  if (typeof s !== 'string') return false
  // Windows drive path, POSIX absolute, or contains separators suggesting a path
  return /^[A-Za-z]:[\\\/]/.test(s) || s.startsWith('/') || s.startsWith('~') ||
         /[\\\/][a-zA-Z0-9_.-]+\.[a-zA-Z]{2,5}$/.test(s)
}

function sanitizeValue(val, key, depth) {
  if (val === null) return null
  if (val === undefined) return null
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val === 0 ? 0 : 42

  if (typeof val === 'string') {
    // Enum-ish key → preserve if it matches known enum value
    if (ENUM_KEYS.has(key)) {
      if (HOOK_EVENT_NAMES.has(val)) return val
      if (TOOL_NAMES.has(val)) return val
      if (PERMISSION_MODES.has(val)) return val
      if (SOURCE_VALUES.has(val)) return val
      if (VALID_HOOK_ROLES.has(val)) return val
      if (EFFORT_LEVELS.has(val)) return val
      // MCP tool names: keep canonical "mcp-tool" placeholder (preserves that it IS an MCP tool)
      if (key === 'tool_name' && val.startsWith('mcp__')) return 'mcp-tool'
    }
    // Effort level value (nested under effort.level)
    if (key === 'level' && EFFORT_LEVELS.has(val)) return val
    // Always-redact keys
    if (ALWAYS_REDACT_PATH_KEYS.has(key)) {
      if (val === '') return ''
      return isPathLike(val) ? '/redacted/path.js' : 'redacted-text'
    }
    // Heuristic: path-like strings → path placeholder
    if (isPathLike(val)) return '/redacted/path.js'
    // Short identifier-looking strings (no spaces, ≤32 chars) → check if enum-ish
    if (/^[a-zA-Z0-9_-]{1,32}$/.test(val)) {
      if (HOOK_EVENT_NAMES.has(val)) return val
      if (TOOL_NAMES.has(val)) return val
      if (PERMISSION_MODES.has(val)) return val
      if (SOURCE_VALUES.has(val)) return val
      if (VALID_HOOK_ROLES.has(val)) return val
      if (EFFORT_LEVELS.has(val)) return val
    }
    // Everything else: free-text → redact
    if (val === '') return ''
    return 'redacted-text'
  }

  if (Array.isArray(val)) {
    return val.map((item, idx) => sanitizeValue(item, String(idx), (depth || 0) + 1))
  }

  if (typeof val === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(val)) {
      out[k] = sanitizeValue(v, k, (depth || 0) + 1)
    }
    return out
  }

  return val
}

function sanitizeEvent(raw) {
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    out[k] = sanitizeValue(v, k, 0)
  }
  return out
}

// ── Shape signature for dedup ─────────────────────────────────────────────────
function shapeKey(event) {
  const name = event.hook_event_name || 'unknown'
  let tool = event.tool_name || 'generic'
  // Normalize MCP tool names to a single canonical key (all MCP tools share the same shape)
  if (typeof tool === 'string' && tool.startsWith('mcp__')) tool = 'mcp-tool'
  return `${name}-${tool}`
}

function filenameFor(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '-') + '.json'
}

// ── Main ─────────────────────────────────────────────────────────────────────
function run() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error(`[sanitize] Input not found: ${RAW_PATH}`)
    console.error('Create the marker and use Claude Code for a session, then run this script.')
    process.exit(1)
  }

  const raw = fs.readFileSync(RAW_PATH, 'utf-8')
  const lines = raw.trim().split('\n').filter(Boolean)

  if (lines.length === 0) {
    console.error('[sanitize] Capture file is empty.')
    process.exit(1)
  }

  // Collect unique shapes (first occurrence wins)
  const shapes = new Map() // key → sanitized event
  for (const line of lines) {
    try {
      const event = JSON.parse(line)
      const key = shapeKey(event)
      if (!shapes.has(key)) {
        shapes.set(key, sanitizeEvent(event))
      }
    } catch (err) {
      console.warn(`[sanitize] Skipping malformed line: ${err.message}`)
    }
  }

  // Write fixture files
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const ALL_EVENT_TYPES = [
    'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop',
    'SubagentStart', 'SubagentStop', 'PermissionDenied', 'StopFailure',
  ]
  const captured = [...shapes.keys()]

  let written = 0
  for (const [key, sanitized] of shapes.entries()) {
    const outFile = path.join(OUT_DIR, filenameFor(key))
    fs.writeFileSync(outFile, JSON.stringify(sanitized, null, 2) + '\n')
    console.log(`[sanitize] Wrote: ${filenameFor(key)}`)
    written++
  }

  // Build "not yet captured" list
  const capturedEventNames = new Set(captured.map(k => k.split('-')[0]))
  const notCaptured = ALL_EVENT_TYPES.filter(t => !capturedEventNames.has(t))

  // Write README
  const today = new Date().toISOString().slice(0, 10)
  const readmeLines = [
    '# tests/fixtures/hook-events',
    '',
    `Captured: ${today}  |  Source: Claude Code hook (real session, this repo)`,
    '',
    '## Provenance',
    '',
    'Fixtures captured from a live Claude Code session using the opt-in capture mode',
    '(AVO-153 AC-1). The hook runs from the working tree, so every tool call during',
    'the implementing session generates real events.',
    '',
    '## Re-capture procedure',
    '',
    '1. Enable marker: `touch ~/.claude/office-hook-capture`  (or PowerShell: `New-Item ~/.claude/office-hook-capture`)',
    '2. Use Claude Code normally in this repo for a session.',
    '3. Run: `node scripts/sanitize-hook-capture.mjs`',
    '4. Review generated fixtures for residual sensitive strings (PRIVACY gate).',
    '5. If clean, commit `tests/fixtures/hook-events/*.json` and `README.md`.',
    '6. Remove marker: `rm ~/.claude/office-hook-capture`',
    '7. Raw capture (`~/.claude/office-hook-capture.jsonl`) stays in `~/.claude` — NEVER commit it.',
    '',
    '## Shapes captured',
    '',
    ...captured.map(k => `- \`${filenameFor(k)}\``),
    '',
    '## Not yet captured (event types absent from corpus)',
    '',
    ...(notCaptured.length > 0
      ? notCaptured.map(t => `- \`${t}\``)
      : ['- (all known event types captured)']),
    '',
  ]
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readmeLines.join('\n'))
  console.log(`[sanitize] Wrote README.md`)
  console.log(`[sanitize] Done: ${written} fixture(s), ${notCaptured.length} event type(s) not captured.`)
}

run()
