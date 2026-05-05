/**
 * Tests for POST /api/auth/login
 *
 * Covers the happy path, bad-password rejection, setup-guard, and rate-limit
 * behaviour added in Phase 7.
 */

import { NextRequest } from 'next/server'
import { _resetStore } from '@/lib/rate-limit'

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockReadState  = jest.fn()
const mockVerify     = jest.fn()
const mockCreateToken = jest.fn(() => 'tok-abc')
const mockCookieOpts  = jest.fn(() => ({ name: 'session', value: 'tok-abc' }))

jest.mock('@/lib/state', () => ({ readState: () => mockReadState() }))
jest.mock('@/lib/auth', () => ({
  verifyPassword:       (...args: unknown[]) => mockVerify(...args),
  createSessionToken:   () => mockCreateToken(),
  sessionCookieOptions: (...args: unknown[]) => mockCookieOpts(...args),
}))

// Import the route **after** mocks are in place.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/auth/login/route') as typeof import('@/app/api/auth/login/route')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(body: Record<string, unknown>, ip = '1.2.3.4'): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method:  'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body:    JSON.stringify(body),
  })
}

const readyState = { setupComplete: true, adminPasswordHash: '$2b$10$hash' }

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  _resetStore()
  mockReadState.mockReturnValue(readyState)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  // Setup guard
  it('returns 400 when setup is not complete', async () => {
    mockReadState.mockReturnValue({ setupComplete: false })
    const res = await POST(makeReq({ password: 'x' }))
    expect(res.status).toBe(400)
  })

  // Happy path
  it('returns 200 and sets a session cookie on correct password', async () => {
    mockVerify.mockResolvedValue(true)
    const res = await POST(makeReq({ password: 'correct' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(mockCreateToken).toHaveBeenCalledTimes(1)
    expect(mockCookieOpts).toHaveBeenCalledWith('tok-abc')
  })

  // Wrong password
  it('returns 401 on wrong password (below limit)', async () => {
    mockVerify.mockResolvedValue(false)
    const res = await POST(makeReq({ password: 'bad' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/invalid password/i)
  })

  // Rate limiting — exceeded
  it('returns 429 after too many failed attempts', async () => {
    mockVerify.mockResolvedValue(false)

    // Exhaust the 5 default attempts.
    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ password: 'bad' }, '5.5.5.5'))
    }

    // The 6th attempt should be blocked.
    const res = await POST(makeReq({ password: 'bad' }, '5.5.5.5'))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    const body = await res.json()
    expect(body.error).toMatch(/too many/i)
  })

  // Rate limiting — IPs are isolated
  it('does not rate-limit a different IP', async () => {
    mockVerify.mockResolvedValue(false)

    for (let i = 0; i < 6; i++) {
      await POST(makeReq({ password: 'bad' }, '10.0.0.1'))
    }

    mockVerify.mockResolvedValue(true)
    const res = await POST(makeReq({ password: 'correct' }, '10.0.0.2'))
    expect(res.status).toBe(200)
  })

  // Rate limiting — cleared on success
  it('clears rate-limit history after a successful login', async () => {
    mockVerify.mockResolvedValue(false)

    // Build up 4 failures (below the 5-attempt limit).
    for (let i = 0; i < 4; i++) {
      await POST(makeReq({ password: 'bad' }, '7.7.7.7'))
    }

    // Now login successfully.
    mockVerify.mockResolvedValue(true)
    const okRes = await POST(makeReq({ password: 'correct' }, '7.7.7.7'))
    expect(okRes.status).toBe(200)

    // The counter should be reset — we can fail 4 more times without being limited.
    mockVerify.mockResolvedValue(false)
    for (let i = 0; i < 4; i++) {
      const res = await POST(makeReq({ password: 'bad' }, '7.7.7.7'))
      expect(res.status).toBe(401)
    }
  })

  // x-real-ip fallback
  it('uses x-real-ip header when x-forwarded-for is absent', async () => {
    mockVerify.mockResolvedValue(false)
    const req = new NextRequest('http://localhost/api/auth/login', {
      method:  'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '9.9.9.9' },
      body:    JSON.stringify({ password: 'bad' }),
    })

    // Exhaust 5 attempts from this IP via x-real-ip.
    for (let i = 0; i < 5; i++) {
      const r = new NextRequest('http://localhost/api/auth/login', {
        method:  'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '9.9.9.9' },
        body:    JSON.stringify({ password: 'bad' }),
      })
      await POST(r)
    }

    const res = await POST(req)
    expect(res.status).toBe(429)
  })
})
