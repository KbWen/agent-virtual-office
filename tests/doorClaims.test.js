import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  createDoorClaimState,
  releaseAgentDoorClaims,
  releaseDoorClaims,
  renewDoorClaims,
  requestDoorClaims,
} from '../src/systems/doorClaims.js'
import { useOfficeStore } from '../src/systems/store.js'

const request = (state, agentId, journeyId, doorIds, now = 1000) =>
  requestDoorClaims(state, { agentId, journeyId, doorIds, now })

describe('doorClaims — bounded physical-door arbitration', () => {
  it('grants one physical-door owner and queues the conflicting direction', () => {
    const a = request(createDoorClaimState(), 'a', 'a:1', ['mainToLounge'])
    const b = request(a.state, 'b', 'b:1', ['mainToLounge'], 1001)

    expect(a.status).toBe('granted')
    expect(b.status).toBe('queued')
    expect(b.state.ownerByDoor.mainToLounge).toBe('a:1')
  })

  it('allows disjoint physical doors to proceed concurrently', () => {
    const a = request(createDoorClaimState(), 'a', 'a:1', ['mainToLounge'])
    const b = request(a.state, 'b', 'b:1', ['mainToMeeting'], 1001)

    expect(b.status).toBe('granted')
    expect(b.state.ownerByDoor).toEqual({ mainToLounge: 'a:1', mainToMeeting: 'b:1' })
  })

  it('acquires a two-door route all-or-none', () => {
    const holder = request(createDoorClaimState(), 'a', 'a:1', ['mainToResearch'])
    const blocked = request(holder.state, 'b', 'b:1', ['mainToLounge', 'mainToResearch'], 1001)

    expect(blocked.status).toBe('queued')
    expect(blocked.state.ownerByDoor.mainToLounge).toBeUndefined()
    expect(blocked.state.ownerByDoor.mainToResearch).toBe('a:1')
  })

  it('preserves the first FIFO ticket across retries and prevents overtaking', () => {
    const owner = request(createDoorClaimState(), 'a', 'a:1', ['mainToLounge'])
    const first = request(owner.state, 'b', 'b:1', ['mainToLounge'], 1001)
    const second = request(first.state, 'c', 'c:1', ['mainToLounge'], 1002)
    const retriedSecond = request(second.state, 'c', 'c:1', ['mainToLounge'], 9000)

    expect(retriedSecond.state.requests['c:1'].ticket).toBe(second.state.requests['c:1'].ticket)

    const released = releaseDoorClaims(retriedSecond.state, { agentId: 'a', journeyId: 'a:1' })
    const cannotOvertake = request(released, 'c', 'c:1', ['mainToLounge'], 9001)
    const grantedFirst = request(cannotOvertake.state, 'b', 'b:1', ['mainToLounge'], 9002)

    expect(cannotOvertake.status).toBe('queued')
    expect(grantedFirst.status).toBe('granted')
  })

  it('uses the journey id as a fencing token for release and renewal', () => {
    const granted = request(createDoorClaimState(), 'a', 'a:2', ['mainToLounge'])
    const staleRelease = releaseDoorClaims(granted.state, { agentId: 'a', journeyId: 'a:1' })
    const foreignRelease = releaseDoorClaims(staleRelease, { agentId: 'b', journeyId: 'a:2' })
    const staleRenew = renewDoorClaims(foreignRelease, { agentId: 'a', journeyId: 'a:1', now: 5000 })
    const renewed = renewDoorClaims(staleRenew, { agentId: 'a', journeyId: 'a:2', now: 5000 })

    expect(renewed.ownerByDoor.mainToLounge).toBe('a:2')
    expect(renewed.requests['a:2'].lastProgressAt).toBe(5000)
    expect(renewed.requests['a:2'].deadlineAt).toBeGreaterThan(5000)
  })

  it('never steals a live claim from the clock alone', () => {
    const owner = request(createDoorClaimState(), 'a', 'a:1', ['mainToLounge'], 0)
    const afterDeadline = owner.state.requests['a:1'].deadlineAt + 1
    const contender = request(owner.state, 'b', 'b:1', ['mainToLounge'], afterDeadline)

    expect(contender.status).toBe('queued')
    expect(contender.state.ownerByDoor.mainToLounge).toBe('a:1')
  })

  it('removes every queued or granted request owned by a deleted agent', () => {
    const owner = request(createDoorClaimState(), 'a', 'a:1', ['mainToLounge'])
    const queued = request(owner.state, 'a', 'a:2', ['mainToResearch'], 1001)
    const cleaned = releaseAgentDoorClaims(queued.state, 'a')

    expect(cleaned.requests).toEqual({})
    expect(cleaned.ownerByDoor).toEqual({})
  })
})

describe('store door-claim lifecycle', () => {
  it('publishes an atomic grant and releases it on fenced final arrival', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    const store = useOfficeStore.getState()
    const id = Object.keys(store.agents)[0]

    expect(store.requestAgentDoorClaims(id, `${id}:1`, ['mainToLounge'], 1000)).toBe('granted')
    expect(useOfficeStore.getState().doorTraffic.ownerByDoor.mainToLounge).toBe(`${id}:1`)

    store.setAgentArrived(id, `${id}:1`)
    expect(useOfficeStore.getState().doorTraffic.ownerByDoor).toEqual({})
  })

  it('does not let a stale arrival release a newer journey claim', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    const store = useOfficeStore.getState()
    const id = Object.keys(store.agents)[0]

    expect(store.requestAgentDoorClaims(id, `${id}:2`, ['mainToResearch'], 1000)).toBe('granted')
    useOfficeStore.setState((state) => ({
      agents: {
        ...state.agents,
        [id]: {
          ...state.agents[id],
          isMoving: true,
          position: { x: 300, y: 250 },
          targetPosition: { x: 620, y: 490 },
          journeyTarget: { x: 620, y: 490 },
        },
      },
    }))
    const before = useOfficeStore.getState().agents[id]
    store.setAgentArrived(id, `${id}:1`)
    expect(useOfficeStore.getState().doorTraffic.ownerByDoor.mainToResearch).toBe(`${id}:2`)
    expect(useOfficeStore.getState().agents[id]).toEqual(before)
  })

  it('does not let a stale abort stop a newer journey', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    const store = useOfficeStore.getState()
    const id = Object.keys(store.agents)[0]

    expect(store.requestAgentDoorClaims(id, `${id}:new`, ['mainToMeeting'], 1000)).toBe('granted')
    useOfficeStore.setState((state) => ({
      agents: {
        ...state.agents,
        [id]: {
          ...state.agents[id],
          isMoving: true,
          position: { x: 300, y: 250 },
          targetPosition: { x: 700, y: 205 },
          journeyTarget: { x: 700, y: 205 },
        },
      },
    }))
    const before = useOfficeStore.getState().agents[id]
    store.abortAgentMovement(id, { x: 333, y: 277 }, `${id}:old`)

    expect(useOfficeStore.getState().doorTraffic.ownerByDoor.mainToMeeting).toBe(`${id}:new`)
    expect(useOfficeStore.getState().agents[id]).toEqual(before)
  })

  it('releases the matching claim when a walk aborts in place', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    const store = useOfficeStore.getState()
    const id = Object.keys(store.agents)[0]

    expect(store.requestAgentDoorClaims(id, `${id}:3`, ['mainToMeeting'], 1000)).toBe('granted')
    store.abortAgentMovement(id, { x: 333, y: 277 }, `${id}:3`)
    expect(useOfficeStore.getState().doorTraffic.ownerByDoor).toEqual({})
  })

  it('defers active dynamic-agent deletion until its rendered abort releases the claim', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    const dynamicId = 'avo187-clear~dev'
    let store = useOfficeStore.getState()
    store.applyExternalStatus([
      { agentId: dynamicId, status: 'working', task: 'Read', label: null, session: 'avo187-clear' },
    ], { source: 'multi-session' })
    store = useOfficeStore.getState()
    expect(store.requestAgentDoorClaims(dynamicId, `${dynamicId}:1`, ['mainToLounge'], 1000)).toBe('granted')

    store.clearExternalStatus(dynamicId)
    let staged = useOfficeStore.getState()
    expect(staged.agents[dynamicId].doorAbortJourneyId).toBe(`${dynamicId}:1`)
    expect(staged.agents[dynamicId].removeAfterDoorAbort).toBe(true)
    expect(staged.doorTraffic.ownerByDoor.mainToLounge).toBe(`${dynamicId}:1`)

    staged.abortAgentMovement(dynamicId, { x: 333, y: 277 }, `${dynamicId}:1`)
    staged = useOfficeStore.getState()
    expect(staged.agents[dynamicId]).toBeUndefined()
    expect(staged.doorTraffic.ownerByDoor).toEqual({})
  })

  it('defers active reconciliation eviction until its rendered abort releases the claim', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    const dynamicId = 'avo187-reconcile~qa'
    let store = useOfficeStore.getState()
    store.applyExternalStatus([
      { agentId: dynamicId, status: 'working', task: 'Read', label: null, session: 'avo187-reconcile' },
    ], { source: 'multi-session' })
    store = useOfficeStore.getState()
    expect(store.requestAgentDoorClaims(dynamicId, `${dynamicId}:1`, ['mainToMeeting'], 1000)).toBe('granted')

    store.applyExternalStatus([], { source: 'multi-session', clearSourceIfEmpty: true })
    let staged = useOfficeStore.getState()
    expect(staged.agents[dynamicId].removeAfterDoorAbort).toBe(true)
    expect(staged.doorTraffic.ownerByDoor.mainToMeeting).toBe(`${dynamicId}:1`)

    staged.abortAgentMovement(dynamicId, { x: 333, y: 277 }, `${dynamicId}:1`)
    staged = useOfficeStore.getState()
    expect(staged.agents[dynamicId]).toBeUndefined()
    expect(staged.doorTraffic.ownerByDoor).toEqual({})
  })

  it('deletes a queued dynamic agent and its request immediately', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    const dynamicId = 'avo187-queued-clear~qa'
    let store = useOfficeStore.getState()
    const ownerId = Object.keys(store.agents)[0]
    store.applyExternalStatus([
      { agentId: dynamicId, status: 'working', task: 'Read', label: null, session: 'avo187-queued-clear' },
    ], { source: 'multi-session' })
    store = useOfficeStore.getState()
    expect(store.requestAgentDoorClaims(ownerId, `${ownerId}:owner`, ['mainToResearch'], 1000)).toBe('granted')
    expect(store.requestAgentDoorClaims(dynamicId, `${dynamicId}:queued`, ['mainToResearch'], 1001)).toBe('queued')

    store.clearExternalStatus(dynamicId)
    const cleared = useOfficeStore.getState()
    expect(cleared.agents[dynamicId]).toBeUndefined()
    expect(cleared.doorTraffic.requests[`${dynamicId}:queued`]).toBeUndefined()
    expect(cleared.doorTraffic.ownerByDoor.mainToResearch).toBe(`${ownerId}:owner`)
  })

  it('cancels a queued static-agent request on single-agent clear', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    let store = useOfficeStore.getState()
    const [ownerId, queuedId] = Object.keys(store.agents)
    store.applyExternalStatus([{ agentId: queuedId, status: 'working', task: 'Read' }])
    store = useOfficeStore.getState()
    store.setAgentGroupEvent(queuedId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: { x: 175, y: 490 },
    })
    const preservedGroupTarget = useOfficeStore.getState().agents[queuedId].groupTarget
    expect(store.requestAgentDoorClaims(ownerId, `${ownerId}:owner`, ['mainToLounge'], 1000)).toBe('granted')
    expect(store.requestAgentDoorClaims(queuedId, `${queuedId}:queued`, ['mainToLounge'], 1001)).toBe('queued')

    store.clearExternalStatus(queuedId)
    const cleared = useOfficeStore.getState()
    expect(cleared.doorTraffic.requests[`${queuedId}:queued`]).toBeUndefined()
    expect(cleared.agents[queuedId].doorCancelJourneyIds).toEqual([`${queuedId}:queued`])
    expect(cleared.agents[queuedId].groupTarget).toEqual(preservedGroupTarget)
    expect(cleared.agents[queuedId].groupTarget).not.toBe(preservedGroupTarget)
  })

  it('requests a rendered-position abort before a static granted claim can release', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    let store = useOfficeStore.getState()
    const id = Object.keys(store.agents)[0]
    store.applyExternalStatus([{ agentId: id, status: 'working', task: 'Read' }])
    store = useOfficeStore.getState()
    expect(store.requestAgentDoorClaims(id, `${id}:active`, ['mainToResearch'], 1000)).toBe('granted')

    store.clearExternalStatus(id)
    const cleared = useOfficeStore.getState()
    expect(cleared.agents[id].doorAbortJourneyId).toBe(`${id}:active`)
    expect(cleared.doorTraffic.ownerByDoor.mainToResearch).toBe(`${id}:active`)
  })

  it('clear-all cancels queued static requests and fences the active rendered abort', () => {
    useOfficeStore.setState({ doorTraffic: createDoorClaimState() })
    let store = useOfficeStore.getState()
    const [ownerId, queuedId] = Object.keys(store.agents)
    store.applyExternalStatus([
      { agentId: ownerId, status: 'working', task: 'Read' },
      { agentId: queuedId, status: 'working', task: 'Read' },
    ])
    store = useOfficeStore.getState()
    store.setAgentGroupEvent(ownerId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: { x: 700, y: 205 },
    })
    store.setAgentGroupEvent(queuedId, {
      behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: { x: 710, y: 205 },
    })
    const ownerGroupTarget = useOfficeStore.getState().agents[ownerId].groupTarget
    const queuedGroupTarget = useOfficeStore.getState().agents[queuedId].groupTarget
    expect(store.requestAgentDoorClaims(ownerId, `${ownerId}:active`, ['mainToMeeting'], 1000)).toBe('granted')
    expect(store.requestAgentDoorClaims(queuedId, `${queuedId}:queued`, ['mainToMeeting'], 1001)).toBe('queued')

    store.clearExternalStatus()
    let cleared = useOfficeStore.getState()
    expect(cleared.doorTraffic.requests[`${queuedId}:queued`]).toBeUndefined()
    expect(cleared.agents[queuedId].doorCancelJourneyIds).toEqual([`${queuedId}:queued`])
    expect(cleared.agents[ownerId].doorAbortJourneyId).toBe(`${ownerId}:active`)
    expect(cleared.doorTraffic.ownerByDoor.mainToMeeting).toBe(`${ownerId}:active`)
    expect(cleared.agents[ownerId].groupTarget).toEqual(ownerGroupTarget)
    expect(cleared.agents[ownerId].groupTarget).not.toBe(ownerGroupTarget)
    expect(cleared.agents[queuedId].groupTarget).toEqual(queuedGroupTarget)
    expect(cleared.agents[queuedId].groupTarget).not.toBe(queuedGroupTarget)

    cleared.abortAgentMovement(ownerId, { x: 333, y: 277 }, `${ownerId}:active`)
    cleared = useOfficeStore.getState()
    expect(cleared.doorTraffic.ownerByDoor).toEqual({})
    expect(cleared.agents[ownerId].doorAbortJourneyId).toBeNull()
  })
})

describe('AgentCharacter door-claim integration guard', () => {
  it('routes every journey-start path through the one doorway-aware gate', () => {
    const source = readFileSync(new URL('../src/components/AgentCharacter.jsx', import.meta.url), 'utf8')
    expect(source).toContain('const beginJourney = useCallback')
    expect(source.match(/beginJourney\(\{/g)?.length).toBe(4)
    expect(source).toContain('requestAgentDoorClaims')
    expect(source).toContain('setAgentArrived(id, activeDoorJourneyRef.current)')
    expect(source).toContain('agentState?.doorAbortJourneyId')
    expect(source).toContain('abortAgentMovement(id, visualPosRef.current, requestedJourneyId)')
    expect(source).toContain('agentState?.doorCancelJourneyIds')
    expect(source).toContain('pendingDoorJourneyRef.current = null')
    expect(source).toContain('scheduleRemovedWalkAbort(isUnmountedRef, visualPosRef.current')
    expect(source).toContain('latest.releaseAgentDoorClaims(id, removalJourneyId)')
    expect(source).not.toMatch(/\bcalculatePath\(/)
  })
})
