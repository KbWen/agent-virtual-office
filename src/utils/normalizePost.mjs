/**
 * AVO-146 (#122) — Server-runtime entry for the office-status transport contract.
 *
 * Before #122 this file INLINED a second copy of every constant + sanitizer + the normalizePost
 * logic (drift-guarded against the canonical `.js` sources). That mirror is ELIMINATED: this is
 * now a thin re-export of the single node-safe source of truth, `src/utils/statusContract.mjs`.
 *
 * server.mjs imports THIS path (`./src/utils/normalizePost.mjs`) unchanged. Both files are plain
 * `.mjs`, so bare Node loads them at runtime without Vite/transpile (the reason the mirror
 * existed in the first place — `package.json` "type":"commonjs" makes the ESM `.js` sources
 * unloadable by bare Node).
 */
export {
  normalizeAgentStatusUpdates, normalizePost, nextSeq, sanitizeAgentId,
  VALID_ROLES, VALID_STATUSES, VALID_MOODS, MAX_MOOD_DURATION,
  BLOCKED_REASONS, AGENT_CARRY_FIELDS, FIELD_SANITIZERS, MAX_AGENT_ID_LENGTH, sanitizeCarryFields,
} from './statusContract.mjs'
