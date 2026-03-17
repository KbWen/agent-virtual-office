import { create } from 'zustand'
import characters from '../config/characters.json'
import { HOME_POSITIONS } from './movementSystem'
import { detectProjectMode } from './platformDetect'

const detectMode = () => {
  if (typeof window === 'undefined') return 'agentcortex'
  return detectProjectMode()
}

const initAgents = (mode) => {
  const roster = characters[mode] || characters.agentcortex
  const agents = {}
  for (const c of roster) {
    const home = HOME_POSITIONS[c.id] || { x: 300, y: 250 }
    agents[c.id] = {
      ...c,
      behavior: 'idle',
      expression: 'normal',
      bubble: null,
      status: 'idle',
      weightOverride: null,
      deskItemCount: { coffee: 0, sticky: 0, books: 0 },
      position: { ...home },
      targetPosition: { ...home },
      isMoving: false,
      facing: 'down',
      inGroupEvent: false,
      groupTarget: null,
    }
  }
  return agents
}

export const useOfficeStore = create((set) => ({
  mode: detectMode(),
  agents: initAgents(detectMode()),
  hour: new Date().getHours(),
  minute: new Date().getMinutes(),
  activeEvent: null,
  isPaused: false,
  showWorkflow: false,

  setAgentBehavior: (id, behavior, expression, bubble) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [id]: { ...s.agents[id], behavior, expression: expression || s.agents[id].expression, bubble: bubble || null },
      },
    })),

  // Group event: lock agent into event behavior + set movement target
  setAgentGroupEvent: (id, { behavior, expression, bubble, groupTarget }) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [id]: {
          ...s.agents[id],
          behavior, expression, bubble: bubble || null,
          inGroupEvent: true,
          groupTarget: groupTarget || null,
        },
      },
    })),

  clearAgentGroupEvent: (id) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [id]: { ...s.agents[id], inGroupEvent: false, groupTarget: null },
      },
    })),

  clearBubble: (id) =>
    set((s) => ({
      agents: { ...s.agents, [id]: { ...s.agents[id], bubble: null } },
    })),

  setAgentTarget: (id, targetPosition, facing) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [id]: { ...s.agents[id], targetPosition, isMoving: true, facing: facing || s.agents[id].facing },
      },
    })),

  setAgentArrived: (id) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [id]: { ...s.agents[id], isMoving: false, position: { ...s.agents[id].targetPosition } },
      },
    })),

  incrementDeskItem: (id, item) =>
    set((s) => {
      const agent = s.agents[id]
      const count = { ...agent.deskItemCount }
      count[item] = ((count[item] || 0) + 1) % 6
      return { agents: { ...s.agents, [id]: { ...agent, deskItemCount: count } } }
    }),

  updateTime: () => {
    const now = new Date()
    set({ hour: now.getHours(), minute: now.getMinutes() })
  },

  setActiveEvent: (event) => set({ activeEvent: event }),
  clearActiveEvent: () => set({ activeEvent: null }),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  triggerWorkflow: () => set({ showWorkflow: true }),
  endWorkflow: () => set({ showWorkflow: false }),

  // Handoff animation state
  handoffs: [],
  addHandoff: (from, to) =>
    set((s) => ({
      handoffs: [...s.handoffs, { id: Date.now(), from, to, startTime: Date.now() }],
    })),
  removeHandoff: (id) =>
    set((s) => ({
      handoffs: s.handoffs.filter(h => h.id !== id),
    })),
}))
