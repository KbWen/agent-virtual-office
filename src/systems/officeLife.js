import eventsData from '../config/officeEvents.json'
import { WAYPOINTS, MEETING_CHAIRS, HOME_POSITIONS } from './movementSystem.js'
import { eventBubble } from '../i18n'
import { DAILY_EVENT_INTERVAL, RARE_EVENT_INTERVAL, TIME_CHECK_INTERVAL, WORK_CLAIM_SIGNAL_WINDOW, LIVE_FLOOR_FIRE_CHANCE, SEED_COOLDOWN_MS, PAIR_HUDDLE_WINDOW } from './constants.js'
import { findSharedFilePair, fileBasename } from './pairHuddle.js'

let dailyTimer = null
let rareTimer = null
let timeInterval = null
let timeEventInterval = null
let seedUnsub = null   // living-office P4: store subscription for real-seeded event triggers
// Module-level cancellation flag so a double-init can fully cancel the PRIOR instance.
// startOfficeLife's closures all read activeCancelled by reference, so reassigning it
// here both starts a fresh flag and lets the double-init guard flip the old one true.
let activeCancelled = null
// Cancellation flags for in-flight interactive events (coffee machine, whiteboard,
// deploy button). Tracked so teardown cancels their deferred callbacks too — otherwise
// a click followed by unmount/HMR leaves multi-stage setTimeout callbacks firing
// against a stale store.
const interactiveCancellers = new Set()
// Handles of the per-event deregistration timers (the setTimeout that removes a
// canceller from interactiveCancellers once the event lifetime elapsed). Tracked so
// teardown can clearTimeout them — otherwise each leaks as a pending handle until it
// fires a now-useless Set.delete on an already-cleared Set.
const interactiveDeregTimers = new Set()

// id → event lookup, built once at module load. triggerInteractiveEvent previously
// rebuilt `[...daily, ...rare]` and ran an O(catalog) .find() on every user click of
// the coffee machine / whiteboard / deploy button. The catalog is static, so resolve
// it to an O(1) map once instead of allocating + scanning per click.
const EVENT_BY_ID = (() => {
  const map = {}
  for (const e of eventsData.daily || []) map[e.id] = e
  for (const e of eventsData.rare || []) map[e.id] = e
  return map
})()

function randomInterval(range) {
  return range[0] + Math.random() * (range[1] - range[0])
}

// ─── living-office-events Phase 2: honesty gating ───────────────────────────────
// Event Decision Framework (spec docs/specs/living-office-events.md):
//   WORK-CLAIM events assert a specific REAL work outcome → may fire ONLY when a matching real
//   signal fired within WORK_CLAIM_SIGNAL_WINDOW (R2). No signal → ineligible (a SOCIAL/WORLD
//   event is drawn instead). SOCIAL/WORLD events make no work-claim → always eligible (honest for
//   the untracked agents pickParticipants already selects). To classify a FUTURE event: if it
//   asserts/implies a real outcome, add it here with its gate; otherwise leave it out.
const recentSignal = (es, now) => !!(es && es.changedAt && (now - es.changedAt) < WORK_CLAIM_SIGNAL_WINDOW)
const WORK_CLAIM_GATES = {
  // deploy claims → Ops had a real recent signal (working→done on a ship)
  'deploy-success':       (s, now) => recentSignal(s.externalStatus?.ops, now),
  'ops-dev-deploy-check': (s, now) => recentSignal(s.externalStatus?.ops, now),
  // design friction → a real block-streak (moodEngine distils this from real signals)
  'dev-arch-disagree':    (s)      => s.mood === 'frustrated' || s.mood === 'stuck',
  // breakthrough → a real done-streak / smooth momentum
  'eureka':               (s)      => s.mood === 'smooth',
  // review friction → QA/Gatekeeper had a real recent signal (no distinct "review subagent" on wire)
  'review-debate':        (s, now) => recentSignal(s.externalStatus?.qa, now) || recentSignal(s.externalStatus?.gate, now),
}

// Exported for tests. true if the event may HONESTLY fire given the current real-signal state.
export function eventEligible(event, state, now = Date.now()) {
  if (!event) return false
  const gate = WORK_CLAIM_GATES[event.id]
  return gate ? !!gate(state, now) : true
}

// Pick a random event from `pool` that is currently eligible (work-claims gated). null if none.
function pickEligibleEvent(pool, state) {
  const now = Date.now()
  const eligible = (pool || []).filter((e) => eventEligible(e, state, now))
  if (eligible.length === 0) return null
  return eligible[Math.floor(Math.random() * eligible.length)]
}

// When a real session is live, scale the ambient floor DOWN (not mute) so working never feels
// quieter than idle/demo (AC-7). Returns true if this tick should be allowed to fire.
export function floorTickAllowed(state) {
  // 'fallback' = a count-only live session (#count=N, no role keys) — still real activity that
  // pushes teamPulse, so it must scale the floor too (AC-7), not just 'external'.
  const live = (state.statusSource === 'external' || state.statusSource === 'fallback') && (state.teamPulse || 0) > 0.2
  return !live || Math.random() < LIVE_FLOOR_FIRE_CHANCE
}

// Release EVERY agent currently locked in a group event back to organic scheduling.
// Group-event cleanup normally happens in executeEvent's per-event setTimeout, but that
// timer early-returns when `cancelled` is flipped (teardown / HMR / StrictMode remount /
// double-init). The store's `inGroupEvent` flag is NOT persisted and NOT reset by the
// module-level zustand store across an HMR boundary, so a cancelled event leaves its
// participants stuck `inGroupEvent: true` forever: doSchedule skips them and the watchdog
// explicitly ignores in-group agents — the agent freezes permanently. Teardown MUST
// release them directly rather than trusting a cancelled cleanup timer.
function releaseAllGroupEvents(store) {
  try {
    const s = store.getState()
    if (!s || !s.agents) return
    for (const id of Object.keys(s.agents)) {
      if (s.agents[id]?.inGroupEvent) {
        s.clearAgentGroupEvent(id)
        s.clearBubble(id)
      }
    }
    if (s.clearReluctant) s.clearReluctant()  // P3: don't strand reluctant tells on teardown/HMR
    s.clearActiveEvent()
  } catch { /* store may be torn down — best effort */ }
}

function jitter(pos, amount = 20) {
  return {
    x: pos.x + (Math.random() - 0.5) * amount,
    y: pos.y + (Math.random() - 0.5) * amount,
  }
}

function pickParticipants(event, agents, externalStatus) {
  const ext = externalStatus || {}
  // Exclude agents that are externally busy (working/blocked) OR already in a group event.
  // Without the inGroupEvent guard a second concurrent event re-locks an already-locked
  // agent: pickParticipants only inspected externalStatus, so an agent locked by the first
  // event was still "available" to the second event's picker.
  const isAvailable = (id) => {
    const es = ext[id]
    return (!es || es.status === 'done' || es.status === 'idle') && !agents[id]?.inGroupEvent
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
    // Guard empty pool: if no agents exist, return [] rather than [undefined].
    // An empty/single-element pool produced [undefined] which triggerInteractiveEvent
    // then used to create a phantom activeEvent — blocking all subsequent events.
    if (pool.length === 0) return []
    const idx = Math.floor(Math.random() * pool.length)
    const result = [pool[idx]].filter(Boolean)
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
    // Everyone gathers in front of the whiteboard — 8 SPACED spots (was a 40×30 pile that made the
    // whole team visually overlap; spread ~90×55 in two rows so each agent reads as distinct).
    // 8 spots IN FRONT OF the whiteboard, all verified on the mainOffice floor (x15-593, y168-394)
    // and clear of the whiteboard (x525-590,y278-342) + desks (y≤360): row1 right of opsDesk just
    // below the board, row2 below the desk row. (Earlier spread put 4 spots in walls/furniture.)
    const whiteboardSpots = [
      { x: 500, y: 350 }, { x: 525, y: 348 }, { x: 550, y: 350 }, { x: 578, y: 354 },
      { x: 445, y: 382 }, { x: 490, y: 384 }, { x: 535, y: 382 }, { x: 578, y: 380 },
    ]
    store.getState().setMultipleAgentGroupEvents(
      participants.map((id, i) => ({
        id,
        behavior: i === 0 ? 'whiteboard' : 'meeting',
        expression: 'normal',
        bubble: i < 2 ? eventBubble('standup') : null,
        groupTarget: jitter(whiteboardSpots[i % whiteboardSpots.length], 7),
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
    // Guard empty pool: pickParticipants returns [] when no agents are available,
    // so participants[0] may be undefined. Without this guard, setAgentGroupEvent
    // receives undefined as the id — producing a phantom group-event slot and
    // a stuck activeEvent that blocks all subsequent events.
    if (!spiller) return
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
    if (!participants.includes('arch')) return
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
    if (!participants.includes('dev') || !participants.includes('qa')) return
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
    if (!participants.includes('ops')) return
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

  'dev-arch-disagree': (store, participants, cancelled) => {
    if (!participants.includes('dev') || !participants.includes('arch')) return
    const s = store.getState()
    if (!s.agents['dev'] || !s.agents['arch']) return
    const meetPoint = { x: 300, y: 305 }
    s.setAgentGroupEvent('dev', {
      behavior: 'chat', expression: 'confused',
      bubble: eventBubble('dev-arch-dis-1'),
      groupTarget: jitter({ x: meetPoint.x - 20, y: meetPoint.y }, 8),
    })
    s.setAgentGroupEvent('arch', {
      behavior: 'whiteboard', expression: 'focused',
      bubble: eventBubble('arch-dis-1'),
      groupTarget: jitter({ x: meetPoint.x + 20, y: meetPoint.y }, 8),
    })
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'chat', 'focused', eventBubble('dev-arch-dis-2'))
      if (s.agents.arch?.inGroupEvent) s.setAgentBehavior('arch', 'chat', 'normal', eventBubble('arch-dis-2'))
    }, 6000)
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'typing', 'normal', eventBubble('dev-arch-dis-3'))
      if (s.agents.arch?.inGroupEvent) s.setAgentBehavior('arch', 'chat', 'happy', eventBubble('arch-dis-3'))
    }, 13000)
  },

  'ops-dev-deploy-check': (store, participants, cancelled) => {
    if (!participants.includes('ops') || !participants.includes('dev')) return
    const s = store.getState()
    if (!s.agents['ops'] || !s.agents['dev']) return
    const devPos = HOME_POSITIONS.dev || { x: 340, y: 364 }
    // Lock dev in place so doSchedule doesn't move them away while ops walks over
    s.setAgentGroupEvent('dev', {
      behavior: 'typing', expression: 'normal',
      bubble: null, groupTarget: null,
    })
    s.setAgentGroupEvent('ops', {
      behavior: 'chat', expression: 'normal',
      bubble: eventBubble('ops-dev-check-1'),
      groupTarget: jitter({ x: devPos.x + 35, y: devPos.y }, 10),
    })
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'scratch-head', 'confused', eventBubble('dev-ops-check-1'))
      if (s.agents.ops?.inGroupEvent) s.setAgentBehavior('ops', 'chat', 'normal', eventBubble('ops-dev-check-2'))
    }, 4000)
    setTimeout(() => {
      if (cancelled?.value) return
      const s = store.getState()
      if (s.agents.dev?.inGroupEvent) s.setAgentBehavior('dev', 'thumbs-up', 'happy', eventBubble('dev-ops-check-2'))
      if (s.agents.ops?.inGroupEvent) s.setAgentBehavior('ops', 'deploy-button', 'happy', eventBubble('ops-dev-check-3'))
    }, 10000)
  },

  'pm-all-meeting': (store, participants, cancelled) => {
    if (!participants.includes('pm')) return
    const s = store.getState()
    if (!s.agents['pm']) return
    s.setAgentGroupEvent('pm', {
      behavior: 'chat', expression: 'happy',
      bubble: eventBubble('pm-meeting-call'),
      groupTarget: null,
    })
    setTimeout(() => {
      if (cancelled?.value) return
      const chairs = [...MEETING_CHAIRS].sort(() => Math.random() - 0.5)
      const otherIds = participants.filter(id => id !== 'pm')
      store.getState().setMultipleAgentGroupEvents(
        otherIds.map((id, i) => ({
          id, behavior: 'meeting', expression: 'confused',
          bubble: eventBubble('pm-meeting-react'),
          groupTarget: jitter(chairs[(i + 1) % chairs.length], 6),
        }))
      )
      store.getState().setAgentGroupEvent('pm', {
        behavior: 'meeting', expression: 'happy',
        bubble: eventBubble('pm-meeting-lead'),
        groupTarget: jitter(chairs[0], 6),
      })
    }, 2500)
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

    // living-office P3 (reluctant participants): TRACKED (working/blocked) agents NOT in the scene
    // get a brief, sub-dominant "torn" tell — the team's life happens AROUND them while they stay
    // heads-down. PURE OVERLAY (setReluctant never touches status/behavior/position; it self-guards
    // to only working/blocked non-group agents), so it cannot freeze or falsify a real desk (R1).
    const s0 = store.getState()
    const pset = new Set(participants)
    const reluctantIds = Object.keys(s0.agents).filter((id) => {
      const es = s0.externalStatus[id]
      return !pset.has(id) && es && (es.status === 'working' || es.status === 'blocked')
    })
    if (reluctantIds.length && s0.setReluctant) {
      s0.setReluctant(reluctantIds, Date.now() + Math.min(event.duration || 8000, 6000))
    }

    // Clean up after event duration — release all participants + clear reluctant tells
    setTimeout(() => {
      if (cancelled.value) return
      const s = store.getState()
      participants.forEach((id) => {
        if (s.agents[id]?.inGroupEvent) {
          s.clearAgentGroupEvent(id)
          s.clearBubble(id)
        }
      })
      if (s.clearReluctant) s.clearReluctant()
      s.clearActiveEvent()
    }, event.duration)
  }
}

// Honest neutral reaction when a clicked work-claim object is gated out (no real signal).
// Mirrors the Poke micro-interaction (AVO-158): an in-place, NON-conclusive INTENT bubble on the
// responsible agent — never a work-outcome claim, never activeEvent/confetti/pet-celebrate. Keeps
// the click tactile while the office stays honest. SOCIAL clicks (tea-break) are never gated.
const INTERACTION_REACTOR = { 'deploy-success': 'ops', 'eureka': 'arch' }
const INTERACTION_BUBBLE_KEY = { 'deploy-success': 'deploy-idle', 'eureka': 'eureka-idle' }
function fireInteractionReaction(store, eventId) {
  const reactorId = INTERACTION_REACTOR[eventId]
  if (!reactorId) return
  const s = store.getState()
  const agent = s.agents?.[reactorId]
  // R1-safe: never override an agent genuinely locked in a real group event.
  if (!agent || agent.inGroupEvent) return
  const line = eventBubble(INTERACTION_BUBBLE_KEY[eventId])
  if (!line) return
  s.setAgentBehavior(reactorId, agent.behavior, agent.expression, line)
  let t
  t = setTimeout(() => { store.getState().clearBubble(reactorId); interactiveDeregTimers.delete(t) }, 2600)
  interactiveDeregTimers.add(t)
}

export function triggerInteractiveEvent(store, eventId) {
  const state = store.getState()
  if (state.isPaused || state.activeEvent) return false

  const event = EVENT_BY_ID[eventId]
  if (!event) return false

  // Honesty gate (panel-decided): a user click on a work-claim object (deploy button → deploy-success,
  // whiteboard → eureka) must NOT manufacture a work outcome with no real signal — the same eventEligible
  // gate the autonomous (pickEligibleEvent) and seed (fireSeed) paths enforce. Gated out → fire a neutral
  // non-conclusive reaction instead of the claim set-piece. SOCIAL/WORLD clicks (tea-break) carry no gate.
  if (!eventEligible(event, state)) {
    fireInteractionReaction(store, eventId)
    return false
  }

  const participants = pickParticipants(event, state.agents, state.externalStatus)
  const cancelled = { value: false }
  // Register so startOfficeLife teardown can cancel this event's deferred callbacks.
  interactiveCancellers.add(cancelled)

  state.setActiveEvent(event)
  executeEvent(store, event, participants, cancelled)

  // Deregister once the event's lifetime (plus a margin past the longest deferred
  // handler step) has elapsed — keeps the Set from growing unbounded. The handle is
  // tracked so startOfficeLife teardown can clear it instead of leaving it pending.
  const deregTimer = setTimeout(() => {
    interactiveCancellers.delete(cancelled)
    interactiveDeregTimers.delete(deregTimer)
  }, event.duration + 15000)
  interactiveDeregTimers.add(deregTimer)

  return true
}

export function startOfficeLife(store) {
  // Guard against double-init (React StrictMode, HMR, missed cleanup).
  // Fully tear down ANY prior instance — including its timeInterval/timeEventInterval
  // and its cancellation flag. Previously only dailyTimer/rareTimer were module-level,
  // so a re-init without cleanup leaked the two setInterval loops and left the prior
  // instance's stale event callbacks firing (its `cancelled` flag never flipped).
  if (dailyTimer || rareTimer || timeInterval || timeEventInterval || seedUnsub) {
    if (activeCancelled) activeCancelled.value = true
    clearTimeout(dailyTimer)
    clearTimeout(rareTimer)
    clearInterval(timeInterval)
    clearInterval(timeEventInterval)
    if (seedUnsub) { seedUnsub(); seedUnsub = null }
    dailyTimer = rareTimer = timeInterval = timeEventInterval = null
    // Cancel any in-flight interactive events from the prior instance.
    for (const c of interactiveCancellers) c.value = true
    interactiveCancellers.clear()
    for (const t of interactiveDeregTimers) clearTimeout(t)
    interactiveDeregTimers.clear()
    // Cancelling the prior instance flips its `cancelled` flag, which makes every
    // pending executeEvent cleanup early-return WITHOUT releasing its participants.
    // Release them here so no agent is stranded `inGroupEvent: true` (frozen forever).
    releaseAllGroupEvents(store)
  }

  // Shared cancellation flag — prevents stale event callbacks from firing after stop().
  // Tracked at module level so the next startOfficeLife() can cancel this instance.
  const cancelled = { value: false }
  activeCancelled = cancelled

  // Guard the setTimeout creation itself on `cancelled`. The reschedule call sits at the
  // BOTTOM of each callback (after the event work), so teardown can run between a
  // callback's top-of-body `cancelled` check and its reschedule — clearTimeout(dailyTimer)
  // then clears the OLD (already-fired) handle while the still-running callback proceeds
  // to setTimeout a NEW timer that teardown's clearTimeout never saw. That orphan would
  // fire 1-3 min later (harmless — its own cancelled check stops it — but it is a leaked
  // handle and reassigns the module-level dailyTimer). Checking `cancelled` here makes a
  // post-teardown reschedule a no-op, so no orphan timer is ever created.
  const scheduleDaily = () => {
    if (cancelled.value) return
    dailyTimer = setTimeout(() => {
      if (cancelled.value) return
      const state = store.getState()
      if (!state.isPaused && !state.activeEvent && floorTickAllowed(state)) {
        // Honesty gate: skip ungated work-claim events; draw an eligible SOCIAL/WORLD one instead.
        const event = pickEligibleEvent(eventsData.daily, state)
        if (event) {
          const participants = pickParticipants(event, state.agents, state.externalStatus)
          store.getState().setActiveEvent(event)
          executeEvent(store, event, participants, cancelled)
        }
      }
      scheduleDaily()
    }, randomInterval(DAILY_EVENT_INTERVAL))
  }

  const scheduleRare = () => {
    if (cancelled.value) return
    rareTimer = setTimeout(() => {
      if (cancelled.value) return
      const state = store.getState()
      if (!state.isPaused && !state.activeEvent && floorTickAllowed(state)) {
        const event = pickEligibleEvent(eventsData.rare, state)
        if (event) {
          const participants = pickParticipants(event, state.agents, state.externalStatus)
          store.getState().setActiveEvent(event)
          executeEvent(store, event, participants, cancelled)
        }
      }
      scheduleRare()
    }, randomInterval(RARE_EVENT_INTERVAL))
  }

  scheduleDaily()
  scheduleRare()

  // ─── Real-seeded triggers (living-office Phase 4) ───────────────────────────────
  // The causal real→event link the owner asked for ("沒有驅動任何一件事情"): a REAL signal
  // EDGE fires the matching coordinated event IMMEDIATELY (instead of only making it eligible for
  // the next random tick). Honesty-gated (same eventEligible), mutex'd (skip if activeEvent),
  // per-event cooldown'd (SEED_COOLDOWN_MS — a flapping signal can't spam, R4). Edge-detected on
  // the cheap tracked fields only; high-frequency position churn early-returns.
  const seedCooldown = {}
  let lastSeedAt = 0   // GLOBAL real-seed cooldown — keeps the causal layer RARE (calm-tech). A busy
                       // session fires many signal edges; without a global gate the office would be in
                       // perpetual event-mode (agents stuck gathering). At most one real-seed / window.
  const fireSeed = (state, eventId) => {
    if (state.isPaused || state.activeEvent) return
    const ev = EVENT_BY_ID[eventId]
    if (!ev || !eventEligible(ev, state)) return // signal must really be present (honesty double-check)
    const now = Date.now()
    if (now - lastSeedAt < SEED_COOLDOWN_MS) return                       // GLOBAL gate (anti event-spam)
    if (seedCooldown[eventId] && now - seedCooldown[eventId] < SEED_COOLDOWN_MS * 3) return // per-event
    seedCooldown[eventId] = now
    lastSeedAt = now
    const participants = pickParticipants(ev, state.agents, state.externalStatus)
    store.getState().setActiveEvent(ev)
    executeEvent(store, ev, participants, cancelled)
  }
  seedUnsub = typeof store.subscribe === 'function' ? store.subscribe((state, prev) => {
    if (cancelled.value || !prev) return
    // AVO-106: co-editing pair overlay. PURE derived "show-while-true" state — computed BEFORE the
    // pause/activeEvent guard below (it is NOT a fired event: no mutex, no cooldown, no relocation).
    // Gated only on externalStatus IDENTITY change so it never runs on 60fps position ticks.
    if (state.externalStatus !== prev.externalStatus) {
      const pair = findSharedFilePair(state.externalStatus, Date.now(), PAIR_HUDDLE_WINDOW)
      if (pair) {
        const ext = state.externalStatus
        const file = fileBasename(ext[pair[0]]?.activeFile || ext[pair[1]]?.activeFile || '')
        state.setPairLink({ a: pair[0], b: pair[1], file })
      } else {
        state.setPairLink(null)
      }
    }
    // ── Seeded EVENTS below remain pause/mutex gated (they fire coordinated set-pieces). ──
    if (state.isPaused || state.activeEvent) return
    // mood edge → real block-streak / done-streak coordinated moment (cadence source #2). Mood is a
    // slow-moving distillation of real signals, so these are naturally infrequent.
    if (state.mood !== prev.mood) {
      if (state.mood === 'frustrated' || state.mood === 'stuck') fireSeed(state, 'dev-arch-disagree')
      else if (state.mood === 'smooth') fireSeed(state, 'eureka')
    }
    // real deploy: Ops just transitioned to done (cadence source #1)
    if (state.externalStatus?.ops?.status === 'done' && prev.externalStatus?.ops?.status !== 'done') {
      fireSeed(state, 'deploy-success')
    }
    // NOTE: the former `helpers-rise → standup` real-seed was REMOVED — SubagentStart fires often, and
    // `standup` gathers ALL agents, so it made the office perpetually clustered/frozen in a busy
    // session (regression). SubagentStart liveliness already shows via the helper-huddle sprites.
  }) : null

  // Update time every minute
  timeInterval = setInterval(() => {
    store.getState().updateTime()
  }, TIME_CHECK_INTERVAL)

  // ─── Time-linked events ──────────────────────────────────────────────
  // Check every minute for time-specific behaviors
  let lastTriggeredHour = -1
  timeEventInterval = setInterval(() => {
    if (cancelled.value) return
    const state = store.getState()
    if (state.isPaused || state.activeEvent) return
    const hour = state.hour
    if (hour === lastTriggeredHour) return
    lastTriggeredHour = hour

    const agentIds = Object.keys(state.agents)

    // 12:00-13:00 — Lunch nap: half the agents nap at desk.
    // Participates in the event mutex via setActiveEvent so a concurrent scheduled
    // event cannot re-lock the same agents while the nap is active. Without this,
    // the daily/rare schedulers could fire between the nap's setMultipleAgentGroupEvents
    // and its 45 s release, re-picking the already-locked nappers.
    if (hour === 12) {
      const lunchNapEvent = { id: 'lunch-nap', duration: 45000 }
      store.getState().setActiveEvent(lunchNapEvent)
      const nappers = agentIds.filter((id) => !state.agents[id]?.inGroupEvent && Math.random() < 0.5)
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
            // Pair clearBubble with clearAgentGroupEvent — setMultipleAgentGroupEvents
            // installed an eventBubble('lunch-nap') speech bubble. Every other release
            // path (executeEvent cleanup, releaseAllGroupEvents teardown) clears both;
            // omitting it here strands the "lunch nap" bubble over the agent until the
            // next doSchedule tick happens to overwrite it (up to a full behavior cycle
            // later — longer if the next behavior defers its label until arrival).
            s.clearBubble(id)
          }
        })
        s.clearActiveEvent()
      }, 45000)
    }

    // 14:00-14:30 — Post-lunch drowsiness: everyone gets sleepy expression.
    // Skip agents currently locked in a group event: officeLife owns behavior/
    // expression/bubble during a group event, and setAgentBehavior does NOT honour
    // inGroupEvent — applying 'tired' here would corrupt an in-progress meeting/
    // standup animation that straddles the 14:00 minute boundary (every other
    // behavior-touching path — applyExternalStatus, clearExternalStatus,
    // onWaypointReached, doSchedule, watchdog — guards on inGroupEvent for exactly
    // this reason). Snapshot the precise set made drowsy so the 30s release reverts
    // ONLY those agents — never an agent that organically picked a 'tired'
    // expression via getNextBehavior, and never one that has since joined a group
    // event.
    if (hour === 14) {
      const drowsyIds = []
      agentIds.forEach((id) => {
        const s = store.getState()
        if (s.agents[id]?.inGroupEvent) return
        s.setAgentBehavior(id, s.agents[id]?.behavior || 'typing', 'tired', null)
        drowsyIds.push(id)
      })
      setTimeout(() => {
        if (cancelled.value) return
        drowsyIds.forEach((id) => {
          const s = store.getState()
          const a = s.agents[id]
          // Only revert agents this handler made drowsy that are still drowsy and
          // not now in a group event — never clobber a group event or an organic 'tired'.
          if (a && !a.inGroupEvent && a.expression === 'tired') {
            s.setAgentBehavior(id, a.behavior, 'normal', null)
          }
        })
      }, 30000)
    }

    // 10:00 or 15:00 — Auto tea break
    if (hour === 10 || hour === 15) {
      const teaEvent = EVENT_BY_ID['tea-break']
      if (teaEvent) {
        const participants = pickParticipants(teaEvent, state.agents, state.externalStatus)
        store.getState().setActiveEvent(teaEvent)
        executeEvent(store, teaEvent, participants, cancelled)
      }
    }

    // Friday 15:00+ — Social boost (handled via behavior weights already, but trigger a group-meeting)
    const day = new Date().getDay()
    if (day === 5 && hour === 15) {
      const meetEvent = EVENT_BY_ID['group-meeting']
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
    if (seedUnsub) { seedUnsub(); seedUnsub = null }
    dailyTimer = rareTimer = timeInterval = timeEventInterval = null
    // Cancel any in-flight interactive events so their deferred callbacks don't
    // fire against a torn-down store.
    for (const c of interactiveCancellers) c.value = true
    interactiveCancellers.clear()
    for (const t of interactiveDeregTimers) clearTimeout(t)
    interactiveDeregTimers.clear()
    // Flipping `cancelled` makes every pending executeEvent cleanup early-return
    // without releasing its participants. Release them directly so an unmount mid-event
    // never strands an agent `inGroupEvent: true` (doSchedule + watchdog both skip
    // in-group agents — the agent would freeze permanently).
    releaseAllGroupEvents(store)
    // Only release the module-level flag if it still points at THIS instance —
    // a newer startOfficeLife() may have already replaced it.
    if (activeCancelled === cancelled) activeCancelled = null
  }
}
