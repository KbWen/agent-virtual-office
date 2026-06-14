/**
 * AVO-146 (#122) — thin re-export of the single-source transport contract.
 *
 * `normalizePost` + the enum constants are defined ONCE in `src/utils/statusContract.mjs`
 * (a node-safe `.mjs` so server.mjs can import it at bare-Node runtime). This module preserves
 * the canonical `src/utils/normalizePost.js` import path for the app/test side. The former
 * byte-identical second copy of the logic (duplicated here vs the .mjs) is eliminated — there
 * is now exactly one implementation.
 */
export { normalizePost, VALID_ROLES, VALID_STATUSES, VALID_MOODS, MAX_MOOD_DURATION } from './statusContract.mjs'
