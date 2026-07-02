import { describe, expect, it } from 'vitest'
import { activityFeedMessage } from '../src/utils/activityFeedLabel.js'

const labels = {
  'activityFeed.agentStatusUpdated': 'Agent checked in',
  'activityFeed.sessionLogUpdated': 'Session log updated',
  'activityFeed.temporaryFileUpdated': 'Draft saved quietly',
  'activityFeed.workNoteUpdated': 'Work note updated',
  'activityFeed.noteUpdated': 'Note updated',
  'activityFeed.statusSnapshotUpdated': 'Status snapshot updated',
}
const t = (key, fallback) => labels[key] || fallback

describe('activityFeedMessage', () => {
  it('turns agent status jsonl file names into product language and keeps raw detail as title', () => {
    const out = activityFeedMessage({ type: 'status', message: '✏️ agent-a151841dbfd625d00.jsonl' }, { t })
    expect(out).toEqual({
      text: 'Agent checked in',
      title: '✏️ agent-a151841dbfd625d00.jsonl',
    })
  })

  it('turns temporary implementation files into a human-readable update', () => {
    const out = activityFeedMessage({ type: 'status', message: 'project_multilingual_rollout.md.tmp.36248.639e6545e73e' }, { t })
    expect(out.text).toBe('Draft saved quietly')
    expect(out.title).toContain('project_multilingual_rollout')
  })

  it('turns work notes into readable product copy while preserving the raw note name', () => {
    const out = activityFeedMessage({ type: 'status', message: '✏️ codex-product-action-strip.md' }, { t })
    expect(out).toEqual({
      text: 'Work note updated',
      title: '✏️ codex-product-action-strip.md',
    })
  })

  it('turns hook capture artifacts into a status snapshot message', () => {
    const out = activityFeedMessage({ type: 'status', message: 'office-hook-capture' }, { t })
    expect(out).toEqual({
      text: 'Status snapshot updated',
      title: 'office-hook-capture',
    })
  })

  it('keeps ordinary messages visible as-is', () => {
    expect(activityFeedMessage({ type: 'status', message: 'blocked' }, { t })).toEqual({
      text: 'blocked',
      title: null,
    })
    expect(activityFeedMessage({ type: 'status', message: 'status' }, { t })).toEqual({
      text: 'status',
      title: null,
    })
  })

  it('does not mistake ordinary status notes for hook snapshot artifacts', () => {
    expect(activityFeedMessage({ type: 'status', message: 'feature-status-report.md' }, { t })).toEqual({
      text: 'Note updated',
      title: 'feature-status-report.md',
    })
  })

  it('localizes event names through the eventName resolver', () => {
    const out = activityFeedMessage({ type: 'event', message: 'deploy-success' }, {
      t,
      eventName: (id) => ({ 'deploy-success': 'Deploy Success' }[id]),
    })
    expect(out).toEqual({ text: 'Deploy Success', title: null })
  })
})
