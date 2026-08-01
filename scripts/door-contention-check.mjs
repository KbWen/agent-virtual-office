#!/usr/bin/env node
import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { formatTargetIdentityError, inspectAvoViteTarget } from './soakTarget.mjs'

const baseUrl = process.env.DOOR_CHECK_URL || 'http://127.0.0.1:5173'
const identity = await inspectAvoViteTarget(baseUrl, { timeoutMs: 3000 })
if (identity.status !== 'match') {
  console.error(`door-contention ERROR: ${formatTargetIdentityError(baseUrl, identity)}`)
  process.exit(1)
}

let browser
try {
  try {
    browser = await chromium.launch({ headless: true })
  } catch {
    const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    if (!existsSync(chrome)) throw new Error('No Chromium. Run: npx playwright install chromium')
    browser = await chromium.launch({ headless: true, executablePath: chrome })
  }
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await page.addInitScript(() => { try { localStorage.setItem('office-onboarded', '1') } catch {} })
  await page.goto(`${identity.baseUrl}/?lang=en`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('svg [data-agent-id]', { timeout: 20_000 })
  const evidenceArg = process.argv.find((arg) => arg.startsWith('--evidence-dir='))
  const evidenceDir = evidenceArg?.slice('--evidence-dir='.length) || process.env.DOOR_CHECK_EVIDENCE_DIR || null
  let evidenceIndex = 0
  if (evidenceDir) mkdirSync(evidenceDir, { recursive: true })
  await page.exposeFunction('captureDoorEvidence', async (label) => {
    if (!evidenceDir) return
    const safeLabel = String(label).replace(/[^a-z0-9_-]+/gi, '-')
    const sequence = String(++evidenceIndex).padStart(2, '0')
    await page.screenshot({ path: `${evidenceDir}/${sequence}-${safeLabel}.png`, fullPage: true })
  })

  const result = await page.evaluate(async () => {
    const { useOfficeStore } = await import('/src/systems/store.js')
    const { calculateJourney, DOOR_SIDES, isOnFloor, isOnObstacle, visuallyOverlapping } = await import('/src/systems/movementSystem.js')
    const { evaluateSoak } = await import('/scripts/soakInvariants.mjs')
    const ids = ['pm', 'arch']
    const rooms = {
      entranceToMain: [{ x: 75, y: 85 }, { x: 150, y: 85 }],
      mainToMeeting: [{ x: 660, y: 205 }, { x: 700, y: 205 }],
      mainToLounge: [{ x: 175, y: 490 }, { x: 315, y: 490 }],
      mainToResearch: [{ x: 620, y: 490 }, { x: 720, y: 490 }],
    }
    const main = [{ x: 300, y: 250 }, { x: 430, y: 250 }]
    const invalid = [...main, ...Object.values(rooms).flat()].filter((p) => !isOnFloor(p.x, p.y) || isOnObstacle(p.x, p.y))
    if (invalid.length) throw new Error(`invalid forced target(s): ${JSON.stringify(invalid)}`)

    useOfficeStore.setState({ isPaused: true })
    const parse = (id) => {
      const el = document.querySelector(`[data-agent-id="${id}"]`)
      const match = /translate\(([-\d.]+)[, ]+([-\d.]+)\)/.exec(el?.getAttribute('transform') || '')
      return match ? { x: +match[1], y: +match[2] } : null
    }
    const nearDoor = (point, doorId) => point && Object.values(DOOR_SIDES[doorId]).some(
      (side) => Math.hypot(point.x - side.x, point.y - side.y) < 36,
    )
    const summary = {}

    async function drive(doorId, label, assignments, expectQueue) {
      const store = useOfficeStore.getState()
      const assignedIds = assignments.map(([id]) => id)
      for (const [id, target] of assignments) {
        store.setAgentGroupEvent(id, { behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: target })
      }
      const effectiveTargets = Object.fromEntries(assignments.map(([id]) => [
        id,
        useOfficeStore.getState().agents[id]?.groupTarget,
      ]))
      const deadline = Date.now() + 45_000
      let started = false
      let queued = false
      let transientOverlapFrames = 0
      let sustainedOverlapMs = 0
      let maxSustainedOverlapMs = 0
      let maxConcurrentOwners = 0
      let previous = {}
      let sampledAt = Date.now()
      const batchStartedAt = sampledAt
      const startedIds = new Set()
      const grantedJourneys = new Set()
      const grantTickets = []
      const frozenMs = {}
      const samples = []
      let visualEvidenceCaptured = false
      while (Date.now() < deadline) {
        const state = useOfficeStore.getState()
        const requests = Object.values(state.doorTraffic.requests).filter((request) => request.doorIds.includes(doorId))
        const concurrentOwners = requests.filter((request) => request.state === 'granted').length
        maxConcurrentOwners = Math.max(maxConcurrentOwners, concurrentOwners)
        if (concurrentOwners > 1) throw new Error(`${doorId}/${label} observed ${concurrentOwners} concurrent owners`)
        for (const request of requests) {
          if (request.state === 'granted' && !grantedJourneys.has(request.journeyId)) {
            grantedJourneys.add(request.journeyId)
            grantTickets.push(request.ticket)
          }
        }
        if (requests.length || assignments.some(([id]) => state.agents[id]?.isMoving)) started = true
        if (requests.some((request) => request.state === 'queued')) queued = true
        if (expectQueue && !visualEvidenceCaptured
          && requests.some((request) => request.state === 'granted')
          && requests.some((request) => request.state === 'queued')) {
          await window.captureDoorEvidence(`${doorId}-${label}`)
          visualEvidenceCaptured = true
        }
        const a = parse(ids[0])
        const b = parse(ids[1])
        const now = Date.now()
        const sampleMs = now - sampledAt
        const sampleAgents = {}
        const renderedIds = Object.keys(state.agents)
        for (const sampleId of renderedIds) {
          const point = parse(sampleId)
          const agent = state.agents[sampleId]
          if (!point || !agent) throw new Error(`${doorId}/${label} lost rendered agent ${sampleId}`)
          if (assignedIds.includes(sampleId) && agent.isMoving) startedIds.add(sampleId)
          const prior = previous[sampleId]
          const step = prior ? Math.hypot(point.x - prior.x, point.y - prior.y) : 0
          if (prior && sampleMs < 600 && step > 48) throw new Error(`${doorId}/${label} teleported ${sampleId} by ${Math.round(step)}px`)
          const offFloor = !isOnFloor(point.x, point.y) || isOnObstacle(point.x, point.y)
          frozenMs[sampleId] = agent.isMoving && prior && step < 0.5 ? (frozenMs[sampleId] || 0) + sampleMs : 0
          if (frozenMs[sampleId] >= 5_000) throw new Error(`${doorId}/${label} froze moving agent ${sampleId}`)
          sampleAgents[sampleId] = { x: point.x, y: point.y, moving: !!agent.isMoving, group: !!agent.inGroupEvent, offFloor }
        }
        samples.push({ t: now - batchStartedAt, agents: sampleAgents })
        const overlapping = nearDoor(a, doorId) && nearDoor(b, doorId) && visuallyOverlapping(a, b)
        if (overlapping) transientOverlapFrames += 1
        const atRest = a && b && previous[ids[0]] && previous[ids[1]]
          && Math.hypot(a.x - previous[ids[0]].x, a.y - previous[ids[0]].y) < 0.5
          && Math.hypot(b.x - previous[ids[1]].x, b.y - previous[ids[1]].y) < 0.5
        sustainedOverlapMs = overlapping && atRest ? sustainedOverlapMs + sampleMs : 0
        maxSustainedOverlapMs = Math.max(maxSustainedOverlapMs, sustainedOverlapMs)
        if (sustainedOverlapMs >= 2_000) throw new Error(`${doorId}/${label} observed a sustained doorway stack`)
        previous = Object.fromEntries(renderedIds.map((sampleId) => [sampleId, parse(sampleId)]))
        sampledAt = now
        const activeForAssigned = Object.values(state.doorTraffic.requests).some((request) => assignedIds.includes(request.agentId))
        const settled = assignedIds.every((id) => !state.agents[id]?.isMoving && !state.agents[id]?.journeyTarget)
        if (started && settled && !activeForAssigned) break
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      const state = useOfficeStore.getState()
      const unfinished = assignedIds.filter((id) => state.agents[id]?.isMoving || state.agents[id]?.journeyTarget)
      const staleAssignedRequests = Object.values(state.doorTraffic.requests).filter(
        (request) => assignedIds.includes(request.agentId),
      )
      if (!started || unfinished.length || staleAssignedRequests.length) {
        throw new Error(`${doorId}/${label} did not settle: ${JSON.stringify({
          unfinished,
          staleRequests: staleAssignedRequests.map((request) => request.journeyId),
          neverStarted: !started,
        })}`)
      }
      if (expectQueue && !queued) throw new Error(`${doorId}/${label} never observed FIFO contention`)
      const neverStarted = assignedIds.filter((id) => !startedIds.has(id))
      if (neverStarted.length) throw new Error(`${doorId}/${label} never started: ${neverStarted.join(',')}`)
      const missedTargets = assignments.filter(([id]) => {
        const point = parse(id)
        const target = effectiveTargets[id]
        return !point || Math.hypot(point.x - target.x, point.y - target.y) > 3
      }).map(([id]) => id)
      if (missedTargets.length) throw new Error(`${doorId}/${label} did not reach target: ${missedTargets.join(',')}`)
      if (expectQueue) {
        const ordered = [...grantTickets].sort((left, right) => left - right)
        if (grantTickets.length !== assignedIds.length || grantTickets.some((ticket, index) => ticket !== ordered[index])) {
          throw new Error(`${doorId}/${label} violated FIFO grant order: ${grantTickets.join(',')}`)
        }
      }
      const invariantResult = evaluateSoak(samples)
      if (!invariantResult.pass) throw new Error(`${doorId}/${label} world invariant failure: ${JSON.stringify(invariantResult.violations)}`)
      summary[doorId] ||= { batches: 0, queuedBatches: 0, transientOverlapFrames: 0, maxSustainedOverlapMs: 0, maxConcurrentOwners: 0 }
      summary[doorId].batches += 1
      summary[doorId].queuedBatches += queued ? 1 : 0
      summary[doorId].transientOverlapFrames += transientOverlapFrames
      summary[doorId].maxSustainedOverlapMs = Math.max(summary[doorId].maxSustainedOverlapMs, maxSustainedOverlapMs)
      summary[doorId].maxConcurrentOwners = Math.max(summary[doorId].maxConcurrentOwners, maxConcurrentOwners)
    }

    for (const doorId of Object.keys(rooms)) {
      const room = rooms[doorId]
      await drive(doorId, 'same-direction-forward', [[ids[0], room[0]], [ids[1], room[1]]], true)
      await drive(doorId, 'preposition-main', [[ids[1], main[1]]], false)
      await drive(doorId, 'opposite-direction-swap', [[ids[0], main[0]], [ids[1], room[1]]], true)
      await drive(doorId, 'return-main', [[ids[1], main[1]]], false)
    }

    await drive('mainToLounge', 'two-door-preposition', [[ids[0], rooms.mainToLounge[0]], [ids[1], rooms.mainToResearch[1]]], false)
    await drive('mainToLounge', 'two-door-opposite', [[ids[0], rooms.mainToResearch[0]], [ids[1], rooms.mainToLounge[1]]], true)
    await drive('mainToLounge', 'two-door-return-main', [[ids[0], main[0]], [ids[1], main[1]]], false)

    const queueOwnerId = ids[0]
    const queuedClearId = ids[1]
    useOfficeStore.getState().setAgentGroupEvent(queueOwnerId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: rooms.mainToLounge[0],
    })
    let scenarioDeadline = Date.now() + 15_000
    while (Date.now() < scenarioDeadline) {
      const state = useOfficeStore.getState()
      const active = Object.values(state.doorTraffic.requests).find(
        (request) => request.agentId === queueOwnerId && request.state === 'granted',
      )
      if (active && state.agents[queueOwnerId]?.isMoving) break
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    useOfficeStore.getState().applyExternalStatus([{ agentId: queuedClearId, status: 'working', task: 'Queued clear' }])
    useOfficeStore.getState().setAgentGroupEvent(queuedClearId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: rooms.mainToLounge[1],
    })
    let queuedClearJourneyId = null
    while (Date.now() < scenarioDeadline) {
      const queued = Object.values(useOfficeStore.getState().doorTraffic.requests).find(
        (request) => request.agentId === queuedClearId && request.state === 'queued',
      )
      if (queued) {
        queuedClearJourneyId = queued.journeyId
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (!queuedClearJourneyId) throw new Error('static queued-clear scenario never entered the queue')
    useOfficeStore.getState().clearExternalStatus(queuedClearId)
    let sawOldQueuedResurrection = false
    const unsubscribeOldQueued = useOfficeStore.subscribe((state) => {
      if (state.doorTraffic.requests[queuedClearJourneyId]) sawOldQueuedResurrection = true
    })
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    const queuedClearedState = useOfficeStore.getState()
    const resumedQueuedRequest = Object.values(queuedClearedState.doorTraffic.requests).find(
      (request) => request.agentId === queuedClearId,
    )
    const queueOwnerStillActive = Object.values(queuedClearedState.doorTraffic.requests).some(
      (request) => request.agentId === queueOwnerId,
    )
    if (queuedClearedState.doorTraffic.requests[queuedClearJourneyId]
      || !resumedQueuedRequest
      || resumedQueuedRequest.journeyId === queuedClearJourneyId
      || (queueOwnerStillActive && (
        resumedQueuedRequest.state !== 'queued' || queuedClearedState.agents[queuedClearId]?.isMoving
      ))) {
      throw new Error(`static queued clear did not replace obsolete work safely: ${JSON.stringify({
        oldPresent: !!queuedClearedState.doorTraffic.requests[queuedClearJourneyId],
        resumed: resumedQueuedRequest || null,
        queueOwnerStillActive,
        resumedMoving: !!queuedClearedState.agents[queuedClearId]?.isMoving,
      })}`)
    }
    if (queuedClearedState.agents[queuedClearId]?.doorCancelJourneyIds?.length) {
      throw new Error('static queued clear left an unacknowledged cancellation marker')
    }
    scenarioDeadline = Date.now() + 45_000
    while (Date.now() < scenarioDeadline) {
      const state = useOfficeStore.getState()
      const activeForPair = Object.values(state.doorTraffic.requests).some(
        (request) => request.agentId === queueOwnerId || request.agentId === queuedClearId,
      )
      if (!activeForPair && !state.agents[queueOwnerId]?.isMoving && !state.agents[queuedClearId]?.isMoving) break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    const resumedQueuedTarget = useOfficeStore.getState().agents[queuedClearId]?.groupTarget
    const resumedQueuedPosition = parse(queuedClearId)
    if (useOfficeStore.getState().doorTraffic.requests[resumedQueuedRequest.journeyId]
      || !resumedQueuedTarget || !resumedQueuedPosition
      || Math.hypot(resumedQueuedPosition.x - resumedQueuedTarget.x, resumedQueuedPosition.y - resumedQueuedTarget.y) > 3) {
      throw new Error('preserved group journey did not resume after queued static clear')
    }
    unsubscribeOldQueued()
    if (sawOldQueuedResurrection) throw new Error('obsolete queued journey resurrected after its clear boundary')
    useOfficeStore.getState().clearAgentGroupEvent(queuedClearId)
    useOfficeStore.getState().clearAgentGroupEvent(queueOwnerId)
    await drive('mainToLounge', 'post-queued-clear-return-main', [[ids[0], main[0]], [ids[1], main[1]]], false)

    const clearId = ids[0]
    useOfficeStore.getState().applyExternalStatus([{ agentId: clearId, status: 'working', task: 'Read' }])
    useOfficeStore.getState().setAgentGroupEvent(clearId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: rooms.mainToLounge[0],
    })
    const clearDeadline = Date.now() + 15_000
    let clearJourneyId = null
    while (Date.now() < clearDeadline) {
      const state = useOfficeStore.getState()
      const active = Object.values(state.doorTraffic.requests).find(
        (request) => request.agentId === clearId && request.state === 'granted',
      )
      if (active && state.agents[clearId]?.isMoving) {
        clearJourneyId = active.journeyId
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (!clearJourneyId) throw new Error('static-clear scenario never entered a granted moving journey')
    let clearAbortSnapshot = null
    const unsubscribeClear = useOfficeStore.subscribe((state) => {
      if (clearAbortSnapshot || state.doorTraffic.requests[clearJourneyId] || state.agents[clearId]?.isMoving) return
      clearAbortSnapshot = { dom: parse(clearId), store: state.agents[clearId]?.position }
    })
    useOfficeStore.getState().clearExternalStatus(clearId)
    let resumedClearJourneyId = null
    while (Date.now() < clearDeadline) {
      const state = useOfficeStore.getState()
      const resumed = Object.values(state.doorTraffic.requests).find(
        (request) => request.agentId === clearId && request.journeyId !== clearJourneyId,
      )
      if (clearAbortSnapshot && resumed) {
        resumedClearJourneyId = resumed.journeyId
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    unsubscribeClear()
    const clearedState = useOfficeStore.getState()
    if (!resumedClearJourneyId
      || clearedState.doorTraffic.requests[clearJourneyId]
      || clearedState.agents[clearId]?.doorAbortJourneyId) {
      throw new Error('static clear did not fence the old journey and resume its preserved group target')
    }
    if (!clearAbortSnapshot?.dom || !clearAbortSnapshot?.store
      || Math.hypot(
        clearAbortSnapshot.dom.x - clearAbortSnapshot.store.x,
        clearAbortSnapshot.dom.y - clearAbortSnapshot.store.y,
      ) > 2) {
      throw new Error('static clear did not abort at rendered position')
    }

    scenarioDeadline = Date.now() + 45_000
    while (Date.now() < scenarioDeadline) {
      const state = useOfficeStore.getState()
      if (!state.doorTraffic.requests[resumedClearJourneyId] && !state.agents[clearId]?.isMoving) break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    const resumedClearTarget = useOfficeStore.getState().agents[clearId]?.groupTarget
    const resumedClearPosition = parse(clearId)
    if (useOfficeStore.getState().doorTraffic.requests[resumedClearJourneyId]
      || !resumedClearTarget || !resumedClearPosition
      || Math.hypot(resumedClearPosition.x - resumedClearTarget.x, resumedClearPosition.y - resumedClearTarget.y) > 3) {
      throw new Error('preserved group journey did not resume after granted static clear')
    }

    useOfficeStore.getState().clearAgentGroupEvent(clearId)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await drive('mainToLounge', 'post-granted-clear-return-main', [[clearId, main[0]]], false)
    const timeoutFollowerId = ids[1]
    useOfficeStore.getState().setAgentGroupEvent(clearId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: rooms.mainToLounge[0],
    })
    scenarioDeadline = Date.now() + 15_000
    let expiredJourneyId = null
    while (Date.now() < scenarioDeadline) {
      const state = useOfficeStore.getState()
      const active = Object.values(state.doorTraffic.requests).find(
        (request) => request.agentId === clearId && request.state === 'granted',
      )
      if (active && state.agents[clearId]?.isMoving) {
        expiredJourneyId = active.journeyId
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (!expiredJourneyId) throw new Error('timeout scenario never entered a granted moving journey')
    useOfficeStore.getState().setAgentGroupEvent(timeoutFollowerId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: rooms.mainToLounge[1],
    })
    let followerJourneyId = null
    while (Date.now() < scenarioDeadline) {
      const queued = Object.values(useOfficeStore.getState().doorTraffic.requests).find(
        (request) => request.agentId === timeoutFollowerId && request.state === 'queued',
      )
      if (queued) {
        followerJourneyId = queued.journeyId
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (!followerJourneyId) throw new Error('timeout scenario never queued a follower')
    let timeoutTransition = null
    const unsubscribeTimeout = useOfficeStore.subscribe((state) => {
      if (timeoutTransition || state.doorTraffic.requests[expiredJourneyId]) return
      timeoutTransition = {
        ownerMoving: !!state.agents[clearId]?.isMoving,
        ownerDom: parse(clearId),
        ownerStore: state.agents[clearId]?.position,
        followerMoving: !!state.agents[timeoutFollowerId]?.isMoving,
        followerState: state.doorTraffic.requests[followerJourneyId]?.state || null,
      }
    })
    const timeoutDeadline = Date.now() + 4_000
    while (Date.now() < timeoutDeadline && useOfficeStore.getState().doorTraffic.requests[expiredJourneyId]) {
      useOfficeStore.setState((state) => {
        const request = state.doorTraffic.requests[expiredJourneyId]
        if (!request) return state
        return {
          doorTraffic: {
            ...state.doorTraffic,
            requests: {
              ...state.doorTraffic.requests,
              [expiredJourneyId]: { ...request, deadlineAt: Date.now() - 1 },
            },
          },
        }
      })
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    unsubscribeTimeout()
    const expiredDom = parse(clearId)
    const expiredStore = useOfficeStore.getState().agents[clearId]?.position
    if (useOfficeStore.getState().doorTraffic.requests[expiredJourneyId] || useOfficeStore.getState().agents[clearId]?.isMoving) {
      throw new Error('expired granted journey did not abort and release')
    }
    if (!expiredDom || !expiredStore || Math.hypot(expiredDom.x - expiredStore.x, expiredDom.y - expiredStore.y) > 2) {
      throw new Error('expired granted journey did not abort at rendered position')
    }
    if (!timeoutTransition
      || timeoutTransition.ownerMoving
      || timeoutTransition.followerMoving
      || timeoutTransition.followerState !== 'queued'
      || !timeoutTransition.ownerDom
      || !timeoutTransition.ownerStore
      || Math.hypot(
        timeoutTransition.ownerDom.x - timeoutTransition.ownerStore.x,
        timeoutTransition.ownerDom.y - timeoutTransition.ownerStore.y,
      ) > 2) {
      throw new Error('timeout release occurred before owner stop or follower remained non-stationary')
    }
    scenarioDeadline = Date.now() + 45_000
    while (Date.now() < scenarioDeadline) {
      const state = useOfficeStore.getState()
      if (!state.doorTraffic.requests[followerJourneyId] && !state.agents[timeoutFollowerId]?.isMoving) break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    const followerTarget = useOfficeStore.getState().agents[timeoutFollowerId]?.groupTarget
    const followerPosition = parse(timeoutFollowerId)
    if (useOfficeStore.getState().doorTraffic.requests[followerJourneyId]
      || !followerTarget || !followerPosition
      || Math.hypot(followerPosition.x - followerTarget.x, followerPosition.y - followerTarget.y) > 3) {
      throw new Error('queued follower did not acquire the released timeout claim and reach its target')
    }

    for (const id of ids) useOfficeStore.getState().clearAgentGroupEvent(id)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await drive('mainToLounge', 'final-return-main', [[ids[0], main[0]], [ids[1], main[1]]], false)
    for (const id of ids) useOfficeStore.getState().clearAgentGroupEvent(id)
    const dynamicId = 'avo187-browser~qa'
    useOfficeStore.getState().applyExternalStatus([
      { agentId: dynamicId, status: 'working', task: 'Dynamic removal', session: 'avo187-browser' },
    ], { source: 'multi-session' })
    const dynamicSelector = `[data-agent-id="${dynamicId}"]`
    scenarioDeadline = Date.now() + 15_000
    while (Date.now() < scenarioDeadline && !document.querySelector(dynamicSelector)) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    const dynamicPosition = parse(dynamicId)
    if (!dynamicPosition) throw new Error('dynamic removal scenario did not render its agent')
    const dynamicTargets = [...Object.values(rooms).flat(), ...main]
    const dynamicTarget = dynamicTargets.find((target) => calculateJourney(dynamicPosition, target).doorIds.length > 0)
    if (!dynamicTarget) throw new Error('dynamic removal scenario found no cross-door target')
    useOfficeStore.getState().setAgentGroupEvent(dynamicId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: dynamicTarget,
    })
    let dynamicJourneyId = null
    while (Date.now() < scenarioDeadline) {
      const state = useOfficeStore.getState()
      const active = Object.values(state.doorTraffic.requests).find(
        (request) => request.agentId === dynamicId && request.state === 'granted',
      )
      if (active && state.agents[dynamicId]?.isMoving) {
        dynamicJourneyId = active.journeyId
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (!dynamicJourneyId) throw new Error('dynamic removal scenario never entered a granted moving journey')
    const originalAbortAgentMovement = useOfficeStore.getState().abortAgentMovement
    let dynamicAbortObservation = null
    let dynamicRemovalGap = false
    useOfficeStore.setState({
      abortAgentMovement: (agentId, position, journeyId) => {
        if (agentId === dynamicId && journeyId === dynamicJourneyId) {
          dynamicAbortObservation = { position: position ? { ...position } : null, dom: parse(dynamicId) }
        }
        return originalAbortAgentMovement(agentId, position, journeyId)
      },
    })
    const unsubscribeDynamic = useOfficeStore.subscribe((state) => {
      const agentPresent = !!state.agents[dynamicId]
      const claimPresent = !!state.doorTraffic.requests[dynamicJourneyId]
      if (agentPresent !== claimPresent) dynamicRemovalGap = true
    })
    useOfficeStore.getState().clearExternalStatus(dynamicId)
    const stagedDynamic = useOfficeStore.getState()
    if (!stagedDynamic.agents[dynamicId]?.removeAfterDoorAbort
      || stagedDynamic.agents[dynamicId]?.doorAbortJourneyId !== dynamicJourneyId
      || !stagedDynamic.doorTraffic.requests[dynamicJourneyId]) {
      throw new Error('dynamic removal released before rendering its abort boundary')
    }
    while (Date.now() < scenarioDeadline) {
      const state = useOfficeStore.getState()
      if (!state.agents[dynamicId] && !state.doorTraffic.requests[dynamicJourneyId] && !document.querySelector(dynamicSelector)) break
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    unsubscribeDynamic()
    useOfficeStore.setState({ abortAgentMovement: originalAbortAgentMovement })
    if (useOfficeStore.getState().agents[dynamicId]
      || useOfficeStore.getState().doorTraffic.requests[dynamicJourneyId]
      || document.querySelector(dynamicSelector)) {
      throw new Error('dynamic rendered abort did not remove the agent and release its claim together')
    }
    if (dynamicRemovalGap
      || !dynamicAbortObservation?.position
      || !dynamicAbortObservation?.dom
      || Math.hypot(
        dynamicAbortObservation.position.x - dynamicAbortObservation.dom.x,
        dynamicAbortObservation.position.y - dynamicAbortObservation.dom.y,
      ) > 2) {
      throw new Error('dynamic removal had a claim gap or skipped its rendered-position abort')
    }

    const unmountId = 'avo187-unmount~dev'
    useOfficeStore.getState().applyExternalStatus([
      { agentId: unmountId, status: 'working', task: 'True unmount', session: 'avo187-unmount' },
    ], { source: 'multi-session' })
    scenarioDeadline = Date.now() + 15_000
    while (Date.now() < scenarioDeadline && !document.querySelector(`[data-agent-id="${unmountId}"]`)) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    const unmountPosition = parse(unmountId)
    if (!unmountPosition) throw new Error('true-unmount scenario did not render its agent')
    const unmountTarget = dynamicTargets.find((target) => calculateJourney(unmountPosition, target).doorIds.length > 0)
    const unmountJourney = unmountTarget ? calculateJourney(unmountPosition, unmountTarget) : null
    if (!unmountJourney?.doorIds.length) throw new Error('true-unmount scenario found no cross-door target')
    const unmountOwnerJourneyId = 'harness:true-unmount-owner'
    const unmountOwnerStatus = useOfficeStore.getState().requestAgentDoorClaims(
      ids[0], unmountOwnerJourneyId, unmountJourney.doorIds,
    )
    if (unmountOwnerStatus !== 'granted') throw new Error('true-unmount scenario could not reserve its blocking door set')
    const [{ default: React }, { default: ReactDOMClient }, { default: AgentCharacter }] = await Promise.all([
      import('/@id/react'),
      import('/@id/react-dom/client'),
      import('/src/components/AgentCharacter.jsx'),
    ])
    const isolatedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    isolatedSvg.style.position = 'fixed'
    isolatedSvg.style.left = '-2000px'
    isolatedSvg.style.top = '0'
    document.body.appendChild(isolatedSvg)
    const isolatedRoot = ReactDOMClient.createRoot(isolatedSvg)
    isolatedRoot.render(React.createElement(AgentCharacter, { agent: useOfficeStore.getState().agents[unmountId] }))
    await new Promise((resolve) => setTimeout(resolve, 100))
    useOfficeStore.getState().setAgentGroupEvent(unmountId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: unmountTarget,
    })
    let unmountQueuedIds = []
    while (Date.now() < scenarioDeadline) {
      unmountQueuedIds = Object.values(useOfficeStore.getState().doorTraffic.requests)
        .filter((request) => request.agentId === unmountId && request.state === 'queued')
        .map((request) => request.journeyId)
      if (unmountQueuedIds.length >= 2) break
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (unmountQueuedIds.length < 2) throw new Error('true-unmount scenario did not create independent queued component journeys')
    isolatedRoot.unmount()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 100))
    isolatedSvg.remove()
    const remainingUnmountRequests = unmountQueuedIds.filter(
      (journeyId) => useOfficeStore.getState().doorTraffic.requests[journeyId],
    )
    if (remainingUnmountRequests.length !== unmountQueuedIds.length - 1) {
      throw new Error(`true unmount did not release exactly its component-local queued journey: ${remainingUnmountRequests.length}/${unmountQueuedIds.length}`)
    }
    useOfficeStore.getState().clearAgentGroupEvent(unmountId)
    useOfficeStore.getState().clearExternalStatus(unmountId)
    useOfficeStore.getState().releaseAgentDoorClaims(ids[0], unmountOwnerJourneyId)
    if (Object.values(useOfficeStore.getState().doorTraffic.requests).some(
      (request) => request.agentId === unmountId || request.journeyId === unmountOwnerJourneyId,
    )) {
      throw new Error('true-unmount scenario left a request after cleanup')
    }
    return {
      doors: summary,
      twoDoorContention: true,
      staticQueuedClear: true,
      staticClearAbort: true,
      timeoutAbortAndHandoff: true,
      dynamicRenderedAbortRemoval: true,
      trueUnmountRelease: true,
      ownerByDoor: useOfficeStore.getState().doorTraffic.ownerByDoor,
      requestIds: Object.keys(useOfficeStore.getState().doorTraffic.requests),
    }
  })

  const covered = Object.keys(result.doors)
  if (covered.length !== 4 || Object.keys(result.ownerByDoor).length !== 0 || result.requestIds.length !== 0) {
    throw new Error(`incomplete or stale result: ${JSON.stringify(result)}`)
  }
  if (evidenceDir) {
    writeFileSync(`${evidenceDir}/result.json`, `${JSON.stringify({
      ...result,
      capturedFrames: evidenceIndex,
      completedAt: new Date().toISOString(),
    }, null, 2)}\n`)
  }
  console.log(`door-contention PASS — ${covered.length}/4 doors, same+opposite+two-door contention, FIFO observed, maxConcurrentOwnerPerDoor=1, 0 sustained doorway stacks`)
  console.log(JSON.stringify(result))
} catch (error) {
  console.error(`door-contention ERROR: ${error.message}`)
  process.exitCode = 1
} finally {
  await browser?.close()
}
