import { create } from 'zustand'
import characters from '../config/characters.json'
import { HOME_POSITIONS } from './movementSystem'
import { randomBubble } from '../i18n'
import { generateContextBubble } from './contextBubble'
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
  isPaused: typeof window !== 'undefined' && localStorage.getItem('office-paused') === 'true',
  showWorkflow: false,

  setAgentBehavior: (id, behavior, expression, bubble) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], behavior, expression: expression || s.agents[id].expression, bubble: bubble || null },
        },
      }
    }),

  // Group event: lock agent into event behavior + set movement target
  setAgentGroupEvent: (id, { behavior, expression, bubble, groupTarget }) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: {
            ...s.agents[id],
            behavior, expression, bubble: bubble || null,
            inGroupEvent: true,
            groupTarget: groupTarget || null,
          },
        },
      }
    }),

  clearAgentGroupEvent: (id) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], inGroupEvent: false, groupTarget: null },
        },
      }
    }),

  clearBubble: (id) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: { ...s.agents, [id]: { ...s.agents[id], bubble: null } },
      }
    }),

  setAgentTarget: (id, targetPosition, facing) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], targetPosition, isMoving: true, facing: facing || s.agents[id].facing },
        },
      }
    }),

  setAgentArrived: (id) =>
    set((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], isMoving: false, position: { ...s.agents[id].targetPosition } },
        },
      }
    }),

  incrementDeskItem: (id, item) =>
    set((s) => {
      const agent = s.agents[id]
      if (!agent) return s
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
  togglePause: () => set((s) => {
    const next = !s.isPaused
    if (typeof window !== 'undefined') localStorage.setItem('office-paused', String(next))
    return { isPaused: next }
  }),
  triggerWorkflow: () => set({ showWorkflow: true }),
  endWorkflow: () => set({ showWorkflow: false }),

  // ─── External status integration ───
  externalStatus: {},          // { [agentId]: { status, task, label, expiresAt } }
  statusSource: 'organic',     // 'organic' | 'external' | 'fallback'
  activeWorkflow: null,        // workflow name for banner display

  applyExternalStatus: (updates) =>
    set((s) => {
      const now = Date.now()
      const ext = { ...s.externalStatus }
      const agents = { ...s.agents }
      for (const u of updates) {
        if (!agents[u.agentId]) continue
        ext[u.agentId] = {
          status: u.status,
          task: u.task,
          label: u.label,
          hint: u.hint || null,
          expiresAt: u.status === 'done' ? now + 15000 : now + 120000,
        }
        // Immediately set behavior + expression to match work status
        const behaviorMap = {
          working: { behavior: u.task === 'Bash' ? 'typing' : u.task === 'Read' ? 'reading-screen' : u.task === 'Grep' || u.task === 'Glob' ? 'research' : 'typing', expression: 'focused' },
          blocked: { behavior: 'scratch-head', expression: 'confused' },
          done:    { behavior: 'thumbs-up', expression: 'happy' },
        }
        const bm = behaviorMap[u.status] || {}
        agents[u.agentId] = {
          ...agents[u.agentId],
          status: u.status,
          behavior: bm.behavior || agents[u.agentId].behavior,
          expression: bm.expression || agents[u.agentId].expression,
        }
        // Context-aware bubble > status pool fallback
        const bubble = generateContextBubble(u.agentId, u, ext)
          || randomBubble(u.status === 'blocked' ? 'blocked-status' : u.status === 'done' ? 'done-status' : 'working-status')
        if (bubble) agents[u.agentId] = { ...agents[u.agentId], bubble }
      }
      return { externalStatus: ext, agents }
    }),

  clearExternalStatus: (agentId) =>
    set((s) => {
      if (agentId) {
        const ext = { ...s.externalStatus }
        delete ext[agentId]
        const agents = { ...s.agents }
        if (agents[agentId]) agents[agentId] = { ...agents[agentId], status: 'idle' }
        return { externalStatus: ext, agents }
      }
      // Clear all
      const agents = { ...s.agents }
      for (const id of Object.keys(s.externalStatus)) {
        if (agents[id]) agents[id] = { ...agents[id], status: 'idle' }
      }
      return { externalStatus: {}, agents, statusSource: 'organic', activeWorkflow: null }
    }),

  // ─── Mood system ───
  mood: 'normal',                // normal | rushing | frustrated | stuck | smooth | intense | idle
  setMood: (mood) => set({ mood }),

  setStatusSource: (source) => set({ statusSource: source }),
  setActiveWorkflow: (name) => set({ activeWorkflow: name }),

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
