export const DOOR_CLAIM_LEASE_MS = 30_000

export function createDoorClaimState() {
  return { nextTicket: 1, requests: {}, ownerByDoor: {} }
}

function normalizeDoorIds(doorIds) {
  return [...new Set((doorIds || []).filter(Boolean))]
}

function sharesDoor(a, b) {
  return a.doorIds.some((doorId) => b.doorIds.includes(doorId))
}

function canGrant(state, request) {
  const doorsFree = request.doorIds.every((doorId) => {
    const owner = state.ownerByDoor[doorId]
    return !owner || owner === request.journeyId
  })
  if (!doorsFree) return false

  return !Object.values(state.requests).some((other) => (
    other.journeyId !== request.journeyId
    && other.state === 'queued'
    && other.ticket < request.ticket
    && sharesDoor(other, request)
  ))
}

export function requestDoorClaims(state, {
  agentId,
  journeyId,
  doorIds,
  now = Date.now(),
  leaseMs = DOOR_CLAIM_LEASE_MS,
}) {
  const normalizedDoorIds = normalizeDoorIds(doorIds)
  if (normalizedDoorIds.length === 0) return { state, status: 'granted' }

  const existing = state.requests[journeyId]
  if (existing && existing.agentId !== agentId) return { state, status: 'queued' }

  const request = existing || {
    journeyId,
    agentId,
    doorIds: normalizedDoorIds,
    ticket: state.nextTicket,
    state: 'queued',
    enqueuedAt: now,
    deadlineAt: null,
    lastProgressAt: null,
  }
  const withRequest = existing ? state : {
    ...state,
    nextTicket: state.nextTicket + 1,
    requests: { ...state.requests, [journeyId]: request },
  }

  if (request.state === 'granted') return { state: withRequest, status: 'granted' }
  if (!canGrant(withRequest, request)) return { state: withRequest, status: 'queued' }

  const granted = {
    ...request,
    state: 'granted',
    lastProgressAt: now,
    deadlineAt: now + leaseMs,
  }
  const ownerByDoor = { ...withRequest.ownerByDoor }
  for (const doorId of granted.doorIds) ownerByDoor[doorId] = journeyId
  return {
    status: 'granted',
    state: {
      ...withRequest,
      requests: { ...withRequest.requests, [journeyId]: granted },
      ownerByDoor,
    },
  }
}

export function releaseDoorClaims(state, { agentId, journeyId }) {
  const request = state.requests[journeyId]
  if (!request || request.agentId !== agentId) return state

  const requests = { ...state.requests }
  delete requests[journeyId]
  const ownerByDoor = { ...state.ownerByDoor }
  for (const doorId of request.doorIds) {
    if (ownerByDoor[doorId] === journeyId) delete ownerByDoor[doorId]
  }
  return { ...state, requests, ownerByDoor }
}

export function renewDoorClaims(state, {
  agentId,
  journeyId,
  now = Date.now(),
  leaseMs = DOOR_CLAIM_LEASE_MS,
}) {
  const request = state.requests[journeyId]
  if (!request || request.agentId !== agentId || request.state !== 'granted') return state
  return {
    ...state,
    requests: {
      ...state.requests,
      [journeyId]: { ...request, lastProgressAt: now, deadlineAt: now + leaseMs },
    },
  }
}

export function releaseAgentDoorClaims(state, agentId) {
  let next = state
  for (const request of Object.values(state.requests)) {
    if (request.agentId === agentId) {
      next = releaseDoorClaims(next, { agentId, journeyId: request.journeyId })
    }
  }
  return next
}
