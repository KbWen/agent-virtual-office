import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_OPACITY_FLOOR,
  activityFeedEntries,
  activityOpacity,
  buildActivityFeedEntryView,
  buildActivityFeedViewModel,
} from '../src/systems/activityFeedModel.mjs'

describe('activityFeedModel', () => {
  const now = 1_000_000

  it('derives recent/fresh/opacity/tone for status rows without UI dependencies', () => {
    const view = buildActivityFeedEntryView(
      { id: 1, type: 'status', status: 'blocked', agentId: 'qa', timestamp: now - 5_000, message: 'agent-qa.jsonl' },
      {
        now,
        messageForEntry: () => ({ text: 'Agent checked in', title: 'agent-qa.jsonl' }),
        nameForId: (id) => id.toUpperCase(),
        colorForId: (id) => ({ qa: '#456' }[id]),
      },
    )

    expect(view).toMatchObject({
      id: 1,
      kind: 'status',
      iconKey: 'status',
      tone: 'danger',
      isFresh: true,
      isRecent: true,
      agentName: 'QA',
      agentColor: '#456',
      accentColor: '#456',
      message: { text: 'Agent checked in', title: 'agent-qa.jsonl' },
    })
    expect(view.opacity).toBeGreaterThan(ACTIVITY_OPACITY_FLOOR)
  })

  it('uses success/neutral tones and floors old-row opacity', () => {
    expect(buildActivityFeedEntryView({ type: 'status', status: 'done', timestamp: now }, { now }).tone).toBe('success')
    expect(buildActivityFeedEntryView({ type: 'status', status: 'working', timestamp: now }, { now }).tone).toBe('neutral')
    expect(activityOpacity(60 * 60 * 1000)).toBe(ACTIVITY_OPACITY_FLOOR)
  })

  it('scopes feed entries to a focused agent and caps output', () => {
    const entries = [
      { id: 1, agentId: 'dev', timestamp: now },
      { id: 2, from: 'qa', to: 'dev', timestamp: now },
      { id: 3, agentId: 'qa', timestamp: now },
    ]

    expect(activityFeedEntries(entries, { focusedId: 'dev', max: 5 }).map((entry) => entry.id)).toEqual([1, 2])
    expect(activityFeedEntries(entries, { max: 2 }).map((entry) => entry.id)).toEqual([1, 2])
  })

  it('builds a feed view-model with unread count and renderer-ready handoff names', () => {
    const view = buildActivityFeedViewModel([
      { id: 1, type: 'handoff', from: 'dev', to: 'qa', timestamp: now - 1_000 },
      { id: 2, type: 'event', message: 'deploy-success', timestamp: now - 40_000 },
    ], {
      now,
      nameForId: (id) => id.toUpperCase(),
      colorForId: (id) => ({ dev: '#123' }[id]),
      messageForEntry: (entry) => ({ text: entry.message || 'handoff', title: null }),
      reducedMotion: true,
    })

    expect(view.count).toBe(2)
    expect(view.unreadCount).toBe(1)
    expect(view.entries[0]).toMatchObject({
      kind: 'handoff',
      fromName: 'DEV',
      toName: 'QA',
      accentColor: '#123',
      animateIn: false,
    })
    expect(view.entries[1]).toMatchObject({
      kind: 'event',
      iconKey: 'event',
      tone: 'neutral',
    })
  })
})
