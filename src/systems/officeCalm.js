/** AVO-199: observed idleness is not a claim that every task is complete. */
import { sanitizeObservedActivity } from '../utils/statusContract.mjs'

export const CALM_SETTLE_MS = 30_000
const HEALTH_FRESH_MS = 30_000
const UNKNOWN = Object.freeze({ mode: 'unknown', eligibleSince: null })
const ACTIVE = Object.freeze({ mode: 'active', eligibleSince: null })
const ACTIVE_STATUSES = new Set(['working', 'planning', 'thinking', 'blocked', 'awaiting-approval', 'done'])

function evidence(state, now) {
  if (!state.experienceFlags?.calmEnabled || state.isPaused || state.statusSource === 'fallback'
    || state.statusSource === 'demo' || state.integrationSource === 'demo') return 'unknown'
  const summary = sanitizeObservedActivity(state.observedActivity, now)
  const health = state.integrationHealth
  if (!summary || health?.state !== 'online' || !Number.isFinite(health.lastSuccessAt)
    || health.lastSuccessAt > now || now - health.lastSuccessAt > HEALTH_FRESH_MS) return 'unknown'
  const entries = Object.values(state.externalStatus || {})
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !Number.isFinite(entry.expiresAt)) return 'unknown'
    if (entry.expiresAt <= now) continue
    if (ACTIVE_STATUSES.has(entry.status)) return 'active'
    if (entry.status !== 'idle') return 'unknown'
  }
  if (!Array.isArray(state.helpers ?? [])) return 'unknown'
  for (const helper of state.helpers || []) {
    if (!helper || !Number.isFinite(helper.expiresAt)) return 'unknown'
    if (helper.expiresAt > now) return 'active'
  }
  return summary.state === 'all-idle' ? 'eligible' : summary.state === 'not-idle' ? 'active' : 'unknown'
}

/** Pure reducer; only the transient calm slice is returned. */
export function resolveOfficeCalm(state, now = Date.now()) {
  const current = evidence(state, now)
  if (current === 'unknown') return UNKNOWN
  if (current === 'active') return ACTIVE
  const previous = state.officeCalm
  const eligibleSince = ['settling', 'quiet'].includes(previous?.mode)
    && Number.isFinite(previous.eligibleSince) && previous.eligibleSince <= now
    ? previous.eligibleSince : now
  return { mode: now - eligibleSince >= CALM_SETTLE_MS ? 'quiet' : 'settling', eligibleSince }
}

function relevant(state) {
  return [state.experienceFlags?.calmEnabled, state.isPaused, state.statusSource,
    state.integrationSource, state.externalStatus, state.helpers,
    state.observedActivity?.state, state.observedActivity?.expiresAt,
    state.integrationHealth?.state, state.integrationHealth?.lastSuccessAt]
}
function sameSignature(a, b) { return a && a.length === b.length && a.every((value, i) => Object.is(value, b[i])) }

/** One deadline timer, no frame scans; caller owns this single controller's lifetime. */
export function startOfficeCalm(store, deps = {}) {
  const now = deps.now ?? Date.now
  const schedule = deps.setTimeout ?? setTimeout
  const cancel = deps.clearTimeout ?? clearTimeout
  const doc = deps.document === undefined ? globalThis.document : deps.document
  let stopped = false
  let timer = null
  let signature = null
  let source = store.getState().integrationSource

  function publish(next) {
    const prev = store.getState().officeCalm
    if (prev?.mode !== next.mode || prev?.eligibleSince !== next.eligibleSince) store.setState({ officeCalm: next })
  }
  // Never inherit a prior mount's settling/quiet interval.
  publish(UNKNOWN)

  function refresh() {
    if (stopped) return
    if (timer !== null) { cancel(timer); timer = null }
    const state = store.getState()
    const time = now()
    const changedSource = source !== state.integrationSource
    source = state.integrationSource
    signature = relevant(state)
    const next = resolveOfficeCalm(changedSource ? { ...state, officeCalm: UNKNOWN } : state, time)
    publish(next)
    if (!state.experienceFlags?.calmEnabled || state.isPaused) return
    const deadlines = []
    if (next.mode === 'settling') deadlines.push(next.eligibleSince + CALM_SETTLE_MS)
    if (Number.isFinite(state.observedActivity?.expiresAt)) deadlines.push(state.observedActivity.expiresAt)
    if (state.integrationHealth?.state === 'online' && Number.isFinite(state.integrationHealth.lastSuccessAt)) {
      deadlines.push(state.integrationHealth.lastSuccessAt + HEALTH_FRESH_MS + 1)
    }
    for (const entry of Object.values(state.externalStatus || {})) {
      if (Number.isFinite(entry?.expiresAt)) deadlines.push(entry.expiresAt)
    }
    for (const helper of state.helpers || []) {
      if (Number.isFinite(helper?.expiresAt)) deadlines.push(helper.expiresAt)
    }
    const deadline = Math.min(...deadlines.filter(value => value > time))
    if (Number.isFinite(deadline)) timer = schedule(() => { timer = null; refresh() }, deadline - time)
  }
  const unsubscribe = store.subscribe(state => {
    if (!stopped && !sameSignature(signature, relevant(state))) refresh()
  })
  const onVisible = () => {
    if (stopped || doc?.visibilityState !== 'visible') return
    store.getState().updateTime?.()
    refresh()
  }
  doc?.addEventListener('visibilitychange', onVisible)
  refresh()
  return () => {
    if (stopped) return
    stopped = true
    unsubscribe()
    doc?.removeEventListener('visibilitychange', onVisible)
    if (timer !== null) { cancel(timer); timer = null }
    publish(UNKNOWN)
  }
}
