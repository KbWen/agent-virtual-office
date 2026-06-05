import { describe, it, expect } from 'vitest'
import {
  getOfficeApiConfig,
  getAllowedOriginHeader,
  isAllowedOrigin,
  isAuthorizedOfficeRequest,
} from '../vite.config.js'

// ---------------------------------------------------------------------------
// Pathname guard (reproduces the vite middleware routing logic inline)
// After connect strips the /api/status mount prefix, req.url values are:
//   plain GET            → '/'
//   GET with query       → '/?t=1' or '/?foo=bar'
//   sub-path /stream     → '/stream'
// The guard MUST route '/' and '/?...' to this handler and sub-paths to next().
// ---------------------------------------------------------------------------
function shouldHandleLocally(reqUrl) {
  const pathname = reqUrl ? reqUrl.split('?')[0] : '/'
  return pathname === '/'
}

describe('middleware pathname routing guard (AVO /api/status?query fix)', () => {
  it('handles plain GET /', () => {
    expect(shouldHandleLocally('/')).toBe(true)
  })

  it('handles GET with query string /?t=1 (was broken — returned HTML before fix)', () => {
    expect(shouldHandleLocally('/?t=1')).toBe(true)
  })

  it('handles GET with multiple query params /?foo=bar&baz=1', () => {
    expect(shouldHandleLocally('/?foo=bar&baz=1')).toBe(true)
  })

  it('passes /stream sub-path to next() handler', () => {
    expect(shouldHandleLocally('/stream')).toBe(false)
  })

  it('passes /stream?param sub-path with query to next()', () => {
    expect(shouldHandleLocally('/stream?heartbeat=1')).toBe(false)
  })

  it('handles null/undefined req.url gracefully', () => {
    expect(shouldHandleLocally(null)).toBe(true)
    expect(shouldHandleLocally(undefined)).toBe(true)
    expect(shouldHandleLocally('')).toBe(true)
  })
})

describe('office API security helpers', () => {
  it('allows only loopback browser origins by default', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:4173')).toBe(true)
    expect(isAllowedOrigin('https://evil.example')).toBe(false)
  })

  it('supports explicit origin allowlists from env', () => {
    const config = getOfficeApiConfig({
      OFFICE_API_ALLOWED_ORIGINS: 'https://office.example, https://preview.example',
    })
    expect(isAllowedOrigin('https://office.example', config)).toBe(true)
    expect(isAllowedOrigin('http://localhost:5173', config)).toBe(false)
  })

  it('echoes only allowed origins into CORS header', () => {
    const config = getOfficeApiConfig()
    expect(getAllowedOriginHeader('http://localhost:5173', config)).toBe('http://localhost:5173')
    expect(getAllowedOriginHeader('https://evil.example', config)).toBeNull()
  })

  it('treats token as optional unless configured', () => {
    expect(isAuthorizedOfficeRequest({ headers: {} }, getOfficeApiConfig({}))).toBe(true)
  })

  it('accepts x-office-token and bearer token when configured', () => {
    const config = getOfficeApiConfig({ OFFICE_API_TOKEN: 'secret-123' })
    expect(isAuthorizedOfficeRequest({ headers: { 'x-office-token': 'secret-123' } }, config)).toBe(true)
    expect(isAuthorizedOfficeRequest({ headers: { authorization: 'Bearer secret-123' } }, config)).toBe(true)
    expect(isAuthorizedOfficeRequest({ headers: { authorization: 'Bearer wrong' } }, config)).toBe(false)
  })

  it('rejects non-string header values even when token is configured', () => {
    const config = getOfficeApiConfig({ OFFICE_API_TOKEN: 'secret' })
    expect(isAuthorizedOfficeRequest({ headers: { 'x-office-token': null } }, config)).toBe(false)
    expect(isAuthorizedOfficeRequest({ headers: { 'x-office-token': 42 } }, config)).toBe(false)
    expect(isAuthorizedOfficeRequest({ headers: {} }, config)).toBe(false)
  })

  it('returns null for disallowed origins with explicit allowlist config', () => {
    const config = getOfficeApiConfig({ OFFICE_API_ALLOWED_ORIGINS: 'https://office.example' })
    expect(getAllowedOriginHeader('http://localhost:5173', config)).toBeNull()
    expect(getAllowedOriginHeader('https://office.example', config)).toBe('https://office.example')
  })
})
