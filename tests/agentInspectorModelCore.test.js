import { describe, expect, it } from 'vitest'

import {
  inspectorAnchorPosition,
  inspectorPanelLayout,
  recentAgentActivities,
  truncateText,
} from '../src/systems/agentInspectorModel.mjs'
import { inspectorPanelLayout as inspectorPanelLayoutFromCore } from '../src/systems/statusCore.mjs'

describe('agentInspectorModel — portable inspector view helpers', () => {
  it('keeps Unicode truncation stable for multi-codepoint text', () => {
    expect(truncateText('abc', 3)).toBe('abc')
    expect(truncateText('abcd', 3)).toBe('abc…')
    expect(truncateText('修好🧪流程', 3)).toBe('修好🧪…')
  })

  it('filters recent activity rows for the selected agent only', () => {
    const rows = recentAgentActivities([
      { id: 1, agentId: 'dev', message: 'newest' },
      { id: 2, agentId: 'qa', message: 'other' },
      { id: 3, agentId: 'dev', message: 'middle' },
      { id: 4, agentId: 'dev', message: 'oldest' },
    ], 'dev', 2)

    expect(rows.map((row) => row.id)).toEqual([1, 3])
  })

  it('anchors moving inspectors to targetPosition and falls back safely', () => {
    expect(inspectorAnchorPosition({
      isMoving: true,
      position: { x: 10, y: 20 },
      targetPosition: { x: 30, y: 40 },
    })).toEqual({ x: 30, y: 40 })

    expect(inspectorAnchorPosition({
      isMoving: false,
      position: { x: 10, y: 20 },
      targetPosition: { x: 30, y: 40 },
    })).toEqual({ x: 10, y: 20 })

    expect(inspectorAnchorPosition(null)).toEqual({ x: 300, y: 250 })
  })

  it('matches the legacy panel geometry for task, detail, and activity rows', () => {
    const layout = inspectorPanelLayout({
      hasTask: true,
      detailCount: 3,
      activityCount: 5,
      sceneScale: 1,
      position: { x: 400, y: 300 },
    })

    expect(layout).toMatchObject({
      detailsStartY: 94,
      activityDividerY: 130,
      activityStartY: 142,
      activityRows: 3,
      contentBottomY: 168,
      width: 200,
      height: 184,
      scale: 1.6,
      scaledWidth: 320,
      scaledHeight: 294.40000000000003,
      x: 240,
      y: 10,
    })
  })

  it('clamps scaled panels inside the 800x560 viewBox', () => {
    const layout = inspectorPanelLayout({
      hasTask: false,
      detailCount: 0,
      activityCount: 0,
      sceneScale: 0.4,
      position: { x: 5, y: 5 },
    })

    expect(layout.scale).toBe(3)
    expect(layout.x).toBe(10)
    expect(layout.y).toBe(10)
    expect(layout.x + layout.scaledWidth).toBeLessThanOrEqual(790)
    expect(layout.y + layout.scaledHeight).toBeLessThanOrEqual(550)
  })

  it('is exported through the aggregate status-core path', () => {
    expect(inspectorPanelLayoutFromCore({ activityCount: 4 }).activityRows).toBe(3)
  })
})
