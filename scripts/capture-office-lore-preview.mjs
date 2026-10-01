#!/usr/bin/env node
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 5233
const BASE_URL = `http://127.0.0.1:${PORT}`
const OUT_DIR = path.join(ROOT, 'docs', 'assets')
const OUT_PATH = path.join(OUT_DIR, 'office-lore-preview.png')

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

const serverProc = spawn(
  process.execPath,
  ['server.mjs', `--port=${PORT}`, '--no-open'],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
)

let cleanedUp = false
async function cleanup(browser) {
  if (cleanedUp) return
  cleanedUp = true
  try { await browser?.close() } catch {}
  if (serverProc.exitCode === null && serverProc.signalCode === null) {
    if (process.platform === 'win32') {
      try { execSync(`taskkill /pid ${serverProc.pid} /T /F`, { stdio: 'ignore' }) } catch {}
    } else {
      try { serverProc.kill('SIGKILL') } catch {}
    }
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) return true
    } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}

async function run() {
  let browser = null
  try {
    const ready = await waitForServer(BASE_URL)
    if (!ready) {
      throw new Error(`Server failed to start on ${BASE_URL}`)
    }

    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

    // Suppress onboarding popup so the whole office is visible
    await page.addInitScript(() => {
      localStorage.setItem('office-onboarded', '1')
    })

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('svg', { timeout: 10000 })

    // Allow office characters, furniture and layout to render
    await page.waitForTimeout(1500)

    // Trigger rich, lively character behaviors and dialogue bubbles
    await page.evaluate(() => {
      try {
        const store = window.__office_store || window.useOfficeStore
        if (store && typeof store.getState === 'function') {
          const s = store.getState()
          if (s.setAgentBehavior) {
            s.setAgentBehavior('pm', 'working', 'focused', '這批耶加雪菲的烘焙度抓得剛剛好，香氣都出來了。')
            s.setAgentBehavior('dev', 'working', 'happy', '橡皮鴨點了點頭，這邏輯肯定沒毛病。')
            s.setAgentBehavior('gate', 'idle', 'calm', '修剪雜枝不是為了處罰，是為了讓主幹長得更挺拔。')
          }
        }
      } catch (e) {
        console.warn('Store bubble trigger skipped:', e)
      }
    })

    await page.waitForTimeout(1000)

    await page.screenshot({ path: OUT_PATH, fullPage: false })
    console.log(`Saved screenshot to ${OUT_PATH}`)
  } catch (err) {
    console.error('Error capturing screenshot:', err)
    process.exitCode = 1
  } finally {
    await cleanup(browser)
  }
}

run()
