#!/usr/bin/env node
/**
 * bundle-budget.mjs — CI bundle-size budget gate (AVO-152, stability wave W5).
 *
 * Compares the built total of dist/assets/*.js against the committed baseline in
 * scripts/bundle-budget.json. Fails (exit 1) when the total exceeds
 * baselineBytes * (1 + maxGrowthPct/100) — silent bundle creep becomes a loud,
 * intentional decision (re-base the baseline in the same PR with a justification).
 *
 * USAGE:  npm run build && node scripts/bundle-budget.mjs
 * EXIT:   0 within budget · 1 over budget or dist missing
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = path.join(ROOT, 'dist', 'assets')
const BUDGET_FILE = path.join(ROOT, 'scripts', 'bundle-budget.json')

if (!existsSync(ASSETS)) {
  console.error('bundle-budget FAIL: dist/assets not found — run `npm run build` first.')
  process.exit(1)
}

const { baselineBytes, maxGrowthPct } = JSON.parse(readFileSync(BUDGET_FILE, 'utf-8'))
const limit = Math.floor(baselineBytes * (1 + maxGrowthPct / 100))

const jsFiles = readdirSync(ASSETS).filter(f => f.endsWith('.js'))
const total = jsFiles.reduce((sum, f) => sum + statSync(path.join(ASSETS, f)).size, 0)

const pct = ((total - baselineBytes) / baselineBytes * 100).toFixed(2)
const detail = `${total} bytes across ${jsFiles.length} js file(s); baseline ${baselineBytes} (${pct >= 0 ? '+' : ''}${pct}%); limit ${limit} (+${maxGrowthPct}%)`

if (total > limit) {
  console.error(`bundle-budget FAIL: ${detail}`)
  console.error('If this growth is intentional, re-base scripts/bundle-budget.json in this PR and justify it.')
  process.exit(1)
}
console.log(`bundle-budget PASS: ${detail}`)
