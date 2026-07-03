import { describe, expect, it } from 'vitest'
import eventsData from '../src/config/officeEvents.json'
import {
  EVENT_CADENCE,
  EVENT_CATEGORY,
  EVENT_CATEGORY_BY_ID,
  INTERACTIVE_REACTION,
  PARTICIPANT_SELECTOR,
  buildEventCatalogEntry,
  buildEventCatalogViewModel,
  eventById,
  eventCategory,
  eventHasExplicitCategory,
  flattenEventCatalog,
  interactiveReactionForEvent,
  participantSelectorKind,
  seedSourcesForEvent,
  validateEventCatalogPortability,
} from '../src/systems/eventCatalogModel.mjs'
import { WORK_CLAIM_GATE_IDS } from '../src/systems/eventGateModel.mjs'
import { MOOD_SEED_EVENT, OPS_DONE_SEED_EVENT } from '../src/systems/eventSeedModel.mjs'

describe('eventCatalogModel public API', () => {
  it('flattens the current office event catalog while preserving cadence', () => {
    const rows = flattenEventCatalog(eventsData)

    expect(rows).toHaveLength(eventsData.daily.length + eventsData.rare.length)
    expect(rows.find((event) => event.id === 'tea-break')?.cadence).toBe(EVENT_CADENCE.DAILY)
    expect(rows.find((event) => event.id === 'dog-visit')?.cadence).toBe(EVENT_CADENCE.RARE)
    expect(eventById(eventsData)['deploy-success'].name).toBe('部署成功')
  })

  it('classifies work-claim, world, and social events explicitly', () => {
    expect(WORK_CLAIM_GATE_IDS.every((id) => eventCategory(id) === EVENT_CATEGORY.WORK_CLAIM)).toBe(true)
    expect(eventCategory('dog-visit')).toBe(EVENT_CATEGORY.WORLD)
    expect(eventCategory('food-delivery')).toBe(EVENT_CATEGORY.WORLD)
    expect(eventCategory('tea-break')).toBe(EVENT_CATEGORY.SOCIAL)
    expect(eventHasExplicitCategory('tea-break')).toBe(false)
    expect(eventHasExplicitCategory('deploy-success')).toBe(true)
    expect(Object.keys(EVENT_CATEGORY_BY_ID).sort()).toEqual([
      'ac-broken',
      'boss-visit',
      'coffee-spill',
      'deploy-success',
      'dev-arch-disagree',
      'dog-visit',
      'eureka',
      'food-delivery',
      'ops-dev-deploy-check',
      'review-debate',
    ])
  })

  it('normalizes participant selector shapes for alternate renderers', () => {
    expect(participantSelectorKind('all')).toBe(PARTICIPANT_SELECTOR.ALL)
    expect(participantSelectorKind('random-2-3')).toBe(PARTICIPANT_SELECTOR.RANDOM_2_3)
    expect(participantSelectorKind('random-1-neighbor')).toBe(PARTICIPANT_SELECTOR.RANDOM_1_NEIGHBOR)
    expect(participantSelectorKind(['dev', 'qa'])).toBe(PARTICIPANT_SELECTOR.ROLE_ARRAY)
    expect(participantSelectorKind('future-selector')).toBe(PARTICIPANT_SELECTOR.UNKNOWN)
  })

  it('exposes current interactive idle reactions and seed sources', () => {
    expect(INTERACTIVE_REACTION).toEqual({
      'deploy-success': { reactorId: 'ops', bubbleKey: 'deploy-idle' },
      eureka: { reactorId: 'arch', bubbleKey: 'eureka-idle' },
    })
    expect(interactiveReactionForEvent('deploy-success')).toEqual({ reactorId: 'ops', bubbleKey: 'deploy-idle' })
    expect(interactiveReactionForEvent('tea-break')).toBeNull()
    expect(seedSourcesForEvent('eureka')).toEqual([{ source: 'mood-edge', value: 'smooth' }])
    expect(seedSourcesForEvent('dev-arch-disagree')).toEqual([
      { source: 'mood-edge', value: 'frustrated' },
      { source: 'mood-edge', value: 'stuck' },
    ])
    expect(seedSourcesForEvent(OPS_DONE_SEED_EVENT)).toEqual([{ source: 'ops-done-edge', value: 'done' }])
    expect(Object.values(MOOD_SEED_EVENT)).toContain('eureka')
  })

  it('builds compact catalog entries and grouped view-models', () => {
    const entry = buildEventCatalogEntry(eventById(eventsData)['review-debate'])
    expect(entry).toMatchObject({
      id: 'review-debate',
      cadence: EVENT_CADENCE.DAILY,
      category: EVENT_CATEGORY.WORK_CLAIM,
      workClaim: true,
      participantSelector: PARTICIPANT_SELECTOR.ROLE_ARRAY,
      participants: ['dev', 'qa'],
      durationMs: 18000,
    })

    const view = buildEventCatalogViewModel(eventsData)
    expect(view.byCadence.daily).toContain('tea-break')
    expect(view.byCadence.rare).toContain('boss-visit')
    expect(view.byCategory[EVENT_CATEGORY.WORK_CLAIM].sort()).toEqual([...WORK_CLAIM_GATE_IDS].sort())
    expect(view.workClaimIds.sort()).toEqual([...WORK_CLAIM_GATE_IDS].sort())
    expect(view.interactiveIds.sort()).toEqual(['deploy-success', 'eureka'])
  })

  it('validates current catalog portability and reports drift explicitly', () => {
    expect(validateEventCatalogPortability(eventsData)).toEqual({
      valid: true,
      missingWorkClaimEvents: [],
      missingInteractiveEvents: [],
      unknownParticipantEvents: [],
      uncategorizedEvents: [],
      invalidRoleEvents: [],
      duplicateIds: [],
    })

    const broken = {
      daily: [
        { id: 'eureka', participants: 'future-selector', duration: 1000 },
        { id: 'eureka', participants: 'all', duration: 1000 },
      ],
      rare: [],
    }
    expect(validateEventCatalogPortability(broken)).toMatchObject({
      valid: false,
      missingWorkClaimEvents: ['deploy-success', 'ops-dev-deploy-check', 'dev-arch-disagree', 'review-debate'],
      missingInteractiveEvents: ['deploy-success'],
      unknownParticipantEvents: ['eureka'],
      uncategorizedEvents: [],
      invalidRoleEvents: [],
      duplicateIds: ['eureka'],
    })
  })

  it('can validate stricter external catalogs for explicit categories and allowed role arrays', () => {
    const external = {
      daily: [
        { id: 'tea-break', participants: ['dev', 'bad-role'], duration: 1000 },
        { id: 'deploy-success', participants: ['ops'], duration: 1000 },
        { id: 'eureka', participants: ['arch'], duration: 1000 },
        { id: 'ops-dev-deploy-check', participants: ['ops', 'dev'], duration: 1000 },
        { id: 'dev-arch-disagree', participants: ['dev', 'arch'], duration: 1000 },
        { id: 'review-debate', participants: ['dev', 'qa'], duration: 1000 },
      ],
      rare: [],
    }

    expect(validateEventCatalogPortability(external, {
      allowedRoles: ['dev', 'qa', 'ops', 'arch'],
      requireExplicitCategory: true,
    })).toMatchObject({
      valid: false,
      uncategorizedEvents: ['tea-break'],
      invalidRoleEvents: ['tea-break'],
    })
  })
})
