const STORE_PROBE_PATH = '/src/systems/store.js'
const AVO_STORE_MARKERS = ['useOfficeStore', 'applyExternalStatus']

export async function inspectAvoViteTarget(baseUrl, { fetchImpl = globalThis.fetch, timeoutMs = 1000 } = {}) {
  let probeUrl
  let normalizedBaseUrl
  try {
    const parsed = new URL(baseUrl)
    normalizedBaseUrl = parsed.origin
    probeUrl = new URL(STORE_PROBE_PATH, parsed).href
  } catch {
    return { status: 'invalid', reason: 'invalid URL' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(probeUrl, { signal: controller.signal })
    if (!response.ok) {
      return { status: 'mismatch', baseUrl: normalizedBaseUrl, probeUrl, reason: `${STORE_PROBE_PATH} returned HTTP ${response.status}` }
    }
    const source = await response.text()
    const missing = AVO_STORE_MARKERS.filter(marker => !source.includes(marker))
    if (missing.length) {
      return { status: 'mismatch', baseUrl: normalizedBaseUrl, probeUrl, reason: `${STORE_PROBE_PATH} is missing AVO markers: ${missing.join(', ')}` }
    }
    return { status: 'match', baseUrl: normalizedBaseUrl, probeUrl }
  } catch (err) {
    const errorCode = err?.cause?.code || err?.code
    const status = errorCode === 'ECONNREFUSED' ? 'unreachable' : 'mismatch'
    const reason = controller.signal.aborted ? `${STORE_PROBE_PATH} identity probe timed out` : (err?.message || 'request failed')
    return { status, baseUrl: normalizedBaseUrl, probeUrl, reason }
  } finally {
    clearTimeout(timer)
  }
}

export function formatTargetIdentityError(baseUrl, inspection) {
  return `target identity check failed for ${baseUrl}: ${inspection.reason}`
}
