/**
 * hostAllowlist.mjs — shared `OFFICE_ALLOWED_HOSTS` env parsing.
 *
 * Extracted from `server.mjs`'s `isAllowedHost` (F3, 2026-09-26 hardening wave, PR #246) so the
 * SAME env var can also govern the Vite dev server's `server.allowedHosts` (`vite.config.mjs`)
 * without duplicating the parsing rules. This module holds ONLY the pure parsing step, not the
 * full per-request matcher — `server.mjs` keeps its own `isAllowedHost` (which also needs
 * `net.isIP`/`SERVER_IPS`, not needed here since both Vite's own matcher and this env parser
 * already special-case IP literals independently). See `server.mjs`'s comment above its
 * `ALLOWED_HOSTS_ENV` for the full documented divergence from Vite's native `allowedHosts`
 * semantics (this module is the one piece the two transports DO share).
 */

/**
 * Host header may be `host`, `host:port`, or `[v6-literal]:port`. Strip the port and any
 * IPv6 brackets so the remainder can be compared as a bare hostname/IP. Returns null for a
 * missing/empty header (also used to normalize a single OFFICE_ALLOWED_HOSTS entry, where a
 * leading-dot suffix entry has no colon to strip and survives unchanged other than
 * lowercasing).
 */
export function hostnameFromHeader(hostHeader) {
  if (typeof hostHeader !== 'string' || !hostHeader) return null
  const bracketed = hostHeader.match(/^\[([^\]]+)\](?::\d+)?$/)
  if (bracketed) return bracketed[1].toLowerCase()
  const idx = hostHeader.lastIndexOf(':')
  if (idx !== -1 && /^\d+$/.test(hostHeader.slice(idx + 1))) return hostHeader.slice(0, idx).toLowerCase()
  return hostHeader.toLowerCase()
}

/**
 * Parse OFFICE_ALLOWED_HOSTS (comma-separated) into a normalized array of lowercase entries.
 * A `.suffix` entry (leading dot) is preserved so callers can match it as a subdomain
 * wildcard; a trailing `:port` is stripped from every entry (`mypc.local:5174` behaves the
 * same as `mypc.local`) since the port a request arrives on is deployment-specific and
 * shouldn't have to be duplicated into the allowlist. Blank and bare '.' entries are dropped
 * (review round 3, LOW-5: a bare '.' would make `host.endsWith('.')` true for EVERY
 * trailing-dot FQDN, silently re-opening rebinding via `http://attacker.com.:<port>`).
 */
export function parseAllowedHostsEnv(envValue) {
  return (envValue || '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .map(entry => hostnameFromHeader(entry) ?? entry.toLowerCase())
    .filter(entry => entry && entry !== '.')
}
