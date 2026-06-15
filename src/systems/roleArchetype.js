/**
 * roleArchetype.js — AC-S2a archetype mapping
 *
 * Maps every VALID_ROLE (store.js) to one of 5 archetypes.
 * Used by tests (attribution fixture) and future banter/murmur routing.
 *
 * Archetypes:
 *   Sprinter   — dev, ops     fast/punchy; ops = gruffer register
 *   Skeptic    — qa, gate     dry/suspicious; gate = formal/procedural
 *   Sage       — arch, res    slow/abstract; res = curious sub-register
 *   Coordinator — pm          warm/brisk/plural
 *   Aesthete   — designer     lyrical/visual
 */

export const ROLE_ARCHETYPE = {
  dev:      'Sprinter',
  ops:      'Sprinter',
  qa:       'Skeptic',
  gate:     'Skeptic',
  arch:     'Sage',
  res:      'Sage',
  pm:       'Coordinator',
  designer: 'Aesthete',
}

export const ARCHETYPES = ['Sprinter', 'Skeptic', 'Sage', 'Coordinator', 'Aesthete']
