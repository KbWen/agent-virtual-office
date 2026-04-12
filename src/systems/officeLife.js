import eventsData from '../config/officeEvents.json'
import { WAYPOINTS, MEETING_CHAIRS, HOME_POSITIONS } from './movementSystem'
import { eventBubble, eventName as getEventName } from '../i18n'
import { DAILY_EVENT_INTERVAL, RARE_EVENT_INTERVAL, TIME_CHECK_INTERVAL } from './constants'

let dailyTimer = null
let rareTimer = null

function randomInterval(range) {
  return range[0] + Math.random() * (range[1] - range[0])
}

function jitter(pos, amount = 20) {
  return {
    x: pos.x + (Math.random() - 0.5) * amount,
    y: pos.y + (Math.random() - 0.5) * amount,
  }
}

function pickParticipants(event, agents, externalStatus) {
  const ext = externalStatus || {}
  // Exclude agents that are externally busy (working/blocked)
  const isAvailable = (id) => {
    const es = ext[id]
    return !es || es.status === 'done' || es.status === 'idle'
  }
  const agentIds = Object.keys(agents)
  const available = agentIds.filter(isAvailable)

  // For 'all' events, use everyone available (skip if too few)
  if (event.participants === 'all') {
    return available.length >= 2 ? available : agentIds
  }
  if (event.participants === 'random-2-3') {
    const pool = available.length >= 2 ? available : agentIds
    const count = 2 + Math.floor(Math.random() * 2)
    return [...pool].sort(() => Math.random() - 0.5).slice(0, count)
  }
  if (event.participants === 'random-1-neighbor') {
    const pool = available.length >= 2 ? available : agentIds
    const idx = Math.floor(Math.random() * pool.length)
    const result = [pool[idx]]
    if (idx + 1 < pool.length) result.push(pool[idx + 1])
    return result
  }
  if (Array.isArray(event.participants)) {
    return event.participants.filter((p) => agents[p] && isAvailable(p))
  }
  const pool = available.length >= 2 ? available : agentIds
  return pool.slice(0, 3)
}

// ─── Event handlers: each sets visual states for participants ────────

const EVENT_HANDLERS = {
  'tea-break': (store, participants) => {
    // 2-3 people walk to coffee area and chat
    const coffeeSpots = [
      { x: 80, y: 475 }, { x: 110, y: 485 }, { x: 140, y: 470 },
    ]
    store.getState().setMultipleAgentGroupEvents(
      participants.map((id, i) => ({
        id,
        behavior: i === 0 ? 'drink-coffee' : 'chat',
        expression: 'happy',
        bubble: eventBubble('tea-break'),
        groupTarget: jitter(coffeeSpots[i % coffeeSpots.length], 12),
      }))
    )
  },

  'standup': (store, participants, cancelled) => {
    // Everyone gathers at whiteboard area
    const whiteboardSpots = [
      { x: 530, y: 355 }, { x: 550, y: 370 }, { x: 570, y: 355 },
      { x: 530, y: 385 }, { x: 550, y: 385 }, { x: 570, y: 370 },
      { x: 540, y: 365 },
    ]
    store.getState().setMultipleAgentGroupEvents(
      participants.map((id, i) => ({
        id,
        behavior: i === 0 ? 'whiteboard' : 'meeting',
        expression: 'normal',
        bubble: i < 2 ? eventBubble('standup') : null,
        groupTarget: jitter(whiteboardSpots[i % whiteboardSpots.length], 8),
      }))
    )
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      const ids = participants.filter(id => s.agents[id]?.inGroupEvent)
      if (ids.length >= 2) {
        s.setAgentBehavior(ids[1], 'meeting', 'normal', eventBubble('standup-done'))
      }
    }, 8000)
  },

  'food-delivery': (store, participants, cancelled) => {
    const bringer = participants[0]
    store.getState().setAgentGroupEvent(bringer, {
      behavior: 'pass-document',
      expression: 'happy',
      bubble: eventBubble('food-delivery'),
      groupTarget: { x: 300, y: 290 },
    })
    setTimeout(() => {
      if (cancelled?.value) return
      participants.slice(1).forEach((id) => {
        const s = store.getState()
        if (s.agents[id]) {
          s.setAgentBehavior(id, 'eat-snack', 'happy', eventBubble('food-react'))
          setTimeout(() => { if (!cancelled?.value) s.clearBubble(id) }, 4000)
        }
      })
    }, 2000)
  },

  'coffee-spill': (store, participants, cancelled) => {
    const spiller = participants[0]
    store.getState().setAgentGroupEvent(spiller, {
      behavior: 'scratch-head',
      expression: 'confused',
      bubble: eventBubble('coffee-spill'),
      groupTarget: null,
    })
    if (participants[1]) {
      setTimeout(() => {
        if (cancelled?.value) return
        const s = store.getState()
        const spillerPos = s.agents[spiller]?.position
        if (spillerPos) {
          s.setAgentGroupEvent(participants[1], {
            behavior: 'pass-document',
            expression: 'normal',
            bubble: eventBubble('coffee-help'),
            groupTarget: jitter(spillerPos, 30),
          })
        }
      }, 1500)
    }
  },

  'eureka': (store, participants) => {
    const s = store.getState()
    if (!s.agents['arch']) return
    s.setAgentGroupEvent('arch', {
      behavior: 'whiteboard',
      expression: 'surprised',
      bubble: eventBubble('eureka'),
      groupTarget: jitter(WAYPOINTS.whiteboard, 10),
    })
  },

  'review-debate': (store, participants, cancelled) => {
    const s = store.getState()
    if (!s.agents['dev'] || !s.agents['qa']) return
    const devPos = HOME_POSITIONS.dev || { x: 340, y: 364 }
    const qaPos = HOME_POSITIONS.qa || { x: 400, y: 244 }
    const meetPoint = { x: (devPos.x + qaPos.x) / 2, y: (devPos.y + qaPos.y) / 2 }

    s.setAgentGroupEvent('dev', {
      behavior: 'chat',
      expression: 'focused',
      bubble: eventBubble('review-dev-1'),
      groupTarget: jitter({ x: meetPoint.x - 20, y: meetPoint.y }, 8),
    })
    s.setAgentGroupEvent('qa', {
      behavior: 'chat',
      expression: 'confused',
      bubble: eventBubble('review-qa-1'),
      groupTarget: jitter({ x: meetPoint.x + 20, y: meetPoint.y }, 8),
    })
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'chat', 'confused', eventBubble('review-dev-2'))
      if (s.agents.qa?.inGroupEvent) s.setAgentBehavior('qa', 'magnifier', 'focused', eventBubble('review-qa-2'))
    }, 6000)
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'typing', 'normal', eventBubble('review-dev-3'))
      if (s.agents.qa?.inGroupEvent) s.setAgentBehavior('qa', 'thumbs-up', 'happy', eventBubble('review-qa-3'))
    }, 12000)
  },

  'deploy-success': (store, participants, cancelled) => {
    const s = store.getState()
    if (!s.agents['ops']) return
    s.setAgentGroupEvent('ops', {
      behavior: 'deploy-button',
      expression: 'happy',
      bubble: eventBubble('deploy-success'),
      groupTarget: null,
    })
    setTimeout(() => {
      if (cancelled?.value) return
      participants.filter(id => id !== 'ops').forEach((id) => {
        const s = store.getState()
        if (s.agents[id]) {
          s.setAgentBehavior(id, 'thumbs-up', 'happy', eventBubble('deploy-celebrate'))
          setTimeout(() => { if (!cancelled?.value) s.clearBubble(id) }, 5000)
        }
      })
    }, 2000)
  },

  'group-meeting': (store, participants, cancelled) => {
    const chairs = [...MEETING_CHAIRS].sort(() => Math.random() - 0.5)
    store.getState().setMultipleAgentGroupEvents(
      participants.map((id, i) => ({
        id,
        behavior: 'meeting',
        expression: 'normal',
        bubble: eventBubble('meeting-start'),
        groupTarget: jitter(chairs[i % chairs.length], 6),
      }))
    )
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      const active = participants.filter(id => s.agents[id]?.inGroupEvent)
      if (active.length > 0) s.setAgentBehavior(active[0], 'meeting', 'focused', eventBubble('meeting-lead'))
      if (active.length > 1) s.setAgentBehavior(active[1], 'meeting', 'normal', eventBubble('meeting-agree'))
    }, 8000)
  },

  // ─── Rare events ─────────────────────────────────────────────────

  'boss-visit': (store, participants, cancelled) => {
    // Everyone rushes back to their desk and pretends to be busy
    store.getState().setMultipleAgentGroupEvents(
      participants
        .filter((id) => HOME_POSITIONS[id])
        .map((id) => ({
          id,
          behavior: 'typing',
          expression: 'focused',
          bubble: eventBubble('boss-visit'),
          groupTarget: jitter(HOME_POSITIONS[id], 6),
        }))
    )
    // After a beat, everyone relaxes
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      participants.forEach((id) => {
        if (s.agents[id]?.inGroupEvent) {
          s.setAgentBehavior(id, 'typing', 'normal', null)
        }
      })
    }, 7000)
  },

  'dog-visit': (store, participants, cancelled) => {
    // Everyone reacts to a dog, then some gather in lounge
    participants.forEach((id, i) => {
      setTimeout(() => {
        if (cancelled?.value) return
        store.getState().setAgentGroupEvent(id, {
          behavior: i === 0 ? 'stretch' : 'chat',
          expression: 'happy',
          bubble: eventBubble('dog-visit'),
          groupTarget: null,
        })
      }, i * 800)
    })
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      participants.slice(0, 3).forEach((id) => {
        if (s.agents[id]?.inGroupEvent) {
          s.setAgentGroupEvent(id, {
            behavior: 'chat',
            expression: 'happy',
            bubble: eventBubble('dog-woof'),
            groupTarget: jitter({ x: 175, y: 490 }, 30),
          })
        }
      })
    }, 5000)
  },

  'ac-broken': (store, participants, cancelled) => {
    // Everyone fans themselves and complains
    store.getState().setMultipleAgentGroupEvents(
      participants.map((id) => ({
        id,
        behavior: 'stretch',
        expression: 'confused',
        bubble: eventBubble('ac-broken'),
        groupTarget: null,
      }))
    )
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      participants.forEach((id) => {
        if (s.agents[id]?.inGroupEvent) {
          s.setAgentBehavior(id, 'stretch', 'confused', eventBubble('ac-fan'))
        }
      })
    }, 6000)
  },

  'group-stretch': (store, participants, cancelled) => {
    // Everyone stretches at the same time
    participants.forEach((id, i) => {
      setTimeout(() => {
        if (cancelled?.value) return
        store.getState().setAgentGroupEvent(id, {
          behavior: 'stretch',
          expression: 'happy',
          bubble: eventBubble('group-stretch'),
          groupTarget: null,
        })
      }, i * 300)
    })
  },
}

function executeEvent(store, event, participants, cancelled) {
  const handler = EVENT_HANDLERS[event.id]
  if (handler) {
    handler(store, participants, cancelled)

    // Clean up after event duration — release all participants
    setTimeout(() => {
      if (cancelled.value) return
      const s = store.getState()
      participants.forEach((id) => {
        if (s.agents[id]?.inGroupEvent) {
          s.clearAgentGroupEvent(id)
          s.clearBubble(id)
        }
      })
      s.clearActiveEvent()
    }, event.duration)
  }
}

export function triggerInteractiveEvent(store, eventId) {
  const state = store.getState()
  if (state.isPaused || state.activeEvent) return false

  const allEvents = [...(eventsData.daily || []), ...(eventsData.rare || [])]
  const event = allEvents.find(e => e.id === eventId)
  if (!event) return false

  const participants = pickParticipants(event, state.agents, state.externalStatus)
  const cancelled = { value: false }

  state.setActiveEvent(event)
  executeEvent(store, event, participants, cancelled)

  return true
}

export function startOfficeLife(store) {
  // Guard against double-init (React StrictMode)
  if (dailyTimer || rareTimer) {
    clearTimeout(dailyTimer)
    clearTimeout(rareTimer)
    dailyTimer = null
    rareTimer = null
  }

  // Shared cancellation flag — prevents stale event callbacks from firing after stop()
  const cancelled = { value: false }

  const scheduleDaily = () => {
    dailyTimer = setTimeout(() => {
      if (cancelled.value) return
      const state = store.getState()
      if (!state.isPaused && !state.activeEvent) {
        const pool = eventsData.daily
        const event = pool[Math.floor(Math.random() * pool.length)]
        const participants = pickParticipants(event, state.agents, state.externalStatus)

        store.getState().setActiveEvent(event)
        executeEvent(store, event, participants, cancelled)
      }
      scheduleDaily()
    }, randomInterval(DAILY_EVENT_INTERVAL))
  }

  const scheduleRare = () => {
    rareTimer = setTimeout(() => {
      if (cancelled.value) return
      const state = store.getState()
      if (!state.isPaused && !state.activeEvent) {
        const pool = eventsData.rare
        const event = pool[Math.floor(Math.random() * pool.length)]
        const participants = pickParticipants(event, state.agents, state.externalStatus)

        store.getState().setActiveEvent(event)
        executeEvent(store, event, participants, cancelled)
      }
      scheduleRare()
    }, randomInterval(RARE_EVENT_INTERVAL))
  }

  scheduleDaily()
  scheduleRare()

  // Update time every minute
  const timeInterval = setInterval(() => {
    store.getState().updateTime()
  }, TIME_CHECK_INTERVAL)

  // ─── Time-linked events ──────────────────────────────────────────────
  // Check every minute for time-specific behaviors
  let lastTriggeredHour = -1
  const timeEventInterval = setInterval(() => {
    if (cancelled.value) return
    const state = store.getState()
    if (state.isPaused || state.activeEvent) return
    const hour = state.hour
    if (hour === lastTriggeredHour) return
    lastTriggeredHour = hour

    const agentIds = Object.keys(state.agents)

    // 12:00-13:00 — Lunch nap: half the agents nap at desk
    if (hour === 12) {
      const nappers = agentIds.filter(() => Math.random() < 0.5)
      store.getState().setMultipleAgentGroupEvents(
        nappers.map((id) => ({
          id,
          behavior: 'nap',
          expression: 'sleepy',
          bubble: eventBubble('lunch-nap'),
          groupTarget: null,
        }))
      )
      setTimeout(() => {
        if (cancelled.value) return
        const s = store.getState()
        nappers.forEach((id) => {
          if (s.agents[id]?.inGroupEvent) {
            s.clearAgentGroupEvent(id)
          }
        })
      }, 45000)
    }

    // 14:00-14:30 — Post-lunch drowsiness: everyone gets sleepy expression
    if (hour === 14) {
      agentIds.forEach((id) => {
        store.getState().setAgentBehavior(id, store.getState().agents[id]?.behavior || 'typing', 'tired', null)
      })
      setTimeout(() => {
        if (cancelled.value) return
        agentIds.forEach((id) => {
          const s = store.getState()
          if (s.agents[id]?.expression === 'tired') {
            s.setAgentBehavior(id, s.agents[id].behavior, 'normal', null)
          }
        })
      }, 30000)
    }

    // 10:00 or 15:00 — Auto tea break
    if (hour === 10 || hour === 15) {
      const teaEvent = eventsData.daily.find(e => e.id === 'tea-break')
      if (teaEvent) {
        const participants = pickParticipants(teaEvent, state.agents, state.externalStatus)
        store.getState().setActiveEvent(teaEvent)
        executeEvent(store, teaEvent, participants, cancelled)
      }
    }

    // Friday 15:00+ — Social boost (handled via behavior weights already, but trigger a group-meeting)
    const day = new Date().getDay()
    if (day === 5 && hour === 15) {
      const meetEvent = eventsData.daily.find(e => e.id === 'group-meeting')
      if (meetEvent) {
        const participants = pickParticipants(meetEvent, state.agents, state.externalStatus)
        store.getState().setActiveEvent(meetEvent)
        executeEvent(store, meetEvent, participants, cancelled)
      }
    }
  }, TIME_CHECK_INTERVAL)

  return () => {
    cancelled.value = true
    clearTimeout(dailyTimer)
    clearTimeout(rareTimer)
    clearInterval(timeInterval)
    clearInterval(timeEventInterval)
  }
}
