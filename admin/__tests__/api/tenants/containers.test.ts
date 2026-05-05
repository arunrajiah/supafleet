/**
 * Tests for POST /api/tenants/[name]/containers
 */

import { NextRequest } from 'next/server'

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockIsAuthenticated = jest.fn()
const mockReadTenantConfig = jest.fn()
const mockRestartAll = jest.fn()
const mockRestartSingle = jest.fn()
const mockUpgrade = jest.fn()

jest.mock('@/lib/auth',   () => ({ isAuthenticated: () => mockIsAuthenticated() }))
jest.mock('@/lib/tenant', () => ({
  readTenantConfig:             (...a: unknown[]) => mockReadTenantConfig(...a),
  restartTenantContainers:      (...a: unknown[]) => mockRestartAll(...a),
  restartSingleTenantContainer: (...a: unknown[]) => mockRestartSingle(...a),
  upgradeTenant:                (...a: unknown[]) => mockUpgrade(...a),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/tenants/[name]/containers/route') as
  typeof import('@/app/api/tenants/[name]/containers/route')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/tenants/myapp/containers', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const FAKE_PARAMS = { params: Promise.resolve({ name: 'myapp' }) }

beforeEach(() => {
  jest.clearAllMocks()
  mockIsAuthenticated.mockResolvedValue(true)
  mockReadTenantConfig.mockReturnValue({ name: 'myapp' })
  mockRestartAll.mockResolvedValue(undefined)
  mockRestartSingle.mockResolvedValue(undefined)
  mockUpgrade.mockResolvedValue(undefined)
})

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('auth guard', () => {
  it('returns 401 when not authenticated', async () => {
    mockIsAuthenticated.mockResolvedValue(false)
    const res = await POST(makeReq({ action: 'restart' }), FAKE_PARAMS)
    expect(res.status).toBe(401)
  })
})

// ── 404 when tenant is unknown ────────────────────────────────────────────────

describe('tenant lookup', () => {
  it('returns 404 when tenant does not exist', async () => {
    mockReadTenantConfig.mockReturnValue(null)
    const res = await POST(makeReq({ action: 'restart' }), FAKE_PARAMS)
    expect(res.status).toBe(404)
  })
})

// ── restart ───────────────────────────────────────────────────────────────────

describe('action: restart', () => {
  it('calls restartTenantContainers with the tenant name', async () => {
    const res = await POST(makeReq({ action: 'restart' }), FAKE_PARAMS)
    expect(res.status).toBe(200)
    expect(mockRestartAll).toHaveBeenCalledWith('myapp')
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.action).toBe('restart')
  })
})

// ── restart-service ───────────────────────────────────────────────────────────

describe('action: restart-service', () => {
  it.each(['auth', 'rest', 'storage'])('restarts service %s', async (svc) => {
    const res = await POST(makeReq({ action: 'restart-service', service: svc }), FAKE_PARAMS)
    expect(res.status).toBe(200)
    expect(mockRestartSingle).toHaveBeenCalledWith('myapp', svc)
    const body = await res.json()
    expect(body.service).toBe(svc)
  })

  it('returns 400 when service is missing', async () => {
    const res = await POST(makeReq({ action: 'restart-service' }), FAKE_PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 400 when service is invalid', async () => {
    const res = await POST(makeReq({ action: 'restart-service', service: 'db' }), FAKE_PARAMS)
    expect(res.status).toBe(400)
  })
})

// ── upgrade ───────────────────────────────────────────────────────────────────

describe('action: upgrade', () => {
  it('calls upgradeTenant with the tenant name', async () => {
    const res = await POST(makeReq({ action: 'upgrade' }), FAKE_PARAMS)
    expect(res.status).toBe(200)
    expect(mockUpgrade).toHaveBeenCalledWith('myapp')
    const body = await res.json()
    expect(body.action).toBe('upgrade')
  })
})

// ── unknown action ────────────────────────────────────────────────────────────

describe('unknown action', () => {
  it('returns 400 for an unrecognised action', async () => {
    const res = await POST(makeReq({ action: 'nuke' }), FAKE_PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/action must be one of/i)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/tenants/myapp/containers', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    'not-json',
    })
    const res = await POST(req, FAKE_PARAMS)
    expect(res.status).toBe(400)
  })
})
