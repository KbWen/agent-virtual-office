/**
 * fix/dev-allowed-hosts — parity unit tests for the shared OFFICE_ALLOWED_HOSTS parser.
 *
 * `src/utils/hostAllowlist.mjs` extracts the pure env-parsing step that `server.mjs`'s
 * `isAllowedHost` (production Host-header allowlist, PR #246) previously computed inline as
 * `ALLOWED_HOSTS_ENV`, so `vite.config.mjs` (the dev server) can map the SAME env var into
 * Vite's own `server.allowedHosts` without duplicating the parsing rules. These tests pin the
 * exact behavior `server.mjs` already relied on (port stripping, IPv6-bracket stripping,
 * leading-dot suffix survival, lowercasing, blank/bare-'.' filtering) so the extraction cannot
 * silently change production behavior.
 */

import { describe, it, expect } from 'vitest'
import { hostnameFromHeader, parseAllowedHostsEnv } from '../src/utils/hostAllowlist.mjs'

describe('hostnameFromHeader', () => {
  it('returns null for missing/empty header', () => {
    expect(hostnameFromHeader(undefined)).toBeNull()
    expect(hostnameFromHeader('')).toBeNull()
    expect(hostnameFromHeader(null)).toBeNull()
  })

  it('passes through a bare hostname, lowercased', () => {
    expect(hostnameFromHeader('MyPC.Local')).toBe('mypc.local')
  })

  it('strips a trailing :port', () => {
    expect(hostnameFromHeader('mypc.local:5174')).toBe('mypc.local')
  })

  it('strips brackets from a bracketed IPv6 literal with a port', () => {
    expect(hostnameFromHeader('[::1]:5174')).toBe('::1')
  })

  it('strips brackets from a bracketed IPv6 literal with no port', () => {
    expect(hostnameFromHeader('[::1]')).toBe('::1')
  })

  it('preserves a leading-dot suffix entry (no colon to strip)', () => {
    expect(hostnameFromHeader('.example.com')).toBe('.example.com')
  })

  it('does not mistake a non-numeric trailing segment for a port', () => {
    // A hostname containing a colon but not port-shaped (RFC-invalid, but must not corrupt
    // the value by chopping off a non-numeric suffix).
    expect(hostnameFromHeader('weird:host')).toBe('weird:host')
  })
})

describe('parseAllowedHostsEnv', () => {
  it('returns an empty array for unset/empty env', () => {
    expect(parseAllowedHostsEnv(undefined)).toEqual([])
    expect(parseAllowedHostsEnv('')).toEqual([])
  })

  it('splits comma-separated entries and trims whitespace', () => {
    expect(parseAllowedHostsEnv(' mypc.local , office.example ')).toEqual(['mypc.local', 'office.example'])
  })

  it('strips :port from each entry identically to a Host header', () => {
    expect(parseAllowedHostsEnv('mypc.local:5174')).toEqual(['mypc.local'])
  })

  it('preserves a leading-dot subdomain-wildcard entry', () => {
    expect(parseAllowedHostsEnv('.example.com')).toEqual(['.example.com'])
  })

  it('lowercases entries', () => {
    expect(parseAllowedHostsEnv('MyPC.Local')).toEqual(['mypc.local'])
  })

  it('drops blank entries from stray/trailing commas', () => {
    expect(parseAllowedHostsEnv('mypc.local,,office.example,')).toEqual(['mypc.local', 'office.example'])
  })

  it('drops a bare "." entry (review round 3, LOW-5 regression guard)', () => {
    expect(parseAllowedHostsEnv('mypc.local,.,office.example')).toEqual(['mypc.local', 'office.example'])
  })
})
