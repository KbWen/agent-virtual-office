import eventsData from '../config/officeEvents.json'
import { WAYPOINTS, MEETING_CHAIRS, HOME_POSITIONS } from './movementSystem'
import { eventBubble, eventName as getEventName } from '../i18n'

const DAILY_INTERVAL = [60000, 180000]   // 1-3 min (group events happen often enough to see)
const RARE_INTERVAL = [300000, 600000]   // 5-10 min

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
    participants.forEach((id, i) => {
      store.getState().setAgentGroupEvent(id, {
        behavior: i === 0 ? 'drink-coffee' : 'chat',
        expression: 'happy',
        bubble: eventBubble('tea-break'),
        groupTarget: jitter(coffeeSpots[i % coffeeSpots.length], 12),
      })
    })
  },

  'standup': (store, participants) => {
    // Everyone gathers at whiteboard area
    const whiteboardSpots = [
      { x: 530, y: 355 }, { x: 550, y: 370 }, { x: 570, y: 355 },
      { x: 530, y: 385 }, { x: 550, y: 385 }, { x: 570, y: 370 },
      { x: 540, y: 365 },
    ]
    participants.forEach((id, i) => {
      store.getState().setAgentGroupEvent(id, {
        behavior: i === 0 ? 'whiteboard' : 'meeting',
        expression: 'normal',
        bubble: i < 2 ? eventBubble('standup') : null,
        groupTarget: jitter(whiteboardSpots[i % whiteboardSpots.length], 8),
      })
    })
    setTimeout(() => {
      const s = store.getState()
      const ids = participants.filter(id => s.agents[id]?.inGroupEvent)
      if (ids.length >= 2) {
        s.setAgentBehavior(ids[1], 'meeting', 'normal', eventBubble('standup-done'))
      }
    }, 8000)
  },

  'food-delivery': (store, participants) => {
    const bringer = participants[0]
    store.getState().setAgentGroupEvent(bringer, {
      behavior: 'pass-document',
      expression: 'happy',
      bubble: eventBubble('food-delivery'),
      groupTarget: { x: 300, y: 290 },
    })
    setTimeout(() => {
      participants.slice(1).forEach((id) => {
        const s = store.getState()
        if (s.agents[id]) {
          s.setAgentBehavior(id, 'eat-snack', 'happy', eventBubble('food-react'))
          setTimeout(() => s.clearBubble(id), 4000)
        }
      })
    }, 2000)
  },

  'coffee-spill': (store, participants) => {
    const spiller = participants[0]
    store.getState().setAgentGroupEvent(spiller, {
      behavior: 'scratch-head',
      expression: 'confused',
      bubble: eventBubble('coffee-spill'),
      groupTarget: null,
    })
    if (participants[1]) {
      setTimeout(() => {
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

  'review-debate': (store, participants) => {
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
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'chat', 'confused', eventBubble('review-dev-2'))
      if (s.agents.qa?.inGroupEvent) s.setAgentBehavior('qa', 'magnifier', 'focused', eventBubble('review-qa-2'))
    }, 6000)
    setTimeout(() => {
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'typing', 'normal', eventBubble('review-dev-3'))
      if (s.agents.qa?.inGroupEvent) s.setAgentBehavior('qa', 'thumbs-up', 'happy', eventBubble('review-qa-3'))
    }, 12000)
  },

  'deploy-success': (store, participants) => {
    const s = store.getState()
    if (!s.agents['ops']) return
    s.setAgentGroupEvent('ops', {
      behavior: 'deploy-button',
      expression: 'happy',
      bubble: eventBubble('deploy-success'),
      groupTarget: null,
    })
    setTimeout(() => {
      participants.filter(id => id !== 'ops').forEach((id) => {
        const s = store.getState()
        if (s.agents[id]) {
          s.setAgentBehavior(id, 'thumbs-up', 'happy', eventBubble('deploy-celebrate'))
          setTimeout(() => s.clearBubble(id), 5000)
        }
      })
    }, 2000)
  },

  'group-meeting': (store, participants) => {
    const chairs = [...MEETING_CHAIRS].sort(() => Math.random() - 0.5)
    participants.forEach((id, i) => {
      store.getState().setAgentGroupEvent(id, {
        behavior: 'meeting',
        expression: 'normal',
        bubble: eventBubble('meeting-start'),
        groupTarget: jitter(chairs[i % chairs.length], 6),
      })
    })
    setTimeout(() => {
      const s = store.getState()
      const active = participants.filter(id => s.agents[id]?.inGroupEvent)
      if (active.length > 0) s.setAgentBehavior(active[0], 'meeting', 'focused', eventBubble('meeting-lead'))
      if (active.length > 1) s.setAgentBehavior(active[1], 'meeting', 'normal', eventBubble('meeting-agree'))
    }, 8000)
  },
}

function executeEvent(store, event, participants) {
  const handler = EVENT_HANDLERS[event.id]
  if (handler) {
    handler(store, participants)

    // Clean up after event duration — release all participants
    setTimeout(() => {
      const s = store.getState()
      participants.forEach((id) => {
        if (s.agents[id]?.inGroupEvent) {
          store.getState().clearAgentGroupEvent(id)
          store.getState().clearBubble(id)
        }
      })
      store.getState().clearActiveEvent()
    }, event.duration)
  }
}

export function startOfficeLife(store) {
  const scheduleDaily = () => {
    dailyTimer = setTimeout(() => {
      const state = store.getState()
      if (!state.isPaused && !state.activeEvent) {
        const pool = eventsData.daily
        const event = pool[Math.floor(Math.random() * pool.length)]
        const participants = pickParticipants(event, state.agents, state.externalStatus)

        store.getState().setActiveEvent(event)
        executeEvent(store, event, participants)
      }
      scheduleDaily()
    }, randomInterval(DAILY_INTERVAL))
  }

  const scheduleRare = () => {
    rareTimer = setTimeout(() => {
      const state = store.getState()
      if (!state.isPaused && !state.activeEvent) {
        const pool = eventsData.rare
        const event = pool[Math.floor(Math.random() * pool.length)]
        const participants = pickParticipants(event, state.agents, state.externalStatus)

        store.getState().setActiveEvent(event)
        executeEvent(store, event, participants)
      }
      scheduleRare()
    }, randomInterval(RARE_INTERVAL))
  }

  scheduleDaily()
  scheduleRare()

  // Update time every minute
  const timeInterval = setInterval(() => {
    store.getState().updateTime()
  }, 60000)

  return () => {
    clearTimeout(dailyTimer)
    clearTimeout(rareTimer)
    clearInterval(timeInterval)
  }
}
