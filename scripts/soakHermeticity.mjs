/**
 * soakHermeticity.mjs — is this soak run actually measuring the OFFICE, or the operator?
 *
 * The dev server reads agent status from OFFICE_STATUS_DIR (default `~/.claude`), which on a
 * developer machine is where their own live Claude Code hook traffic lands every few seconds.
 * A soak run against that directory is not measuring ambient office behaviour: real agents get
 * driven into working/blocked mid-run, events are suppressed, agents are relocated — and any
 * invariant violation it reports may have been fabricated by an unrelated editing session.
 * `staged-capture.mjs` already isolates itself this way; the soak did not.
 *
 * Pure + dependency-injected so the GATE LOGIC is unit-testable, same doctrine as
 * soakInvariants / soakCoverage / soakTarget.
 */

const STATUS_PATH = '/api/status'

/** Pure verdict from an already-fetched status body. */
export function assessHermeticity({ mode, statusBody, probeError = null }) {
  if (mode === 'spawned') {
    // Both isolations, not one. OFFICE_STATUS_DIR alone is NOT hermetic: vite.config.js registers
    // a file-watcher fallback that manufactures agent status from edits to the PROJECT ITSELF and
    // writes it into whatever status dir it was handed, isolated or not. Measured, not theorised —
    // a run isolated by OFFICE_STATUS_DIR alone still had `dev` and `res` status arrive mid-sample
    // because tests and docs were being edited beside it.
    return {
      mode,
      isolated: true,
      reason: 'spawned with an empty OFFICE_STATUS_DIR and the file-watcher fallback disabled',
    }
  }
  if (probeError) {
    // Unknown is NOT isolated: an unverifiable claim must not read as a clean one.
    return { mode, isolated: false, reason: `could not verify the reused server's status source: ${probeError}` }
  }
  const body = typeof statusBody === 'string' ? statusBody.trim() : ''
  if (body === '' || body === 'null') {
    return { mode, isolated: true, reason: 'reused server reports no agent status' }
  }
  let roles = null
  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed?.agents)) roles = parsed.agents.map((a) => a?.role).filter(Boolean)
  } catch { /* fall through — a non-JSON body still means SOMETHING is being served */ }
  const who = roles?.length ? ` (${roles.join(', ')})` : ''
  return { mode, isolated: false, reason: `reused server is serving live agent status${who}` }
}

/** Fetch the reused server's status, then hand the body to the pure verdict above. */
export async function probeHermeticity(baseUrl, { fetchImpl = globalThis.fetch, timeoutMs = 1000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(new URL(STATUS_PATH, baseUrl).href, { signal: controller.signal })
    if (!res.ok) return assessHermeticity({ mode: 'reused', statusBody: '', probeError: `HTTP ${res.status}` })
    return assessHermeticity({ mode: 'reused', statusBody: await res.text() })
  } catch (err) {
    const reason = controller.signal.aborted ? 'status probe timed out' : (err?.message || 'request failed')
    return assessHermeticity({ mode: 'reused', statusBody: '', probeError: reason })
  } finally {
    clearTimeout(timer)
  }
}

/** One line for the soak's own output. */
export function formatHermeticity(h) {
  return `sim-soak hermeticity: ${h.isolated ? 'ISOLATED' : 'NOT ISOLATED'} — ${h.reason}`
}
