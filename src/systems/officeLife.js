import eventsData from '../config/officeEvents.json'
import { WAYPOINTS, MEETING_CHAIRS, HOME_POSITIONS } from './movementSystem'

const DAILY_INTERVAL = [60000, 180000]   // 1-3 min (group events happen often enough to see)
const RARE_INTERVAL = [300000, 600000]   // 5-10 min

function randomInterval(range) {
  return range[0] + Math.random() * (range[1] - range[0])
}

function jitter(pos, amount = 20) {
  return {
    x: pos.x + (Math.random() - 0.5) * amount,
    y: pos.y + (Math.random() - 0.5) * amount,
  }
}

function pickParticipants(event, agents) {
  const agentIds = Object.keys(agents)
  if (event.participants === 'all') return agentIds
  if (event.participants === 'random-2-3') {
    const count = 2 + Math.floor(Math.random() * 2)
    return [...agentIds].sort(() => Math.random() - 0.5).slice(0, count)
  }
  if (event.participants === 'random-1-neighbor') {
    const idx = Math.floor(Math.random() * agentIds.length)
    const result = [agentIds[idx]]
    if (idx + 1 < agentIds.length) result.push(agentIds[idx + 1])
    return result
  }
  if (Array.isArray(event.participants)) {
    return event.participants.filter((p) => agents[p])
  }
  return agentIds.slice(0, 3)
}

// ─── Event handlers: each sets visual states for participants ────────

// All handlers receive (store, participants, cancelled) where cancelled = { value: bool }
const EVENT_HANDLERS = {
  'tea-break': (store, participants, _cancelled) => {
    // 2-3 people walk to coffee area and chat
    const coffeeSpots = [
      { x: 80, y: 475 }, { x: 110, y: 485 }, { x: 140, y: 470 },
    ]
    const bubbles = ['☕ 休息~', '喝一杯', '聊聊天', '好累啊']
    participants.forEach((id, i) => {
      store.getState().setAgentGroupEvent(id, {
        behavior: i === 0 ? 'drink-coffee' : 'chat',
        expression: 'happy',
        bubble: bubbles[i % bubbles.length],
        groupTarget: jitter(coffeeSpots[i % coffeeSpots.length], 12),
      })
    })
  },

  'standup': (store, participants, cancelled) => {
    // Everyone gathers at whiteboard area
    const whiteboardSpots = [
      { x: 530, y: 355 }, { x: 550, y: 370 }, { x: 570, y: 355 },
      { x: 530, y: 385 }, { x: 550, y: 385 }, { x: 570, y: 370 },
      { x: 540, y: 365 },
    ]
    const bubbles = ['今天進度...', '來報告', '嗯嗯', '站立會議！', '快快講']
    participants.forEach((id, i) => {
      store.getState().setAgentGroupEvent(id, {
        behavior: i === 0 ? 'whiteboard' : 'meeting',
        expression: 'normal',
        bubble: i < 2 ? bubbles[i] : null,
        groupTarget: jitter(whiteboardSpots[i % whiteboardSpots.length], 8),
      })
    })
    // After a few seconds, more bubbles appear
    setTimeout(() => {
      if (cancelled.value) return
      const s = store.getState()
      const ids = participants.filter(id => s.agents[id]?.inGroupEvent)
      if (ids.length >= 2) {
        s.setAgentBehavior(ids[1], 'meeting', 'normal', '報告完畢')
      }
    }, 8000)
  },

  'food-delivery': (store, participants, cancelled) => {
    // Everyone gets happy, one person "brings food"
    const bringer = participants[0]
    store.getState().setAgentGroupEvent(bringer, {
      behavior: 'pass-document',
      expression: 'happy',
      bubble: '外送到了！🍱',
      groupTarget: { x: 300, y: 290 },
    })
    // Others react with happy expressions at their desks
    setTimeout(() => {
      if (cancelled.value) return
      participants.slice(1).forEach((id) => {
        const s = store.getState()
        if (s.agents[id]) {
          s.setAgentBehavior(id, 'eat-snack', 'happy', '讚！吃飯！')
          setTimeout(() => { if (!cancelled.value) s.clearBubble(id) }, 4000)
        }
      })
    }, 2000)
  },

  'coffee-spill': (store, participants, cancelled) => {
    // One person spills, neighbor helps
    const spiller = participants[0]
    store.getState().setAgentGroupEvent(spiller, {
      behavior: 'scratch-head',
      expression: 'confused',
      bubble: '啊！打翻了！',
      groupTarget: null, // stay at desk
    })
    if (participants[1]) {
      setTimeout(() => {
        if (cancelled.value) return
        const s = store.getState()
        const spillerPos = s.agents[spiller]?.position
        if (spillerPos) {
          s.setAgentGroupEvent(participants[1], {
            behavior: 'pass-document',
            expression: 'normal',
            bubble: '我來幫忙！',
            groupTarget: jitter(spillerPos, 30),
          })
        }
      }, 1500)
    }
  },

  'eureka': (store, participants, _cancelled) => {
    // Architect has a eureka moment, runs to whiteboard
    const s = store.getState()
    if (!s.agents['arch']) return
    s.setAgentGroupEvent('arch', {
      behavior: 'whiteboard',
      expression: 'surprised',
      bubble: '有了！💡',
      groupTarget: jitter(WAYPOINTS.whiteboard, 10),
    })
  },

  'review-debate': (store, participants, cancelled) => {
    // Dev and QA face off
    const s = store.getState()
    if (!s.agents['dev'] || !s.agents['qa']) return
    const devPos = HOME_POSITIONS.dev || { x: 340, y: 364 }
    const qaPos = HOME_POSITIONS.qa || { x: 400, y: 244 }
    const meetPoint = { x: (devPos.x + qaPos.x) / 2, y: (devPos.y + qaPos.y) / 2 }

    s.setAgentGroupEvent('dev', {
      behavior: 'chat',
      expression: 'focused',
      bubble: '這沒bug啊！',
      groupTarget: jitter({ x: meetPoint.x - 20, y: meetPoint.y }, 8),
    })
    s.setAgentGroupEvent('qa', {
      behavior: 'chat',
      expression: 'confused',
      bubble: '明明就有！',
      groupTarget: jitter({ x: meetPoint.x + 20, y: meetPoint.y }, 8),
    })
    // Back and forth
    setTimeout(() => {
      if (cancelled.value) return
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'chat', 'confused', '...讓我看看')
      if (s.agents.qa?.inGroupEvent) s.setAgentBehavior('qa', 'magnifier', 'focused', '你看這裡')
    }, 6000)
    setTimeout(() => {
      if (cancelled.value) return
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'typing', 'normal', '好吧修了')
      if (s.agents.qa?.inGroupEvent) s.setAgentBehavior('qa', 'thumbs-up', 'happy', '讚')
    }, 12000)
  },

  'deploy-success': (store, participants, cancelled) => {
    // Ops presses the button, everyone celebrates
    const s = store.getState()
    if (!s.agents['ops']) return
    s.setAgentGroupEvent('ops', {
      behavior: 'deploy-button',
      expression: 'happy',
      bubble: '部署成功！🚀',
      groupTarget: null,
    })
    setTimeout(() => {
      if (cancelled.value) return
      participants.filter(id => id !== 'ops').forEach((id, i) => {
        const s = store.getState()
        if (s.agents[id]) {
          const celebBubbles = ['🎉 耶！', '太好了！', '終於...', '慶祝！', '下班！', '完美~']
          s.setAgentBehavior(id, 'thumbs-up', 'happy', celebBubbles[i % celebBubbles.length])
          setTimeout(() => { if (!cancelled.value) s.clearBubble(id) }, 5000)
        }
      })
    }, 2000)
  },

  // Group meeting — 3 people go to meeting room
  'group-meeting': (store, participants, cancelled) => {
    const chairs = [...MEETING_CHAIRS].sort(() => Math.random() - 0.5)
    const bubbles = ['開會囉', '來了來了', '又開會...']
    participants.forEach((id, i) => {
      store.getState().setAgentGroupEvent(id, {
        behavior: 'meeting',
        expression: 'normal',
        bubble: bubbles[i % bubbles.length],
        groupTarget: jitter(chairs[i % chairs.length], 6),
      })
    })
    // Discussion bubbles mid-meeting
    setTimeout(() => {
      if (cancelled.value) return
      const s = store.getState()
      const active = participants.filter(id => s.agents[id]?.inGroupEvent)
      if (active.length > 0) s.setAgentBehavior(active[0], 'meeting', 'focused', '所以方向是...')
      if (active.length > 1) s.setAgentBehavior(active[1], 'meeting', 'normal', '嗯嗯同意')
    }, 8000)
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
          store.getState().clearAgentGroupEvent(id)
          store.getState().clearBubble(id)
        }
      })
      store.getState().clearActiveEvent()
    }, event.duration)
  }
}

export function startOfficeLife(store) {
  // Keep timer refs local to this invocation so cleanup is exact
  let dailyTimer = null
  let rareTimer = null
  // Shared cancellation flag — prevents stale event-cleanup callbacks from firing after stop()
  const cancelled = { value: false }

  const scheduleDaily = () => {
    dailyTimer = setTimeout(() => {
      if (cancelled.value) return
      const state = store.getState()
      if (!state.isPaused && !state.activeEvent) {
        const pool = eventsData.daily
        const event = pool[Math.floor(Math.random() * pool.length)]
        const participants = pickParticipants(event, state.agents)

        store.getState().setActiveEvent(event)
        executeEvent(store, event, participants, cancelled)
      }
      scheduleDaily()
    }, randomInterval(DAILY_INTERVAL))
  }

  const scheduleRare = () => {
    rareTimer = setTimeout(() => {
      if (cancelled.value) return
      const state = store.getState()
      if (!state.isPaused && !state.activeEvent) {
        const pool = eventsData.rare
        const event = pool[Math.floor(Math.random() * pool.length)]
        const participants = pickParticipants(event, state.agents)

        store.getState().setActiveEvent(event)
        executeEvent(store, event, participants, cancelled)
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
    cancelled.value = true
    clearTimeout(dailyTimer)
    clearTimeout(rareTimer)
    clearInterval(timeInterval)
  }
}
